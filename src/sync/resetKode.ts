/**
 * Kode reset PIN sekali pakai (BU-65, keputusan Andri 22 Nov 2026).
 *
 * Latar: tes klik layar 22 Nov 2026 menemukan lockout kritis — PIN yang
 * disimpan kadang tidak bisa dipakai login dan semua peran ikut terkunci.
 * Jalan keluarnya: pemilik peran yang lupa PIN meminta kode reset ke Andri
 * lewat WA, memasukkan kode itu di layar "Lupa PIN", dan PIN peran itu
 * dihapus supaya bisa diatur baru.
 *
 * Aturan keras:
 *  - Kode berisi 6 angka acak, berlaku 1 jam, sekali pakai.
 *  - HANYA hash SHA-256 kode yang disimpan di D1 — kode polos tidak pernah
 *    ditulis ke database, log, atau chat (hanya ditampilkan sekali ke Andri
 *    saat dibuat, supaya diteruskan lewat WA).
 *  - 5 kali salah = kode mati; minta kode baru.
 *  - Kode yang cocok menghapus PIN peran itu DI HUB (pin_sync / bazar),
 *    sehingga semua perangkat ikut terbuka saat sync berikutnya.
 *  - PIN asli tidak pernah dikirim, disimpan, atau dicatat di mana pun.
 */
import { idPinSync, simpanPin, type DBCloud, type KirimanPin, type PeranPinSync } from "./logika.ts";
export type { DBCloud } from "./logika.ts";

/** Panjang kode reset (angka saja, supaya gampang diketik & didikte lewat WA). */
export const KODE_RESET_PANJANG = 6;
/** Masa berlaku kode sejak dibuat (1 jam). */
export const KODE_RESET_BERLAKU_MS = 60 * 60 * 1000;
/** Percobaan salah maksimum per kode; sesudah itu kode mati. */
export const MAKS_PERCOBAAN_KODE = 5;

/**
 * Peran yang PIN-nya bisa direset: tiga PIN di settings (F3) + PIN kasir
 * tiap bazar (disimpan di record bazar, BU-34).
 */
export type PeranResetPin = PeranPinSync | `bazar:${string}`;

/** Peran reset yang sah: tiga peran settings atau `bazar:<id>`. */
export function peranResetValid(peran: string): peran is PeranResetPin {
  if (peran === "admin" || peran === "owner" || peran === "kasir_toko") return true;
  return /^bazar:[A-Za-z0-9][A-Za-z0-9_-]*$/.test(peran);
}

