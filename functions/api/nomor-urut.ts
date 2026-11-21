/**
 * Endpoint alokasi nomor urut pesanan jahit: POST /api/nomor-urut (F4, BU-19/21).
 *
 * Mengembalikan satu nomor urut berikutnya untuk bulan yang diminta
 * ("YYYY-MM"). Alokasi memakai satu pernyataan atomik di D1, jadi dua
 * perangkat yang meminta bersamaan tidak bisa mendapat nomor yang sama.
 * Nomor yang sudah dialokasikan tidak dipakai ulang — bila perangkat
 * membatalkan pesanannya, nomor itu kosong (tidak dipakai perangkat lain).
 *
 * Keamanan: sama seperti /api/sync — bila secret SYNC_TOKEN diatur,
 * header `x-sync-token` wajib cocok.
 */
import { alokasiNomor, type DBCloud } from "../../src/sync/logika.ts";

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

  const bulan = (isi as { bulan?: unknown } | null)?.bulan;
  if (typeof bulan !== "string" || !/^\d{4}-\d{2}$/.test(bulan)) {
    return json({ ok: false, pesan: "bulan harus format YYYY-MM." }, 400);
  }

  try {
    const nomor = await alokasiNomor(env.DB as unknown as DBCloud, bulan);
    return json({ ok: true, bulan, nomor });
  } catch {
    return json({ ok: false, pesan: "Gagal mengalokasikan nomor urut." }, 500);
  }
};
