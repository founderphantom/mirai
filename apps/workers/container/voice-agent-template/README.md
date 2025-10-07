## Inworld Runtime Templates

These templates demonstrate how to use the Inworld Runtime SDK across simple CLI examples and a full-stack voice agent application.

### What’s inside

- `cli/primitives/`: Runnable command-line examples that showcase primitives work (LLM/STT/TTS clients and some more).
- `cli/graphs/`: Runnable command-line examples that showcase Inworld Runtime graphs.
- `voice_agent/`: A complete app with a Node server and React client for a text/voice agent. See `templates/ts/voice_agent/README.md`.
- `prompts/`: Example Jinja prompt templates and props.
- `models/`: Sample model assets used by some examples (e.g., `silero_vad.onnx`).

### Prerequisites

- Node.js 18+
- Yarn (recommended)
- An Inworld API key available as env var `INWORLD_API_KEY`

## Quick start: CLI examples

Run examples directly from `cli/` using yarn scripts.

```bash
yarn install

# Provide your Inworld API key
export INWORLD_API_KEY="<your_api_key>"

# Example: basic LLM chat with tools and streaming
yarn node-llm-chat "Tell me the weather in Vancouver and evaluate 2 + 2" \
  --provider=openai --modelName=gpt-4o-mini --tools --toolChoice=auto
```

## Quick start: Voice Agent app

See detailed steps in `templates/ts/voice_agent/README.md`. Summary:

```bash
# Terminal 1: server
cd templates/ts/voice_agent/server
yarn install
cp .env-sample .env  # fill in required values (including INWORLD_API_KEY)
yarn start

# Terminal 2: client
cd templates/ts/voice_agent/client
yarn install
yarn start
```

The server runs on port 4000. The client starts on 3000 (or next available) and opens in your browser.

### Troubleshooting

- Missing `INWORLD_API_KEY`: set it before running examples.
- Port conflicts: the client will pick the next available port; ensure the server is on 4000.
- Audio issues in the client: grant microphone permissions in the browser.
