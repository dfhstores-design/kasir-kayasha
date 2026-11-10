/**
 * Endpoint sinkronisasi: POST /api/sync
 *
 * Menyimpan batch kiriman dari perangkat ke D1 secara IDEMPOTEN.
 * Endpoint ini bersifat sempurna opsional bagi perangkat: bila gagal, perangkat
 * tetap berjalan dan mencoba lagi nanti. Penjualan TIDAK pernah menunggu endpoint ini.
 *
 * Keamanan:
 *  - Bila secret SYNC_TOKEN diatur, header `x-sync-token` wajib cocok.
 *  - Tidak ada endpoint baca publik; data tidak dapat diambil dari luar.
 *  - Isi transaksi tidak pernah dicatat ke log.
 */
import { prosesBatch, type DBCloud } from "../../src/sync/logika.ts";

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
  // Binding mungkin belum dibuat (mis. preview tanpa D1) — jangan membuat aplikasi error.
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

  const kiriman = (isi as { kiriman?: unknown } | null)?.kiriman;
  if (!Array.isArray(kiriman)) {
    return json({ ok: false, pesan: "kiriman harus berupa daftar." }, 400);
  }
  if (kiriman.length > 200) {
    return json({ ok: false, pesan: "Terlalu banyak kiriman dalam satu permintaan." }, 413);
  }

  const hasil = await prosesBatch(env.DB as unknown as DBCloud, kiriman);
  return json({ ok: true, ...hasil });
};

export const onRequestGet = async (): Promise<Response> =>
  json({ ok: true, layanan: "kasir-kayesha-sync", metode: "POST" });
