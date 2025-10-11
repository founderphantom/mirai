import path from 'path';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VAD_MODEL_PATH_RELATIVE,
  DEFAULT_VAD_MODEL_PATH_ABSOLUTE,
  DEFAULT_VOICE_ID,
} from './constants';

/**
 * Parse environment variables for server configuration
 * Note: API key is NOT loaded from env - it comes from request headers
 */
export const parseEnvironmentVariables = () => {
  // For VAD model path, use environment variable if set, otherwise determine based on NODE_ENV at runtime
  // This MUST be evaluated at runtime, not compile time!
  let vadModelPath: string;
  if (process.env.VAD_MODEL_PATH) {
    // Explicit override from environment
    vadModelPath = process.env.VAD_MODEL_PATH;
    console.log('[parseEnvironmentVariables] Using VAD_MODEL_PATH from env:', vadModelPath);
  } else if (process.env.NODE_ENV === 'production') {
    // Production: Use absolute path (container has models at /app/models/)
    vadModelPath = DEFAULT_VAD_MODEL_PATH_ABSOLUTE;
    console.log('[parseEnvironmentVariables] Production mode, using absolute path:', vadModelPath);
  } else {
    // Development: Resolve relative path from compiled code location
    vadModelPath = path.join(__dirname, DEFAULT_VAD_MODEL_PATH_RELATIVE);
    console.log('[parseEnvironmentVariables] Development mode, using relative path:', vadModelPath, '(__dirname:', __dirname + ')');
  }

  console.log('[parseEnvironmentVariables] Final VAD model path:', vadModelPath);
  console.log('[parseEnvironmentVariables] NODE_ENV:', process.env.NODE_ENV);

  return {
    llmModelName: process.env.LLM_MODEL_NAME || DEFAULT_LLM_MODEL_NAME,
    llmProvider: process.env.LLM_PROVIDER || DEFAULT_PROVIDER,
    voiceId: process.env.VOICE_ID || DEFAULT_VOICE_ID,
    vadModelPath,
    ttsModelId: process.env.TTS_MODEL_ID || DEFAULT_TTS_MODEL_ID,
    // Because the env variable is optional and it's a string, we need to convert it to a boolean safely
    graphVisualizationEnabled:
      (process.env.GRAPH_VISUALIZATION_ENABLED || '').toLowerCase().trim() ===
      'true',
    interruptionEnabled:
      (process.env.INTERRUPTION_ENABLED || '').toLowerCase().trim() === 'true',
  };
};
