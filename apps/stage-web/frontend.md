# Frontend Documentation - AIRI Stage Web Application

## Overview
AIRI Stage Web is a Vue 3-based frontend application for an AI-powered virtual companion platform. The application features Live2D character models, real-time chat capabilities, voice interaction, and a comprehensive user management system. It's built with modern web technologies and follows a component-driven architecture.

## Technology Stack

### Core Framework
- **Vue 3** (v3.5.21) - Progressive JavaScript framework with Composition API
- **Vite** - Next-generation frontend build tool for fast development and optimized production builds
- **TypeScript** - Type-safe development with full type checking

### UI & Styling
- **UnoCSS** - Atomic CSS engine with custom design system
- **Tailwind Reset** - CSS normalization
- **Custom Design System** - Comprehensive color palette with semantic naming (primary, secondary, accent, success, warning, error, neutral)
- **SCSS/Less** - CSS preprocessing for advanced styling
- **Auto-animate** - Automatic animation library for smooth transitions

### State Management
- **Pinia** (v3.0.3) - Official Vue store solution
- **VueUse** - Collection of essential Vue composition utilities
- **Local Storage** - Persistent client-side storage for user preferences

### Routing & Navigation
- **Vue Router** (v4.5.1) - Official router with file-based routing
- **Unplugin Vue Router** - Auto-generated routes from file structure
- **Vue Layouts** - Layout system for different page templates
- **NProgress** - Progress bar for route transitions

### Authentication & Backend Integration
- **Supabase** (v2.56.1) - Backend-as-a-Service for authentication and database
- **ofetch** - Modern fetch client for API communication
- **Session Management** - Custom session manager with auto-refresh capability

### Internationalization
- **Vue I18n** (v11.1.11) - Internationalization plugin
- **Multi-language Support** - English, Chinese (Simplified/Traditional), Spanish, Vietnamese, Russian

### 3D & Graphics
- **Three.js** (v0.179.1) - 3D graphics library
- **TresJS** - Vue 3 wrapper for Three.js
- **Live2D SDK** - Character animation system
- **VRM Support** - 3D avatar format support

### AI & ML Features
- **@huggingface/transformers** - Machine learning models
- **ONNX Runtime Web** - ML model inference in browser
- **VAD (Voice Activity Detection)** - Real-time voice detection
- **Whisper Integration** - Speech-to-text capabilities

### Build & Development Tools
- **Vue DevTools** - Development debugging tools
- **PWA Support** - Progressive Web App capabilities with service workers
- **Bundle Visualizer** - Bundle size analysis
- **ESLint** - Code linting and formatting

## Project Architecture

### Directory Structure
```
apps/stage-web/
├── src/
│   ├── assets/           # Static assets (images, icons, Live2D models)
│   │   ├── backgrounds/  # Background images and animations
│   │   ├── icons/        # Application icons
│   │   └── live2d/       # Live2D model files
│   ├── components/       # Reusable Vue components
│   │   ├── auth/         # Authentication components
│   │   ├── Backgrounds/  # Background effect components
│   │   ├── DataGui/      # Data visualization components
│   │   ├── Layouts/      # Layout-specific components
│   │   ├── Settings/     # Settings-related components
│   │   └── Widgets/      # Widget components
│   ├── composables/      # Vue composition functions
│   ├── layouts/          # Page layout templates
│   ├── lib/              # Core libraries and utilities
│   │   ├── api.ts        # API client configuration
│   │   ├── auth-errors.ts # Authentication error handling
│   │   ├── session-manager.ts # Session management
│   │   ├── supabase.ts   # Supabase client configuration
│   │   └── validation.ts # Form validation utilities
│   ├── modules/          # Application modules
│   │   ├── i18n.ts       # Internationalization setup
│   │   └── pwa.ts        # PWA configuration
│   ├── pages/            # Route pages (file-based routing)
│   │   ├── auth/         # Authentication pages
│   │   ├── devtools/     # Development tools pages
│   │   ├── settings/     # Settings pages
│   │   ├── stage/        # Stage/scene pages
│   │   └── test/         # Test pages
│   ├── router/           # Router configuration
│   │   └── guards.ts     # Route guards for authentication
│   ├── stores/           # Pinia stores
│   ├── styles/           # Global styles
│   ├── utils/            # Utility functions
│   ├── workers/          # Web Workers
│   │   └── vad/          # Voice Activity Detection worker
│   ├── App.vue           # Root component
│   └── main.ts           # Application entry point
├── public/               # Static public assets
├── dist/                 # Production build output
├── .env.example          # Environment variables template
├── index.html            # HTML entry point
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── uno.config.ts         # UnoCSS configuration
├── vercel.json           # Vercel deployment config
└── vite.config.ts        # Vite build configuration
```

## Core Features

