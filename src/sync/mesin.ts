/**
 * Mesin sinkronisasi di perangkat (Phase 6).
 *
 * ATURAN KERAS yang tidak boleh dilanggar:
 *  1. Penjualan TIDAK PERNAH menunggu jaringan. `tandaiUntukSync` hanya menulis outbox lokal.
 *  2. Kegagalan jaringan bukan kesalahan pengguna: dicoba lagi diam-diam dengan jeda.
 *  3. Antrean dikosongkan HANYA setelah server menjawab diterima.
 *  4. Tanpa internet, tidak ada yang berubah — aplikasi tetap berfungsi penuh.
 */
import { getDB, type OutboxRecord, type TransaksiRecord, type ProdukRecord, type ItemTransaksiRecord, type PembayaranRecord, type LogSinkronRecord } from "../db/schema.ts";
import { buatId, SETTINGS_KOSONG } from "../db/repositori.ts";
import type { Kiriman, Perubahan } from "./logika.ts";
import { simpanBayanganUntuk, terapkanPerubahan, type HasilTarik, type KonteksTarik } from "./tarik.ts";

export type StatusSync = "mati" | "menunggu" | "mengirim" | "siap" | "gagal";

export interface RingkasanSync {
  status: StatusSync;
  antrean: number;
  terakhirBerhasil: string | null;
  pesan: string | null;
}

/** Ringkasan satu putaran sinkronisasi penuh (kirim + tarik, Fase 2B). */
export interface RingkasanSinkronisasi extends RingkasanSync {
  terakhirTarik: string | null;
  ditarik: { transaksiBaru: number; transaksiDigabung: number; produk: number; bazar: number };
  konflik: number;
}

const KUNCI_TERAKHIR = "syncTerakhirBerhasil";

/** Tumpang-tindih kursor tarik (menit): menutupi beda jam antar perangkat. */
const OVERLAP_TARIK_MENIT = 5;

/**
 * Id perangkat ini (Fase 2B, BU-33): dibuat sekali dan disimpan di settings.
 * Dipakai hub untuk tidak mengembalikan baris ke pengirimnya sendiri.
 */
export async function perangkatId(): Promise<string> {
  const db = await getDB();
  const settings = (await db.get("settings", "utama")) ?? SETTINGS_KOSONG;
  if (settings.perangkatId) return settings.perangkatId;
  const id = crypto.randomUUID();
  await db.put("settings", { ...settings, perangkatId: id });
  return id;
}

/** Kursor tarik terakhir (waktu `diubah_pada` terbaru yang sudah ditarik). */
export async function bacaTerakhirTarik(): Promise<string | null> {
  const db = await getDB();
  const s = await db.get("settings", "utama");
  return s?.syncTarikTerakhir ?? null;
}

