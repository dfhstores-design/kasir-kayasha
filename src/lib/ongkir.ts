/**
 * Ongkos kirim — empat keadaan (BAZAR-PARKIR-RESI.md bagian 4a).
 *
 *   ambil_sendiri     Rp 0  — tidak dikirim
 *   butik             Rp n  — ditagihkan butik, MASUK total
 *   kurir             Rp 0  — dibayar langsung penerima ke kurir, tidak masuk total
 *   belum_ditentukan  null  — belum dapat nilainya, boleh diisi kemudian
 *
 * Invarian yang dijaga:
 * 1. `ongkirDitagihkanButik` = 0 untuk semua mode kecuali "butik".
 * 2. Mode "belum_ditentukan" TIDAK sama dengan Rp 0 — resi harus bisa membedakannya.
 * 3. Nominal hanya boleh non-nol untuk mode "butik".
 */
import type { Rupiah } from "./money.ts";

export type OngkirMode = "ambil_sendiri" | "butik" | "kurir" | "belum_ditentukan";

export const ONGKIR_MODES: readonly OngkirMode[] = [
  "ambil_sendiri",
  "butik",
  "kurir",
  "belum_ditentukan",
] as const;

export interface Ongkir {
  mode: OngkirMode;
  /** null hanya sah untuk mode "belum_ditentukan". */
  nominal: Rupiah | null;
}

export const ONGKIR_GRATIS: Ongkir = { mode: "ambil_sendiri", nominal: 0 };

export type OngkirError =
  | "nominal_negatif"
  | "nominal_tidak_kosong"
  | "nominal_kosong"
  | "mode_tidak_dikenal";

export type OngkirResult =
  | { ok: true; value: Ongkir }
  | { ok: false; error: OngkirError };

/**
 * Membuat Ongkir yang sah. Menolak kombinasi mode/nominal yang tidak konsisten,
 * supaya "belum ditentukan" tidak pernah diam-diam menjadi Rp 0.
 */
export function buatOngkir(mode: OngkirMode, nominal: Rupiah | null): OngkirResult {
  if (!ONGKIR_MODES.includes(mode)) return { ok: false, error: "mode_tidak_dikenal" };

  if (mode === "belum_ditentukan") {
    if (nominal !== null) return { ok: false, error: "nominal_tidak_kosong" };
    return { ok: true, value: { mode, nominal: null } };
  }

  if (nominal === null) return { ok: false, error: "nominal_kosong" };
  if (!Number.isInteger(nominal) || nominal < 0) return { ok: false, error: "nominal_negatif" };

  if (mode === "ambil_sendiri" || mode === "kurir") {
    // Keduanya selalu 0. Nominal lain kemungkinan salah ketik.
    if (nominal !== 0) return { ok: false, error: "nominal_tidak_kosong" };
    return { ok: true, value: { mode, nominal: 0 } };
  }

  return { ok: true, value: { mode, nominal } };
}

/** Bagian ongkir yang MASUK tagihan butik. Selalu 0 bila belum ditentukan. */
export function ongkirDitagihkanButik(ongkir: Ongkir): Rupiah {
  if (ongkir.mode !== "butik") return 0;
  return ongkir.nominal ?? 0;
}

/** True bila nominalnya belum diketahui (bukan Rp 0). */
export function ongkirBelumDitentukan(ongkir: Ongkir): boolean {
  return ongkir.mode === "belum_ditentukan";
}

/** Teks resi untuk baris ongkir. */
export function labelOngkirResi(ongkir: Ongkir): string {
  switch (ongkir.mode) {
    case "ambil_sendiri":
      return "Rp0";
    case "kurir":
      return "Dibayar langsung ke kurir";
    case "belum_ditentukan":
      return "Belum ditentukan";
    case "butik":
      return `Rp${(ongkir.nominal ?? 0).toLocaleString("id-ID")}`;
  }
}

/** Label pilihan di layar Keranjang / Form Pesanan. */
export function labelOngkirPilihan(mode: OngkirMode): string {
  switch (mode) {
    case "ambil_sendiri":
      return "Ambil sendiri Rp 0";
    case "butik":
      return "Dikirim, ongkir ditagih";
    case "kurir":
      return "Dibayar kurir";
    case "belum_ditentukan":
      return "Belum tentu";
  }
}
