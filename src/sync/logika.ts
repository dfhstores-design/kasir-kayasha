/**
 * Logika sinkronisasi cloud (Phase 6) — TANPA dependensi runtime Cloudflare.
 *
 * Dipisah dari `functions/api/sync.ts` supaya bisa diuji dengan database tiruan
 * (lihat `sync.test.ts`). Handler hanya menyambungkan ke D1.
 *
 * JAMINAN UTAMA:
 *  1. Perangkat tetap sumber kebenaran; sinkronisasi tidak pernah memblokir penjualan.
 *  2. Idempoten: mengirim kiriman yang sama dua kali tidak menggandakan baris.
 *  3. Kiriman yang tidak valid DITOLAK per-kiriman, bukan menggagalkan seluruh batch.
 */

export type JenisKiriman = "transaksi" | "produk" | "bazar";

export interface KirimanTransaksi {
  jenis: "transaksi";
  id: string;
  nomorResi: string;
  waktu: string;
  jenisTransaksi: "langsung" | "po";
  statusPesanan: string;
  statusBayar: string;
  bazarId: string | null;
  namaPemesan: string | null;
  ongkirMode: string;
  ongkirNominal: number | null;
  subtotalAwal: number;
  diskonItem: number;
  diskonTotal: number;
  total: number;
  dibatalkanPada: string | null;
  dibuatPada: string;
  diubahPada: string;
  items: Array<{
    id: string;
    produkId: string | null;
    namaSnapshot: string;
    hargaSatuan: number;
    kuantitas: number;
    diskonPerUnit: number;
    subtotalBersih: number;
  }>;
  pembayaran: Array<{
    id: string;
    nominal: number;
    waktu: string;
    metode: string | null;
  }>;
}

export interface KirimanProduk {
  jenis: "produk";
  id: string;
  nama: string;
  kode: string | null;
  hargaJual: number;
  stokGudang: number;
  arsip: boolean;
  diubahPada: string;
}

export interface KirimanBazar {
  jenis: "bazar";
  id: string;
  nama: string;
  status: string;
  lokasi: string | null;
  mulai: string | null;
  selesai: string | null;
  diubahPada: string;
}

export type Kiriman = KirimanTransaksi | KirimanProduk | KirimanBazar;

export interface HasilKirim {
  diterima: string[];
  ditolak: Array<{ id: string; pesan: string }>;
}

/** Antarmuka database yang dibutuhkan sinkronisasi (supaya bisa diuji). */
export interface DBCloud {
  /** Menjalankan pernyataan SQL; `bind` mengikat parameter. */
  prepare(sql: string): {
    bind(...nilai: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> };
  };
}

/** Validasi minimum sebelum menyentuh database. */
export function periksaKiriman(k: unknown): { ok: true; nilai: Kiriman } | { ok: false; pesan: string } {
  if (!k || typeof k !== "object") return { ok: false, pesan: "Kiriman bukan objek." };
  const o = k as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== "string" || id.length < 8) return { ok: false, pesan: "id tidak valid." };
  const jenis = o.jenis;
  if (jenis !== "transaksi" && jenis !== "produk" && jenis !== "bazar") {
    return { ok: false, pesan: "jenis tidak dikenal." };
  }

  if (jenis === "transaksi") {
    const t = o as unknown as KirimanTransaksi;
    if (typeof t.nomorResi !== "string" || !t.nomorResi) return { ok: false, pesan: "nomorResi kosong." };
    if (!Number.isInteger(t.total) || t.total < 0) return { ok: false, pesan: "total harus integer ≥ 0." };
    if (!Array.isArray(t.items)) return { ok: false, pesan: "items harus array." };
    for (const it of t.items) {
      if (!Number.isInteger(it.hargaSatuan) || !Number.isInteger(it.kuantitas)) {
        return { ok: false, pesan: "item memuat angka bukan integer." };
      }
    }
    if (!Array.isArray(t.pembayaran)) return { ok: false, pesan: "pembayaran harus array." };
  }

  if (jenis === "produk") {
    const p = o as unknown as KirimanProduk;
    if (typeof p.nama !== "string" || !p.nama.trim()) return { ok: false, pesan: "nama produk kosong." };
    if (!Number.isInteger(p.hargaJual) || p.hargaJual < 0) return { ok: false, pesan: "hargaJual harus integer." };
  }

  if (jenis === "bazar") {
    const b = o as unknown as KirimanBazar;
    if (typeof b.nama !== "string" || !b.nama.trim()) return { ok: false, pesan: "nama bazar kosong." };
  }

  return { ok: true, nilai: k as Kiriman };
}

/** Kunci jejak idempoten. Sama untuk kiriman yang sama, berbeda bila isi berubah. */
export function kunciSync(k: Kiriman): string {
  return `${k.jenis}:${k.id}:${k.diubahPada}`;
}

/**
 * Menyimpan satu kiriman secara idempoten.
 * Bila kunci sudah ada di `sync_log`, kiriman dianggap SUDAH diterima dan dilewati.
 */
