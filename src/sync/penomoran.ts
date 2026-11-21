/**
 * Nomor urut pesanan jahit dari hub (F4, BU-19/21).
 *
 * Prinsip: saat online, nomor urut diminta ke hub (D1) — satu pernyataan
 * atomik di sana, jadi dua perangkat tidak bisa mendapat nomor yang sama.
 * Saat offline / hub tidak bisa dihubungi, pemanggil memakai nomor lokal
 * sementara (lihat jahitan.ts) dan fungsi ini mengembalikan null.
 * Penjualan TIDAK PERNAH menunggu fungsi ini: gagal = null, bukan error.
 */

export interface OpsiNomor {
  /** Alamat endpoint sync penuh (…/api/sync); kosong = tidak aktif. */
  urlSync?: string;
  token?: string | undefined;
  /** Bulan "YYYY-MM" yang dimintakan nomornya. */
  bulan: string;
  fetchImpl?: typeof fetch | undefined;
}

/** Alamat endpoint nomor urut: saudara dari endpoint sync (…/api/nomor-urut). */
export function urlNomorUrut(urlSync: string): string {
  const dasar = urlSync.replace(/\/+$/, "");
  return dasar.endsWith("/api/sync")
    ? `${dasar.slice(0, -"/api/sync".length)}/api/nomor-urut`
    : `${dasar}/api/nomor-urut`;
}

/**
 * Meminta satu nomor urut dari hub untuk bulan yang diberikan.
 * Mengembalikan nomor (≥ 1) atau null bila tidak bisa (offline, tanpa
 * alamat, server menolak, jawaban tidak bisa dibaca). Tidak melempar.
 */
/** Batas tunggu hub (ms): lewat dari ini, pakai nomor lokal sementara. */
const BATAS_TUNGGU_MS = 5000;

export async function mintaNomorUrutBulan(opsi: OpsiNomor): Promise<number | null> {
  const urlSync = opsi.urlSync ?? "";
  if (!urlSync) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const f = opsi.fetchImpl ?? fetch;
  let jawab: Response;
  try {
    jawab = await f(urlNomorUrut(urlSync), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opsi.token ? { "x-sync-token": opsi.token } : {}),
      },
      body: JSON.stringify({ bulan: opsi.bulan }),
      // Penjualan tidak pernah menunggu hub: hub lambat = nomor lokal.
      signal: AbortSignal.timeout(BATAS_TUNGGU_MS),
    });
  } catch {
    return null;
  }
  if (!jawab.ok) return null;
  let isi: unknown;
  try {
    isi = (await jawab.json()) as unknown;
  } catch {
    return null;
  }
  const nomor = (isi as { nomor?: unknown } | null)?.nomor;
  return typeof nomor === "number" && Number.isInteger(nomor) && nomor >= 1 ? nomor : null;
}
