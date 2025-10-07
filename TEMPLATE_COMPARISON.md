# Inworld Template Comparison for Mirai MVP

**Date:** 2025-10-07
**Decision:** Which Inworld template to use as foundation for MVP

---

## 📋 **Executive Summary**

**Recommendation: Use `voice-agent-template` ✅**

The `voice-agent-template` is the better foundation for your MVP because:
- ✅ Built-in character/agent system (matches your architecture)
- ✅ Modular structure (easy to add CharacterPoolManager)
- ✅ Conversation state management (required for multi-tenant)
- ✅ Client/server separation (matches web app architecture)
- ✅ Session-based architecture (compatible with JWT auth)
- ✅ Better for persistent character personalities

---

## 🔍 **Detailed Comparison**

| Feature | `runtime-multimodal-companion-template` | `voice-agent-template` ✅ |
|---------|----------------------------------------|--------------------------|
| **Purpose** | Unity/game engine integration | Web-based voice agent with characters |
| **Target Platform** | Unity, C# games | Web browsers, mobile apps |
| **Authentication** | HMAC (Unity InworldAuth) | Session-based (extensible to JWT) |
| **Architecture** | Single-file, flat | Modular (components, server/client) |
| **Character System** | ❌ No concept of characters | ✅ Full agent/character system |
| **State Management** | ❌ Ephemeral (per-request) | ✅ Persistent conversation state |
| **Conversation History** | ❌ None | ✅ Messages array in state |
| **Multi-tenant Ready** | ⚠️ Shared STT only | ✅ Character pooling compatible |
| **Inworld Runtime Version** | 0.5.0-rc.3 | 0.6.0 (latest) |
| **Client UI** | ❌ None (Unity handles) | ✅ React client included |
| **Graph System** | Simple STTGraph | Full InworldGraphWrapper |
| **Session Management** | `/create-session` tokens | `/load`, `/unload` endpoints |
| **Image Support** | ✅ Vision/image chat | ❌ Not built-in |
| **Code Structure** | 326 lines (single file) | ~2000+ lines (modular) |
| **Complexity** | Low (rapid prototyping) | Medium (production-ready) |

---

## 🏗️ **Architecture Deep Dive**

### **runtime-multimodal-companion-template**

```typescript
// Single-file architecture
├── index.ts (main server)
├── message_handler.ts
├── stt_graph.ts
├── auth.ts (HMAC for Unity)
└── test-*.html (local testing)

// Key characteristics:
- ONE global STTGraph (shared across all sessions)
- Ephemeral LLM nodes (created per request)
- No character concept
- Designed for Unity client with InworldAuth HMAC
```

**Flow:**
```
Unity Client (C#)
  ↓ HMAC Auth (InworldAuth)
  ↓ POST /create-session → { sessionKey, wsToken }
  ↓ WebSocket /ws?key=xxx&wsToken=xxx
  ↓
Server (Node.js)
  ├─ STTGraph (shared) ← All users
  └─ Per-request LLM nodes (ephemeral)
```

**Pros:**
- ✅ Image/vision support built-in
- ✅ Simple, single-file design
- ✅ Good for Unity games
- ✅ HMAC auth works out-of-box

**Cons:**
- ❌ No character system (would need to build from scratch)
- ❌ No conversation state management
- ❌ HMAC auth doesn't match your Better-Auth JWT
- ❌ Not designed for multi-tenant character pooling
- ❌ Flat structure (harder to extend)

---

### **voice-agent-template** ✅

```typescript
// Modular architecture
voice_agent/
├── server/
│   ├── components/
│   │   ├── app.ts              ← InworldApp (character management)
│   │   ├── graph.ts            ← InworldGraphWrapper (full pipeline)
│   │   ├── message_handler.ts
│   │   ├── audio_handler.ts
│   │   └── event_factory.ts
│   ├── middleware/
│   │   └── CharacterPoolManager.ts ← YOUR ADDITION
│   ├── index.ts                ← Original single-tenant
│   ├── index.enhanced.ts       ← Container-ready
│   └── index.multi-tenant.ts   ← YOUR MULTI-TENANT VERSION
└── client/ (React UI)

// Key characteristics:
- InworldApp manages character state
- InworldGraphWrapper for full STT→LLM→TTS pipeline
- Character/agent concept built-in
- Modular components (easy to extend)
```

