import path from 'path';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VAD_MODEL_PATH,
  DEFAULT_VOICE_ID,
} from './constants';

/**
 * Parse environment variables for server configuration
 * Note: API key is NOT loaded from env - it comes from request headers
 */
export const parseEnvironmentVariables = () => {
  return {
    llmModelName: process.env.LLM_MODEL_NAME || DEFAULT_LLM_MODEL_NAME,
    llmProvider: process.env.LLM_PROVIDER || DEFAULT_PROVIDER,
    voiceId: process.env.VOICE_ID || DEFAULT_VOICE_ID,
    vadModelPath:
      process.env.VAD_MODEL_PATH ||
      path.join(__dirname, DEFAULT_VAD_MODEL_PATH),
    ttsModelId: process.env.TTS_MODEL_ID || DEFAULT_TTS_MODEL_ID,
    // Because the env variable is optional and it's a string, we need to convert it to a boolean safely
    graphVisualizationEnabled:
      (process.env.GRAPH_VISUALIZATION_ENABLED || '').toLowerCase().trim() ===
      'true',
    interruptionEnabled:
      (process.env.INTERRUPTION_ENABLED || '').toLowerCase().trim() === 'true',
  };
};
