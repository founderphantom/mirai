import {
  FRAME_PER_BUFFER,
  INPUT_SAMPLE_RATE,
  MIN_AUDIO_ENERGY,
  MIN_SPEECH_DURATION_MS,
  PAUSE_DURATION_THRESHOLD_MS,
  PRE_ROLL_MS,
  SPEECH_THRESHOLD,
} from '../constants';

export interface AudioHandlerCallbacks {
  onNewInteractionRequested: () => string;
  onSpeechCaptured: (key: string, speechBuffer: number[]) => void;
}

export class AudioHandler {
  private INPUT_SAMPLE_RATE = INPUT_SAMPLE_RATE;
  private FRAME_PER_BUFFER = FRAME_PER_BUFFER;
  private PAUSE_DURATION_THRESHOLD_MS = PAUSE_DURATION_THRESHOLD_MS;
  private MIN_SPEECH_DURATION_SAMPLES = Math.floor(
    (MIN_SPEECH_DURATION_MS * INPUT_SAMPLE_RATE) / 1000,
  );
  private PRE_ROLL_MAX_SAMPLES = Math.floor(
    (this.INPUT_SAMPLE_RATE * PRE_ROLL_MS) / 1000,
  );

  private pauseDuration = 0;
  private isCapturingSpeech = false;
  private speechBuffer: number[] = [];

  // Keep track of the audio buffer until the frame size is reached for VAD.
  private audioBuffer: any[] = [];
  // Keep track of the pre-roll buffer to avoid clipping the onset of the speech.
  private preRollBuffer: number[];

  // Keep track to avoid creating multiple interactions for the same continuous user speech.
  private currentAudioInteractionRegistered: boolean = false;

  constructor(
    private vadClient: any,
    private callbacks: AudioHandlerCallbacks,
  ) {
    this.initializePreRollWithSilence();
  }

  private initializePreRollWithSilence(): void {
    this.preRollBuffer = new Array(this.PRE_ROLL_MAX_SAMPLES).fill(0);
  }

  async processAudioChunk(message: any, key: string) {
    // Add audio chunks to the audio buffer until the frame size is reached for VAD.
    for (let i = 0; i < message.audio.length; i++) {
      Object.values(message.audio[i]).forEach((value) => {
        this.audioBuffer.push(value);
      });
    }

    if (this.audioBuffer.length < this.FRAME_PER_BUFFER) {
      return;
    }

    const audioChunk = {
      data: this.audioBuffer,
      sampleRate: this.INPUT_SAMPLE_RATE,
    };
    this.audioBuffer = [];

    const vadResult = await this.vadClient.detectVoiceActivity(
      audioChunk,
      SPEECH_THRESHOLD,
    );

    if (this.isCapturingSpeech) {
      this.speechBuffer.push(...audioChunk.data);

      let speechDetected = false;
      let shouldCreateInteraction = false;

      if (
        this.speechBuffer.length >
        this.MIN_SPEECH_DURATION_SAMPLES + this.PRE_ROLL_MAX_SAMPLES
      ) {
        speechDetected = true;

        // Check audio energy BEFORE creating interaction to prevent empty inputs
        if (!this.currentAudioInteractionRegistered) {
          const energy = this.calculateEnergy(this.speechBuffer);

          // Only create interaction if audio has sufficient energy
          if (energy >= MIN_AUDIO_ENERGY) {
            shouldCreateInteraction = true;
            console.log(`[AudioHandler] Creating interaction - energy sufficient: ${energy.toFixed(4)}`);
          } else {
            console.log(`[AudioHandler] Skipping interaction - energy too low: ${energy.toFixed(4)} < ${MIN_AUDIO_ENERGY}`);
            // Reset state to avoid creating interaction for this audio
            this.isCapturingSpeech = false;
            this.speechBuffer = [];
            this.pauseDuration = 0;
            return;
          }
        }

        // Create interaction only after energy check passes
        if (shouldCreateInteraction) {
          this.callbacks.onNewInteractionRequested();
          this.currentAudioInteractionRegistered = true;
        }
      }

      if (vadResult === -1) {
        // Already capturing speech but new chunk has no voice activity.
        this.pauseDuration +=
          (audioChunk.data.length * 1000) / this.INPUT_SAMPLE_RATE;

        // If the pause duration is greater than the threshold, stop capturing speech.
        if (this.pauseDuration > this.PAUSE_DURATION_THRESHOLD_MS) {
          this.isCapturingSpeech = false;

          // If speech is detected AND interaction was registered, capture the speech.
          if (speechDetected && this.currentAudioInteractionRegistered) {
            this.currentAudioInteractionRegistered = false;
            this.callbacks.onSpeechCaptured(
              key,
              [...this.speechBuffer], // Create a copy
            );
            this.speechBuffer = [];
          } else if (!this.currentAudioInteractionRegistered) {
            // Speech was detected but didn't meet energy threshold, discard
            console.log('[AudioHandler] Discarding low-energy speech buffer');
            this.speechBuffer = [];
          }
        }
      } else {
        // Already capturing speech and new chunk has voice activity
        this.pauseDuration = 0;
      }
    } else {
      if (vadResult !== -1) {
        // Not capturing speech but new chunk has voice activity.
        // Start capturing and prepend pre-roll to avoid clipped onset
        this.isCapturingSpeech = true;
        this.speechBuffer.push(...this.preRollBuffer);
        this.initializePreRollWithSilence();
        this.speechBuffer.push(...audioChunk.data);
        this.pauseDuration = 0;
      } else {
        // Not capturing speech and new chunk has no voice activity.
        // Maintain pre-roll while idle - replace oldest samples with new ones
        this.preRollBuffer.splice(0, audioChunk.data.length);
        this.preRollBuffer.push(...audioChunk.data);
      }
    }
  }

