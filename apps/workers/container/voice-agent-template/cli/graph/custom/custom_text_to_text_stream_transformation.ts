import 'dotenv/config';

import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
  TextChunkingNode,
} from '@inworld/runtime/graph';

import { DEFAULT_LLM_MODEL_NAME, DEFAULT_LLM_PROVIDER } from '../../constants';
import { parseArgs } from '../../helpers/cli_helpers';

class TextToTextStreamTransformationNode extends CustomNode {
  process(
    _context: ProcessContext,
    input: GraphTypes.TextStream,
  ): GraphTypes.TransformationStreamTextToText {
    return input.toTextResponse({
      transform: (text: string) => {
        return text.toLocaleLowerCase();
      },
    });
  }
}

const usage = `
Usage:
    yarn node-custom-text-to-text-stream "Hello, how are you?"
Description:
    This example demonstrates how to create a custom node with text stream as an input.
    It will convert each stream text chunk to lower case`;

run();

async function run() {
  const { prompt, apiKey } = parseArgs(usage);

  const textToTextNode = new TextToTextStreamTransformationNode();

  const llmNode = new RemoteLLMChatNode({
    id: 'llm-node',
    provider: DEFAULT_LLM_PROVIDER,
    modelName: DEFAULT_LLM_MODEL_NAME,
    stream: true,
  });

  const textChunkingNode = new TextChunkingNode();

  const graph = new GraphBuilder({
    id: 'custom_text_to_text_stream_transformation_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .addNode(textChunkingNode)
    .addNode(textToTextNode)
    .setStartNode(llmNode)
    .addEdge(llmNode, textChunkingNode)
    .addEdge(textChunkingNode, textToTextNode)
    .setEndNode(textToTextNode)
    .build();

  const { outputStream } = graph.start(
    new GraphTypes.LLMChatRequest({
      messages: [{ role: 'user', content: prompt }],
    }),
  );

  let transformedResult = '';

  const response = await outputStream.next();

  await response.processResponse({
    TextStream: async (textStream) => {
      console.log('📝 Processing TextStream from transformation', textStream);
      let chunk = await textStream.next();
      console.log('📝 Processing TextStream from transformation chunk', chunk);

      while (!chunk.done) {
        console.log(`📝 Transformed chunk: "${chunk.text}"`);
        transformedResult += chunk.text;
        chunk = await textStream.next();
      }
    },
    string: async (text) => {
      console.log(`📝 Direct string result: "${text}"`);
      transformedResult += text;
    },
    default: async (data) => {
      console.log('📝 Unknown response type:', typeof data, data);
    },
  });

  console.log(`🎉 Final Transformed Result: "${transformedResult}"`);
}
