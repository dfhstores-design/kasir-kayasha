/**
 * Mesin sinkronisasi di perangkat (Phase 6).
 *
 * ATURAN KERAS yang tidak boleh dilanggar:
 *  1. Penjualan TIDAK PERNAH menunggu jaringan. `tandaiUntukSync` hanya menulis outbox lokal.
 *  2. Kegagalan jaringan bukan kesalahan pengguna: dicoba lagi diam-diam dengan jeda.
 *  3. Antrean dikosongkan HANYA setelah server menjawab diterima.
 *  4. Tanpa internet, tidak ada yang berubah — aplikasi tetap berfungsi penuh.
 */
import { getDB, type OutboxRecord, type TransaksiRecord, type ProdukRecord, type ItemTransaksiRecord, type PembayaranRecord } from "../db/schema.ts";
import { buatId } from "../db/repositori.ts";
import type { Kiriman } from "./logika.ts";

export type StatusSync = "mati" | "menunggu" | "mengirim" | "siap" | "gagal";

export interface RingkasanSync {
  status: StatusSync;
  antrean: number;
  terakhirBerhasil: string | null;
  pesan: string | null;
}

const KUNCI_TERAKHIR = "syncTerakhirBerhasil";

/** Menambah satu baris outbox. TIDAK menyentuh jaringan. */
export async function tandaiUntukSync(
  jenisRecord: OutboxRecord["jenisRecord"],
  idRecord: string,
): Promise<void> {
  const db = await getDB();
  // Satu baris per record: kiriman berulang tidak menumpuk.
  const ada = await db.getAllFromIndex("outbox", "by-record", idRecord);
  if (ada.length > 0) {
    await db.put("outbox", {
      ...ada[0]!,
      terakhirDicoba: null,
      dibuatPada: new Date().toISOString(),
    });
    return;
  }
  await db.put("outbox", {
    id: buatId(),
    jenisRecord,
    idRecord,
    aksi: "upsert",
    percobaan: 0,
    terakhirDicoba: null,
    dibuatPada: new Date().toISOString(),
  });
}

export async function jumlahAntrean(): Promise<number> {
  const db = await getDB();
  return db.count("outbox");
}

export async function bacaTerakhirBerhasil(): Promise<string | null> {
  const db = await getDB();
  const s = await db.get("settings", "utama");
  return (s as unknown as Record<string, string | null> | undefined)?.[KUNCI_TERAKHIR] ?? null;
}

/** Menyusun kiriman dari data lokal untuk satu baris outbox. */
async function siapkanKiriman(o: OutboxRecord): Promise<Kiriman | null> {
  const db = await getDB();

  if (o.jenisRecord === "transaksi") {
    const t: TransaksiRecord | undefined = await db.get("transactions", o.idRecord);
    if (!t) return null;
    const items: ItemTransaksiRecord[] = await db.getAllFromIndex("transaction_items", "by-transaksi", t.id);
    const pembayaran: PembayaranRecord[] = await db.getAllFromIndex("payments", "by-transaksi", t.id);
    return {
      jenis: "transaksi",
      id: t.id,
      nomorResi: t.nomorResi,
      waktu: t.waktu,
      jenisTransaksi: t.jenis,
      statusPesanan: t.statusPesanan,
      statusBayar: t.statusBayar,
      bazarId: t.bazarId,
      namaPemesan: t.namaPemesan,
      ongkirMode: t.ongkirMode,
      ongkirNominal: t.ongkirNominal,
      subtotalAwal: t.subtotalAwal,
      diskonItem: t.diskonItem,
      diskonTotal: t.diskonTotal,
      total: t.total,
      dibatalkanPada: t.dibatalkanPada,
      dibuatPada: t.createdAt,
      diubahPada: t.updatedAt,
      items: items.map((i) => ({
        id: i.id,
        produkId: i.produkId,
        namaSnapshot: i.namaSnapshot,
        hargaSatuan: i.hargaSatuan,
        kuantitas: i.kuantitas,
        diskonPerUnit: i.diskonPerUnit,
        subtotalBersih: i.subtotalBersih,
      })),
      pembayaran: pembayaran.map((p) => ({
        id: p.id,
        nominal: p.nominal,
        waktu: p.waktu,
        metode: p.metode,
      })),
    };
  }

  if (o.jenisRecord === "produk") {
    const p: ProdukRecord | undefined = await db.get("products", o.idRecord);
    if (!p) return null;
    return {
      jenis: "produk",
      id: p.id,
      nama: p.nama,
      kode: p.kode,
      hargaJual: p.hargaJual,
      stokGudang: p.stokGudang,
      arsip: p.arsip,
      diubahPada: p.updatedAt,
    };
  }

  // settings tidak dikirim ke cloud (berisi rekening & PIN lokal).
  return null;
}

