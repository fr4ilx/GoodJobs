/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly VITE_GITHUB_TOKEN?: string;
  readonly VITE_APIFY_TOKEN?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
