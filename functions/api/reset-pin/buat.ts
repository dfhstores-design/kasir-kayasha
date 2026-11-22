/**
 * Endpoint pembuatan kode reset PIN: POST /api/reset-pin/buat (BU-65).
 *
 * Membuat satu kode reset sekali pakai (6 angka, berlaku 1 jam) untuk satu
 * peran. Kode polos hanya muncul SEKALI di jawaban ini — pemanggil (Muse)
 * yang meneruskannya ke Andri lewat WA. Di database hanya hash-nya yang
 * tersimpan; kode tidak pernah dicatat di log server.
 *
 * Keamanan: sama seperti /api/sync — bila secret SYNC_TOKEN diatur,
 * header `x-sync-token` wajib cocok. Endpoint ini TIDAK boleh dipanggil
 * dari aplikasi kasir biasa (aplikasi hanya memanggil /pakai).
 */
import { buatKodeReset, peranResetValid, type PeranResetPin } from "../../../src/sync/resetKode.ts";
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

  const peran = (isi as { peran?: unknown } | null)?.peran;
  if (typeof peran !== "string" || !peranResetValid(peran)) {
    return json({ ok: false, pesan: "peran tidak dikenal." }, 400);
  }

  const hasil = await buatKodeReset(env.DB as unknown as DBCloud, peran as PeranResetPin);
  return json({ ok: true, peran: hasil.peran, kode: hasil.kode, kedaluwarsaPada: hasil.kedaluwarsaPada });
};
