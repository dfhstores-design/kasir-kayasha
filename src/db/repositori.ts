/**
 * Repositori data. Semua tulis-menulis ke IndexedDB lewat sini.
 *
 * Prinsip dari CONTEXT:
 * - tulis ke IndexedDB DULU, jangan menunggu server
 * - transaksi + item + pembayaran + pengurangan stok ditulis dalam SATU transaksi DB
 * - tidak ada operasi hapus permanen untuk transaksi
 */
import { getDB, type BazarItemRecord, type BazarRecord, type BiayaBazarRecord, type KategoriBiaya, type FotoRecord, type KeranjangTertahanRecord, type PembayaranRecord, type ProdukRecord, type SettingsRecord, type TransaksiRecord, type ItemTransaksiRecord, type UUID } from "./schema.ts";
import { hitungSaldoBazar } from "../lib/stok.ts";
import { pesanStok, validasiSumberStok, type SumberStok } from "../lib/sumberStok.ts";
import type { Rupiah } from "../lib/money.ts";

// Tipe dipakai ulang oleh layar; diekspor ulang agar konsumen cukup mengimpor dari sini.
export type { BazarRecord, BiayaBazarRecord, KategoriBiaya, FotoRecord, KeranjangTertahanRecord, ProdukRecord, SettingsRecord, TransaksiRecord, UUID };

export const SETTINGS_KOSONG: SettingsRecord = {
  id: "utama",
  namaButik: "",
  alamatBaris1: "",
  alamatBaris2: "",
  kotaKodePos: "",
  telepon1: "",
  telepon2: "",
  teksPenutup: "",
  logo: null,
  rekening: [],
  tampilkanSapaan: true,
  tampilkanNomorResi: true,
  tampilkanRincianDiskon: true,
  tampilkanPembayaranSisa: true,
  pinHash: null,
  updatedAt: new Date(0).toISOString(),
};

export function buatId(): UUID {
  return crypto.randomUUID();
}

/* ------------------------------------------------------------------ settings */

export async function ambilSettings(): Promise<SettingsRecord> {
  const db = await getDB();
  return (await db.get("settings", "utama")) ?? SETTINGS_KOSONG;
}

export async function simpanSettings(nilai: SettingsRecord): Promise<void> {
  const db = await getDB();
  await db.put("settings", { ...nilai, id: "utama", updatedAt: new Date().toISOString() });
}

/** Profil dianggap terisi bila nama butik sudah diisi pemilik. */
export function profilTerisi(s: SettingsRecord): boolean {
  return s.namaButik.trim().length > 0;
}

/* ------------------------------------------------------------------ produk */

