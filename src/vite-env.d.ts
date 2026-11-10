/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  /** Alamat endpoint sinkronisasi; kosong = sinkronisasi tidak aktif. */
  readonly VITE_SYNC_URL?: string;
  /** Token opsional untuk endpoint sinkronisasi. */
  readonly VITE_SYNC_TOKEN?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