async function simpanTerakhirTarik(waktu: string | null): Promise<void> {
  if (!waktu) return;
  const db = await getDB();
  const settings = await db.get("settings", "utama");
  if (settings) await db.put("settings", { ...settings, syncTarikTerakhir: waktu });
}

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
async function siapkanKiriman(o: OutboxRecord, perangkat: string): Promise<Kiriman | null> {
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
      jenisDokumen: t.jenisDokumen,
      arahStok: t.arahStok,
      pelangganId: t.pelangganId,
      statusPesanan: t.statusPesanan,
      statusBayar: t.statusBayar,
      bazarId: t.bazarId,
      namaPemesan: t.namaPemesan,
      kontak: t.kontak,
      catatanPesanan: t.catatanPesanan,
      perkiraanSiap: t.perkiraanSiap,
      alamat: t.alamat,
      ...(t.nomorUrutBulan !== undefined ? { nomorUrutBulan: t.nomorUrutBulan } : {}),
      jenisBayar: t.jenisBayar,
      ongkirMode: t.ongkirMode,
      ongkirNominal: t.ongkirNominal,
      subtotalAwal: t.subtotalAwal,
      diskonItem: t.diskonItem,
      diskonTotal: t.diskonTotal,
      total: t.total,
      dibatalkanPada: t.dibatalkanPada,
      dibuatPada: t.createdAt,
      diubahPada: t.updatedAt,
      perangkat,
      items: items.map((i) => ({
        id: i.id,
        produkId: i.produkId,
        namaSnapshot: i.namaSnapshot,
        hargaSatuan: i.hargaSatuan,
        kuantitas: i.kuantitas,
        diskonPerUnit: i.diskonPerUnit,
        subtotalBersih: i.subtotalBersih,
        ukuran: i.ukuran ?? null,
        ...(i.urutan !== undefined ? { urutan: i.urutan } : {}),
      })),
      pembayaran: pembayaran.map((p) => ({
        id: p.id,
        nominal: p.nominal,
        waktu: p.waktu,
        metode: p.metode,
        catatan: p.catatan,
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
      catatan: p.catatan,
      arsip: p.arsip,
      diubahPada: p.updatedAt,
    };
  }

  if (o.jenisRecord === "bazar") {
    const b = await db.get("bazars", o.idRecord);
    if (!b) return null;
    return {
      jenis: "bazar",
      id: b.id,
      nama: b.nama,
      status: b.status,
      lokasi: b.lokasi,
      mulai: b.mulai,
      selesai: b.selesai,
      catatan: b.catatan,
      pinKasirHash: b.pinKasirHash,
      diubahPada: b.updatedAt ?? b.createdAt,
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
  const idPerangkat = await perangkatId();

  const kiriman: Array<{ outboxId: string; kiriman: Kiriman }> = [];
  for (const o of outbox) {
    const k = await siapkanKiriman(o, idPerangkat);
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

  // Yang sudah diterima hub dicatat tanggal sync-nya (BU-33) dan menjadi
  // bayangan baru untuk gabung 3-arah berikutnya.
  const sekarang = new Date().toISOString();
  for (const x of kiriman) {
    if (!diterima.has(x.kiriman.id)) continue;
    try {
      if (x.kiriman.jenis === "transaksi") {
        const t = await db.get("transactions", x.kiriman.id);
        if (t) await db.put("transactions", { ...t, terakhirSyncPada: sekarang });
      } else if (x.kiriman.jenis === "produk") {
        await simpanBayanganUntuk(db, "produk", x.kiriman.id);
      } else if (x.kiriman.jenis === "bazar") {
        await simpanBayanganUntuk(db, "bazar", x.kiriman.id);
      }
    } catch {
      // Gagal mencatat jejak sync: antrean sudah bersih, jangan gagalkan kirim.
    }
  }

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

export interface OpsiTarik {
  url?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Menarik perubahan dari hub (Fase 2B, BU-33) dan menerapkannya ke lokal.
 * Tidak melempar error jaringan: kegagalan dilaporkan lewat hasil.
 * Kursor memakai tumpang-tindih 5 menit untuk menutupi beda jam antar perangkat.
 */
export async function tarikPerubahan(opsi: OpsiTarik = {}): Promise<{
  ok: boolean;
  ditarik: HasilTarik | null;
  terakhirTarik: string | null;
  pesan: string | null;
}> {
  const url = opsi.url ?? "";
  const terakhirTarik = await bacaTerakhirTarik();
  if (!url) return { ok: false, ditarik: null, terakhirTarik, pesan: null };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, ditarik: null, terakhirTarik, pesan: "Belum tersambung. Data tetap aman di HP." };
  }

  const idPerangkat = await perangkatId();
  const kursor = terakhirTarik
    ? new Date(new Date(terakhirTarik).getTime() - OVERLAP_TARIK_MENIT * 60_000).toISOString()
    : undefined;
  const param = new URLSearchParams({
    ...(kursor ? { sejak: kursor } : {}),
    perangkat: idPerangkat,
    batas: "50",
  });
  const f = opsi.fetchImpl ?? fetch;
  let jawab: Response;
  try {
    jawab = await f(`${url}?${param.toString()}`, {
      method: "GET",
      headers: {
        ...(opsi.token ? { "x-sync-token": opsi.token } : {}),
      },
    });
  } catch {
    return { ok: false, ditarik: null, terakhirTarik, pesan: "Belum tersambung. Data tetap aman di HP." };
  }
  if (!jawab.ok) {
    return { ok: false, ditarik: null, terakhirTarik, pesan: "Server sedang tidak bisa menerima. Dicoba lagi nanti." };
  }

  let isi: unknown;
  try {
    isi = (await jawab.json()) as unknown;
  } catch {
    return { ok: false, ditarik: null, terakhirTarik, pesan: "Jawaban server tidak bisa dibaca." };
  }
  const o = isi as Partial<Perubahan> & { ok?: unknown };
  if (o.ok !== true || !Array.isArray(o.transaksi) || !Array.isArray(o.produk) || !Array.isArray(o.bazar)) {
    return { ok: false, ditarik: null, terakhirTarik, pesan: "Jawaban server tidak bisa dibaca." };
  }

  const db = await getDB();
  // Pakai waktu server untuk `terakhirSyncPada` agar konsisten antar perangkat.
  const ctx: KonteksTarik = {
    perangkatId: idPerangkat,
    sekarang: typeof o.sekarang === "string" ? o.sekarang : new Date().toISOString(),
  };
  const ditarik = await terapkanPerubahan(
    db,
    { sekarang: String(o.sekarang ?? ctx.sekarang), transaksi: o.transaksi, produk: o.produk, bazar: o.bazar },
    ctx,
  );
  const kursorBaru = ditarik.kursorBaru ?? (typeof o.sekarang === "string" ? o.sekarang : null);
  if (kursorBaru) {
    // Tanpa baris baru pun kursor maju (dikurangi tumpang-tindih saat dipakai).
    const maju =
      !terakhirTarik || kursorBaru > terakhirTarik ? kursorBaru : terakhirTarik;
    await simpanTerakhirTarik(maju);
  }
  return { ok: true, ditarik, terakhirTarik: kursorBaru ?? terakhirTarik, pesan: null };
}

/**
 * Satu putaran sinkronisasi penuh (Fase 2B): kirim dulu, lalu tarik.
 * Dipakai StatusSinkron agar perangkat lain terlihat tanpa menekan apa pun.
 */
export async function sinkronkan(opsi: OpsiKirim & OpsiTarik = {}): Promise<RingkasanSinkronisasi> {
  const url = opsi.url ?? "";
  const antreanAwal = await jumlahAntrean();
  const terakhirTarikAwal = await bacaTerakhirTarik();

  if (!url) {
    return {
      status: "mati",
      antrean: antreanAwal,
      terakhirBerhasil: await bacaTerakhirBerhasil(),
      terakhirTarik: terakhirTarikAwal,
      ditarik: { transaksiBaru: 0, transaksiDigabung: 0, produk: 0, bazar: 0 },
      konflik: 0,
      pesan: null,
    };
  }

  const hasilKirim = await kirimAntrean(opsi);
  const hasilTarik = await tarikPerubahan(opsi);

  const status: StatusSync =
    hasilKirim.status === "gagal" || !hasilTarik.ok
      ? hasilKirim.antrean > 0 || hasilKirim.status === "gagal"
        ? "gagal"
        : hasilKirim.status
      : hasilKirim.status === "siap" || hasilKirim.status === "menunggu"
        ? hasilKirim.status
        : "siap";

  return {
    status,
    antrean: hasilKirim.antrean,
    terakhirBerhasil: hasilKirim.terakhirBerhasil,
    terakhirTarik: hasilTarik.terakhirTarik,
    ditarik: hasilTarik.ditarik
      ? {
          transaksiBaru: hasilTarik.ditarik.transaksiBaru,
          transaksiDigabung: hasilTarik.ditarik.transaksiDigabung,
          produk: hasilTarik.ditarik.produkDigabung,
          bazar: hasilTarik.ditarik.bazarDigabung,
        }
      : { transaksiBaru: 0, transaksiDigabung: 0, produk: 0, bazar: 0 },
    konflik: hasilTarik.ditarik?.konflik ?? 0,
    pesan: hasilKirim.pesan ?? hasilTarik.pesan,
  };
}

/** Satu baris antrean untuk layar Riwayat Sinkronisasi (BU-33). */
export interface AntreanTampil {
  id: string;
  jenis: string;
  judul: string;
  subjudul: string;
}

/** Daftar transaksi/barang/bazar yang belum terkirim (bisa dilihat & dilacak). */
export async function daftarAntrean(): Promise<AntreanTampil[]> {
  const db = await getDB();
  const outbox = await db.getAll("outbox");
  const hasil: AntreanTampil[] = [];
  for (const o of outbox) {
    if (o.jenisRecord === "transaksi") {
      const t = await db.get("transactions", o.idRecord);
      hasil.push({
        id: o.id,
        jenis: "Pesanan",
        judul: t ? `${t.nomorResi}${t.namaPemesan ? ` — ${t.namaPemesan}` : ""}` : o.idRecord,
        subjudul: t ? `Dibuat ${new Date(t.waktu).toLocaleString("id-ID")}` : "Data tidak ditemukan di perangkat.",
      });
    } else if (o.jenisRecord === "produk") {
      const p = await db.get("products", o.idRecord);
      hasil.push({
        id: o.id,
        jenis: "Barang",
        judul: p ? p.nama : o.idRecord,
        subjudul: p ? `Harga ${p.hargaJual.toLocaleString("id-ID")} · stok ${p.stokGudang}` : "Data tidak ditemukan di perangkat.",
      });
    } else if (o.jenisRecord === "bazar") {
      const b = await db.get("bazars", o.idRecord);
      hasil.push({
        id: o.id,
        jenis: "Bazar",
        judul: b ? b.nama : o.idRecord,
        subjudul: b ? `Status ${b.status}` : "Data tidak ditemukan di perangkat.",
      });
    } else {
      hasil.push({ id: o.id, jenis: "Lainnya", judul: o.idRecord, subjudul: o.jenisRecord });
    }
  }
  return hasil;
}

/** Catatan sinkronisasi (pengaman diam-diam) — hanya dibaca owner. */
export async function bacaLogSinkron(): Promise<LogSinkronRecord[]> {
  const db = await getDB();
  const semua = await db.getAllFromIndex("logSinkron", "by-waktu");
  return semua.sort((a, b) => b.waktu.localeCompare(a.waktu));
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