**Flow:**
```
Web/Mobile Client
  ↓ JWT Auth (Better-Auth) → API Gateway
  ↓ POST /api/voice/session/start → { sessionKey, websocketUrl }
  ↓ WebSocket /api/voice/ws?sessionKey=xxx
  ↓
API Gateway
  ↓ Validates JWT, creates session in KV
  ↓ Proxies to Container
  ↓
Container (Multi-Tenant)
  └─ CharacterPoolManager
     ├─ Character A (InworldApp) → User 1, User 2, User 5
     ├─ Character B (InworldApp) → User 3, User 7
     └─ Character C (InworldApp) → User 4, User 6
```

**Pros:**
- ✅ **Character system built-in** (agent.id, agent.name, agent.motivation)
- ✅ **Conversation state management** (messages array, user context)
- ✅ **Modular architecture** (easy to add CharacterPoolManager)
- ✅ **Session management** (/load, /unload endpoints)
- ✅ **Latest Inworld Runtime** (0.6.0)
- ✅ **Client/server separation** (React UI included)
- ✅ **Compatible with JWT auth** (easy to adapt)

**Cons:**
- ❌ No image/vision support (but not needed for MVP)
- ⚠️ More complex (but production-ready)

---

## 🎯 **Mapping to Your MVP Requirements**

### **Your Architecture:**

```
Client (Web/Mobile)
  ↓ JWT (Better-Auth)
API Gateway (Hono)
  ↓ Validates JWT, rate limits
  ↓ Stores session in KV
  ↓ Proxies WebSocket
Container (Multi-Tenant)
  ↓ CharacterPoolManager
  ↓ 100+ concurrent users
D1 Database (Drizzle ORM)
  ↓ Conversations, voice_sessions
Polar (Billing)
  ↓ Usage tracking
```

### **Which Template Fits?**

| Requirement | `runtime-multimodal-companion` | `voice-agent-template` ✅ |
|-------------|-------------------------------|--------------------------|
| **Character personalities** | ❌ Need to build | ✅ Built-in (agent config) |
| **JWT auth integration** | ⚠️ Needs rework (HMAC) | ✅ Easy (adapt /load endpoint) |
| **Multi-tenant pooling** | ⚠️ Shared STT only | ✅ Character state ready |
| **Conversation history** | ❌ Need to build | ✅ Messages array in state |
| **API Gateway proxy** | ⚠️ Works but not ideal | ✅ Perfect fit |
| **D1/Drizzle integration** | ⚠️ Need to add | ✅ Easy to add |
| **Polar billing hooks** | ⚠️ Need to add | ✅ Easy to add |
| **Client UI** | ❌ Unity only | ✅ React client included |

---

## 📊 **Code Complexity Comparison**

### **runtime-multimodal-companion-template**

```typescript
// index.ts - All in one file (326 lines)
const connections: { [key: string]: { ws?: any } } = {};
const wsTokens: { [sessionKey: string]: { token: string; expiresAt: number } } = {};

// No character concept - just connections
webSocket.on('connection', (ws, request) => {
  const key = query.key?.toString();
  connections[key] = { ws };
});

// Ephemeral LLM nodes per request
const llmNode = new RemoteLLMChatNode({
  id: uuidv4() + '_llm_node',
  provider: 'google',
  modelName: 'gemini-2.5-flash-lite',
});
```

**Analysis:** Simple, but you'd need to build:
- Character management system
- Conversation state management
- Character pooling logic
- Session→Character mapping
- State persistence

---

### **voice-agent-template**

```typescript
// components/app.ts - Character management
export class InworldApp {
  connections: { [key: string]: Connection } = {};

  async load(req: any, res: any) {
    const agent = { ...req.body.agent, id: v4() };

    this.connections[req.query.key] = {
      state: {
        messages: [{ role: 'system', content: this.createSystemMessage(agent) }],
        agent,  // ← Character info stored
        userName: req.body.userName,
      },
      ws: null,
    };
  }
}

// types.ts - Character types
export interface Agent {
  id: string;
  name: string;
  description: string;
  motivation: string;
  knowledge?: string[];
}

export interface Connection {
  state: State;  // ← Persistent state
  ws: any;
}
```

**Analysis:** Already has:
- ✅ Character/agent system
- ✅ Conversation state (messages array)
- ✅ Connection management
- ✅ Type safety with interfaces
- ✅ Easy to extend with CharacterPoolManager

---

## 🔄 **Migration Path: Which Template?**

### **If you choose `runtime-multimodal-companion-template`:**

**Work needed:**
1. ❌ Build character system from scratch
   ```typescript
   // Need to add:
   interface Character {
     id: string;
     name: string;
     personality: any;
     // ...
   }

   const characters: Map<string, Character> = new Map();
   ```

2. ❌ Add conversation state management
   ```typescript
   // Need to add:
   interface ConversationState {
     messages: Message[];
     characterId: string;
     userId: string;
   }
   ```