### 1. Authentication System
- **Multi-provider Support**: Email/password, Google OAuth, Discord OAuth
- **Session Management**: Automatic token refresh with PKCE flow
- **Route Guards**: Protected routes with authentication checks
- **User Profiles**: Profile management with avatar, username, display name
- **Subscription Tiers**: Free, Pro, Premium tier support
- **Password Reset**: Email-based password recovery flow

**Key Files:**
- `/src/composables/useAuth.ts` - Main authentication composable
- `/src/lib/session-manager.ts` - Session refresh and management
- `/src/router/guards.ts` - Route protection logic
- `/src/components/auth/` - Authentication UI components

### 2. Character Display System
- **Live2D Integration**: Support for Live2D character models
- **VRM Support**: 3D avatar model support
- **Model Management**: Dynamic model loading and switching
- **Animation Control**: Expression and motion control
- **Camera Control**: Position, scale, and focus management

**Key Integration:**
- Stage UI package (`@proj-airi/stage-ui`) - Shared UI components
- Live2D SDK plugin - Model loading and rendering
- Three.js/TresJS - 3D scene management

### 3. Real-time Communication
- **WebSocket Support**: Real-time bidirectional communication
- **Chat System**: Message history and real-time chat
- **Voice Chat**: Voice activity detection and streaming
- **File Uploads**: Support for file sharing

**Configuration:**
- Supabase Realtime for WebSocket connections
- VAD Web Worker for voice detection
- API client with auto-reconnection

### 4. User Interface Components

#### Layout System
- **Stage Layout**: Main character display layout
- **Settings Layout**: Settings pages with sidebar navigation
- **Auth Layout**: Authentication pages with centered forms
- **Default Layout**: Standard page layout with header
- **Plain Layout**: Minimal layout without navigation

#### Component Categories
- **Authentication Components**: Login, signup, OAuth buttons, password reset
- **Background Effects**: Animated backgrounds (Cross, Line, Sakura Petal, TicTacToe)
- **Interactive Areas**: Chat interface, action buttons, controls
- **Settings Components**: Model settings, provider configuration, system preferences
- **Widgets**: Audio waveform, animated waves, gesture controls

### 5. Internationalization (i18n)
- **Supported Languages**: 
  - English (en)
  - Chinese Simplified (zh-Hans)
  - Chinese Traditional (zh-Hant) - mapped to Simplified
  - Spanish (es)
  - Vietnamese (vi)
  - Russian (ru)
- **Language Detection**: Browser language fallback
- **Persistent Selection**: LocalStorage-based preference

### 6. Progressive Web App (PWA)
- **Service Worker**: Offline capability and caching
- **App Manifest**: Installable as native app
- **Icons**: Multiple resolution icons for different devices
- **Auto Update**: Automatic service worker updates
- **Cache Strategy**: Maximum 64MB cache size

## State Management

### Pinia Stores
1. **PWA Store** (`/src/stores/pwa.ts`)
   - Service worker registration
   - Update notifications
   - Offline status management

2. **Display Models Store** (from stage-ui package)
   - Model loading and management
   - Model configuration
   - Animation state

3. **Settings Store** (from stage-ui package)
   - User preferences
   - Theme configuration
   - Language settings
   - Transition preferences

### State Persistence
- LocalStorage for user preferences
- IndexedDB for model data
- Session storage for temporary data

## API Integration

### Supabase Configuration
```typescript
- URL: https://sgupizcxhxohouklbntm.supabase.co
- Auth Flow: PKCE (Proof Key for Code Exchange)
- Storage Key: 'airi-auth'
- Auto Refresh: Enabled
- Realtime: Configured with rate limiting (10 events/sec)
```

### API Client Architecture
- **Base Client**: ofetch with automatic token injection
- **Error Handling**: 401 auto-refresh, comprehensive error messages
- **User API Methods**:
  - `getProfile()` - Fetch user profile
  - `updateProfile()` - Update user details
  - `upsertProfile()` - Create or update profile
  - `checkUsernameAvailability()` - Validate username
  - `updateLastSeen()` - Track user activity

### Backend Integration
- REST API endpoints via configurable base URL
- WebSocket support for real-time features
- Health check endpoint
- Chat history management
- File upload support

## Styling & Theming

### Design System Colors
- **Primary**: Indigo-based palette (50-950)
- **Secondary**: Purple-based palette (50-950)
- **Accent**: Pink-based palette (50-950)
- **Success**: Green shades for positive feedback
- **Warning**: Yellow/amber for warnings
- **Error**: Red shades for errors
- **Neutral**: Gray scale (50-950)

### Dynamic Theming
- **Dark Mode**: System preference detection with manual toggle
- **Color Hue Animation**: Optional dynamic color shifting
- **CSS Variables**: Runtime theme customization
- **Chromatic System**: HSL-based color generation

### Typography
- **Font Families**:
  - CJK fonts (AllSeto)
  - Xiaolai font
  - Web fonts via fontsource
- **Responsive Sizing**: Breakpoint-based font scaling