async function simpanTransaksi(db: DBCloud, k: KirimanTransaksi, sekarang: string): Promise<void> {
  // Baris induk di-upsert: kiriman yang sama menimpa, tidak menggandakan.
  await db
    .prepare(
      `INSERT INTO transactions
        (id, nomor_resi, waktu, jenis, status_pesanan, status_bayar, bazar_id, nama_pemesan,
         ongkir_mode, ongkir_nominal, subtotal_awal, diskon_item, diskon_total, total,
         dibatalkan_pada, dibuat_pada, diubah_pada)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         status_pesanan=excluded.status_pesanan, status_bayar=excluded.status_bayar,
         total=excluded.total, dibatalkan_pada=excluded.dibatalkan_pada,
         diubah_pada=excluded.diubah_pada`,
    )
    .bind(
      k.id,
      k.nomorResi,
      k.waktu,
      k.jenisTransaksi,
      k.statusPesanan,
      k.statusBayar,
      k.bazarId,
      k.namaPemesan,
      k.ongkirMode,
      k.ongkirNominal,
      k.subtotalAwal,
      k.diskonItem,
      k.diskonTotal,
      k.total,
      k.dibatalkanPada,
      k.dibuatPada,
      k.diubahPada,
    )
    .run();

  for (const it of k.items) {
    await db
      .prepare(
        `INSERT INTO transaction_items
          (id, transaksi_id, produk_id, nama_snapshot, harga_satuan, kuantitas, diskon_per_unit, subtotal_bersih)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET kuantitas=excluded.kuantitas,
           harga_satuan=excluded.harga_satuan, diskon_per_unit=excluded.diskon_per_unit,
           subtotal_bersih=excluded.subtotal_bersih`,
      )
      .bind(it.id, k.id, it.produkId, it.namaSnapshot, it.hargaSatuan, it.kuantitas, it.diskonPerUnit, it.subtotalBersih)
      .run();
  }

  for (const p of k.pembayaran) {
    await db
      .prepare(
        `INSERT INTO payments (id, transaksi_id, nominal, waktu, metode)
         VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET nominal=excluded.nominal, metode=excluded.metode`,
      )
      .bind(p.id, k.id, p.nominal, p.waktu, p.metode)
      .run();
  }

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "transaksi", k.id, sekarang)
    .run();
}

async function simpanProduk(db: DBCloud, k: KirimanProduk, sekarang: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO products (id, nama, kode, harga_jual, stok_gudang, arsip, diubah_pada)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, kode=excluded.kode,
         harga_jual=excluded.harga_jual, stok_gudang=excluded.stok_gudang,
         arsip=excluded.arsip, diubah_pada=excluded.diubah_pada`,
    )
    .bind(k.id, k.nama, k.kode, k.hargaJual, k.stokGudang, k.arsip ? 1 : 0, k.diubahPada)
    .run();

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "produk", k.id, sekarang)
    .run();
}

async function simpanBazar(db: DBCloud, k: KirimanBazar, sekarang: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bazars (id, nama, status, lokasi, mulai, selesai, diubah_pada)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, status=excluded.status,
         lokasi=excluded.lokasi, mulai=excluded.mulai, selesai=excluded.selesai,
         diubah_pada=excluded.diubah_pada`,
    )
    .bind(k.id, k.nama, k.status, k.lokasi, k.mulai, k.selesai, k.diubahPada)
    .run();

  await db
    .prepare(`INSERT OR REPLACE INTO sync_log (kunci, jenis, id_record, diterima_pada) VALUES (?,?,?,?)`)
    .bind(kunciSync(k), "bazar", k.id, sekarang)
    .run();
}

/**
 * Memproses satu batch kiriman.
 * Tiap kiriman ditangani sendiri-sendiri: satu rusak tidak membatalkan yang lain.
 */
export async function prosesBatch(
  db: DBCloud,
  kiriman: readonly unknown[],
  sekarang: string = new Date().toISOString(),
): Promise<HasilKirim> {
  const diterima: string[] = [];
  const ditolak: Array<{ id: string; pesan: string }> = [];

  for (const mentah of kiriman) {
    const cek = periksaKiriman(mentah);
    if (!cek.ok) {
      const id = mentah && typeof mentah === "object" ? String((mentah as { id?: unknown }).id ?? "?") : "?";
      ditolak.push({ id, pesan: cek.pesan });
      continue;
    }

    const k = cek.nilai;
    try {
      // Sudah pernah diterima? Lewati tanpa menulis ulang.
      const ada = await db
        .prepare(`SELECT kunci FROM sync_log WHERE kunci = ?`)
        .bind(kunciSync(k))
        .first<{ kunci: string }>();
      if (ada) {
        diterima.push(k.id);
        continue;
      }

      if (k.jenis === "transaksi") await simpanTransaksi(db, k, sekarang);
      else if (k.jenis === "produk") await simpanProduk(db, k, sekarang);
      else await simpanBazar(db, k, sekarang);

      diterima.push(k.id);
    } catch (e) {
      ditolak.push({ id: k.id, pesan: e instanceof Error ? e.message : "gagal disimpan." });
    }
  }

  return { diterima, ditolak };
}
