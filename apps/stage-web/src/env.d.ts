/// <reference types="vite/client" />

interface ImportMetaEnv {
  // DEPRECATED: API calls now use service binding via worker proxy
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string

  readonly VITE_ENVIRONMENT: 'development' | 'production'
  readonly VITE_APP_TARGET_HUGGINGFACE_SPACE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