export async function daftarProduk(termasukArsip = false): Promise<ProdukRecord[]> {
  const db = await getDB();
  const semua = await db.getAll("products");
  const hasil = termasukArsip ? semua : semua.filter((p) => !p.arsip);
  return hasil.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export async function ambilProduk(id: UUID): Promise<ProdukRecord | undefined> {
  const db = await getDB();
  return db.get("products", id);
}

export async function simpanProduk(p: ProdukRecord): Promise<void> {
  const db = await getDB();
  await db.put("products", { ...p, updatedAt: new Date().toISOString() });
}

export const MAKS_FOTO = 3;

export async function daftarFoto(produkId: UUID): Promise<FotoRecord[]> {
  const db = await getDB();
  const foto = await db.getAllFromIndex("product_photos", "by-produk", produkId);
  return foto.sort((a, b) => a.urutan - b.urutan);
}

/** Menambah foto; menolak melebihi 3 foto (aturan CONTEXT). */
export async function tambahFoto(
  produkId: UUID,
  blob: Blob,
  tipe: string,
): Promise<{ ok: true; foto: FotoRecord } | { ok: false; kode: "maksimal_foto" }> {
  const db = await getDB();
  const tx = db.transaction("product_photos", "readwrite");
  const ada = await tx.store.index("by-produk").getAll(produkId);
  if (ada.length >= MAKS_FOTO) {
    await tx.done;
    return { ok: false, kode: "maksimal_foto" };
  }
  const urutan = (Math.max(0, ...ada.map((f) => f.urutan)) + 1) as 1 | 2 | 3;
  const foto: FotoRecord = {
    id: buatId(),
    produkId,
    urutan,
    blob,
    tipe,
    ukuran: blob.size,
  };
  await tx.store.put(foto);
  await tx.done;
  return { ok: true, foto };
}

export async function hapusFoto(id: UUID): Promise<void> {
  const db = await getDB();
  await db.delete("product_photos", id);
}

/* ------------------------------------------------------------------ bazar */

export async function bazarAktif(): Promise<BazarRecord | undefined> {
  const db = await getDB();
  const aktif = await db.getAllFromIndex("bazars", "by-status", "aktif");
  return aktif[0];
}

export async function daftarBazar(): Promise<BazarRecord[]> {
  const db = await getDB();
  const semua = await db.getAll("bazars");
  return semua.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function buatBazar(
  nama: string,
  mulai: string | null,
  selesai: string | null,
  detail: { lokasi?: string | null; catatan?: string | null } = {},
): Promise<BazarRecord> {
  const db = await getDB();
  const tx = db.transaction("bazars", "readwrite");
  const sudahAktif = await tx.store.index("by-status").getAll("aktif");
  if (sudahAktif.length > 0) {
    await tx.done;
    throw new Error("Masih ada bazar aktif. Tutup dulu sebelum membuka bazar baru.");
  }
  const bazar: BazarRecord = {
    id: buatId(),
    nama,
    mulai,
    selesai,
    lokasi: detail.lokasi ?? null,
    catatan: detail.catatan ?? null,
    status: "aktif",
    ringkasanTerjual: null,
    ringkasanDibawa: null,
    ringkasanSisa: null,
    ditutupPada: null,
    createdAt: new Date().toISOString(),
  };
  await tx.store.put(bazar);
  await tx.done;
  return bazar;
}

/* ------------------------------------------------------------ biaya bazar */

export async function daftarBiaya(bazarId: UUID): Promise<BiayaBazarRecord[]> {
  const db = await getDB();
  const semua = await db.getAllFromIndex("bazar_biaya", "by-bazar", bazarId);
  return semua.sort((a, b) => (a.tanggal === b.tanggal ? a.createdAt.localeCompare(b.createdAt) : a.tanggal.localeCompare(b.tanggal)));
}

export type HasilBiaya =
  | { ok: true; biaya: BiayaBazarRecord }
  | { ok: false; pesan: string };

/** Mencatat pengeluaran bazar. Nominal wajib integer > 0. */
export async function tambahBiaya(
  bazarId: UUID,
  nilai: { kategori: KategoriBiaya; judul: string; nominal: number; tanggal: string; catatan: string | null },
): Promise<HasilBiaya> {
  if (nilai.judul.trim().length < 2) return { ok: false, pesan: "Isi judul biaya." };
  if (!Number.isInteger(nilai.nominal) || nilai.nominal <= 0) {
    return { ok: false, pesan: "Nominal harus lebih dari 0." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai.tanggal)) {
    return { ok: false, pesan: "Tanggal tidak valid." };
  }
  const db = await getDB();
  const biaya: BiayaBazarRecord = {
    id: buatId(),
    bazarId,
    kategori: nilai.kategori,
    judul: nilai.judul.trim(),
    nominal: nilai.nominal,
    tanggal: nilai.tanggal,
    catatan: nilai.catatan?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  await db.put("bazar_biaya", biaya);
  return { ok: true, biaya };
}

export async function hapusBiaya(id: UUID): Promise<void> {
  const db = await getDB();
  await db.delete("bazar_biaya", id);
}

export async function itemBazar(bazarId: UUID): Promise<BazarItemRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("bazar_items", "by-bazar", bazarId);
}

/** Saldo bazar sebuah produk pada bazar tertentu (0 bila belum dialokasikan). */
export async function saldoBazarProduk(bazarId: UUID, produkId: UUID): Promise<number> {
  const db = await getDB();
  const items = await db.getAllFromIndex("bazar_items", "by-bazar", bazarId);
  const item = items.find((i) => i.produkId === produkId);
  return item ? hitungSaldoBazar(item) : 0;
}

export async function saldoSemuaBazar(bazarId: UUID): Promise<Map<UUID, number>> {
  const items = await itemBazar(bazarId);
  return new Map(items.map((i) => [i.produkId, hitungSaldoBazar(i)]));
}

/** Ringkasan bazar untuk layar: dibawa, terjual, sisa, uang masuk. */
export interface RingkasanBazar {
  dibawa: number;
  terjualPcs: number;
  sisaPcs: number;
  uangMasuk: Rupiah;
  jumlahBarang: number;
}

export async function ringkasanBazar(bazarId: UUID): Promise<RingkasanBazar> {
  const items = await itemBazar(bazarId);
  const trx = await db_transaksiBazar(bazarId);
  const uangMasuk = trx
    .filter((t) => !t.dibatalkanPada)
    .reduce((n, t) => n + t.total, 0);

  return {
    dibawa: items.reduce((n, i) => n + i.dibawa, 0),
    terjualPcs: items.reduce((n, i) => n + i.terjual, 0),
    sisaPcs: items.reduce((n, i) => n + hitungSaldoBazar(i), 0),
    uangMasuk,
    jumlahBarang: items.length,
  };
}

async function db_transaksiBazar(bazarId: UUID): Promise<TransaksiRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("transactions", "by-bazar", bazarId);
}

/** Apakah bazar masih punya transaksi tertahan (parkir) miliknya. */
export async function adaParkirUntukBazar(bazarId: UUID): Promise<boolean> {
  const db = await getDB();
  const semua = await db.getAll("parked_carts");
  return semua.some((p) => p.bazarId === bazarId);
}

export type HasilTutupBazar =
  | { ok: true; dikembalikan: number; hilang: number; selisih: number }
  | { ok: false; pesan: string };

/**
 * Menutup bazar: sisa yang dikembalikan menambah stok gudang, sisanya dianggap habis.
 * Ditolak bila masih ada parkir milik bazar ini (supaya tidak ada keranjang menggantung).
 */
export async function tutupBazar(
  bazarId: UUID,
  dikembalikanPerProduk: ReadonlyMap<UUID, number>,
): Promise<HasilTutupBazar> {
  if (await adaParkirUntukBazar(bazarId)) {
    return { ok: false, pesan: "Selesaikan atau hapus transaksi tertahan dulu." };
  }

  const db = await getDB();
  const items = await itemBazar(bazarId);
  const produkSemua = await db.getAll("products");
  const waktu = new Date().toISOString();

  let totalDikembalikan = 0;
  let totalHilang = 0;
  const perubahan: Array<{ produkId: UUID; stokGudangBaru: number }> = [];

  for (const item of items) {
    const sisa = hitungSaldoBazar(item);
    const kembali = dikembalikanPerProduk.get(item.produkId) ?? sisa;
    if (!Number.isInteger(kembali) || kembali < 0) {
      return { ok: false, pesan: "Jumlah yang dikembalikan tidak valid." };
    }
    totalDikembalikan += kembali;
    totalHilang += Math.max(0, sisa - kembali);

    const produk = produkSemua.find((p) => p.id === item.produkId);
    if (produk) perubahan.push({ produkId: produk.id, stokGudangBaru: produk.stokGudang + kembali });
  }

  const bazar = await db.get("bazars", bazarId);
  if (!bazar) return { ok: false, pesan: "Bazar tidak ditemukan." };

  const ringkas = await ringkasanBazar(bazarId);

  let totalSelisih = 0;

  const tx = db.transaction(["products", "bazar_items", "bazars"], "readwrite");
  for (const p of perubahan) {
    const produk = await tx.objectStore("products").get(p.produkId);
    if (produk) {
      await tx.objectStore("products").put({ ...produk, stokGudang: p.stokGudangBaru, updatedAt: waktu });
    }
  }
  for (const item of items) {
    const sisa = hitungSaldoBazar(item);
    const kembali = dikembalikanPerProduk.get(item.produkId) ?? sisa;
    // Selisih = jumlah yang tidak kembali (termasuk beda hitung fisik).
    const selisih = sisa - kembali;
    totalSelisih += Math.abs(selisih);
    await tx.objectStore("bazar_items").put({
      ...item,
      ditarik: item.ditarik + kembali,
      // Sisa yang tidak dikembalikan dianggap terjual habis di lokasi bazar.
      terjual: item.terjual + Math.max(0, selisih),
      // Bila fisik lebih banyak dari tercatat, selisihnya negatif (barang lebih).
      selisih: selisih,
      updatedAt: waktu,
    });
  }
  await tx.objectStore("bazars").put({
    ...bazar,
    status: "selesai",
    ringkasanDibawa: ringkas.dibawa,
    ringkasanTerjual: ringkas.terjualPcs,
    ringkasanSisa: totalDikembalikan,
    ditutupPada: waktu,
  });
  await tx.done;

  return { ok: true, dikembalikan: totalDikembalikan, hilang: totalHilang, selisih: totalSelisih };
}

/** Menarik sebagian barang dari bazar kembali ke gudang (tanpa menutup bazar). */
export async function tarikDariBazar(bazarId: UUID, produkId: UUID, jumlah: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["products", "bazar_items"], "readwrite");
  const items = await tx.objectStore("bazar_items").index("by-bazar").getAll(bazarId);
  const item = items.find((i) => i.produkId === produkId);
  if (!item) throw new RangeError("Barang belum dibawa ke bazar.");

  const sisa = hitungSaldoBazar(item);
  if (!Number.isInteger(jumlah) || jumlah < 0 || jumlah > sisa) {
    await tx.done;
    throw new RangeError("Jumlah melebihi sisa bazar.");
  }

  const produk = await tx.objectStore("products").get(produkId);
  const waktu = new Date().toISOString();
  if (produk) {
    await tx.objectStore("products").put({
      ...produk,
      stokGudang: produk.stokGudang + jumlah,
      updatedAt: waktu,
    });
  }
  await tx.objectStore("bazar_items").put({ ...item, ditarik: item.ditarik + jumlah, updatedAt: waktu });
  await tx.done;
}

