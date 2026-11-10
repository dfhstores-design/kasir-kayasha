/**
 * Uang selalu integer Rupiah. Tidak ada floating point untuk uang.
 *
 * Kontrak (docs/design/UI-SPEC.md, BAZAR-PARKIR-RESI.md):
 * - semua nominal bertipe integer satuan rupiah
 * - pembulatan dilakukan sekali di batas masukan, bukan di tengah perhitungan
 */

/** Batas atas wajar untuk satu transaksi; mencegah salah ketik satuan. */
export const MAX_RUPIAH = 1_000_000_000;

export type Rupiah = number;

export type MoneyError =
  | "bukan_angka"
  | "negatif"
  | "terlalu_besar"
  | "pecahan";

export type MoneyResult =
  | { ok: true; value: Rupiah }
  | { ok: false; error: MoneyError };

/**
 * Mengubah masukan pengguna menjadi Rupiah bulat.
 * Menerima "10.000", "Rp 10.000", "10000", " 12 500 ".
 * Menolak pecahan (mis. "1000,50" atau "10.5") — pesan besar, bukan dibulatkan diam-diam.
 */
export function parseRupiah(input: string | number | null | undefined): MoneyResult {
  if (input === null || input === undefined) return { ok: false, error: "bukan_angka" };

  if (typeof input === "number") {
    if (!Number.isFinite(input)) return { ok: false, error: "bukan_angka" };
    if (!Number.isInteger(input)) return { ok: false, error: "pecahan" };
    if (input < 0) return { ok: false, error: "negatif" };
    if (input > MAX_RUPIAH) return { ok: false, error: "terlalu_besar" };
    return { ok: true, value: input };
  }

  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "bukan_angka" };

  // Buang "Rp", spasi, dan titik pemisah ribuan gaya Indonesia.
  const cleaned = trimmed.replace(/rp/gi, "").replace(/[\s.]/g, "");
  if (cleaned === "") return { ok: false, error: "bukan_angka" };

  // Koma dianggap pecahan; pada uang Rupiah kita tidak menerima pecahan.
  if (cleaned.includes(",")) return { ok: false, error: "pecahan" };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "bukan_angka" };

  const value = Number(cleaned);
  if (!Number.isSafeInteger(value)) return { ok: false, error: "terlalu_besar" };
  if (value > MAX_RUPIAH) return { ok: false, error: "terlalu_besar" };
  return { ok: true, value };
}

/** Format Indonesia: 1250000 -> "Rp 1.250.000". */
export function formatRupiah(value: Rupiah): string {
  const negative = value < 0;
  const digits = Math.abs(Math.trunc(value)).toLocaleString("id-ID");
  return `${negative ? "−" : ""}Rp ${digits}`;
}

/** Format tanpa "Rp", dipakai di baris barang pada resi (contoh: 250.000). */
export function formatRupiahTanpaRp(value: Rupiah): string {
  return Math.abs(Math.trunc(value)).toLocaleString("id-ID");
}

/** Format untuk resi panjang, contoh: Rp25.000 (tanpa spasi, seperti contoh pemilik). */
export function formatRupiahResi(value: Rupiah): string {
  return `Rp${formatRupiahTanpaRp(value)}`;
}

/** Penjumlahan Rupiah yang aman terhadap luapan. */
export function tambahRupiah(...values: Rupiah[]): Rupiah {
  return values.reduce((total, v) => {
    const next = total + v;
    if (!Number.isSafeInteger(next)) throw new RangeError("Nominal melebihi batas aman");
    return next;
  }, 0);
}

export function clampRupiah(value: Rupiah, min: Rupiah, max: Rupiah): Rupiah {
  return Math.min(Math.max(value, min), max);
}
