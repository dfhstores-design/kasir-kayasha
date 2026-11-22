import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  BATAS_RIWAYAT_AWAL,
  batasiRiwayat,
  labelJenisDokumen,
  labelMetodeBayar,
  muatDataRingkasan,
  ringkasItem,
  urutRiwayatBaruDulu,
} from "./Ringkasan.tsx";
import { alokasikanKeBazar, buatBazar, simpanProduk, type ProdukRecord } from "../db/repositori.ts";
import { getDB, resetKoneksiDB } from "../db/schema.ts";
import { hitungRingkasanKeuangan, metodeBayarSah } from "../lib/bazar.ts";
import { simpanPenjualan } from "../lib/penjualan.ts";
import { tanggalHariIni } from "../lib/tanggal.ts";

describe("labelJenisDokumen", () => {
  it("memberi label Indonesia untuk tiap jenis dokumen", () => {
    expect(labelJenisDokumen("penjualan")).toBe("Penjualan");
    expect(labelJenisDokumen("pesanan")).toBe("Pesanan");
    expect(labelJenisDokumen("jasa")).toBe("Jahit");
  });
});

describe("ringkasItem", () => {
  it("tanpa item → —", () => {
    expect(ringkasItem([])).toBe("—");
  });

  it("satu dan dua item disebut semua dengan kuantitas", () => {
    expect(ringkasItem([{ namaSnapshot: "Kemeja", kuantitas: 2 }])).toBe("Kemeja ×2");
    expect(
      ringkasItem([
        { namaSnapshot: "Kemeja", kuantitas: 2 },
        { namaSnapshot: "Celana", kuantitas: 1 },
      ]),
    ).toBe("Kemeja ×2, Celana ×1");
  });

  it("lebih dari dua item dipotong dengan hitungan sisa", () => {
    expect(
      ringkasItem([
        { namaSnapshot: "A", kuantitas: 1 },
        { namaSnapshot: "B", kuantitas: 1 },
        { namaSnapshot: "C", kuantitas: 3 },
      ]),
    ).toBe("A ×1, B ×1 dan 1 barang lain");
  });
});

describe("labelMetodeBayar", () => {
  it("memakai jenisBayar bila ada", () => {
    expect(labelMetodeBayar("tunai", [])).toBe("Tunai");
    expect(labelMetodeBayar("transfer", [])).toBe("Transfer");
    expect(labelMetodeBayar("qris", [])).toBe("QRIS");
  });

  it("tanpa jenisBayar memakai metode pembayaran terakhir (pesanan jahit / PO)", () => {
    expect(
      labelMetodeBayar(null, [
        { metode: "tunai", waktu: "2026-11-10T10:00:00.000Z" },
        { metode: "transfer", waktu: "2026-11-11T10:00:00.000Z" },
      ]),
    ).toBe("Transfer");
  });

  it("tanpa jenisBayar dan tanpa pembayaran → —", () => {
    expect(labelMetodeBayar(null, [])).toBe("—");
  });
});

describe("urutRiwayatBaruDulu", () => {
  it("mengurutkan terbaru dulu", () => {
    const daftar = [
      { waktu: "2026-11-10T10:00:00.000Z", id: "lama" },
      { waktu: "2026-11-12T10:00:00.000Z", id: "baru" },
    ];
    expect(urutRiwayatBaruDulu(daftar).map((t) => t.id)).toEqual(["baru", "lama"]);
  });
});

describe("batasiRiwayat", () => {
  const daftar = Array.from({ length: 25 }, (_, i) => i);

  it("tampilan awal dibatasi 20 terbaru", () => {
    expect(BATAS_RIWAYAT_AWAL).toBe(20);
    expect(batasiRiwayat(daftar, false)).toHaveLength(20);
    expect(batasiRiwayat(daftar, false)[0]).toBe(0);
  });

  it("tampilkan semua mengembalikan seluruh daftar", () => {
    expect(batasiRiwayat(daftar, true)).toHaveLength(25);
  });
});

/**
 * (d, tes klik 22 Nov 2026): mode umum Ringkasan harus menghitung SEMUA
 * transaksi — skenario profil baru: 5 penjualan hari ini (4 toko + 1 bazar),
 * bazar lalu ditutup. Dulu agregat hanya menghitung transaksi bazar selesai
 * terakhir, jadi penjualan toko tidak masuk angka.
 */
