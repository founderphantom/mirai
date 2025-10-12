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
export const PAUSE_DURATION_THRESHOLD_MS = 1500; // Increased from 700ms to 1500ms to allow natural speech pauses
export const MIN_SPEECH_DURATION_MS = 1000; // Increased from 400ms to require more sustained speech
export const PRE_ROLL_MS = 500; // Add tolerance for clipping of the beginning of user speech
export const FRAME_PER_BUFFER = 1024;
export const SPEECH_THRESHOLD = 0.90; // Increased from 0.85 to 0.90 - much stricter to prevent background noise detection
export const MIN_AUDIO_ENERGY = 0.04; // Increased from 0.02 to 0.04 - minimum RMS energy required to consider audio as speech (0.0-1.0 range)
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
