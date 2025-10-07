import { GraphOutputStream, GraphTypes } from '@inworld/runtime/graph';
import { v4 } from 'uuid';
import { RawData } from 'ws';

import { INPUT_SAMPLE_RATE } from '../constants';
import {
  AudioInput,
  ChatMessage,
  EVENT_TYPE,
  State,
  TextInput,
} from '../types';
import { InworldApp } from './app';
import { AudioHandler, AudioHandlerCallbacks } from './audio_handler';
import { EventFactory } from './event_factory';
import { InworldGraphWrapper } from './graph';

const WavEncoder = require('wav-encoder');

export class MessageHandler {
  private INPUT_SAMPLE_RATE = INPUT_SAMPLE_RATE;
  private interruptionEnabled: boolean;
  private currentInteractionId: string = v4();

  // Keep track of the processing queue to avoid concurrent execution of the graph
  // within the same session.
  private processingQueue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  private audioHandler: AudioHandler;

  constructor(
    private inworldApp: InworldApp,
    private send: (data: any) => void,
  ) {
    this.interruptionEnabled = inworldApp.interruptionEnabled;

    const audioHandlerCallbacks: AudioHandlerCallbacks = {
      onNewInteractionRequested: () => {
        return this.createNewInteraction(
          'Starting a new interaction from speech',
        );
      },
      onSpeechCaptured: (key: string, speechBuffer: number[]) => {
        this.processCapturedSpeech(key, speechBuffer);
      },
    };

    this.audioHandler = new AudioHandler(
      inworldApp.vadClient,
      audioHandlerCallbacks,
    );
  }

  private createNewInteraction(logMessage: string): string {
    this.currentInteractionId = v4();
    console.log(logMessage, this.currentInteractionId);
    this.send(
      EventFactory.newInteraction(
        this.currentInteractionId,
        this.interruptionEnabled,
      ),
    );
    return this.currentInteractionId;
  }

  async handleMessage(data: RawData, key: string) {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case EVENT_TYPE.TEXT:
        this.createNewInteraction('Starting a new interaction from text input');

        let input = {
          text: message.text,
          interactionId: this.currentInteractionId,
          key,
        } as TextInput;

        this.addToQueue(() =>
          this.executeGraph({
            key,
            input,
            interactionId: this.currentInteractionId,
            graphWrapper: this.inworldApp.graphWithTextInput,
          }),
        );

        break;

      case EVENT_TYPE.AUDIO:
        await this.audioHandler.processAudioChunk(message, key);
        break;

      case EVENT_TYPE.AUDIO_SESSION_END:
        this.audioHandler.endAudioSession(key);
        break;
    }
  }

  private processCapturedSpeech(key: string, speechBuffer: number[]) {
    let input: AudioInput | null = null;

    try {
      input = {
        audio: {
          // Normalize to get consistent input regardless of how loud or quiet the user's microphone input is.
          // Avoid normalizing before VAD else quiet ambient sound can be amplified and trigger VAD.
          data: this.audioHandler.normalizeAudio(speechBuffer),
          sampleRate: this.INPUT_SAMPLE_RATE,
        },
        interactionId: this.currentInteractionId,
        key,
      } as AudioInput;

      this.addToQueue(() =>
        this.executeGraph({
          key,
          input,
          interactionId: this.currentInteractionId,
          graphWrapper: this.inworldApp.graphWithAudioInput,
        }),
      );
    } catch (error) {
      console.error('Error processing captured speech:', error.message);
    }
  }

  private async executeGraph({
    key,
    input,
    interactionId,
    graphWrapper,
  }: {
    key: string;
    input: TextInput | AudioInput;
    interactionId: string;
    graphWrapper: InworldGraphWrapper;
  }) {
    const { outputStream } = graphWrapper.graph.start(input);

    await this.handleResponse(
      outputStream,
      interactionId,
      this.inworldApp.connections[key].state,
    );

    this.send(EventFactory.interactionEnd(interactionId));

    graphWrapper.graph.closeExecution(outputStream);
  }

  private async handleResponse(
    outputStream: GraphOutputStream,
    interactionId: string,
    state: State,
  ) {
    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      id: interactionId,
    };

    try {
      const result = await outputStream.next();
      if (
        this.interruptionEnabled &&
        this.currentInteractionId !== interactionId
      ) {
        console.log(
          'Interaction ID mismatch, skipping response',
          this.currentInteractionId,
          interactionId,
        );
        return;
      }

      await result.processResponse({
        TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
          for await (const chunk of ttsStream) {
            if (
              this.interruptionEnabled &&
              this.currentInteractionId !== interactionId
            ) {
              console.log(
                'Interaction ID mismatch, skipping response',
                this.currentInteractionId,
                interactionId,
              );
              return;
            }
            responseMessage.content += chunk.text;

            const audioBuffer = await WavEncoder.encode({
              sampleRate: chunk.audio.sampleRate,
              channelData: [new Float32Array(chunk.audio.data)],
            });

            const textPacket = EventFactory.text(chunk.text, interactionId, {
              isAgent: true,
              name: state.agent.id,
            });

            this.send(textPacket);
            this.send(
              EventFactory.audio(
                Buffer.from(audioBuffer).toString('base64'),
                interactionId,
                textPacket.packetId.utteranceId,
              ),
            );

            // Update the message content.
            const message = state.messages.find(
              (m) => m.id === interactionId && m.role === 'assistant',
            );
            if (message) {
              message.content = responseMessage.content;
            } else {
              state.messages.push(responseMessage);
            }
          }
        },
      });
    } catch (error) {
      console.error(error);
      const errorPacket = EventFactory.error(error, interactionId);
      // Ignore errors caused by empty speech.
      if (!errorPacket.error.includes('recognition produced no text')) {
        this.send(errorPacket);
      }
    }
  }

  private addToQueue(task: () => Promise<void>) {
    this.processingQueue.push(task);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    while (this.processingQueue.length > 0) {
      const task = this.processingQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Error processing task from queue:', error);
        }
      }
    }
    this.isProcessing = false;
  }
}
