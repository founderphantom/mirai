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
    this.voiceId = characterConfig?.voiceId || env.voiceId;
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

    // Initialize the VAD client
    console.log('[InworldApp] Loading VAD model from:', this.vadModelPath);
    this.vadClient = await VADFactory.createLocal({
      modelPath: this.vadModelPath,
    });
    console.log('[InworldApp] VAD model loaded successfully');

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
