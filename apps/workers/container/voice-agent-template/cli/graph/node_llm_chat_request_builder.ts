import 'dotenv/config';

import {
  GraphBuilder,
  GraphTypes,
  LLMChatRequestBuilderNode,
  MessageTemplate,
  RemoteLLMChatNode,
  RequestBuilderToolChoice,
  Tool,
} from '@inworld/runtime/graph';
const minimist = require('minimist');

const DEFAULT_LLM_MODEL_NAME = 'gpt-4o';

const tools: Tool[] = [
  {
    name: 'get_weather',
    description: 'Get the current weather in a given location',
    properties: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
      },
      required: ['location'],
    },
  },
];

const usage = `
Usage:
    yarn node-llm-chat-request-builder '{"city": "San Francisco", "activity": "hiking"}'
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] 
    --provider=<service-provider>[optional, default=openai]
    --toolChoice[optional, tool choice strategy: auto/required/none/function_name]
    --imageUrl=<image-url>[optional, include an image in the message for multimodal input]

Examples:
    # Basic request without tools
    yarn node-llm-chat-request-builder '{"city": "San Francisco", "activity": "hiking"}'

    # Basic request with tools (auto, required, none, function_name)
    yarn node-llm-chat-request-builder '{"city": "San Francisco", "activity": "hiking"}' --toolChoice="auto"
  
    # Specific tool choice
    yarn node-llm-chat-request-builder '{"city": "San Francisco", "activity": "hiking"}' --toolChoice="get_weather"

    # Multimodal request
    yarn node-llm-chat-request-builder '{"city": "Unknown", "activity": "hiking"}' --imageUrl="https://cms.inspirato.com/ImageGen.ashx?image=%2fmedia%2f5682444%2fLondon_Dest_16531610X.jpg"
  
    # If you are on Windows, you need to escape the quotes in the JSON string.
    # For example (double check in node_llm_chat_advanced.ts to see the escape characters):
    yarn node-llm-chat-request-builder '{\"city\": \""San Francisco\", \"activity\": \"hiking\"}'
`;

run();

function getRequestBuilderToolChoice(
  toolChoice: string,
): RequestBuilderToolChoice {
  switch (toolChoice) {
    case 'auto':
    case 'required':
    case 'none':
      return {
        type: 'string',
        value: toolChoice,
      };
    default:
      return {
        type: 'function',
        function: {
          type: 'function',
          name: toolChoice,
        },
      };
  }
}

async function run() {
  const { jsonData, modelName, provider, apiKey, toolChoice } = parseArgs();

  let userMessage: MessageTemplate;
  if (jsonData.image_url) {
    console.log('imageUrl', jsonData.image_url);
    userMessage = {
      role: 'user',
      content_items: [
        {
          type: 'template',
          template: `Analyze the following situation and determine whether
        the user should bring an umbrella.
        City: {{city}}
        Activity: {{activity}}
        `,
        },
        {
          type: 'image',
          url_template: `{{image_url}}`, // use "url" if you just need a static image.
          detail: 'high',
        },
      ],
    };
  } else {
    userMessage = {
      role: 'user',
      content: {
        type: 'template',
        template: `Analyze the following situation and determine whether
      the user should bring an umbrella.
      City: {{city}}
      Activity: {{activity}}
      `,
      },
    };
  }

  const llmRequestBuilderNode = new LLMChatRequestBuilderNode({
    id: 'llm_request_builder_node',
    tools: toolChoice ? tools : [],
    toolChoice: toolChoice
      ? getRequestBuilderToolChoice(toolChoice)
      : undefined,
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content: {
          type: 'template',
          template: `You are a helpful assistant great at analyzing situations. return your answer in json format.`,
        },
      },
      userMessage,
    ],
    reportToClient: true,
  });

  const llmChatNode = new RemoteLLMChatNode({
    id: 'llm_chat_node',
    provider: provider,
    modelName: modelName,
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 200,
    },
  });

  const builder = new GraphBuilder({
    id: 'node_llm_chat_request_builder_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmRequestBuilderNode)
    .addNode(llmChatNode)
    .addEdge(llmRequestBuilderNode, llmChatNode)
    .setStartNode(llmRequestBuilderNode)
    .setEndNode(llmChatNode);

  const graph = builder.build();
  const { outputStream } = graph.start(jsonData);

  for await (const result of outputStream) {
    await result.processResponse({
      Content: (response: GraphTypes.Content) => {
        console.log('📥 LLM Chat Response:');
        console.log('  Content:', response.content);
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log('  Tool Calls:');
          response.toolCalls.forEach((toolCall: any, index: number) => {
            console.log(`    ${index + 1}. ${toolCall.name}(${toolCall.args})`);
            console.log(`       ID: ${toolCall.id}`);
          });
        }
      },
      LLMChatRequest: (request: GraphTypes.LLMChatRequest) => {
        console.log('📥 LLM Chat Request:', request);
      },
    });
  }
}

function parseArgs(): {
  jsonData: { city: string; activity: string; image_url?: string };
  modelName: string;
  provider: string;
  apiKey: string;
  toolChoice: string;
  imageUrl?: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const jsonString = argv._?.join(' ') || '';
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || 'openai';
  const apiKey = process.env.INWORLD_API_KEY || '';
  const toolChoice = argv.toolChoice || '';
  const imageUrl = argv.imageUrl;

  if (!jsonString) {
    throw new Error(
      `You need to provide a JSON string with user data.\n${usage}`,
    );
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  let jsonData;
  try {
    jsonData = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON string provided: ${error.message}\n${usage}`);
  }

  if (!jsonData.city || !jsonData.activity) {
    throw new Error(
      `JSON data must include 'city' and 'activity' fields.\n${usage}`,
    );
  }

  return {
    jsonData: {
      city: jsonData.city,
      activity: jsonData.activity,
      ...(imageUrl && { image_url: imageUrl }),
    },
    modelName,
    provider,
    apiKey,
    toolChoice,
    imageUrl,
  };
}
