/**
 * Tes penerapan perubahan dari hub (Fase 2B, BU-33).
 *
 * Yang dikunci:
 *  1. Uang append-only: pembayaran baru ditambah, yang lama tidak ditimpa.
 *  2. Status hanya maju; batal bersifat final.
 *  3. Data master digabung 3-arah; kolom yang bentrok diputus yang terbaru + dicatat.
 *  4. Kiriman rusak tidak menggagalkan paket; dicatat di log lalu dilewati.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { getDB, resetKoneksiDB, type ProdukRecord, type TransaksiRecord } from "../db/schema.ts";
import { gabungMaster, terapkanPerubahan, type KonteksTarik } from "./tarik.ts";
import type { KirimanTransaksi, Perubahan } from "./logika.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

const CTX: KonteksTarik = { perangkatId: "perangkat-tes", sekarang: "2026-11-10T12:00:00.000Z" };

function produkLokal(over: Partial<ProdukRecord> = {}): ProdukRecord {
  return {
    id: "produk-1",
    nama: "Kebaya",
    kode: null,
    hargaJual: 450000,
    stokGudang: 3,
    catatan: null,
    arsip: false,
    createdAt: "2026-11-10T08:00:00.000Z",
    updatedAt: "2026-11-10T08:00:00.000Z",
    ...over,
  };
}

function transaksiLokal(over: Partial<TransaksiRecord> = {}): TransaksiRecord {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    nomorResi: "KYS-0001",
    nomorUrutHari: 1,
    waktu: "2026-11-10T08:00:00.000Z",
    jenis: "langsung",
    jenisDokumen: "penjualan",
    arahStok: "keluar",
    pelangganId: null,
    statusPesanan: "diproses",
    bazarId: null,
    namaPemesan: null,
    kontak: null,
    perkiraanSiap: null,
    alamat: null,
    catatanPesanan: null,
    riwayatTotal: [],
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: 450000,
    diskonItem: 0,
    diskonTotal: 0,
    total: 450000,
    sapaan: "Pagi",
    rekeningSnapshot: [],
    jenisBayar: null,
    statusBayar: "belum_dibayar",
    dibatalkanPada: null,
    createdAt: "2026-11-10T08:00:00.000Z",
    updatedAt: "2026-11-10T08:00:00.000Z",
    ...over,
  };
}

function kirimanTransaksi(over: Partial<KirimanTransaksi> = {}): KirimanTransaksi {
  return {
    jenis: "transaksi",
    id: "11111111-1111-1111-1111-111111111111",
    nomorResi: "KYS-0001",
    waktu: "2026-11-10T08:00:00.000Z",
    jenisDokumen: "penjualan",
    arahStok: "keluar",
    pelangganId: null,
    statusPesanan: "selesai",
    statusBayar: "lunas",
    bazarId: null,
    namaPemesan: null,
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: 450000,
    diskonItem: 0,
    diskonTotal: 0,
    total: 450000,
    dibatalkanPada: null,
    dibuatPada: "2026-11-10T08:00:00.000Z",
    diubahPada: "2026-11-10T09:00:00.000Z",
    items: [
      {
        id: "item-1",
        produkId: "p-1",
        namaSnapshot: "Kebaya",
        hargaSatuan: 450000,
        kuantitas: 1,
        diskonPerUnit: 0,
        subtotalBersih: 450000,
      },
    ],
    pembayaran: [{ id: "pay-1", nominal: 450000, waktu: "2026-11-10T08:30:00.000Z", metode: "tunai" }],
    ...over,
  };
}

describe("gabungMaster — 3-arah", () => {
  const kolom = ["nama", "hargaJual"] as const;

  it("kolom yang hanya berubah di jauh diambil dari jauh", () => {
    const lokal = { nama: "Kebaya", hargaJual: 450000 };
    const jauh = { nama: "Kebaya", hargaJual: 500000 };
    const bayangan = { nama: "Kebaya", hargaJual: 450000 };
    const { hasil, konflik } = gabungMaster(lokal, jauh, bayangan, [...kolom], "2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z");
    expect(hasil.hargaJual).toBe(500000);
    expect(konflik).toHaveLength(0);
  });

  it("kolom yang hanya berubah di lokal dipertahankan", () => {
    const lokal = { nama: "Kebaya Baru", hargaJual: 450000 };
    const jauh = { nama: "Kebaya", hargaJual: 450000 };
    const bayangan = { nama: "Kebaya", hargaJual: 450000 };
    const { hasil } = gabungMaster(lokal, jauh, bayangan, [...kolom], "2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z");
    expect(hasil.nama).toBe("Kebaya Baru");
  });

  it("kolom yang berubah di dua sisi diputus yang terbaru + dicatat", () => {
    const lokal = { nama: "Kebaya", hargaJual: 470000 };
    const jauh = { nama: "Kebaya", hargaJual: 500000 };
    const bayangan = { nama: "Kebaya", hargaJual: 450000 };
    const { hasil, konflik } = gabungMaster(lokal, jauh, bayangan, [...kolom], "2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z");
    expect(hasil.hargaJual).toBe(500000);
    expect(konflik).toContain("hargaJual");
  });

  it("tanpa bayangan: yang terbaru menang utuh", () => {
    const lokal = { nama: "Kebaya", hargaJual: 450000 };
    const jauh = { nama: "Kebaya X", hargaJual: 500000 };
    const { hasil } = gabungMaster(lokal, jauh, null, [...kolom], "2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z");
    expect(hasil).toEqual({ nama: "Kebaya X", hargaJual: 500000 });
  });
});

describe("terapkanPerubahan — transaksi append-only", () => {
  beforeEach(resetDB);

  it("transaksi baru dari perangkat lain masuk utuh beserta item, bayar & jurnal", async () => {
    const db = await getDB();
    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [kirimanTransaksi()],
      produk: [],
      bazar: [],
      biayaBazar: [],
    };
    const hasil = await terapkanPerubahan(db, perubahan, CTX);
    expect(hasil.transaksiBaru).toBe(1);
    expect(hasil.konflik).toBe(0);

    const t = await db.get("transactions", "11111111-1111-1111-1111-111111111111");
    expect(t?.total).toBe(450000);
    expect(t?.terakhirSyncPada).toBe("2026-11-10T12:00:00.000Z");
    expect(t?.waktu).toBe("2026-11-10T08:00:00.000Z");
    expect(await db.getAllFromIndex("transaction_items", "by-transaksi", t!.id)).toHaveLength(1);
    expect(await db.getAllFromIndex("payments", "by-transaksi", t!.id)).toHaveLength(1);
    const jurnal = await db.getAllFromIndex("journal", "by-dokumen", t!.id);
    expect(jurnal).toHaveLength(1);
    expect(jurnal[0]?.kategori).toBe("pelunasan");
  });

  it("pembayaran baru ditambah, total & pembayaran lama tidak ditimpa", async () => {
    const db = await getDB();
    const lokal = transaksiLokal({ statusBayar: "dp", updatedAt: "2026-11-10T10:00:00.000Z" });
    await db.put("transactions", lokal);
    await db.put("payments", { id: "pay-0", transaksiId: lokal.id, nominal: 100000, waktu: "2026-11-10T08:30:00.000Z", metode: "tunai", catatan: null });

    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [
        kirimanTransaksi({
          diubahPada: "2026-11-10T09:00:00.000Z",
          statusBayar: "lunas",
          pembayaran: [
            { id: "pay-0", nominal: 999999, waktu: "2026-11-10T08:30:00.000Z", metode: "tunai" },
            { id: "pay-1", nominal: 350000, waktu: "2026-11-10T09:30:00.000Z", metode: "transfer" },
          ],
        }),
      ],
      produk: [],
      bazar: [],
      biayaBazar: [],
    };
    const hasil = await terapkanPerubahan(db, perubahan, CTX);
    expect(hasil.transaksiDigabung).toBe(1);

    const bayar = await db.getAllFromIndex("payments", "by-transaksi", lokal.id);
    expect(bayar).toHaveLength(2);
    expect(bayar.find((p) => p.id === "pay-0")?.nominal).toBe(100000);
    const t = await db.get("transactions", lokal.id);
    expect(t?.total).toBe(450000);
    expect(t?.statusBayar).toBe("lunas");
  });

  it("status tidak boleh mundur", async () => {
    const db = await getDB();
    await db.put("transactions", transaksiLokal({ statusPesanan: "selesai", statusBayar: "lunas" }));
    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [kirimanTransaksi({ statusPesanan: "diproses", statusBayar: "dp", diubahPada: "2026-11-10T09:00:00.000Z" })],
      produk: [],
      bazar: [],
      biayaBazar: [],
    };
    await terapkanPerubahan(db, perubahan, CTX);
    const t = await db.get("transactions", "11111111-1111-1111-1111-111111111111");
    expect(t?.statusPesanan).toBe("selesai");
    expect(t?.statusBayar).toBe("lunas");
  });

  it("void dari perangkat lain diterapkan + jurnal balik ditulis", async () => {
    const db = await getDB();
    const lokal = transaksiLokal({ statusBayar: "dp" });
    await db.put("transactions", lokal);
    await db.put("payments", { id: "pay-0", transaksiId: lokal.id, nominal: 100000, waktu: "2026-11-10T08:30:00.000Z", metode: "tunai", catatan: null });
    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [
        kirimanTransaksi({
          statusPesanan: "dibatalkan",
          statusBayar: "dp",
          dibatalkanPada: "2026-11-10T11:00:00.000Z",
          diubahPada: "2026-11-10T11:00:00.000Z",
          catatanPesanan: "Dibatalkan: pelanggan membatalkan",
          pembayaran: [{ id: "pay-0", nominal: 100000, waktu: "2026-11-10T08:30:00.000Z", metode: "tunai" }],
        }),
      ],
      produk: [],
      bazar: [],
      biayaBazar: [],
    };
    await terapkanPerubahan(db, perubahan, CTX);
    const t = await db.get("transactions", lokal.id);
    expect(t?.statusPesanan).toBe("dibatalkan");
    expect(t?.dibatalkanPada).toBe("2026-11-10T11:00:00.000Z");
    const jurnal = await db.getAllFromIndex("journal", "by-dokumen", lokal.id);
    expect(jurnal.some((j) => j.kategori === "pembatalan" && j.nominal === 100000)).toBe(true);
  });

  it("kiriman rusak dicatat lalu dilewati, yang lain tetap diterapkan", async () => {
    const db = await getDB();
    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [kirimanTransaksi(), { jenis: "transaksi", id: "pendek" } as unknown as KirimanTransaksi],
      produk: [],
      bazar: [],
      biayaBazar: [],
    };
    const hasil = await terapkanPerubahan(db, perubahan, CTX);
    expect(hasil.transaksiBaru).toBe(1);
    expect(hasil.konflik).toBe(1);
    const log = await db.getAll("logSinkron");
    expect(log.length).toBeGreaterThan(0);
  });
});

describe("terapkanPerubahan — produk gabung 3-arah", () => {
  beforeEach(resetDB);

  it("kolom yang berubah di sisi berbeda digabung, bukan saling menimpa", async () => {
    const db = await getDB();
    const lokal = produkLokal({ nama: "Kebaya Baru", updatedAt: "2026-11-10T10:00:00.000Z" });
    await db.put("products", lokal);
    // Bayangan = versi terakhir yang diketahui hub (sebelum perubahan lokal).
    await db.put("bayangan", {
      id: "produk:produk-1",
      jenis: "produk",
      idRecord: "produk-1",
      data: { ...produkLokal(), nama: "Kebaya", hargaJual: 450000 },
      diubahPada: "2026-11-10T08:00:00.000Z",
    });
    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [],
      produk: [
        {
          jenis: "produk",
          id: "produk-1",
          nama: "Kebaya",
          kode: null,
          hargaJual: 500000,
          stokGudang: 3,
          arsip: false,
          diubahPada: "2026-11-10T09:00:00.000Z",
        },
      ],
      bazar: [],
      biayaBazar: [],
    };
    const hasil = await terapkanPerubahan(db, perubahan, CTX);
    expect(hasil.produkDigabung).toBe(1);
    const p = await db.get("products", "produk-1");
    expect(p?.nama).toBe("Kebaya Baru");
    expect(p?.hargaJual).toBe(500000);
    expect(await db.getAll("logSinkron")).toHaveLength(0);
  });

  it("kolom yang bentrok diputus yang terbaru + masuk log owner", async () => {
    const db = await getDB();
    const lokal = produkLokal({ hargaJual: 470000, updatedAt: "2026-11-10T08:30:00.000Z" });
    await db.put("products", lokal);
    await db.put("bayangan", {
      id: "produk:produk-1",
      jenis: "produk",
      idRecord: "produk-1",
      data: { ...produkLokal(), hargaJual: 450000 },
      diubahPada: "2026-11-10T08:00:00.000Z",
    });
    const perubahan: Perubahan = {
      sekarang: "2026-11-10T12:00:00.000Z",
      transaksi: [],
      produk: [
        {
          jenis: "produk",
          id: "produk-1",
          nama: "Kebaya",
          kode: null,
          hargaJual: 500000,
          stokGudang: 3,
          arsip: false,
          diubahPada: "2026-11-10T09:00:00.000Z",
        },
      ],
      bazar: [],
      biayaBazar: [],
    };
    await terapkanPerubahan(db, perubahan, CTX);
    const p = await db.get("products", "produk-1");
    expect(p?.hargaJual).toBe(500000);
    const log = await db.getAll("logSinkron");
    expect(log).toHaveLength(1);
    expect(log[0]?.judul).toContain("Kebaya");
  });
});

describe("terapkanPerubahan — biaya bazar (F1, BU-34)", () => {
  beforeEach(resetDB);

  const biayaLokal = (over: Partial<import("../db/schema.ts").BiayaBazarRecord> = {}) => ({
    id: "55555555-5555-5555-5555-555555555555",
    bazarId: "44444444-4444-4444-4444-444444444444",
    kategori: "sewa_booth" as const,
    judul: "Sewa booth",
    nominal: 750000,
    tanggal: "2026-11-10",
    catatan: null,
    createdAt: "2026-11-10T08:00:00.000Z",
    ...over,
  });

  const kirimanBiaya = (
    over: Partial<import("./logika.ts").KirimanBiayaBazar> = {},
  ): import("./logika.ts").KirimanBiayaBazar => ({
    jenis: "biaya_bazar",
    id: "55555555-5555-5555-5555-555555555555",
    bazarId: "44444444-4444-4444-4444-444444444444",
    kategori: "sewa_booth",
    judul: "Sewa booth",
    nominal: 750000,
    tanggal: "2026-11-10",
    catatan: null,
    dibuatPada: "2026-11-10T08:00:00.000Z",
    diubahPada: "2026-11-10T08:00:00.000Z",
    ...over,
  });

  const paket = (biayaBazar: import("./logika.ts").KirimanBiayaBazar[]): Perubahan => ({
    sekarang: "2026-11-10T12:00:00.000Z",
    transaksi: [],
    produk: [],
    bazar: [],
    biayaBazar,
  });

  it("biaya baru dari perangkat lain masuk ke lokal", async () => {
    const db = await getDB();
    const hasil = await terapkanPerubahan(db, paket([kirimanBiaya()]), CTX);
    expect(hasil.biayaBazarDigabung).toBe(1);
    const b = await db.get("bazar_biaya", "55555555-5555-5555-5555-555555555555");
    expect(b?.judul).toBe("Sewa booth");
    expect(b?.nominal).toBe(750000);
  });

  it("tombstone menghapus biaya lokal", async () => {
    const db = await getDB();
    await db.put("bazar_biaya", biayaLokal());
    const hasil = await terapkanPerubahan(
      db,
      paket([kirimanBiaya({ diubahPada: "2026-11-10T09:00:00.000Z", dihapus: true })]),
      CTX,
    );
    expect(hasil.biayaBazarDigabung).toBe(1);
    expect(await db.get("bazar_biaya", "55555555-5555-5555-5555-555555555555")).toBeUndefined();
  });

  it("tombstone untuk biaya yang tidak ada tidak error dan tidak dihitung", async () => {
    const db = await getDB();
    const hasil = await terapkanPerubahan(
      db,
      paket([kirimanBiaya({ diubahPada: "2026-11-10T09:00:00.000Z", dihapus: true })]),
      CTX,
    );
    expect(hasil.biayaBazarDigabung).toBe(0);
    expect(hasil.konflik).toBe(0);
  });

  it("kiriman biaya rusak dicatat di log, tidak menggagalkan paket", async () => {
    const db = await getDB();
    const hasil = await terapkanPerubahan(
      db,
      paket([
        kirimanBiaya(),
        kirimanBiaya({
          id: "66666666-6666-6666-6666-666666666666",
          kategori: "entah" as import("./logika.ts").KirimanBiayaBazar["kategori"],
        }),
      ]),
      CTX,
    );
    expect(hasil.biayaBazarDigabung).toBe(1);
    expect(hasil.konflik).toBe(1);
    expect(await db.get("bazar_biaya", "55555555-5555-5555-5555-555555555555")).toBeDefined();
  });
});