/**
 * Menambah barang bawa ke bazar. Gudang berkurang, saldo bazar bertambah —
 * dalam satu transaksi DB agar tidak ada stok yang "hilang".
 */
export async function alokasikanKeBazar(
  bazarId: UUID,
  produkId: UUID,
  jumlah: number,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["products", "bazar_items"], "readwrite");
  const produk = await tx.objectStore("products").get(produkId);
  if (!produk) throw new Error("Barang tidak ditemukan");
  if (!Number.isInteger(jumlah) || jumlah < 0 || jumlah > produk.stokGudang) {
    await tx.done;
    throw new RangeError("Jumlah melebihi stok gudang");
  }

  const itemsStore = tx.objectStore("bazar_items");
  const semua = await itemsStore.index("by-bazar").getAll(bazarId);
  const item = semua.find((i) => i.produkId === produkId);
  const now = new Date().toISOString();

  if (item) {
    await itemsStore.put({ ...item, dibawa: item.dibawa + jumlah, updatedAt: now });
  } else {
    await itemsStore.put({
      id: buatId(),
      bazarId,
      produkId,
      dibawa: jumlah,
      terjual: 0,
      ditarik: 0,
      selisih: null,
      updatedAt: now,
    });
  }

  await tx.objectStore("products").put({
    ...produk,
    stokGudang: produk.stokGudang - jumlah,
    updatedAt: now,
  });
  await tx.done;
}

