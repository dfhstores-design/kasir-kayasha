/**
 * Endpoint pemakaian kode reset PIN: POST /api/reset-pin/pakai (BU-65).
 *
 * Dipanggil aplikasi kasir dari layar "Lupa PIN" dengan { peran, kode }.
 * Bila kode cocok, masih berlaku, dan belum dipakai: kode ditandai
 * terpakai dan PIN peran itu DIHAPUS di hub, lalu jawaban { ok: true }.
 * Perangkat pemakai lalu menghapus PIN lokalnya sendiri.
 *
 * Keamanan: sama seperti /api/sync — bila secret SYNC_TOKEN diatur,
 * header `x-sync-token` wajib cocok. Pesan galat sengaja umum supaya
 * tidak membocorkan apakah kodenya ada, sudah dipakai, atau kedaluwarsa.
 */
import { pakaiKodeReset, peranResetValid, type PeranResetPin } from "../../../src/sync/resetKode.ts";
import type { DBCloud } from "../../../src/sync/logika.ts";

interface Env {
  DB?: D1Database;
  SYNC_TOKEN?: string;
}

type Konteks = {
  request: Request;
  env: Env;
};

const json = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const onRequestPost = async ({ request, env }: Konteks): Promise<Response> => {
  if (!env.DB) {
    return json({ ok: false, pesan: "Sinkronisasi belum aktif di server." }, 503);
  }

  if (env.SYNC_TOKEN) {
    const kirimToken = request.headers.get("x-sync-token");
    if (kirimToken !== env.SYNC_TOKEN) {
      return json({ ok: false, pesan: "Tidak diizinkan." }, 401);
    }
  }

  let isi: unknown;
  try {
    isi = await request.json();
  } catch {
    return json({ ok: false, pesan: "Isi bukan JSON." }, 400);
  }

  const o = (isi as { peran?: unknown; kode?: unknown } | null) ?? {};
  if (typeof o.peran !== "string" || !peranResetValid(o.peran)) {
    return json({ ok: false, pesan: "peran tidak dikenal." }, 400);
  }
  if (typeof o.kode !== "string" || !/^\d{6}$/.test(o.kode)) {
    return json({ ok: false, pesan: "Kode harus 6 angka." }, 400);
  }

  const hasil = await pakaiKodeReset(env.DB as unknown as DBCloud, o.peran as PeranResetPin, o.kode);
  if (hasil.ok) return json({ ok: true, peran: hasil.peran });
  return json({ ok: false, pesan: hasil.pesan }, 400);
};