/** Label pendek peran untuk pesan di layar (bahasa sederhana). */
export function labelPeranReset(peran: PeranResetPin): string {
  if (peran === "admin") return "admin";
  if (peran === "owner") return "owner";
  if (peran === "kasir_toko") return "kasir toko";
  return "kasir bazar";
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** SHA-256 kode → base64. Dipakai di server dan di skrip pembuat kode. */
export async function hashKodeReset(kode: string): Promise<string> {
  const data = new TextEncoder().encode(kode);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return b64(new Uint8Array(buf));
}

/** Kode 6 angka acak (angka saja, nol di depan dipertahankan). */
export function buatKodeResetAcak(): string {
  const angka = new Uint32Array(1);
  crypto.getRandomValues(angka);
  return String((angka[0] ?? 0) % 1_000_000).padStart(KODE_RESET_PANJANG, "0");
}

/** Perbandingan waktu-tetap sederhana (panjang hash publik, jadi cukup). */
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

interface BarisKodeReset {
  id: string;
  peran: string;
  hash_kode: string;
  dibuat_pada: string;
  kedaluwarsa_pada: string;
  dipakai_pada: string | null;
  percobaan_gagal: number;
  perangkat: string | null;
}

/**
 * Membuat satu kode reset untuk satu peran. Mengembalikan kode POLOS satu
 * kali saja — pemanggil wajib meneruskannya ke Andri dan tidak
 * menyimpannya di mana pun. Di database hanya hash-nya yang tersimpan.
 */
export async function buatKodeReset(
  db: DBCloud,
  peran: PeranResetPin,
  sekarang: string = new Date().toISOString(),
): Promise<{ id: string; kode: string; peran: PeranResetPin; kedaluwarsaPada: string }> {
  const kode = buatKodeResetAcak();
  const hash = await hashKodeReset(kode);
  const id = crypto.randomUUID();
  const kedaluwarsaPada = new Date(Date.parse(sekarang) + KODE_RESET_BERLAKU_MS).toISOString();
  await db
    .prepare(
      `INSERT INTO kode_reset_pin (id, peran, hash_kode, dibuat_pada, kedaluwarsa_pada, dipakai_pada, percobaan_gagal, perangkat) VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(id, peran, hash, sekarang, kedaluwarsaPada, null, 0, null)
    .run();
  return { id, kode, peran, kedaluwarsaPada };
}

/**
 * Memakai satu kode reset: bila cocok dan masih berlaku, tandai terpakai
 * dan HAPUS PIN peran itu di hub (pin_sync untuk tiga peran settings,
 * pin_kasir_hash untuk bazar). Perangkat pemakai lalu menghapus PIN
 * lokalnya sendiri; perangkat lain ikut terbuka saat sync berikutnya.
 */
export async function pakaiKodeReset(
  db: DBCloud,
  peran: PeranResetPin,
  kode: string,
  sekarang: string = new Date().toISOString(),
): Promise<{ ok: true; peran: PeranResetPin } | { ok: false; pesan: string }> {
  if (!peranResetValid(peran)) return { ok: false, pesan: "Peran tidak dikenal." };
  if (!/^\d{6}$/.test(kode)) return { ok: false, pesan: "Kode harus 6 angka." };

  const hash = await hashKodeReset(kode);
  const kandidat = await db
    .prepare(
      `SELECT * FROM kode_reset_pin WHERE peran = ? AND dipakai_pada IS NULL AND kedaluwarsa_pada > ? ORDER BY dibuat_pada DESC`,
    )
    .bind(peran, sekarang)
    .all<BarisKodeReset>();
  const baris = kandidat.results ?? [];
  if (baris.length === 0) {
    return { ok: false, pesan: "Kode salah atau sudah kedaluwarsa. Minta kode baru ke Andri." };
  }

  const cocok = baris.find((b) => samaAman(b.hash_kode, hash));
  if (!cocok) {
    // Kode salah: hitung percobaan pada kode terbaru untuk peran ini.
    // Jumlah gagal dicatat DULU sebelum UPDATE — baris yang dikembalikan
    // database bisa berupa referensi yang ikut berubah sesudah UPDATE.
    const terbaru = baris[0]!;
    const gagalSebelumnya = terbaru.percobaan_gagal;
    if (gagalSebelumnya + 1 >= MAKS_PERCOBAAN_KODE) {
      await db
        .prepare(`UPDATE kode_reset_pin SET percobaan_gagal = ? WHERE id = ?`)
        .bind(MAKS_PERCOBAAN_KODE, terbaru.id)
        .run();
      return { ok: false, pesan: "Kode ini sudah terlalu banyak dicoba. Minta kode baru ke Andri." };
    }
    await db
      .prepare(`UPDATE kode_reset_pin SET percobaan_gagal = percobaan_gagal + 1 WHERE id = ?`)
      .bind(terbaru.id)
      .run();
    const sisa = MAKS_PERCOBAAN_KODE - (gagalSebelumnya + 1);
    return { ok: false, pesan: `Kode salah. Sisa percobaan: ${sisa}.` };
  }
  if (cocok.percobaan_gagal >= MAKS_PERCOBAAN_KODE) {
    return { ok: false, pesan: "Kode ini sudah terlalu banyak dicoba. Minta kode baru ke Andri." };
  }

  // Tandai terpakai; hanya berhasil bila belum dipakai orang lain.
  await db
    .prepare(`UPDATE kode_reset_pin SET dipakai_pada = ? WHERE id = ? AND dipakai_pada IS NULL`)
    .bind(sekarang, cocok.id)
    .run();
  const dicek = await db
    .prepare(`SELECT * FROM kode_reset_pin WHERE id = ?`)
    .bind(cocok.id)
    .first<BarisKodeReset>();
  if (!dicek || dicek.dipakai_pada !== sekarang) {
    return { ok: false, pesan: "Kode sudah dipakai. Minta kode baru ke Andri." };
  }

  // Hapus PIN peran itu di hub.
  if (cocok.peran === "admin" || cocok.peran === "owner" || cocok.peran === "kasir_toko") {
    const kiriman: KirimanPin = {
      jenis: "pin",
      id: idPinSync(cocok.peran),
      peran: cocok.peran,
      hash: null,
      diubahPada: sekarang,
      perangkat: "reset-pin",
    };
    await simpanPin(db, kiriman, sekarang);
  } else {
    const bazarId = cocok.peran.slice("bazar:".length);
    await db
      .prepare(`UPDATE bazars SET pin_kasir_hash = NULL, diubah_pada = ? WHERE id = ?`)
      .bind(sekarang, bazarId)
      .run();
  }

  // Jejak audit di hub (hanya bisa dibaca dari D1; tidak dikirim ke perangkat).
  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(`reset-pin:${cocok.peran}:${sekarang}`, "reset-pin", cocok.peran, sekarang)
    .run();

  return { ok: true, peran: cocok.peran as PeranResetPin };
}
