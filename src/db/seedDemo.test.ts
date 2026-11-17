import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { jalankanSeedDemo } from "./seedDemo.ts";
import {
  ambilSettings,
  bazarAktif,
  daftarProduk,
  daftarTransaksi,
  simpanProduk,
} from "./repositori.ts";
import { resetKoneksiDB, type ProdukRecord } from "./schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

describe("seed demo KAYESA", () => {
  beforeEach(resetDB);

  it("mengisi settings, 5 produk, 1 bazar, 10 penjualan dan 3 PO bila DB kosong", async () => {
    expect(await jalankanSeedDemo()).toBe(true);

    const s = await ambilSettings();
    expect(s.namaButik).toBe("KAYESA");
    expect(s.alamatBaris1).toBe("Jl. Tarumanegara No. 41");
    expect(s.alamatBaris2).toBe("Sebelah Pempak Nyai");
    expect(s.kotaKodePos).toBe("Ploso Ciptum 15419");
    expect(s.telepon1).toBe("0812 1141 4017");
    expect(s.telepon2).toBe("0821 1376 5892");
    expect(s.teksPenutup).toBe("Terima kasih, sampai jumpa!");
    expect(s.logo).toBeNull();
    expect(s.pinHash).toBeNull();
    expect(s.rekening).toHaveLength(1);
    expect(s.rekening[0]?.namaBank).toBe("BCA");
    expect(s.rekening[0]?.nomor).toBe("676 017 885");
    expect(s.rekening[0]?.namaPemilik).toBe("NARSHITA DEWI");
    expect(s.rekening[0]?.utama).toBe(true);

    const produk = await daftarProduk();
    expect(produk).toHaveLength(5);
    expect(produk.map((p) => p.nama).sort()).toEqual([
      "Blus Linen",
      "Celana Kulot",
      "Dress Batik",
      "Kemeja Katun",
      "Rok Plisket",
    ]);
    // Stok gudang berkurang sebesar yang dialokasikan ke bazar.
    expect(produk.find((p) => p.nama === "Blus Linen")?.stokGudang).toBe(4);

    const bazar = await bazarAktif();
    expect(bazar?.nama).toBe("Demo Bazar KAYESA");
    expect(bazar?.status).toBe("aktif");

    const semua = await daftarTransaksi();
    expect(semua).toHaveLength(13);
    const penjualan = semua.filter((t) => t.jenis === "langsung");
    const po = semua.filter((t) => t.jenis === "po");
    expect(penjualan).toHaveLength(10);
    expect(po).toHaveLength(3);
    expect(po.map((t) => t.statusPesanan).sort()).toEqual(["diproses", "diproses", "siap"]);
    expect(po.every((t) => t.namaPemesan?.startsWith("CONTOH – "))).toBe(true);
    expect(po.every((t) => t.catatanPesanan === "DATA CONTOH DEMO")).toBe(true);
    expect(penjualan.every((t) => t.bazarId === bazar?.id)).toBe(true);
  });

  it("tidak mengubah apa pun bila dijalankan dua kali", async () => {
    expect(await jalankanSeedDemo()).toBe(true);
    expect(await jalankanSeedDemo()).toBe(false);
    expect((await daftarProduk()).length).toBe(5);
    expect((await daftarTransaksi()).length).toBe(13);
  });

  it("tidak jalan bila sudah ada produk", async () => {
    const now = new Date().toISOString();
    const p: ProdukRecord = {
      id: crypto.randomUUID(),
      nama: "Barang Asli",
      kode: null,
      hargaJual: 100000,
      stokGudang: 1,
      catatan: null,
      arsip: false,
      createdAt: now,
      updatedAt: now,
    };
    await simpanProduk(p);
    expect(await jalankanSeedDemo()).toBe(false);
    expect((await ambilSettings()).namaButik).toBe("");
    expect((await daftarProduk()).map((x) => x.nama)).toEqual(["Barang Asli"]);
  });
});
