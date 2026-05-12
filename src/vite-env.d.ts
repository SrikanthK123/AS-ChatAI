/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_MODEL_NAME: string
  readonly VITE_MAX_TOKENS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
