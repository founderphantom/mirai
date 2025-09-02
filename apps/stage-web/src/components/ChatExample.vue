<template>
  <div class="chat-container">
    <!-- Conversation List -->
    <div class="conversations-sidebar">
      <div class="sidebar-header">
        <h3>Conversations</h3>
        <button @click="createNewConversation" class="btn-primary">
          New Chat
        </button>
      </div>
      
      <div v-if="conversationsLoading" class="loading">
        Loading conversations...
      </div>
      
      <div v-else class="conversation-list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: activeConversation?.id === conv.id }"
          @click="selectConversation(conv)"
        >
          <div class="conversation-title">
            {{ conv.title || 'New Conversation' }}
          </div>
          <div class="conversation-meta">
            <span v-if="conv.is_starred">⭐</span>
            <span v-if="conv.is_archived">📁</span>
            <span class="message-count">{{ conv.message_count }} messages</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Chat Area -->
    <div class="chat-area">
      <div v-if="!activeConversation" class="no-conversation">
        <p>Select a conversation or create a new one to start chatting</p>
      </div>
      
      <template v-else>
        <!-- Chat Header -->
        <div class="chat-header">
          <h2>{{ activeConversation.title || 'Chat' }}</h2>
          <div class="chat-actions">
            <button @click="toggleStar(activeConversation.id)" class="btn-icon">
              {{ activeConversation.is_starred ? '⭐' : '☆' }}
            </button>
            <button @click="toggleArchive(activeConversation.id)" class="btn-icon">
              📁
            </button>
            <button @click="clearChat" class="btn-icon">
              🗑️
            </button>
          </div>
        </div>
        
        <!-- Messages -->
        <div class="messages-container" ref="messagesContainer">
          <div v-if="isLoading" class="loading">
            Loading messages...
          </div>
          
          <div v-else-if="!hasMessages" class="no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
          
          <div v-else class="messages">
            <div
              v-for="message in messages"
              :key="message.id"
              class="message"
              :class="message.role"
            >
              <div class="message-role">
                {{ message.role === 'user' ? 'You' : 'Assistant' }}
              </div>
              <div class="message-content">
                {{ message.content || streamContent }}
              </div>
              <div class="message-actions" v-if="message.role === 'assistant'">
                <button @click="rateMessage(message.id, 5)" class="btn-small">
                  👍
                </button>
                <button @click="rateMessage(message.id, 1)" class="btn-small">
                  👎
                </button>
                <button @click="regenerate" class="btn-small">
                  🔄 Regenerate
                </button>
              </div>
            </div>
            
            <!-- Streaming indicator -->
            <div v-if="isStreaming" class="message assistant streaming">
              <div class="message-role">Assistant</div>
              <div class="message-content">
                {{ streamContent || 'Thinking...' }}
                <span class="typing-indicator">●●●</span>
              </div>
            </div>
          </div>
          
          <button v-if="hasMore" @click="loadMoreMessages" class="load-more">
            Load More
          </button>
        </div>
        
        <!-- Input Area -->
        <div class="input-area">
          <textarea
            v-model="inputMessage"
            @keydown.enter.prevent="handleSend"
            placeholder="Type your message..."
            class="message-input"
            :disabled="isStreaming"
          />
          <button
            @click="handleSend"
            :disabled="!canSendMessage"
            class="send-button"
          >
            {{ isStreaming ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </template>
    </div>
    
    <!-- User Profile Sidebar -->
    <div class="profile-sidebar" v-if="user">
      <div class="profile-header">
        <img :src="user.avatar_url || '/default-avatar.png'" alt="Avatar" class="avatar" />
        <h3>{{ user.full_name || user.email }}</h3>
        <p class="subscription-badge" :class="user.subscription_tier">
          {{ user.subscription_tier }} Plan
        </p>
      </div>
      
      <div class="usage-stats">
        <h4>Usage Today</h4>
        <div class="stat">
          <span>Messages:</span>
          <span>{{ user.daily_message_count }} / {{ getMessageLimit() }}</span>
        </div>
        <div class="stat">
          <span>Tokens:</span>
          <span>{{ formatNumber(user.api_usage?.tokens_used || 0) }}</span>
        </div>
      </div>
      
      <div class="profile-actions">
        <button @click="logout" class="btn-secondary">
          Logout
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { useChat, useConversations } from '@/composables/useChat';
import { useAuth } from '@/composables/useAuth';
import { useWebSocket } from '@/composables/useWebSocket';
import { providerService } from '@/services/provider.service';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@proj-airi/stage-ui/stores/auth';

// Auth
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);
const { logout } = useAuth();

// WebSocket
const { connect } = useWebSocket({ autoConnect: true });

// Conversations
const {
  conversations,
  activeConversation,
  loading: conversationsLoading,
  loadConversations,
  createConversation,
  setActiveConversation,
  toggleArchive,
  toggleStar,
} = useConversations();

// Chat
const {
  messages,
  inputMessage,
  isStreaming,
  isLoading,
  hasMessages,
  hasMore,
  canSendMessage,
  streamContent,
  initialize: initializeChat,
  loadMoreMessages,
  sendMessage,
  regenerateLastMessage: regenerate,
  rateMessage,
  clearConversation,
} = useChat();

// Refs
const messagesContainer = ref<HTMLElement>();

// Methods
const selectConversation = async (conversation: any) => {
  setActiveConversation(conversation);
  await initializeChat(conversation.id);
  scrollToBottom();
};

const createNewConversation = async () => {
  // Get default provider and model
  const providers = await providerService.getProviders();
  const defaultProvider = providers.find(p => p.status === 'available') || providers[0];
  const defaultModel = defaultProvider?.supported_models[0];
  
  if (!defaultProvider || !defaultModel) {
    console.error('No providers available');
    return;
  }
  
  const conversation = await createConversation({
    title: 'New Chat',
    provider_id: defaultProvider.id,
    model_id: defaultModel.id,
    temperature: 0.7,
    max_tokens: 2000,
  });
  
  if (conversation) {
    await selectConversation(conversation);
  }
};

const handleSend = async () => {
  if (!canSendMessage.value) return;
  
  await sendMessage();
  scrollToBottom();
};

const clearChat = async () => {
  if (confirm('Are you sure you want to clear this conversation?')) {
    await clearConversation();
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const getMessageLimit = () => {
  const limits: Record<string, number> = {
    free: 10,
    plus: 100,
    pro: 500,
    enterprise: -1,
  };
  return limits[user.value?.subscription_tier || 'free'] || 10;
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

// Watch for new messages to scroll
watch(messages, () => {
  scrollToBottom();
});

// Initialize
onMounted(async () => {
  await connect();
  await loadConversations();
  
  // Select first conversation if available
  if (conversations.value.length > 0) {
    await selectConversation(conversations.value[0]);
  }
});
</script>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
}

.conversations-sidebar {
  width: 280px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  padding: 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s;
}

.conversation-item:hover {
  background: var(--bg-hover);
}

.conversation-item.active {
  background: var(--bg-active);
}

.conversation-title {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.conversation-meta {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  margin-bottom: 1.5rem;
}

.message.user {
  text-align: right;
}

.message.assistant {
  text-align: left;
}

.message-role {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.message-content {
  display: inline-block;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  max-width: 70%;
  word-wrap: break-word;
}

.message.user .message-content {
  background: var(--primary);
  color: white;
}

.message.assistant .message-content {
  background: var(--bg-secondary);
}

.message-actions {
  margin-top: 0.5rem;
}

.typing-indicator {
  animation: blink 1.4s infinite;
}

@keyframes blink {
  0%, 60%, 100% { opacity: 1; }
  30% { opacity: 0.3; }
}

.input-area {
  padding: 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 1rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  resize: none;
  font-family: inherit;
}

.send-button {
  padding: 0.75rem 1.5rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-sidebar {
  width: 280px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  padding: 1rem;
}

.profile-header {
  text-align: center;
  margin-bottom: 2rem;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 1rem;
}

.subscription-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.subscription-badge.free {
  background: var(--gray-100);
  color: var(--gray-700);
}

.subscription-badge.plus {
  background: var(--blue-100);
  color: var(--blue-700);
}

.subscription-badge.pro {
  background: var(--purple-100);
  color: var(--purple-700);
}

.subscription-badge.enterprise {
  background: var(--gold-100);
  color: var(--gold-700);
}

.usage-stats {
  margin-bottom: 2rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.loading, .no-messages, .no-conversation {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.btn-primary, .btn-secondary, .btn-icon, .btn-small {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-icon {
  background: transparent;
  padding: 0.5rem;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  background: transparent;
}

.load-more {
  display: block;
  margin: 1rem auto;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  cursor: pointer;
}
</style>