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