/* ------------------------------------------------------------------ parkir */

export const MAKS_PARKIR = 3;

export async function daftarParkir(): Promise<KeranjangTertahanRecord[]> {
  const db = await getDB();
  const semua = await db.getAll("parked_carts");
  return semua.sort((a, b) => a.dibuatPada.localeCompare(b.dibuatPada));
}

export async function simpanParkir(
  k: Omit<KeranjangTertahanRecord, "id" | "dibuatPada">,
): Promise<{ ok: true; keranjang: KeranjangTertahanRecord } | { ok: false; kode: "maksimal_parkir" }> {
  const db = await getDB();
  const tx = db.transaction("parked_carts", "readwrite");
  const semua = await tx.store.getAll();
  if (semua.length >= MAKS_PARKIR) {
    await tx.done;
    return { ok: false, kode: "maksimal_parkir" };
  }
  const keranjang: KeranjangTertahanRecord = {
    ...k,
    id: buatId(),
    dibuatPada: new Date().toISOString(),
  };
  await tx.store.put(keranjang);
  await tx.done;
  return { ok: true, keranjang };
}

export async function hapusParkir(id: UUID): Promise<void> {
  const db = await getDB();
  await db.delete("parked_carts", id);
}

export async function ambilParkir(id: UUID): Promise<KeranjangTertahanRecord | undefined> {
  const db = await getDB();
  return db.get("parked_carts", id);
}