export interface OpsiKirim {
  /** Alamat endpoint; kosong = sinkronisasi tidak aktif. */
  url?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Mengirim antrean ke server. Mengembalikan ringkasan.
 * Tidak melempar error jaringan: kegagalan dilaporkan lewat `status`.
 */
export async function kirimAntrean(opsi: OpsiKirim = {}): Promise<RingkasanSync> {
  const url = opsi.url ?? "";
  const antreanAwal = await jumlahAntrean();

  if (!url) {
    return {
      status: "mati",
      antrean: antreanAwal,
      terakhirBerhasil: await bacaTerakhirBerhasil(),
      pesan: null,
    };
  }
  if (antreanAwal === 0) {
    return {
      status: "siap",
      antrean: 0,
      terakhirBerhasil: await bacaTerakhirBerhasil(),
      pesan: null,
    };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      status: "menunggu",
      antrean: antreanAwal,
      terakhirBerhasil: await bacaTerakhirBerhasil(),
      pesan: "Menunggu internet.",
    };
  }

  const db = await getDB();
  const outbox: OutboxRecord[] = await db.getAll("outbox");

  const kiriman: Array<{ outboxId: string; kiriman: Kiriman }> = [];
  for (const o of outbox) {
    const k = await siapkanKiriman(o);
    if (k) kiriman.push({ outboxId: o.id, kiriman: k });
  }

  if (kiriman.length === 0) {
    // Tidak ada yang bisa dikirim (mis. hanya settings): bersihkan antrean.
    await db.clear("outbox");
    return { status: "siap", antrean: 0, terakhirBerhasil: await bacaTerakhirBerhasil(), pesan: null };
  }

  const f = opsi.fetchImpl ?? fetch;
  let jawab: Response;
  try {
    jawab = await f(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opsi.token ? { "x-sync-token": opsi.token } : {}),
      },
      body: JSON.stringify({ kiriman: kiriman.map((x) => x.kiriman) }),
    });
  } catch {
    await catatGagal(db, outbox);
    return {
      status: "gagal",
      antrean: await jumlahAntrean(),
      terakhirBerhasil: await bacaTerakhirBerhasil(),
      pesan: "Belum tersambung. Data tetap aman di HP.",
    };
  }

  if (!jawab.ok) {
    await catatGagal(db, outbox);
    return {
      status: "gagal",
      antrean: await jumlahAntrean(),
      terakhirBerhasil: await bacaTerakhirBerhasil(),
      pesan: "Server sedang tidak bisa menerima. Dicoba lagi nanti.",
    };
  }

  let hasil: { diterima?: string[] } = {};
  try {
    hasil = (await jawab.json()) as { diterima?: string[] };
  } catch {
    hasil = {};
  }
  const diterima = new Set(hasil.diterima ?? []);

  // Hapus HANYA yang diakui diterima.
  const tx = db.transaction("outbox", "readwrite");
  for (const x of kiriman) {
    if (diterima.has(x.kiriman.id)) await tx.store.delete(x.outboxId);
  }
  await tx.done;

  const sisa = await jumlahAntrean();
  const settings = await db.get("settings", "utama");
  if (settings) {
    await db.put("settings", {
      ...settings,
      [KUNCI_TERAKHIR]: new Date().toISOString(),
    } as typeof settings);
  }

  return {
    status: sisa === 0 ? "siap" : "menunggu",
    antrean: sisa,
    terakhirBerhasil: new Date().toISOString(),
    pesan: null,
  };
}

async function catatGagal(db: Awaited<ReturnType<typeof getDB>>, outbox: OutboxRecord[]) {
  const now = new Date().toISOString();
  const tx = db.transaction("outbox", "readwrite");
  for (const o of outbox) {
    await tx.store.put({ ...o, percobaan: o.percobaan + 1, terakhirDicoba: now });
  }
  await tx.done;
}

/** Jeda coba-ulang (ms) berdasarkan jumlah percobaan: 5s, 15s, 45s, lalu 2 menit maksimum. */
export function jedaCobaLagi(percobaan: number): number {
  const dasar = 5000;
  const hasil = dasar * Math.pow(3, Math.max(0, percobaan));
  return Math.min(hasil, 120000);
}
