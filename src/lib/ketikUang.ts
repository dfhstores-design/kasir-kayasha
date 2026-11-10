/**
 * Membantu mengetik nominal rupiah: pemisah ribuan otomatis saat mengetik.
 * "10000" → "10.000". Angka bukan digit dibuang, tidak ada pecahan.
 */
export function dalamRupiah(nilai: string): string {
  const digit = nilai.replace(/[^\d]/g, "").slice(0, 12);
  if (digit === "") return "";
  return Number(digit).toLocaleString("id-ID");
}
