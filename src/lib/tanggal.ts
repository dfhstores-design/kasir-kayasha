/**
 * Pembantu format tanggal Indonesia untuk layar & resi.
 *
 * Zona waktu usaha adalah WIB (Asia/Jakarta) — semua tanggal yang dilihat
 * pengguna (tanggal transaksi, "hari ini", tutup harian, resi) memakai WIB,
 * bukan UTC dan bukan zona waktu perangkat. Sebelum perbaikan ini
 * (C9, tes klik 22 Nov 2026) tanggal dihitung dari `toISOString()` (UTC),
 * sehingga jam 00:30 WIB masih dihitung sebagai "kemarin" dan semua tanggal
 * transaksi default ke hari sebelumnya.
 */

const ZONA_WIB = "Asia/Jakarta";

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

/**
 * Tanggal kalender WIB ("YYYY-MM-DD") dari sebuah waktu (Date atau string
 * ISO). Dipakai setiap kali tanggal sebuah stempel waktu dibandingkan
 * dengan sebuah hari — jangan memakai `waktu.slice(0, 10)` (itu tanggal UTC).
 */
export function tanggalWIB(waktu: Date | string): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Bulan kalender WIB ("YYYY-MM") dari sebuah waktu. */
export function bulanWIB(waktu: Date | string): string {
  return tanggalWIB(waktu).slice(0, 7);
}

/** True bila waktu bisa diparse menjadi tanggal yang sah. */
function tanggalSah(waktu: Date | string): boolean {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  return !Number.isNaN(d.getTime());
}

/** Bagian tanggal WIB (hari/bulan/tahun) dari sebuah waktu. */
function bagianWIB(waktu: Date | string): { hari: number; bulan: number; tahun: number } {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  const bagian = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_WIB,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const ambil = (jenis: Intl.DateTimeFormatPartTypes): number =>
    Number(bagian.find((p) => p.type === jenis)?.value ?? 0);
  return { hari: ambil("day"), bulan: ambil("month"), tahun: ambil("year") };
}

/** "11 Nov 2026" (tanggal WIB). Tanggal tidak valid → "—" (jangan crash render). */
export function formatTanggal(waktu: Date | string): string {
  if (!tanggalSah(waktu)) return "—";
  const { hari, bulan, tahun } = bagianWIB(waktu);
  return `${hari} ${BULAN[bulan - 1]} ${tahun}`;
}

/** "11 Nov 2026 14:20" — dipakai di resi (jam WIB). */
export function formatTanggalJam(waktu: Date | string): string {
  return `${formatTanggal(waktu)} ${formatJam(waktu)}`;
}

/** "14:20" (jam WIB). Jam tidak valid → "—". */
export function formatJam(waktu: Date | string): string {
  if (!tanggalSah(waktu)) return "—";
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ZONA_WIB,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** "Hari ini, 10 November 2026" untuk Ringkasan (tanggal WIB). */
export function formatJudulHari(waktu: Date = new Date()): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  const namaHari = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA_WIB, weekday: "long" }).format(d);
  return `Hari ini, ${namaHari}, ${formatTanggal(d)}`;
}

/** Tanggal hari ini "YYYY-MM-DD" dalam WIB. */
export function tanggalHariIni(sekarang: Date = new Date()): string {
  return tanggalWIB(sekarang);
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
 * Penanda transaksi dari kertas (re-entry, Fase 2C): tanggal transaksi (WIB)
 * lebih lama dari tanggal dimasukkannya ke aplikasi (WIB). `createdAt`
 * dicatat saat transaksi dimasukkan (waktu sebenarnya), sedangkan `waktu`
 * adalah tanggal transaksi aslinya — jadi selisih keduanya menandai
 * re-entry tanpa kolom baru.
 */
export function transaksiDariKertas(waktu: string, createdAt: string): boolean {
  return tanggalWIB(waktu) < tanggalWIB(createdAt);
}