  endAudioSession(key: string): void {
    this.pauseDuration = 0;
    this.isCapturingSpeech = false;
    this.currentAudioInteractionRegistered = false;
    // Reinitialize with silence instead of empty array
    this.initializePreRollWithSilence();

    if (this.speechBuffer.length > 0) {
      this.callbacks.onSpeechCaptured(
        key,
        [...this.speechBuffer], // Create a copy
      );
      this.speechBuffer = [];
    }
  }

  /**
   * Calculate RMS (Root Mean Square) energy of audio buffer
   * Returns value between 0.0 (silence) and 1.0 (full scale)
   */
  private calculateEnergy(audioBuffer: number[]): number {
    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      sum += audioBuffer[i] * audioBuffer[i];
    }
    return Math.sqrt(sum / audioBuffer.length);
  }

  /**
   * Normalize audio only if it meets minimum energy threshold
   * Returns null if audio is too quiet (likely background noise)
   */
  normalizeAudio(audioBuffer: number[]): number[] | null {
    // Calculate energy before normalization
    const energy = this.calculateEnergy(audioBuffer);

    // Reject audio that's too quiet (background noise)
    if (energy < MIN_AUDIO_ENERGY) {
      console.log(`[AudioHandler] Audio rejected - energy too low: ${energy.toFixed(4)} < ${MIN_AUDIO_ENERGY}`);
      return null;
    }

    let maxVal = 0;
    // Find maximum absolute value
    for (let i = 0; i < audioBuffer.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(audioBuffer[i]));
    }

    if (maxVal === 0) {
      console.log('[AudioHandler] Audio rejected - all samples are zero');
      return null;
    }

    // Only normalize if maxVal is reasonable (not too quiet)
    if (maxVal < 0.01) {
      console.log(`[AudioHandler] Audio rejected - max amplitude too low: ${maxVal.toFixed(4)}`);
      return null;
    }

    // Create normalized copy
    const normalizedBuffer = [];
    for (let i = 0; i < audioBuffer.length; i++) {
      normalizedBuffer.push(audioBuffer[i] / maxVal);
    }

    console.log(`[AudioHandler] Audio accepted - energy: ${energy.toFixed(4)}, maxVal: ${maxVal.toFixed(4)}`);
    return normalizedBuffer;
  }
}
