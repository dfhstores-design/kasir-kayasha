import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ambilSettings } from "./db/repositori.ts";
import { terapkanTampilan } from "./lib/tampilan.ts";
import "./styles/tokens.css";
import "./styles/base.css";
import { daftarkanServiceWorker } from "./pwa/register.ts";

// Terapkan pengaturan tampilan (skala huruf & tema) sebelum render agar tidak berkedip.
void ambilSettings()
  .then((s) => terapkanTampilan(s.skalaFont, s.tema))
  .catch(() => { /* bawaan: terang + normal */ });

const el = document.getElementById("root");
if (!el) throw new Error("Elemen #root tidak ditemukan");

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker hanya di produksi; saat `npm run dev` ia akan mengganggu HMR.
daftarkanServiceWorker();