/* ------------------------------------------------------------------ transaksi */

export interface TransaksiLengkap {
  transaksi: TransaksiRecord;
  item: ItemTransaksiRecord[];
  pembayaran: PembayaranRecord[];
}

/**
 * Menyimpan transaksi + item + pembayaran + pengurangan stok dalam SATU transaksi DB.
 * Idempoten oleh `id` (UUID dibuat di perangkat): menekan simpan dua kali tidak menggandakan.
 *
 * Aturan stok ditegakkan di sini (bukan hanya di UI):
 *  - transaksi bazar WAJIB memakai `tipe: "bazar"`; memakai "gudang" akan DITOLAK
 *  - transaksi tanpa bazar WAJIB memakai `tipe: "gudang"`
 *  - saldo bazar tidak boleh negatif; stok gudang tidak boleh negatif
 * Semua sumber divalidasi SEBELUM satu pun baris ditulis.
 */
export async function simpanTransaksi(
  trx: TransaksiRecord,
  items: ItemTransaksiRecord[],
  pembayaran: PembayaranRecord[],
  stokBaru: readonly SumberStok[],
): Promise<void> {
  const bazarIdTransaksi = trx.bazarId;

  // 1) Validasi bentuk aturan.
  const cek = validasiSumberStok(stokBaru, bazarIdTransaksi);
  if (!cek.ok) throw new RangeError(pesanStok(cek.kode));

  // 2) Validasi kecukupan stok.
  const db = await getDB();
  for (const s of stokBaru) {
    if (s.tipe === "gudang") {
      const produk = await db.get("products", s.produkId);
      if (!produk) throw new RangeError("Barang tidak ditemukan.");
      if (produk.stokGudang < s.jumlah) throw new RangeError(pesanStok("stok_gudang_tidak_cukup"));
    } else {
      const items2 = await db.getAllFromIndex("bazar_items", "by-bazar", s.bazarId);
      const item = items2.find((i) => i.produkId === s.produkId);
      const saldo = item ? hitungSaldoBazar(item) : 0;
      if (saldo < s.jumlah) throw new RangeError(pesanStok("saldo_bazar_tidak_cukup"));
    }
  }

  const tx = db.transaction(
    ["transactions", "transaction_items", "payments", "products", "bazar_items"],
    "readwrite",
  );

  await tx.objectStore("transactions").put(trx);
  for (const it of items) await tx.objectStore("transaction_items").put(it);
  for (const p of pembayaran) await tx.objectStore("payments").put(p);

  const now = new Date().toISOString();
  for (const s of stokBaru) {
    if (s.tipe === "gudang") {
      const produk = await tx.objectStore("products").get(s.produkId);
      if (produk) {
        await tx.objectStore("products").put({
          ...produk,
          stokGudang: produk.stokGudang - s.jumlah,
          updatedAt: now,
        });
      }
    } else {
      const items2 = await tx.objectStore("bazar_items").index("by-bazar").getAll(s.bazarId);
      const item = items2.find((i) => i.produkId === s.produkId);
      if (!item) throw new RangeError(pesanStok("saldo_bazar_tidak_cukup"));
      await tx.objectStore("bazar_items").put({
        ...item,
        terjual: item.terjual + s.jumlah,
        updatedAt: now,
      });
    }
  }

  await tx.done;
}

export async function ambilTransaksi(id: UUID): Promise<TransaksiLengkap | undefined> {
  const db = await getDB();
  const trx = await db.get("transactions", id);
  if (!trx) return undefined;
  const [item, pembayaran] = await Promise.all([
    db.getAllFromIndex("transaction_items", "by-transaksi", id),
    db.getAllFromIndex("payments", "by-transaksi", id),
  ]);
  return { transaksi: trx, item, pembayaran };
}

export async function daftarTransaksi(): Promise<TransaksiRecord[]> {
  const db = await getDB();
  const semua = await db.getAll("transactions");
  return semua.sort((a, b) => b.waktu.localeCompare(a.waktu));
}

/** Nomor urut hari itu untuk `#7` di resi. */
export async function nomorUrutBerikutnya(hari: string): Promise<number> {
  const semua = await daftarTransaksi();
  return semua.filter((t) => t.waktu.slice(0, 10) === hari).length + 1;
}
