import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Kasir Kayesha — Vite untuk PWA offline-first.
// Tidak ada proxy API pada Phase 2: aplikasi bekerja penuh dari perangkat.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    // Service worker ditulis manual di public/sw.js — bukan hasil bundel.
    sourcemap: false,
  },
});