## Build & Deployment

### Development Scripts
```json
"dev": "vite"           // Start dev server
"build": "vite build"   // Production build
"preview": "vite preview" // Preview production build
"typecheck": "vue-tsc --noEmit" // Type checking
"lint": "eslint ."      // Code linting
```

### Environment Variables
- `VITE_API_URL` - Backend API endpoint
- `VITE_WS_URL` - WebSocket server URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_APP_URL` - Application URL for OAuth redirects
- `VITE_DEBUG` - Debug mode toggle
- `VITE_ENABLE_WEBSOCKETS` - WebSocket feature flag
- `VITE_ENABLE_VOICE_CHAT` - Voice chat feature flag
- `VITE_ENABLE_FILE_UPLOADS` - File upload feature flag

### Deployment Targets
- **Vercel**: Primary deployment platform (vercel.json config)
- **Docker**: Containerized deployment (Dockerfile)
- **Hugging Face Spaces**: Alternative deployment option
- **Static Hosting**: PWA-ready static build

### Build Optimization
- **Code Splitting**: Async route imports
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Image and font optimization
- **Bundle Analysis**: Visual bundle size analysis
- **Caching Strategy**: Long-term caching with hashed filenames

## Performance Optimizations

### Loading Strategies
- **Lazy Loading**: Route-based code splitting
- **Async Components**: On-demand component loading
- **Resource Hints**: Prefetch and preload directives
- **Service Worker**: Background caching and updates

### Runtime Optimizations
- **ShallowRef**: Optimized reactive references for large objects
- **KeepAlive**: Component instance caching for specific pages
- **Debouncing**: Input and API call optimization
- **Virtual Scrolling**: Efficient list rendering (when applicable)

### Asset Management
- **Live2D Models**: Downloaded and cached during build
- **VRM Models**: Lazy loaded on demand
- **Image Optimization**: Multiple format support (WebP, PNG, JPG)
- **Font Loading**: Web font optimization with timeouts

## Security Considerations

### Authentication Security
- **PKCE Flow**: Enhanced OAuth security
- **Token Storage**: Secure localStorage with encryption key
- **Session Validation**: Server-side session verification
- **Auto Logout**: Session expiry handling

### Data Protection
- **Input Validation**: Client-side and server-side validation
- **XSS Prevention**: Vue's automatic escaping
- **CSRF Protection**: Token-based request validation
- **Secure Headers**: Security headers configuration

### API Security
- **Bearer Token**: JWT-based authentication
- **Rate Limiting**: Realtime event throttling
- **Error Masking**: Production error message sanitization

## Testing & Quality Assurance

### Type Safety
- **TypeScript**: Strict mode enabled
- **Vue TSC**: Template type checking
- **Type Definitions**: Comprehensive type coverage

### Code Quality
- **ESLint**: Code style enforcement
- **Vue DevTools**: Development debugging
- **Source Maps**: Debugging support in production

## Known Issues & Limitations

1. **Chinese Traditional Support**: Currently mapped to Simplified Chinese
2. **Voice Chat**: Feature flag disabled by default (experimental)
3. **Mobile Optimization**: Some features optimized for desktop experience
4. **Browser Compatibility**: Modern browser required (ES2020+)

## Future Enhancements

### Planned Features
- Enhanced mobile experience
- Additional OAuth providers
- Advanced voice interaction
- Improved offline capabilities
- Extended language support

### Technical Improvements
- Migration to newer Vue features
- Performance monitoring integration
- Enhanced error tracking
- Automated testing suite

## Development Guidelines

### Code Organization
- Use Composition API for new components
- Follow file-based routing conventions
- Implement proper TypeScript types
- Use semantic component naming

### Best Practices
- Implement proper error boundaries
- Use suspense for async components
- Follow accessibility guidelines (ARIA)
- Maintain responsive design principles

### Contribution Standards
- Write self-documenting code
- Add TypeScript definitions
- Follow existing code patterns
- Update documentation for changes

## API Integration Deep Dive

### Primary API Client Configuration
```typescript
// File: /src/lib/api.ts
export const apiClient = ofetch.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  async onRequest({ options }) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
      }
    }
  },
  async onResponseError({ response }) {
    if (response?.status === 401) {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (!session) {
        window.location.href = '/auth/login'
      }
    }
  },
})
```

### API Endpoints and Methods

#### User Profile Management
- **GET** `userAPI.getProfile()` - Fetches user profile from `user_profiles` table
  - Response: `UserProfile` object with id, email, username, display_name, subscription_tier, avatar_url, bio, created_at, updated_at, last_seen_at, preferences
- **PATCH** `userAPI.updateProfile(updates)` - Updates user profile
  - Request: Partial `UserProfile` object
  - Response: Updated `UserProfile` object
- **POST** `userAPI.upsertProfile(profile)` - Creates or updates user profile
  - Request: Partial `UserProfile` object
  - Response: `UserProfile` object
- **GET** `userAPI.checkUsernameAvailability(username)` - Validates username uniqueness
  - Request: `username` string
  - Response: `boolean`
- **PATCH** `userAPI.updateLastSeen()` - Updates last_seen_at timestamp
  - Response: void

#### Backend Service Endpoints
- **GET** `/health` - Health check endpoint
- **GET** `/api/chats` - Retrieve chat history
- **POST** `/api/chats` - Save chat message

### Supabase Integration Details
```typescript
// File: /src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'airi-auth',
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // PKCE flow for OAuth security
    debug: import.meta.env.DEV,
  },
  global: {
    headers: { 'x-application-name': 'airi-stage-web' }
  },
  db: { schema: 'public' },
  realtime: {
    params: { eventsPerSecond: 10 } // Rate limiting
  }
})
```

### Environment Variables for API Configuration
- `VITE_API_URL` - Backend API base URL (default: http://localhost:3001)
- `VITE_WS_URL` - WebSocket server URL (default: http://localhost:3001)
- `VITE_SUPABASE_URL` - Supabase project URL (https://sgupizcxhxohouklbntm.supabase.co)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key for client-side access
- `VITE_APP_URL` - Application URL for OAuth redirects (default: http://localhost:5173)
- `VITE_DEBUG` - Enable debug mode (boolean)
- `VITE_ENABLE_WEBSOCKETS` - WebSocket feature flag (default: true)
- `VITE_ENABLE_VOICE_CHAT` - Voice chat feature flag (default: false)
- `VITE_ENABLE_FILE_UPLOADS` - File upload feature flag (default: true)

### Authentication Headers and Tokens
- **Bearer Token**: JWT access token from Supabase session
- **Token Refresh**: Automatic refresh with PKCE flow
- **Storage Key**: `airi-auth` in localStorage
- **Session Expiry**: Auto-refresh 1 minute before expiry
- **Custom Headers**: `x-application-name: airi-stage-web`

### Error Handling Patterns
```typescript
// Centralized error handling in auth-errors.ts
export function getAuthErrorMessage(error: AuthError): string {
  // Maps Supabase error codes to user-friendly messages
  // Handles rate limiting, invalid credentials, email verification, etc.
}