3. ❌ Rework authentication (HMAC → JWT)
   ```typescript
   // Need to replace HMAC with JWT validation
   ```

4. ❌ Build character pooling logic
   ```typescript
   // Need to build CharacterPoolManager from scratch
   ```

**Estimated work:** ~3-5 days

---

### **If you choose `voice-agent-template` (recommended):** ✅

**Work needed:**
1. ✅ Add CharacterPoolManager (already done!)
2. ✅ Create index.multi-tenant.ts (already done!)
3. ✅ Update Dockerfile (already done!)
4. ⚠️ Minor: Adapt /load endpoint for API Gateway headers
   ```typescript
   // Easy change:
   const characterId = req.headers['x-character-id'];
   const userId = req.headers['x-user-id'];
   ```

**Estimated work:** ~1 day (mostly integration testing)

---

## 🚀 **Recommendation: `voice-agent-template`**

### **Why?**

1. **Character System Built-In**
   - Already has `Agent` interface with personality config
   - State management with conversation history
   - Easy to extend with CharacterPoolManager

2. **Modular Architecture**
   - Components folder (easy to add middleware)
   - Separation of concerns
   - Type-safe with TypeScript interfaces

3. **Latest Inworld Runtime (0.6.0)**
   - More features and bug fixes
   - Better performance
   - Active development

4. **Production-Ready Structure**
   - Client/server separation
   - Error handling
   - Graceful shutdown

5. **Your Work Already Done**
   - CharacterPoolManager already built
   - index.multi-tenant.ts already created
   - Dockerfile already updated
   - SETUP.md already written

6. **Easy API Gateway Integration**
   - Session-based endpoints (/load, /unload)
   - Just adapt for header-based auth
   - Compatible with KV session cache

---

## 📝 **Next Steps (If Switching)**

### **If you want to switch to `runtime-multimodal-companion-template`:**

**Not recommended**, but if you must:
1. Copy CharacterPoolManager logic to runtime-multimodal template
2. Build character system from scratch
3. Add conversation state management
4. Replace HMAC with JWT validation
5. Add character pooling to index.ts
6. Test extensively

**Estimated time:** 3-5 days

---

### **If you stay with `voice-agent-template` (recommended):** ✅

**You're 95% done!** Just need to:
1. ✅ Test local Docker build
2. ✅ Deploy container to Cloudflare
3. ✅ Deploy API Gateway
4. ✅ Create KV namespace and set secrets
5. ✅ Test end-to-end integration

**Estimated time:** 1 day (mostly testing)

---

## 🎓 **When to Use Each Template**

### **Use `runtime-multimodal-companion-template` when:**
- Building Unity game integration
- Need image/vision features immediately
- Single-player or small-scale (not multi-tenant)
- Rapid prototyping (quick MVP)
- C# client with InworldAuth

### **Use `voice-agent-template` when:** ✅
- Building web/mobile app with characters
- Need multi-tenant character pooling
- Need conversation history and state
- Production deployment with API Gateway
- Multiple character support
- Long-term memory and personality

---

## 📊 **Final Score**

| Criteria | `runtime-multimodal` | `voice-agent` ✅ | Winner |
|----------|---------------------|------------------|--------|
| Character system | ❌ 0/10 | ✅ 10/10 | voice-agent |
| Multi-tenant ready | ⚠️ 3/10 | ✅ 9/10 | voice-agent |
| Conversation state | ❌ 0/10 | ✅ 10/10 | voice-agent |
| Auth compatibility | ⚠️ 4/10 | ✅ 8/10 | voice-agent |
| Modular architecture | ⚠️ 5/10 | ✅ 10/10 | voice-agent |
| Image support | ✅ 10/10 | ❌ 0/10 | runtime-multimodal |
| Latest runtime | ⚠️ 7/10 | ✅ 10/10 | voice-agent |
| Client UI | ❌ 0/10 | ✅ 10/10 | voice-agent |
| Your work done | ❌ 0/10 | ✅ 10/10 | voice-agent |

**Total Score:**
- `runtime-multimodal-companion-template`: **29/90** (32%)
- `voice-agent-template`: **77/90** (86%) ✅

---

## ✅ **Decision: Use `voice-agent-template`**

You've already built all the multi-tenant infrastructure on top of `voice-agent-template`:
- CharacterPoolManager
- index.multi-tenant.ts
- API Gateway integration
- SETUP.md documentation

**Switching now would mean rebuilding everything from scratch.**

Stick with `voice-agent-template` and deploy! 🚀
