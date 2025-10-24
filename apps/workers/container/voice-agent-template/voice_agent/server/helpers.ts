import path from 'path';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VAD_MODEL_PATH,
  DEFAULT_VOICE_ID,
} from './constants';

export const parseEnvironmentVariables = () => {
  // In multi-tenant mode, API key comes from headers, not env vars
  // So we only require it if we're in single-tenant mode
  const apiKey = process.env.INWORLD_API_KEY;

  // Determine VAD model path
  // In production (Docker), use absolute path: /app/models/silero_vad.onnx
  // In development, use relative path from __dirname
  let vadModelPath = process.env.VAD_MODEL_PATH;
  if (!vadModelPath) {
    // Check if we're in production Docker container
    const productionModelPath = '/app/models/silero_vad.onnx';
    const fs = require('fs');
    if (fs.existsSync(productionModelPath)) {
      vadModelPath = productionModelPath;
    } else {
      // Development mode - use relative path
      vadModelPath = path.join(__dirname, DEFAULT_VAD_MODEL_PATH);
    }
  }

  return {
    apiKey: apiKey || '', // Return empty string if not set (multi-tenant will provide it)
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