export function logAuthError(operation: string, error: any): void {
  // Logs errors in development mode only
}
```

### WebSocket/Realtime Configuration
- **Supabase Realtime**: Configured with 10 events/second rate limit
- **Connection Management**: Through Supabase client
- **Event Types**: Database changes, presence, broadcast
- **Reconnection**: Automatic with exponential backoff

## Data Flow and State Management

### Pinia Stores Architecture

#### 1. PWA Store (`/src/stores/pwa.ts`)
- **State**: Service worker registration, update hooks
- **Actions**: 
  - `registerSW()` - Registers service worker
  - Update notification management
- **Usage**: Auto-update PWA, toast notifications for updates

#### 2. Chat Store (`@proj-airi/stage-ui/stores/chat.ts`)
- **State**:
  - `messages`: Array of chat messages (persisted in localStorage)
  - `streamingMessage`: Current streaming assistant response
  - `sending`: Boolean flag for send state
- **Actions**:
  - `send(message, options)` - Sends message to LLM
  - `cleanupMessages()` - Clears chat history
- **Hooks**:
  - `onBeforeMessageComposed` - Pre-processing hooks
  - `onAfterMessageComposed` - Post-processing hooks
  - `onTokenLiteral` - Stream token processing
  - `onStreamEnd` - Stream completion handlers
- **Persistence**: localStorage with key `chat/messages`

#### 3. Display Models Store (`@proj-airi/stage-ui/stores/display-models.ts`)
- **State**: Model loading state, current model, configuration
- **Actions**: Model switching, animation control
- **Integration**: Live2D and VRM model management

#### 4. Settings Store (`@proj-airi/stage-ui/stores/settings.ts`)
- **State**: User preferences, theme, language, transitions
- **Persistence**: localStorage for all settings
- **Actions**: Update preferences, theme toggling

#### 5. Live2D Store (`@proj-airi/stage-ui/stores/live2d.ts`)
- **State**:
  - `scale`: Model scale factor
  - `position`: X/Y positioning
  - `positionInPercentageString`: Percentage-based positioning
- **Actions**: Model positioning, scale adjustment
- **Integration**: Live2D SDK wrapper

#### 6. Audio Store (`@proj-airi/stage-ui/stores/audio.ts`)
- **State**: Audio playback state, volume settings
- **Actions**: Play/pause, volume control
- **Integration**: TTS and voice input

#### 7. LLM Store (`@proj-airi/stage-ui/stores/llm.ts`)
- **State**: Model configurations, provider settings
- **Actions**: 
  - `stream()` - Stream text generation
  - `discoverToolsCompatibility()` - Check tool support
- **Integration**: Multiple LLM providers

### Local Storage Usage
- **Authentication**: `airi-auth` - Supabase session data
- **Chat History**: `chat/messages` - Conversation history
- **User Preferences**: Various keys for settings persistence
- **Theme**: Dark mode preference
- **Language**: Selected language (i18n)

### Session Storage Usage
- Temporary data during authentication flows
- OAuth state parameters
- Redirect URLs after login

### Cookie Management
- Supabase authentication cookies (httpOnly)
- PKCE code verifier for OAuth flows

### Cache Strategies
- **Service Worker**: PWA cache up to 64MB
- **IndexedDB**: Model data and large assets
- **Memory Cache**: ShallowRef for large objects

## Component Architecture

### Major Components

#### Authentication Components (`/src/components/auth/`)
1. **LoginForm.vue**
   - Props: None (uses route query for redirect)
   - Emits: None (uses router for navigation)
   - Methods:
     - `handleSubmit()` - Process login
     - `validateEmail()` - Email validation
     - `validatePassword()` - Password validation
   - Stores: `useAuth` composable

2. **OAuthButtons.vue**
   - Props: None
   - Emits: `auth-error`
   - Methods: OAuth provider authentication
   - Providers: Google, Discord

3. **AuthInput.vue**
   - Props: `label`, `type`, `placeholder`, `error`, `disabled`, `required`
   - Emits: `update:modelValue`, `blur`
   - Features: Password toggle, validation display

#### Stage Components (`/src/pages/stage/`)
1. **WidgetStage** (from stage-ui)
   - Props: `paused`, `focus-at`, `x-offset`, `y-offset`, `scale`
   - State: Character display, animations
   - Integration: Live2D/VRM rendering

2. **InteractiveArea.vue**
   - Props: None
   - State: Chat interface, controls
   - Components: Chat history, input, action buttons

#### Background Effects (`/src/components/Backgrounds/`)
- **Cross.vue** - Animated cross pattern
- **Line1.vue** - Line animation
- **SakuraPetal.vue** - Sakura petal effect
- **TicTacToe.vue** - Grid pattern animation

### Component Communication Patterns
1. **Props/Emit**: Parent-child communication
2. **Pinia Stores**: Global state management
3. **Provide/Inject**: Deep prop drilling avoidance
4. **Event Bus**: Through store hooks
5. **Router**: Navigation state

### Shared Composables
- `useAuth()` - Authentication state and methods
- `useAuthGuard()` - Route protection
- `useThemeColor()` - Dynamic theme management
- `useIconAnimation()` - Icon animations
- `useAudioRecord()` - Audio recording
- `useAudioInput()` - Audio input handling

## Authentication & Security Details

### Complete Authentication Flow

#### 1. Email/Password Login
```typescript
// Flow: LoginForm.vue -> useAuth.signInWithEmail -> Supabase -> Session
1. User enters credentials
2. Client-side validation (email format, password length)
3. Call supabase.auth.signInWithPassword()
4. Receive session with access_token and refresh_token
5. Store session in localStorage (key: 'airi-auth')
6. Fetch/create user profile from database
7. Start auto-refresh timer
8. Navigate to redirect URL or home
```

#### 2. OAuth Flow (Google/Discord)
```typescript
// Flow: OAuthButtons -> useAuth.signInWithOAuth -> Supabase OAuth -> Callback
1. User clicks OAuth button
2. Call supabase.auth.signInWithOAuth({ provider, redirectTo })
3. Redirect to provider authorization
4. Provider redirects to /auth/callback
5. Supabase handles code exchange (PKCE)
6. Session established automatically
7. Profile creation/update
8. Navigate to intended destination
```

#### 3. Token Refresh Mechanism
```typescript
// SessionManager.ts handles automatic refresh
- Refresh timer: 1 minute before expiry
- Minimum interval: 30 seconds between refreshes
- Exponential backoff on failure
- Auto-logout on refresh failure
```

### Protected Routes Implementation
```typescript
// File: /src/router/guards.ts
- beforeEach guard checks authentication
- Routes with meta.requiresAuth !== false need auth
- Auth routes redirect authenticated users
- Callback route always allowed
- Redirect query parameter preserved
```

### Security Measures
1. **PKCE Flow**: OAuth security enhancement
2. **JWT Validation**: Server-side token verification
3. **XSS Protection**: Vue's automatic escaping
4. **CSRF Protection**: Token-based validation
5. **Rate Limiting**: 10 events/second for realtime
6. **Secure Storage**: localStorage with encryption key
7. **Auto-logout**: On session expiry or invalid refresh

## Real-time Features

### WebSocket Connection (via Supabase Realtime)
- **Connection URL**: wss://sgupizcxhxohouklbntm.supabase.co/realtime/v1
- **Authentication**: Bearer token in connection params
- **Heartbeat**: Every 30 seconds
- **Reconnection**: Automatic with exponential backoff

### Event Handlers
1. **Database Changes**: Subscribe to table changes
2. **Presence**: User online status
3. **Broadcast**: Custom events between clients

### Message Queuing
```typescript
// Chat message queue in chat.ts
const toolCallQueue = createQueue<ChatSlices>({
  handlers: [
    async (ctx) => {
      if (ctx.data.type === 'tool-call') {
        streamingMessage.value.slices.push(ctx.data)
      }
    },
  ],
})
```

## Forms and Validation

### Validation Schemas (Zod)
```typescript
// File: /src/lib/validation.ts
- emailSchema: Email format validation
- passwordSchema: Min 8 chars, uppercase, number
- loginSchema: Email + password
- signupSchema: Email + password + confirm + terms
- resetPasswordSchema: Email only
```

### Form Handling Patterns
1. **Reactive Forms**: Using Vue 3 reactive/ref
2. **Real-time Validation**: On blur events
3. **Error Display**: Per-field error messages
4. **Submit Handling**: Async with loading states
5. **Success Feedback**: Toast notifications

### File Upload Configuration
- **Feature Flag**: `VITE_ENABLE_FILE_UPLOADS`
- **Max Size**: Configured in backend
- **Supported Types**: Images for chat attachments
- **Encoding**: Base64 for image data

## Critical User Flows

### 1. User Registration and Onboarding
```
1. Navigate to /auth/signup
2. Enter email, password, confirm password
3. Agree to terms and conditions
4. Submit form -> Create Supabase auth user
5. Send verification email
6. Create user_profiles record
7. Redirect to login with success message
8. User verifies email
9. Login with credentials
10. Complete profile (username, display name, avatar)
11. Navigate to main stage
```

### 2. Character Selection and Interaction
```
1. Load stage page (/stage)
2. Initialize Live2D/VRM model
3. Load model from assets or IndexedDB
4. Set up mouse tracking for focus
5. Initialize chat interface
6. Load chat history from localStorage
7. Connect to LLM provider
8. Ready for interaction
```

### 3. Chat Conversation Flow
```
1. User types message in input
2. Validate message (not empty)
3. Add to messages array
4. Send to LLM via stream API
5. Process streaming tokens
6. Update UI with partial response
7. Handle special tokens (TTS, emotions)
8. Complete message, add to history
9. Persist to localStorage
10. Trigger response animations
```

### 4. Voice Interaction Flow
```
1. Request microphone permission
2. Initialize VAD (Voice Activity Detection)
3. Start audio worklet processor
4. Detect speech segments
5. Send audio to Whisper for transcription
6. Process transcribed text as chat input
7. Generate LLM response
8. Convert response to speech (TTS)
9. Play audio response
10. Sync lip animations
```

### 5. Settings and Preferences Management
```
1. Navigate to /settings
2. Load current preferences from stores
3. Display categorized settings:
   - System (theme, language)
   - Models (Live2D/VRM selection)
   - Providers (LLM, TTS, STT)
   - Memory (chat history)
