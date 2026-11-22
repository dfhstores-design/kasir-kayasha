/**
 * Reset PIN dari perangkat (BU-65, keputusan Andri 22 Nov 2026).
 *
 * Dua jalan reset:
 *  1. Kode reset dari Andri (layar "Lupa PIN"): perangkat meminta hub
 *     memeriksa kode ke /api/reset-pin/pakai. BUTUH INTERNET — tanpa
 *     internet kode tidak bisa diperiksa, dan layar wajib mengatakannya
 *     dengan jujur (bukan janji reset offline).
 *  2. Reset oleh owner (layar owner): owner yang sudah masuk menghapus
 *     PIN peran lain langsung di perangkat ini; penghapusan ikut
 *     tersinkron ke perangkat lain lewat jalur sync PIN yang sudah ada
 *     (F3) — jalan ini tetap bisa dipakai saat offline.
 *
 * PIN asli tidak pernah dikirim, ditampilkan, atau dicatat di mana pun.
 */
import { getDB } from "../db/schema.ts";
import { ubahPinKasirBazar } from "../db/repositori.ts";
import { perangkatId, simpanPin } from "./mesin.ts";
import { catatLogSinkron } from "./tarik.ts";
import { labelPeranReset, type PeranResetPin } from "./resetKode.ts";

export type HasilVerifikasiKode = { ok: true } | { ok: false; pesan: string };

/** Asal endpoint API: VITE_SYNC_URL tanpa ekor /api/sync; kosong = asal yang sama. */
function apiBase(): string {
  const urlSync = import.meta.env.VITE_SYNC_URL ?? "";
  if (!urlSync) return "";
  return urlSync.replace(/\/api\/sync\/?$/, "");
}

/**
 * Meminta hub memeriksa kode reset untuk satu peran.
 * Gagal jaringan = tidak ada internet (bukan kode salah) — pesannya dibedakan.
 */
export async function verifikasiKodeReset(
  peran: PeranResetPin,
  kode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HasilVerifikasiKode> {
  const token = import.meta.env.VITE_SYNC_TOKEN;
  let jawab: Response;
  try {
    jawab = await fetchImpl(`${apiBase()}/api/reset-pin/pakai`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-sync-token": token } : {}),
      },
      body: JSON.stringify({ peran, kode }),
    });
  } catch {
    return { ok: false, pesan: "Tidak ada internet. Sambungkan internet dulu, lalu coba lagi." };
  }
  let isi: unknown = null;
  try {
    isi = await jawab.json();
  } catch {
    // Jawaban bukan JSON: pakai pesan umum di bawah.
  }
  const o = (isi ?? {}) as { ok?: unknown; pesan?: unknown };
  if (jawab.ok && o.ok === true) return { ok: true };
  if (typeof o.pesan === "string" && o.pesan) return { ok: false, pesan: o.pesan };
  return { ok: false, pesan: "Kode tidak bisa diperiksa. Coba lagi." };
}

/**
 * Menghapus PIN peran itu di perangkat ini + mencatatnya di log sinkron
 * (owner bisa melihat di Riwayat Sinkron). Penghapusan ikut tersinkron:
 * tiga peran settings lewat kiriman PIN (F3), PIN bazar lewat kiriman bazar.
 */
export async function hapusPinLokalSetelahReset(peran: PeranResetPin, olehOwner = false): Promise<void> {
  if (peran === "admin" || peran === "owner" || peran === "kasir_toko") {
    await simpanPin(peran, null);
  } else {
    await ubahPinKasirBazar(peran.slice("bazar:".length), null);
  }
  const db = await getDB();
  await catatLogSinkron(db, {
    jenis: "info",
    judul: `PIN ${labelPeranReset(peran)} direset${olehOwner ? " oleh owner" : " dengan kode dari Andri"}`,
    rincian: "PIN dihapus; pemilik peran harus mengatur PIN baru.",
    perangkat: await perangkatId(),
  });
}
