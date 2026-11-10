/**
 * Sapaan resi otomatis dari jam (BAZAR-PARKIR-RESI.md bagian 4b).
 *
 *   04:00 – 10:59  Pagi
 *   11:00 – 14:59  Siang
 *   15:00 – 18:29  Sore
 *   18:30 – 03:59  Malam
 *
 * Nilai disimpan sebagai snapshot di transaksi, bukan dihitung ulang saat mencetak.
 * Waktu acuan: zona waktu perangkat (Asia/Jakarta sesuai CONTEXT).
 */

export type Sapaan = "Pagi" | "Siang" | "Sore" | "Malam";

export const BATAS_SAPAAN = {
  pagiMulaiMenit: 4 * 60, // 04:00
  siangMulaiMenit: 11 * 60, // 11:00
  soreMulaiMenit: 15 * 60, // 15:00
  malamMulaiMenit: 18 * 60 + 30, // 18:30
} as const;

/** Menghitung sapaan dari menit dalam sehari (0–1439). */
export function sapaanDariMenit(menitDalamHari: number): Sapaan {
  if (!Number.isFinite(menitDalamHari)) {
    throw new RangeError("Menit tidak valid");
  }
  const menit = ((Math.trunc(menitDalamHari) % 1440) + 1440) % 1440;

  if (menit < BATAS_SAPAAN.pagiMulaiMenit) return "Malam";
  if (menit < BATAS_SAPAAN.siangMulaiMenit) return "Pagi";
  if (menit < BATAS_SAPAAN.soreMulaiMenit) return "Siang";
  if (menit < BATAS_SAPAAN.malamMulaiMenit) return "Sore";
  return "Malam";
}

/** Menghitung sapaan dari objek Date. */
export function sapaanDariWaktu(waktu: Date): Sapaan {
  return sapaanDariMenit(waktu.getHours() * 60 + waktu.getMinutes());
}

/** Bentuk yang dicetak di resi: "- Sore -". */
export function formatSapaan(sapaan: Sapaan): string {
  return `- ${sapaan} -`;
}
