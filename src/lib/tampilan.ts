/**
 * Penerapan pengaturan tampilan (BU-32): skala huruf & tema warna UI.
 *
 * BATAS TEGAS (BU-25): pengaturan ini HANYA untuk UI aplikasi.
 * Ukuran font & layout dokumen/nota (src/lib/dokumen.ts, PDF/PNG) TETAP fix.
 * Di sini kita hanya setel data-tema pada <html> dan font-size root (rem).
 */
import type { Tema } from "../db/schema.ts";

/** Opsi skala font yang ditawarkan (BU-32). 1 = normal. */
export const SKALA_FONT: readonly number[] = [0.9, 1, 1.15, 1.3];

/** Label tampilan untuk tiap skala (urutan sama dengan SKALA_FONT). */
export const LABEL_SKALA: readonly string[] = ["Kecil", "Normal", "Besar", "Sangat besar"];

/** Opsi tema yang ditawarkan (BU-32). */
export const DAFTAR_TEMA: readonly Tema[] = ["terang", "gelap", "krem"];

/** Label ramah untuk tiap tema (urutan sama dengan DAFTAR_TEMA). */
export const LABEL_TEMA: Record<Tema, string> = {
  terang: "Terang",
  gelap: "Gelap",
  krem: "Krem",
};

/** Setel skala huruf root; 1 = bawaan browser (16px). Aman di lingkungan tanpa DOM. */
export function terapkanSkalaFont(skala: number): void {
  if (typeof document === "undefined") return;
  const sah = SKALA_FONT.includes(skala) ? skala : 1;
  document.documentElement.style.fontSize = (sah * 100).toString() + "%";
}

/** Setel tema warna via atribut data-tema pada <html>. */
export function terapkanTema(tema: Tema): void {
  if (typeof document === "undefined") return;
  const sah: Tema = DAFTAR_TEMA.includes(tema) ? tema : "terang";
  document.documentElement.setAttribute("data-tema", sah);
}

/** Terapkan keduanya sekaligus (dipakai saat app dibuka & setiap setting berubah). */
export function terapkanTampilan(skala: number, tema: Tema): void {
  terapkanSkalaFont(skala);
  terapkanTema(tema);
}
