/** Pembantu format tanggal Indonesia untuk layar & resi. */

const BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** "11 Nov 2026" */
export function formatTanggal(waktu: Date | string): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "11 Nov 2026 14:20" — dipakai di resi */
export function formatTanggalJam(waktu: Date | string): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${formatTanggal(d)} ${jam}:${menit}`;
}

/** "14:20" */
export function formatJam(waktu: Date | string): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Hari ini, 10 November 2026" untuk Ringkasan. */
export function formatJudulHari(waktu: Date = new Date()): string {
  const nama = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return `Hari ini, ${nama[waktu.getDay()]}, ${formatTanggal(waktu)}`;
}

/** Tanggal hari ini "YYYY-MM-DD" (cara yang sama dipakai layar lain: potongan ISO). */
export function tanggalHariIni(sekarang: Date = new Date()): string {
  return sekarang.toISOString().slice(0, 10);
}

/**
 * "YYYY-MM-DD" → Date jam 12 siang waktu setempat, atau null bila tidak valid.
 * Jam 12 siang dipilih supaya tanggalnya tetap sama saat diubah ke ISO
 * (WIB = UTC+7; tengah malam setempat bisa jadi hari sebelumnya dalam UTC).
 */
export function waktuDariTanggal(tanggal: string): Date | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal);
  if (!cocok) return null;
  const d = new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]), 12, 0, 0, 0);
  if (
    d.getFullYear() !== Number(cocok[1]) ||
    d.getMonth() !== Number(cocok[2]) - 1 ||
    d.getDate() !== Number(cocok[3])
  ) {
    return null;
  }
  return d;
}

/**
 * Penanda transaksi dari kertas (re-entry, Fase 2C): tanggal transaksi lebih
 * lama dari tanggal dimasukkannya ke aplikasi. `createdAt` dicatat saat
 * transaksi dimasukkan (waktu sebenarnya), sedangkan `waktu` adalah tanggal
 * transaksi aslinya — jadi selisih keduanya menandai re-entry tanpa kolom baru.
 */
export function transaksiDariKertas(waktu: string, createdAt: string): boolean {
  return waktu.slice(0, 10) < createdAt.slice(0, 10);
}