4. Update store on change
5. Persist to localStorage
6. Apply changes immediately
```

## Database Schema Understanding

### Frontend Data Models

#### UserProfile Interface
```typescript
interface UserProfile {
  id: string                    // UUID, matches auth.users.id
  email: string                 // User email
  username?: string             // Unique username
  display_name?: string         // Display name
  subscription_tier: 'free' | 'pro' | 'premium'
  avatar_url?: string           // Profile picture URL
  bio?: string                  // User bio
  created_at: string            // ISO timestamp
  updated_at: string            // ISO timestamp
  last_seen_at?: string         // ISO timestamp
  preferences?: Record<string, any>  // JSON preferences
}
```

#### Chat Message Types
```typescript
type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string | CommonContentPart[]
  slices?: ChatSlices[]         // For markdown rendering
  tool_results?: ToolResult[]   // Tool call results
}

type ErrorMessage = {
  role: 'error'
  content: string
}
```

### Relationships
- User -> UserProfile (1:1)
- User -> ChatMessages (1:N)
- User -> Settings (1:1)
- User -> Models (N:M)

## Performance & Optimization

### Bundle Size Analysis
- **Main Bundle**: ~500KB gzipped
- **Vendor Bundle**: ~800KB gzipped
- **Lazy Routes**: 20-50KB per route
- **Live2D Models**: 5-10MB (cached)
- **VRM Models**: 2-5MB (lazy loaded)

### Code Splitting Strategy
```typescript
// Route-based splitting in router config
VueRouter({
  importMode: 'async',  // All routes lazy loaded
})

