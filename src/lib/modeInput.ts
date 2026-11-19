/**
 * Mode input pesanan jahit (BU-22): wizard langkah-demi-langkah atau
 * satu layar sekaligus. Mode bisa dipilih lewat:
 *   - param URL `?mode=wizard` / `?mode=satu-layar` (link pembanding),
 *   - pilihan terakhir yang tersimpan di localStorage,
 *   - bawaan: satu layar (keputusan Tante 19 Nov 2026, "Menggunakan 1 layar").
 * Param URL selalu menang atas simpanan, supaya tiap link pembanding
 * selalu membuka model yang dimaksud.
 */

export type ModeInput = "wizard" | "satu-layar";

export const KUNCI_MODE_INPUT = "kayesa-mode-input";

/** Mode awal: param URL > simpanan > satu layar. */
export function bacaModeInput(search: string, tersimpan: string | null): ModeInput {
  try {
    const p = new URLSearchParams(search).get("mode");
    if (p === "wizard" || p === "satu-layar") return p;
  } catch {
    // URL tidak bisa dibaca: lanjut ke simpanan.
  }
  if (tersimpan === "wizard" || tersimpan === "satu-layar") return tersimpan;
  return "satu-layar";
}

/**
 * Layar awal dari param URL, untuk link pembanding yang langsung membuka
 * form pesanan jahit. Di luar itu kembalikan null (beranda).
 */
export function layarAwalDariUrl(search: string): "wizard-jahit" | null {
  try {
    return new URLSearchParams(search).get("layar") === "pesanan-jahit" ? "wizard-jahit" : null;
  } catch {
    return null;
  }
}
