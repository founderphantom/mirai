/**
 * VAD Calibrator - Per-Session Voice Activity Detection Calibration
 *
 * Problem: Different users have different speaking volumes and background noise levels
 * Solution: 3-second calibration step at session start to measure user's audio environment
 *
 * Calibration Process:
 * 1. Collect 3 seconds of audio samples
 * 2. Measure background noise level (RMS energy when silent)
 * 3. Measure speech level (RMS energy when speaking)
 * 4. Calculate optimal SPEECH_THRESHOLD and MIN_AUDIO_ENERGY for this session
 */

import { INPUT_SAMPLE_RATE, FRAME_PER_BUFFER } from '../constants';

export interface CalibrationResult {
  speechThreshold: number;
  minAudioEnergy: number;
  backgroundNoiseLevel: number;
  speechLevel: number;
}

export interface CalibrationProgress {
  phase: 'collecting' | 'analyzing' | 'complete';
  progress: number; // 0-100
  message: string;
}

export class VADCalibrator {
  private readonly CALIBRATION_DURATION_MS = 3000; // 3 seconds
  private readonly CALIBRATION_SAMPLES = Math.floor(
    (this.CALIBRATION_DURATION_MS * INPUT_SAMPLE_RATE) / 1000
  );

  private calibrationBuffer: number[] = [];
  private isCalibrating = false;
  private calibrationStartTime: number = 0;

  // Track separate buffers for silence and speech detection
  private silenceBuffers: number[][] = [];
  private speechBuffers: number[][] = [];

  /**
   * Start calibration process
   */
  startCalibration(): void {
    console.log('[VADCalibrator] Starting calibration...');
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.calibrationBuffer = [];
    this.silenceBuffers = [];
    this.speechBuffers = [];
  }

  /**
   * Add audio chunk to calibration buffer
   * Returns calibration progress or null if not calibrating
   */
  addCalibrationSample(audioData: number[]): CalibrationProgress | null {
    if (!this.isCalibrating) {
      return null;
    }

    this.calibrationBuffer.push(...audioData);

    // Classify this chunk as silence or speech based on simple energy threshold
    const energy = this.calculateEnergy(audioData);

    // Simple heuristic: if energy > 0.02, likely speech; otherwise silence
    if (energy > 0.02) {
      this.speechBuffers.push([...audioData]);
    } else {
      this.silenceBuffers.push([...audioData]);
    }

    const progress = Math.min(
      100,
      (this.calibrationBuffer.length / this.CALIBRATION_SAMPLES) * 100
    );

    // Check if calibration is complete
    if (this.calibrationBuffer.length >= this.CALIBRATION_SAMPLES) {
      this.isCalibrating = false;

      return {
        phase: 'complete',
        progress: 100,
        message: 'Calibration complete'
      };
    }

    // Return progress
    const elapsed = Date.now() - this.calibrationStartTime;
    const remaining = this.CALIBRATION_DURATION_MS - elapsed;

    return {
      phase: 'collecting',
      progress: Math.floor(progress),
      message: `Calibrating microphone... ${Math.ceil(remaining / 1000)}s`
    };
  }

  /**
   * Analyze calibration data and calculate optimal thresholds
   */
  calculateThresholds(): CalibrationResult {
    console.log('[VADCalibrator] Analyzing calibration data...');
    console.log(`[VADCalibrator] Total samples: ${this.calibrationBuffer.length}`);
    console.log(`[VADCalibrator] Silence chunks: ${this.silenceBuffers.length}`);
    console.log(`[VADCalibrator] Speech chunks: ${this.speechBuffers.length}`);

    // Calculate background noise level (average of silence samples)
    let backgroundNoiseLevel = 0;
    if (this.silenceBuffers.length > 0) {
      const silenceEnergies = this.silenceBuffers.map(chunk => this.calculateEnergy(chunk));
      backgroundNoiseLevel = silenceEnergies.reduce((sum, e) => sum + e, 0) / silenceEnergies.length;
    } else {
      // If no silence detected, use very low default
      backgroundNoiseLevel = 0.005;
    }

    // Calculate speech level (average of speech samples)
    let speechLevel = 0;
    if (this.speechBuffers.length > 0) {
      const speechEnergies = this.speechBuffers.map(chunk => this.calculateEnergy(chunk));
      speechLevel = speechEnergies.reduce((sum, e) => sum + e, 0) / speechEnergies.length;
    } else {
      // If no speech detected during calibration, use default
      speechLevel = 0.1;
    }

    // Calculate optimal thresholds based on measured levels
    // Speech threshold: Set to detect speech that's significantly above background noise
    // Use 0.8-0.95 range, calibrated based on signal-to-noise ratio
    const signalToNoiseRatio = speechLevel / (backgroundNoiseLevel + 0.001); // Avoid division by zero
    let speechThreshold: number;

    if (signalToNoiseRatio > 10) {
      // Very clean audio, can use higher threshold
      speechThreshold = 0.95;
    } else if (signalToNoiseRatio > 5) {
      // Good audio quality
      speechThreshold = 0.90;
    } else if (signalToNoiseRatio > 3) {
      // Moderate background noise
      speechThreshold = 0.85;
    } else {
      // Noisy environment, use lower threshold but not too low
      speechThreshold = 0.80;
    }

    // Min audio energy: Set slightly above background noise level
    // This prevents background noise from being processed as speech
    const minAudioEnergy = Math.max(
      backgroundNoiseLevel * 2.5, // 2.5x above background noise
      0.015 // Absolute minimum threshold
    );

    console.log('[VADCalibrator] Calibration results:');
    console.log(`  Background noise level: ${backgroundNoiseLevel.toFixed(4)}`);
    console.log(`  Speech level: ${speechLevel.toFixed(4)}`);
    console.log(`  Signal-to-noise ratio: ${signalToNoiseRatio.toFixed(2)}`);
    console.log(`  Calculated speech threshold: ${speechThreshold.toFixed(2)}`);
    console.log(`  Calculated min audio energy: ${minAudioEnergy.toFixed(4)}`);

    return {
      speechThreshold,
      minAudioEnergy,
      backgroundNoiseLevel,
      speechLevel
    };
  }

  /**
   * Calculate RMS (Root Mean Square) energy of audio buffer
   * Returns value between 0.0 (silence) and 1.0 (full scale)
   */
  private calculateEnergy(audioBuffer: number[]): number {
    if (audioBuffer.length === 0) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      sum += audioBuffer[i] * audioBuffer[i];
    }
    return Math.sqrt(sum / audioBuffer.length);
  }

  /**
   * Check if calibration is still in progress
   */
  isCalibrationInProgress(): boolean {
    return this.isCalibrating;
  }

  /**
   * Reset calibration state
   */
  reset(): void {
    this.isCalibrating = false;
    this.calibrationBuffer = [];
    this.silenceBuffers = [];
    this.speechBuffers = [];
    this.calibrationStartTime = 0;
  }
}