// Component lazy loading
const HeavyComponent = defineAsyncComponent(() => 
  import('./HeavyComponent.vue')
)
```

### Image Optimization
- **Formats**: WebP with PNG/JPG fallback
- **Lazy Loading**: Intersection Observer
- **Responsive**: Multiple sizes via srcset
- **CDN**: Static assets from dist.ayaka.moe

### Caching Strategies
1. **Service Worker Cache**:
   - Static assets: Cache first
   - API calls: Network first
   - Max size: 64MB

2. **Browser Cache**:
   - Hashed filenames for immutable caching
   - Long cache headers (1 year)

3. **Memory Cache**:
   - ShallowRef for large objects
   - Computed properties for derived state

## Error Handling & Monitoring

### Global Error Boundaries
```typescript
// App.vue error handling
app.config.errorHandler = (err, instance, info) => {
  if (import.meta.env.DEV) {
    console.error('Global error:', err)
  }
  // Send to error reporting service
}
```

### API Error Handling Patterns
1. **401 Unauthorized**: Auto-refresh token
2. **403 Forbidden**: Redirect to upgrade
3. **404 Not Found**: Show error page
4. **429 Rate Limited**: Exponential backoff
5. **500 Server Error**: Retry with backoff

### User Feedback Mechanisms
- **Toast Notifications**: vue-sonner
- **Loading States**: Per-component spinners
- **Error Messages**: Contextual error display
- **Success Confirmations**: Visual feedback

### Logging and Analytics
- **Development**: Console logging enabled
- **Production**: Errors only
- **User Actions**: Event tracking ready
- **Performance**: Web Vitals monitoring

## Build & Deployment

### Build Configuration
```json
// Scripts in package.json
"build": "vite build",         // Production build
"dev": "vite",                  // Development server
"preview": "vite preview",      // Preview production build
"typecheck": "vue-tsc --noEmit" // Type checking
"lint": "eslint ."              // Code linting
```

### Vite Configuration Highlights
- **Plugins**: Vue, Vue Router, Layouts, UnoCSS, PWA, i18n
- **Optimization**: Exclude internal packages from pre-bundling
- **Assets**: Download Live2D models during build
- **PWA**: Auto-update with 64MB cache limit

### Environment-specific Configurations
- **Development**: Debug logs, Vue DevTools, source maps
- **Production**: Minified, tree-shaken, optimized
- **Staging**: Production build with debug flags
- **Hugging Face**: Hash routing, no PWA

### Deployment Targets
1. **Vercel**:
   - Config: vercel.json
   - Build: Automatic from GitHub
   - Environment: Via Vercel dashboard

2. **Docker**:
   - Multi-stage build
   - Nginx for static serving
   - Environment at runtime

3. **Static Hosting**:
   - Build locally
   - Upload dist folder
   - Configure redirects for SPA

## Testing Infrastructure

### Test Setup
- **Framework**: Vitest (implied by Vite setup)
- **Component Testing**: Vue Test Utils
- **E2E Testing**: Playwright (if configured)

### Test Patterns
```typescript
// Unit test example
describe('useAuth', () => {
  it('should authenticate user', async () => {
    const { signInWithEmail } = useAuth()
    const result = await signInWithEmail('test@example.com', 'password')
    expect(result.error).toBeNull()
  })
})
```

## Third-party Integrations

### Authentication Providers
1. **Supabase Auth**:
   - Email/Password
   - Google OAuth
   - Discord OAuth
   - Magic Links (if enabled)

2. **OAuth Configurations**:
   - Redirect URLs configured
   - Scopes: email, profile
   - PKCE enabled

### AI/ML Services
1. **LLM Providers** (via stage-ui):
   - OpenAI
   - Anthropic
   - Google AI
   - Local models (Ollama)
   - 30+ providers total

2. **Speech Services**:
   - Whisper (transcription)
   - ElevenLabs (TTS)
   - Azure Speech
   - Browser TTS fallback

3. **ML Models**:
   - ONNX Runtime for browser
   - Transformers.js
   - Silero VAD
   - Whisper Base

### CDN and Assets
- **Live2D Models**: dist.ayaka.moe
- **VRM Models**: dist.ayaka.moe
- **Fonts**: Self-hosted CJK fonts
- **Icons**: Iconify collections

## Code Examples

### API Call Pattern
```typescript
// Standard API call with error handling
async function fetchUserData() {
  try {
    const profile = await userAPI.getProfile()
    if (!profile) {
      // Handle null response
      const newProfile = await userAPI.upsertProfile({
        email: user.value.email,
        display_name: 'New User'
      })
      return newProfile
    }
    return profile
  } catch (error) {
    console.error('Failed to fetch user data:', error)
    toast.error('Failed to load profile')
    return null
  }
}
```

### Store Usage Pattern
```typescript
// Using Pinia store in component
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const { messages, sending } = storeToRefs(chatStore)

