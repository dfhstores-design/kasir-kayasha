/**
 * PIN lokal untuk membedakan admin & kasir (ROLE-BIAYA-RINGKASAN.md bagian 1.1).
 *
 * Tanpa akun, tanpa server — hanya PIN di perangkat. PIN disimpan sebagai
 * hash SHA-256 + salt acak, TIDAK pernah sebagai teks biasa dan tidak pernah di-log.
 *
 * Catatan jujur: PIN lokal hanya mencegah salah ketuk/salah orang di perangkat yang
 * sama. Ia tidak mengenkripsi IndexedDB; orang yang menguasai perangkat tetap bisa
 * membaca data. Ini disengaja untuk menjaga biaya Rp0 dan tetap offline.
 */

export const PIN_DIGIT_MIN = 4;
export const PIN_DIGIT_MAKS = 6;
export const MAKS_PERCOBAAN_PIN = 5;
export const JEDA_SETELAH_GAGAL_MS = 30_000;

const SALT_BYTE = 16;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Membuat hash PIN + salt. Dipakai saat admin menetapkan/mengganti PIN. */
export async function buatHashPin(pin: string): Promise<string> {
  const cek = validasiPinBaru(pin);
  if (!cek.ok) throw new RangeError(cek.pesan);

  const salt = new Uint8Array(SALT_BYTE);
  crypto.getRandomValues(salt);
  const digest = await sha256(pin + ":" + b64(salt));
  return `sha256$${b64(salt)}$${digest}`;
}

/** Mencocokkan PIN dengan hash tersimpan. */
export async function cocokPin(pin: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  const bagian = hash.split("$");
  if (bagian.length !== 3 || bagian[0] !== "sha256") return false;
  const salt = bagian[1] ?? "";
  const diharapkan = bagian[2] ?? "";
  const digest = await sha256(pin + ":" + salt);
  return samaAman(digest, diharapkan);
}

export type HasilValidasiPin =
  | { ok: true }
  | { ok: false; pesan: string };

/** Aturan PIN baru: hanya angka, 4–6 digit, tidak berulang semua. */
export function validasiPinBaru(pin: string): HasilValidasiPin {
  const bersih = pin.trim();
  if (!/^\d+$/.test(bersih)) return { ok: false, pesan: "PIN harus angka." };
  if (bersih.length < PIN_DIGIT_MIN || bersih.length > PIN_DIGIT_MAKS) {
    return { ok: false, pesan: `PIN harus ${PIN_DIGIT_MIN}–${PIN_DIGIT_MAKS} angka.` };
  }
  if (/^(\d)\1+$/.test(bersih)) return { ok: false, pesan: "PIN tidak boleh angka sama semua." };
  if (["123456", "1234", "12345", "0000", "1111"].includes(bersih)) {
    return { ok: false, pesan: "PIN terlalu mudah ditebak." };
  }
  return { ok: true };
}

/** Status penguncian setelah beberapa percobaan salah (tanpa state global). */
export function batasPercobaan(
  percobaan: number,
  waktuGagalTerakhir: number | null,
  sekarang: number,
): { terkunci: boolean; sisaDetik: number } {
  if (percobaan < MAKS_PERCOBAAN_PIN || waktuGagalTerakhir === null) {
    return { terkunci: false, sisaDetik: 0 };
  }
  const sisa = waktuGagalTerakhir + JEDA_SETELAH_GAGAL_MS - sekarang;
  if (sisa <= 0) return { terkunci: false, sisaDetik: 0 };
  return { terkunci: true, sisaDetik: Math.ceil(sisa / 1000) };
}

async function sha256(teks: string): Promise<string> {
  const data = new TextEncoder().encode(teks);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return b64(new Uint8Array(buf));
}

/** Perbandingan waktu tetap sederhana (panjang hash publik, jadi cukup). */
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}
