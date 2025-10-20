// Local CommonJS-compatible constants for voice agent server
// This overrides the parent constants.ts which is treated as ES module

export const DEFAULT_VOICE_ID = 'Eve';
export const DEFAULT_LLM_MODEL_NAME = 'gpt-4o-mini';
export const DEFAULT_PROVIDER = 'openai';
export const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1';
// Path will be resolved at runtime in helpers.ts
export const DEFAULT_VAD_MODEL_PATH_RELATIVE = '../../models/silero_vad.onnx';
export const DEFAULT_VAD_MODEL_PATH_ABSOLUTE = '/app/models/silero_vad.onnx';
export const INPUT_SAMPLE_RATE = 16000;
export const TTS_SAMPLE_RATE = 24000;
export const PAUSE_DURATION_THRESHOLD_MS = 500; // Increased from 300ms to allow for longer natural pauses in speech and prevent message splitting
export const CONTINUATION_WINDOW_MS = 1000; // Time window to consider new speech as continuation of previous interaction (1 second)
export const MIN_SPEECH_DURATION_MS = 200; // Inworld best practice: Minimum speech duration (200ms) - decrease to capture shorter utterances
export const PRE_ROLL_MS = 500; // Add tolerance for clipping of the beginning of user speech
export const FRAME_PER_BUFFER = 1024;
export const SPEECH_THRESHOLD = 0.8; // Inworld best practice: Balanced threshold (0.8) - calibration will adjust per-session based on environment
export const MIN_AUDIO_ENERGY = 0.02; // Inworld best practice: Minimum RMS energy (0.02) - calibration will adjust this based on background noise
export const TEXT_CONFIG = {
  maxNewTokens: 100, // 75 words
  maxPromptLength: 1000,
  repetitionPenalty: 1,
  topP: 0.5,
  temperature: 0.1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: ['\n\n'],
};

export const WS_APP_PORT = parseInt(process.env.WS_APP_PORT || '4000');