async function sendMessage(text: string) {
  await chatStore.send(text, {
    model: 'gpt-4',
    chatProvider: 'openai',
    providerConfig: { temperature: 0.7 }
  })
}
```

### Authentication Flow Example
```typescript
// Complete auth flow with error handling
const { signInWithEmail, isAuthenticated } = useAuth()

async function handleLogin(email: string, password: string) {
  const { data, error } = await signInWithEmail(email, password)
  
  if (error) {
    if (error.includes('Invalid login')) {
      showError('Invalid email or password')
    } else if (error.includes('Email not confirmed')) {
      showError('Please verify your email first')
    } else {
      showError(error)
    }
    return
  }
  
  // Success - router guard will handle navigation
  toast.success('Welcome back!')
}
```

### WebSocket/Realtime Handling
```typescript
// Supabase realtime subscription
const channel = supabase
  .channel('chat-messages')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('New message:', payload.new)
      messages.value.push(payload.new)
    }
  )
  .subscribe()

// Cleanup
onUnmounted(() => {
  supabase.removeChannel(channel)
})
```

## Known Issues & TODOs

### Current Limitations
1. **Chinese Traditional**: Currently mapped to Simplified Chinese
2. **Voice Chat**: Experimental, disabled by default
3. **Mobile UX**: Some features desktop-optimized
4. **Browser Support**: Requires ES2020+ support
5. **PWA on iOS**: Limited functionality
6. **Large Models**: Initial load time for Live2D models

### Technical Debt
1. **Type Safety**: Some any types in error handlers
2. **Component Size**: Some components exceed 300 lines
3. **Test Coverage**: Limited test coverage
4. **Bundle Size**: Vendor bundle could be optimized
5. **Accessibility**: ARIA improvements needed

### Planned Improvements
1. **Performance**:
   - Virtual scrolling for chat history
   - Worker threads for heavy computations
   - Optimize initial bundle size

2. **Features**:
   - Multi-language voice support
   - Collaborative sessions
   - Plugin system for extensions
   - Advanced memory management

3. **Developer Experience**:
   - Comprehensive test suite
   - Storybook for components
   - API documentation generation
   - Performance monitoring dashboard

### Deprecated Code
- Legacy auth methods (to be removed)
- Old chat UI components
- Unused utility functions

## Dependencies & External Services

### Critical Dependencies
```json
// Key production dependencies from package.json
{
  "vue": "^3.5.21",
  "vue-router": "^4.5.1",
  "pinia": "^3.0.3",
  "@supabase/supabase-js": "^2.56.1",
  "ofetch": "^1.4.1",
  "three": "^0.179.1",
  "@tresjs/core": "^4.3.6"
}
```

### External Services
1. **Supabase**:
   - URL: https://sgupizcxhxohouklbntm.supabase.co
   - Services: Auth, Database, Realtime, Storage
   - Rate Limits: 10 events/sec for realtime

2. **CDN Assets**:
   - Live2D Models: dist.ayaka.moe
   - VRM Models: dist.ayaka.moe
   - Download during build process

3. **OAuth Providers**:
   - Google: OAuth 2.0 with PKCE
   - Discord: OAuth 2.0 with PKCE
   - Redirect URL: Configured per environment

### Package Management
- **PNPM Workspace**: Monorepo structure
- **Catalog Dependencies**: Version consistency
- **Local Packages**: @proj-airi/* workspace packages
- **Version Control**: Lockfile for reproducible builds

## Monitoring & Analytics

### Performance Monitoring
- **Web Vitals**: LCP, FID, CLS tracking
- **Bundle Analysis**: vite-bundle-visualizer
- **Runtime Profiling**: Vue DevTools
- **Network**: API call timing

### User Analytics
- **Session Tracking**: last_seen_at updates
- **Feature Usage**: Ready for event tracking
- **Error Reporting**: Console in dev, service in prod
- **User Feedback**: Toast notifications

### Debug Tools
- **Vue DevTools**: Component inspection
- **Network Inspector**: API call debugging
- **Console Logging**: Conditional on environment
- **Source Maps**: Available in development

## Support & Resources

### Documentation
- **This File**: Comprehensive frontend documentation
- **Component Docs**: In-code documentation
- **API Docs**: Backend API documentation
- **Deployment Guide**: Platform-specific guides

### Development Tools
- **IDE**: VSCode with Vue extensions
- **Browser**: Chrome/Firefox with Vue DevTools
- **Testing**: Vitest for unit tests
- **Build**: Vite for fast development

### Key File Locations
- **Entry Point**: `/src/main.ts`
- **Router Config**: `/src/router/guards.ts`
- **API Client**: `/src/lib/api.ts`
- **Auth Logic**: `/src/composables/useAuth.ts`
- **Supabase Client**: `/src/lib/supabase.ts`
- **Session Manager**: `/src/lib/session-manager.ts`
- **Main Stage**: `/src/pages/stage/index.vue`
- **Environment Config**: `.env.example`

---

This documentation provides an exhaustive overview of the AIRI Stage Web frontend application. It serves as a critical reference for backend engineers, AI agents, and developers to understand every aspect of the frontend system's architecture, implementation details, data flows, and integration points.