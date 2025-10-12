import { VADFactory } from '@inworld/runtime/primitives/vad';
import { v4 } from 'uuid';
const { validationResult } = require('express-validator');

import { parseEnvironmentVariables } from '../helpers';
import { Connection } from '../types';
import { InworldGraphWrapper } from './graph';

export class InworldApp {
  apiKey: string;
  llmModelName: string;
  llmProvider: string;
  voiceId: string;
  vadModelPath: string;
  graphVisualizationEnabled: boolean;
  interruptionEnabled: boolean;
  ttsModelId: string;
  connections: {
    [key: string]: Connection;
  } = {};

  vadClient: any;

  graphWithAudioInput: InworldGraphWrapper;
  graphWithTextInput: InworldGraphWrapper;

  promptTemplate: string;

  /**
   * Initialize the Inworld app with character-specific configuration
   * @param apiKey - Inworld API key (from X-Inworld-API-Key header)
   * @param characterConfig - Optional character-specific voice/model config
   */
  async initialize(apiKey: string, characterConfig?: {
    voiceId?: string;
    llmModelName?: string;
    llmProvider?: string;
    ttsModelId?: string;
  }) {
    this.connections = {};

    // Parse the environment variables for defaults
    const env = parseEnvironmentVariables();

    // Use provided API key (from header) instead of env
    this.apiKey = apiKey;

    // Use character-specific config if provided, otherwise fall back to env/defaults
    this.llmModelName = characterConfig?.llmModelName || env.llmModelName;
    this.llmProvider = characterConfig?.llmProvider || env.llmProvider;
    // Validate and sanitize voice ID
    // Inworld uses simple voice names like "Dennis", "Ashley", etc.
    // Google Cloud TTS uses format like "en-US-Neural2-F"
    let voiceId = characterConfig?.voiceId || env.voiceId;

    // Detect invalid voice IDs (Google Cloud format with hyphens and locale codes)
    if (voiceId && /^[a-z]{2}-[A-Z]{2}-/.test(voiceId)) {
      console.warn(`[InworldApp] Invalid voice ID detected: "${voiceId}". This appears to be a Google Cloud TTS voice.`);
      console.warn(`[InworldApp] Inworld expects voice names like "Dennis", "Ashley", etc.`);
      console.warn(`[InworldApp] Falling back to default voice: "${env.voiceId}"`);
      voiceId = env.voiceId;
    }

    this.voiceId = voiceId;
    this.ttsModelId = characterConfig?.ttsModelId || env.ttsModelId;

    // These are always from environment
    this.vadModelPath = env.vadModelPath;
    this.graphVisualizationEnabled = env.graphVisualizationEnabled;
    this.interruptionEnabled = env.interruptionEnabled;

    console.log('[InworldApp] Initializing with config:', {
      llmModelName: this.llmModelName,
      llmProvider: this.llmProvider,
      voiceId: this.voiceId,
      ttsModelId: this.ttsModelId,
      vadModelPath: this.vadModelPath,
      interruptionEnabled: this.interruptionEnabled,
    });

    try {
      // Verify VAD model file exists before attempting to load
      const fs = require('fs');
      const path = require('path');

      console.log('[InworldApp] Checking VAD model file...');
      console.log('[InworldApp] Current working directory:', process.cwd());
      console.log('[InworldApp] __dirname:', __dirname);
      console.log('[InworldApp] Expected VAD model path:', this.vadModelPath);

      // Check if file exists
      if (!fs.existsSync(this.vadModelPath)) {
        // Try to find the file in common locations
        const possiblePaths = [
          this.vadModelPath,
          path.join(process.cwd(), 'models', 'silero_vad.onnx'),
          path.join(__dirname, '..', '..', 'models', 'silero_vad.onnx'),
          '/app/models/silero_vad.onnx',
          path.join(process.cwd(), 'silero_vad.onnx'),
        ];

        console.log('[InworldApp] Model not found at primary path. Checking alternative locations:');
        let foundPath: string | null = null;
        for (const p of possiblePaths) {
          console.log(`  - Checking ${p}:`, fs.existsSync(p) ? 'FOUND' : 'not found');
          if (fs.existsSync(p) && !foundPath) {
            foundPath = p;
          }
        }

        if (foundPath) {
          console.log(`[InworldApp] Found VAD model at: ${foundPath}, using this path instead`);
          this.vadModelPath = foundPath;
        } else {
          // List files in /app/models to debug
          const modelsDir = '/app/models';
          if (fs.existsSync(modelsDir)) {
            console.log(`[InworldApp] Contents of ${modelsDir}:`);
            const files = fs.readdirSync(modelsDir);
            files.forEach((file: string) => {
              const stats = fs.statSync(path.join(modelsDir, file));
              console.log(`  - ${file} (${stats.size} bytes)`);
            });
          } else {
            console.log(`[InworldApp] Directory ${modelsDir} does not exist`);
          }

          throw new Error(`VAD model file not found at any known location. Primary path was: ${this.vadModelPath}`);
        }
      } else {
        const stats = fs.statSync(this.vadModelPath);
        console.log(`[InworldApp] VAD model file found (${stats.size} bytes)`);
      }

      // Initialize the VAD client
      console.log('[InworldApp] Loading VAD model from:', this.vadModelPath);
      this.vadClient = await VADFactory.createLocal({
        modelPath: this.vadModelPath,
      });
      console.log('[InworldApp] VAD model loaded successfully');
    } catch (error) {
      console.error('[InworldApp] Failed to load VAD model:', {
        error,
        vadModelPath: this.vadModelPath,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(`VAD model loading failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // Create graph for text input
      console.log('[InworldApp] Creating text input graph...');
      this.graphWithTextInput = await InworldGraphWrapper.create({
        apiKey: this.apiKey,
        llmModelName: this.llmModelName,
        llmProvider: this.llmProvider,
        voiceId: this.voiceId,
        connections: this.connections,
        graphVisualizationEnabled: this.graphVisualizationEnabled,
        ttsModelId: this.ttsModelId,
      });
      console.log('[InworldApp] Text input graph created');
    } catch (error) {
      console.error('[InworldApp] Failed to create text input graph:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Text graph creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // Create graph for audio input
      console.log('[InworldApp] Creating audio input graph...');
      this.graphWithAudioInput = await InworldGraphWrapper.create({
        apiKey: this.apiKey,
        llmModelName: this.llmModelName,
        llmProvider: this.llmProvider,
        voiceId: this.voiceId,
        connections: this.connections,
        withAudioInput: true,
        graphVisualizationEnabled: this.graphVisualizationEnabled,
        ttsModelId: this.ttsModelId,
      });
      console.log('[InworldApp] Audio input graph created');
    } catch (error) {
      console.error('[InworldApp] Failed to create audio input graph:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Audio graph creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('[InworldApp] Initialization complete');
  }

  async load(req: any, res: any) {
    res.setHeader('Content-Type', 'application/json');

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const agent = {
      ...req.body.agent,
      id: v4(),
    };

    this.connections[req.query.key] = {
      state: {
        messages: [
          {
            role: 'system',
            content: this.createSystemMessage(agent),
            id: v4(),
          },
        ],
        agent,
        userName: req.body.userName,
      },
      ws: null,
    };

    res.end(JSON.stringify({ agent }));
  }

  private createSystemMessage(agent: any) {
    return `You are: "${agent.name}". Your persona is: "${agent.description}". Your motivation is: "${agent.motivation}".`;
  }

  unload(req: any, res: any) {
    res.setHeader('Content-Type', 'application/json');

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    delete this.connections[req.query.key];

    res.end(JSON.stringify({ message: 'Session unloaded' }));
  }

  shutdown() {
    this.connections = {};
    this.graphWithTextInput.destroy();
    this.graphWithAudioInput.destroy();
  }
}
