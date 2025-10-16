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
import { VADCalibrator, CalibrationProgress } from './vad_calibrator';
import { getMetricsTracker } from './metrics_tracker';

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
  private vadCalibrator: VADCalibrator;
  private isCalibrating: boolean = false;

  private metricsTracker = getMetricsTracker();
  private sessionKey: string = '';
  private chunkCounters: Map<string, number> = new Map();

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

    this.vadCalibrator = new VADCalibrator();
  }

  /**
   * Initialize metrics tracking for this session
   */
  initSession(sessionKey: string): void {
    this.sessionKey = sessionKey;
    this.metricsTracker.initSession(sessionKey);
    console.log('[MessageHandler] Session initialized for metrics:', sessionKey);
  }

  /**
   * Start VAD calibration for this session
   * Should be called when session starts, before normal audio processing
   */
  startCalibration(): void {
    console.log('[MessageHandler] Starting VAD calibration');
    this.isCalibrating = true;
    this.vadCalibrator.startCalibration();

    // Send calibration start event to client
    this.send({
      type: 'CALIBRATION_START',
      message: 'Adjusting microphone...'
    });
  }

  private createNewInteraction(logMessage: string): string {
    this.currentInteractionId = v4();
    console.log(logMessage, this.currentInteractionId);

    // Start metrics tracking for this interaction
    this.metricsTracker.startInteraction(this.sessionKey, this.currentInteractionId);
    this.chunkCounters.set(this.currentInteractionId, 0);

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
        // Text input always works, even during calibration
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
        // Route audio to calibration or normal processing
        if (this.isCalibrating) {
          await this.handleCalibrationAudio(message);
        } else {
          await this.audioHandler.processAudioChunk(message, key);
        }
        break;

      case EVENT_TYPE.AUDIO_SESSION_END:
        if (!this.isCalibrating) {
          this.audioHandler.endAudioSession(key);
        }
        break;
    }
  }

  /**
   * Handle audio during calibration phase
   */
  private async handleCalibrationAudio(message: any): Promise<void> {
    // Extract audio data from message
    const audioData: number[] = [];
    for (let i = 0; i < message.audio.length; i++) {
      Object.values(message.audio[i]).forEach((value) => {
        audioData.push(value as number);
      });
    }

    // Add to calibration buffer
    const progress = this.vadCalibrator.addCalibrationSample(audioData);

    if (!progress) {
      return;
    }

    // Send progress update to client
    this.send({
      type: 'CALIBRATION_PROGRESS',
      phase: progress.phase,
      progress: progress.progress,
      message: progress.message
    });

    // Check if calibration is complete
    if (progress.phase === 'complete') {
      this.completeCalibration();
    }
  }

  /**
   * Complete calibration and apply thresholds
   */
  private completeCalibration(): void {
    console.log('[MessageHandler] Completing VAD calibration');

    // Calculate optimal thresholds
    const calibrationResult = this.vadCalibrator.calculateThresholds();

    // Apply thresholds to audio handler
    this.audioHandler.setCalibratedThresholds(
      calibrationResult.speechThreshold,
      calibrationResult.minAudioEnergy
    );

    // Mark calibration as complete
    this.isCalibrating = false;

    // Send completion event to client
    this.send({
      type: 'CALIBRATION_COMPLETE',
      result: {
        speechThreshold: calibrationResult.speechThreshold,
        minAudioEnergy: calibrationResult.minAudioEnergy,
        backgroundNoiseLevel: calibrationResult.backgroundNoiseLevel,
        speechLevel: calibrationResult.speechLevel
      },
      message: 'Microphone calibrated successfully'
    });

    console.log('[MessageHandler] VAD calibration complete:', calibrationResult);
  }

  private processCapturedSpeech(key: string, speechBuffer: number[]) {
    let input: AudioInput | null = null;

    try {
      // Normalize audio and check energy threshold
      // Returns null if audio is too quiet (background noise)
      const normalizedAudio = this.audioHandler.normalizeAudio(speechBuffer);

      // Skip sending to STT if audio was rejected (too quiet/noise)
      if (!normalizedAudio) {
        console.log('[MessageHandler] Skipping speech processing - audio rejected by energy filter');
        return;
      }

      input = {
        audio: {
          // Normalize to get consistent input regardless of how loud or quiet the user's microphone input is.
          // Avoid normalizing before VAD else quiet ambient sound can be amplified and trigger VAD.
          data: normalizedAudio,
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
    try {
      // Record STT start for audio input
      if ('audio' in input) {
        this.metricsTracker.recordSTTStart(interactionId);
      }

      // Record LLM start
      this.metricsTracker.recordLLMStart(interactionId);

      const { outputStream } = graphWrapper.graph.start(input);

      await this.handleResponse(
        outputStream,
        interactionId,
        this.inworldApp.connections[key].state,
      );

      this.send(EventFactory.interactionEnd(interactionId));

      // End interaction with success
      this.metricsTracker.endInteraction(interactionId, true);

      graphWrapper.graph.closeExecution(outputStream);
    } catch (error) {
      console.error('[MessageHandler] Error in executeGraph:', error);
      // End interaction with failure
      this.metricsTracker.endInteraction(interactionId, false);
      throw error;
    } finally {
      // Clean up chunk counter
      this.chunkCounters.delete(interactionId);
    }
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
          // Track if we've received any text (for STT success)
          let receivedText = false;
          let fullText = '';

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
            fullText += chunk.text;
            receivedText = true;

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

            // Record audio chunk metrics
            const chunkIndex = this.chunkCounters.get(interactionId) || 0;
            this.metricsTracker.recordAudioChunk(
              interactionId,
              chunkIndex,
              chunk.text.length,
              chunk.audio.data.length
            );
            this.chunkCounters.set(interactionId, chunkIndex + 1);

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

          // Record STT completion if text was received
          if (receivedText) {
            this.metricsTracker.recordSTTComplete(interactionId, fullText, true);
            this.metricsTracker.recordLLMComplete(interactionId);
          }
        },
      });
    } catch (error) {
      console.error(error);
      const errorPacket = EventFactory.error(error, interactionId);

      // Record STT error if it's a speech recognition error
      if (errorPacket.error.includes('recognition') || errorPacket.error.includes('STT')) {
        this.metricsTracker.recordSTTError(interactionId, errorPacket.error);
      }

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
