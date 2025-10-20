import {
  CONTINUATION_WINDOW_MS,
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

  // Continuation window: Track when speech was last captured to detect continuations
  private lastSpeechCapturedTime: number = 0;
  private currentInteractionKey: string = '';
  private isInContinuationWindow: boolean = false;

  // Per-session calibrated thresholds (overrides global constants)
  private calibratedSpeechThreshold: number = SPEECH_THRESHOLD;
  private calibratedMinAudioEnergy: number = MIN_AUDIO_ENERGY;

  // VAD Hysteresis: Track last N VAD results to smooth out noisy frame-by-frame decisions
  private readonly VAD_SMOOTHING_WINDOW = 5; // Track last 5 frames (5 * 64ms = 320ms window)
  private vadResultHistory: number[] = []; // Stores last N VAD results (-1 = silence, 1 = speech)

  constructor(
    private vadClient: any,
    private callbacks: AudioHandlerCallbacks,
  ) {
    this.initializePreRollWithSilence();
  }

  /**
   * Set calibrated thresholds for this session
   * Called after VAD calibration completes
   */
  setCalibratedThresholds(speechThreshold: number, minAudioEnergy: number): void {
    console.log('[AudioHandler] Setting calibrated thresholds:', {
      speechThreshold,
      minAudioEnergy,
      previousSpeechThreshold: this.calibratedSpeechThreshold,
      previousMinAudioEnergy: this.calibratedMinAudioEnergy
    });
    this.calibratedSpeechThreshold = speechThreshold;
    this.calibratedMinAudioEnergy = minAudioEnergy;
  }

  /**
   * Apply VAD smoothing using majority vote over last N frames
   * This prevents single-frame false positives from ending speech capture
   *
   * @param rawVadResult - Current frame's VAD result (-1 = silence, >= 0 = speech)
   * @returns Smoothed VAD result (-1 = silence, 1 = speech)
   */
  private smoothVADResult(rawVadResult: number): number {
    // Convert raw result to binary: -1 for silence, 1 for speech
    const binaryResult = rawVadResult === -1 ? -1 : 1;

    // Add to history
    this.vadResultHistory.push(binaryResult);

    // Keep only last N results
    if (this.vadResultHistory.length > this.VAD_SMOOTHING_WINDOW) {
      this.vadResultHistory.shift();
    }

    // Not enough history yet, return raw result
    if (this.vadResultHistory.length < this.VAD_SMOOTHING_WINDOW) {
      return binaryResult;
    }

    // Majority vote: count speech frames (1) vs silence frames (-1)
    const speechCount = this.vadResultHistory.filter(r => r === 1).length;
    const silenceCount = this.vadResultHistory.filter(r => r === -1).length;

    // Return majority decision
    return speechCount > silenceCount ? 1 : -1;
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

    const rawVadResult = await this.vadClient.detectVoiceActivity(
      audioChunk,
      this.calibratedSpeechThreshold,
    );

    // Apply smoothing to prevent false pauses from noisy frame-by-frame VAD decisions
    const vadResult = this.smoothVADResult(rawVadResult);

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
          if (energy >= this.calibratedMinAudioEnergy) {
            // Check if we're within the continuation window
            const timeSinceLastCapture = Date.now() - this.lastSpeechCapturedTime;
            const isWithinContinuationWindow =
              this.lastSpeechCapturedTime > 0 &&
              timeSinceLastCapture < CONTINUATION_WINDOW_MS;

            if (isWithinContinuationWindow) {
              // Reuse existing interaction (continuation of previous speech)
              console.log(`[AudioHandler] Continuation detected (${timeSinceLastCapture}ms since last capture) - reusing interaction`);
              this.currentAudioInteractionRegistered = true;
              this.isInContinuationWindow = true; // Mark that we're in a continuation
            } else {
              // Create new interaction
              shouldCreateInteraction = true;
              this.isInContinuationWindow = false; // Not in continuation window
              console.log(`[AudioHandler] Creating new interaction - energy sufficient: ${energy.toFixed(4)}`);
            }
          } else {
            console.log(`[AudioHandler] Skipping interaction - energy too low: ${energy.toFixed(4)} < ${this.calibratedMinAudioEnergy}`);
            // Reset state to avoid creating interaction for this audio
            this.isCapturingSpeech = false;
            this.speechBuffer = [];
            this.pauseDuration = 0;
            return;
          }
        }

        // Create interaction only after energy check passes and if not a continuation
        if (shouldCreateInteraction) {
          const newKey = this.callbacks.onNewInteractionRequested();
          this.currentInteractionKey = newKey;
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

          // If speech is detected AND interaction was registered, validate final buffer energy
          if (speechDetected && this.currentAudioInteractionRegistered) {
            // Final energy check on complete speech buffer to prevent sending low-quality audio
            const finalEnergy = this.calculateEnergy(this.speechBuffer);

            if (finalEnergy >= this.calibratedMinAudioEnergy) {
              // If in continuation window, discard this capture to prevent sending split messages
              if (this.isInContinuationWindow) {
                console.log(`[AudioHandler] Discarding continuation speech to prevent split messages - duration: ${((this.speechBuffer.length / this.INPUT_SAMPLE_RATE) * 1000).toFixed(0)}ms`);
                this.currentAudioInteractionRegistered = false;
                this.isInContinuationWindow = false; // Reset continuation flag
                this.speechBuffer = [];
                // Don't update lastSpeechCapturedTime to allow the continuation window to expire naturally
              } else {
                // Normal speech capture
                this.currentAudioInteractionRegistered = false;
                this.lastSpeechCapturedTime = Date.now(); // Track when speech was captured for continuation detection
                this.callbacks.onSpeechCaptured(
                  key,
                  [...this.speechBuffer], // Create a copy
                );
                console.log(`[AudioHandler] Speech captured - final energy: ${finalEnergy.toFixed(4)}, duration: ${((this.speechBuffer.length / this.INPUT_SAMPLE_RATE) * 1000).toFixed(0)}ms`);
                this.speechBuffer = [];
              }
            } else {
              console.log(`[AudioHandler] Discarding speech - final energy too low: ${finalEnergy.toFixed(4)} < ${this.calibratedMinAudioEnergy}`);
              this.currentAudioInteractionRegistered = false;
              this.isInContinuationWindow = false; // Reset continuation flag
              this.speechBuffer = [];
            }
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
    // Reset VAD history for clean state in next session
    this.vadResultHistory = [];
    // Reset continuation window on session end
    this.lastSpeechCapturedTime = 0;
    this.currentInteractionKey = '';
    this.isInContinuationWindow = false;

    if (this.speechBuffer.length > 0) {
      // Final energy check before sending
      const finalEnergy = this.calculateEnergy(this.speechBuffer);

      if (finalEnergy >= this.calibratedMinAudioEnergy) {
        this.lastSpeechCapturedTime = Date.now(); // Track speech capture time
        this.callbacks.onSpeechCaptured(
          key,
          [...this.speechBuffer], // Create a copy
        );
        console.log(`[AudioHandler] Session ended - speech captured with energy: ${finalEnergy.toFixed(4)}`);
      } else {
        console.log(`[AudioHandler] Session ended - discarding low-energy speech: ${finalEnergy.toFixed(4)} < ${this.calibratedMinAudioEnergy}`);
      }
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
    if (energy < this.calibratedMinAudioEnergy) {
      console.log(`[AudioHandler] Audio rejected - energy too low: ${energy.toFixed(4)} < ${this.calibratedMinAudioEnergy}`);
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