describe("muatDataRingkasan — mode umum (d)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  async function produkBaru(nama: string, hargaJual: number): Promise<ProdukRecord> {
    const now = new Date().toISOString();
    const p: ProdukRecord = {
      id: crypto.randomUUID(),
      nama,
      kode: null,
      hargaJual,
      stokGudang: 50,
      catatan: null,
      arsip: false,
      createdAt: now,
      updatedAt: now,
    };
    await simpanProduk(p);
    return p;
  }

  it("tanpa bazar aktif, agregat menghitung 5 penjualan (toko + bazar) di hari itu", async () => {
    const blus = await produkBaru("Blus", 180000);
    const rok = await produkBaru("Rok", 150000);
    const kemeja = await produkBaru("Kemeja", 200000);
    const celana = await produkBaru("Celana", 120000);
    const gaun = await produkBaru("Gaun", 500000);
    const b = await buatBazar("Bazar Uji", null, null);
    // Penjualan bazar butuh alokasi stok dulu.
    await alokasikanKeBazar(b.id, gaun.id, 10);
    const jual = async (p: ProdukRecord, bazarId: string | null) => {
      const h = await simpanPenjualan(
        {
          items: [{ produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas: 1, diskonPerUnit: 0 }],
          diskonTotal: 0,
          ongkir: { mode: "ambil_sendiri", nominal: 0 },
          jenisBayar: "tunai",
          statusBayar: "lunas",
          dibayarSekarang: 0,
          bazarId,
        },
        { rekening: [] },
      );
      expect(h.ok).toBe(true);
    };
    // 4 penjualan toko + 1 penjualan bazar, semuanya hari ini.
    await jual(blus, null);
    await jual(rok, null);
    await jual(kemeja, null);
    await jual(celana, null);
    await jual(gaun, b.id);
    // Bazar lalu ditutup (status selesai) — seperti di tes klik.
    const db = await getDB();
    await db.put("bazars", { ...b, status: "selesai", ditutupPada: new Date().toISOString() });

    const data = await muatDataRingkasan(null);
    expect(data.mode).toBe("umum");
    expect(data.trx).toHaveLength(5);

    const keRingkas = data.trx.map((t) => ({
      total: t.total,
      jenisBayar: t.jenisBayar,
      dibatalkan: t.dibatalkanPada !== null,
      waktu: t.waktu,
      pembayaran: (data.bayarPerTrx.get(t.id) ?? []).map((p) => ({
        nominal: p.nominal,
        metode: metodeBayarSah(p.metode),
        waktu: p.waktu,
      })),
    }));
    const harian = hitungRingkasanKeuangan(keRingkas, [], tanggalHariIni());
    expect(harian.jumlahTransaksi).toBe(5);
    expect(harian.omzet).toBe(180000 + 150000 + 200000 + 120000 + 500000);
    expect(harian.uangMasuk).toBe(180000 + 150000 + 200000 + 120000 + 500000);
  });

  it("dengan bazar aktif, agregat tetap hanya bazar itu", async () => {
    const blus = await produkBaru("Blus", 180000);
    const gaun = await produkBaru("Gaun", 500000);
    const b = await buatBazar("Bazar Uji", null, null);
    await alokasikanKeBazar(b.id, gaun.id, 10);
    const jual = async (p: ProdukRecord, bazarId: string | null) => {
      const h = await simpanPenjualan(
        {
          items: [{ produkId: p.id, nama: p.nama, hargaSatuan: p.hargaJual, kuantitas: 1, diskonPerUnit: 0 }],
          diskonTotal: 0,
          ongkir: { mode: "ambil_sendiri", nominal: 0 },
          jenisBayar: "tunai",
          statusBayar: "lunas",
          dibayarSekarang: 0,
          bazarId,
        },
        { rekening: [] },
      );
      expect(h.ok).toBe(true);
    };
    await jual(blus, null);
    await jual(gaun, b.id);

    const data = await muatDataRingkasan(b);
    expect(data.mode).toBe("bazar");
    expect(data.trx).toHaveLength(1);
    expect(data.trx[0]?.bazarId).toBe(b.id);
  });
});
