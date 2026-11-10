import { defineConfig } from "vitest/config";

// Tes unit berjalan di Node dengan jsdom hanya untuk berkas yang butuh DOM
// (komponen React, IndexedDB lewat fake-indexeddb).
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
  },
});
