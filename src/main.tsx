import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/tokens.css";
import "./styles/base.css";
import { daftarkanServiceWorker } from "./pwa/register.ts";

const el = document.getElementById("root");
if (!el) throw new Error("Elemen #root tidak ditemukan");

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker hanya di produksi; saat `npm run dev` ia akan mengganggu HMR.
daftarkanServiceWorker();
