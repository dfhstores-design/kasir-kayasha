/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
