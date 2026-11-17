import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { ambilLogoDemo, jalankanSeedDemo, LOGO_DEMO_URL } from "./seedDemo.ts";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mengambil logo default dari public/ bila tersedia", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe(LOGO_DEMO_URL);
        return { ok: true, blob: async () => new Blob(["logo-png"], { type: "image/png" }) };
      }),
    );
    const logo = await ambilLogoDemo();
    expect(logo).toBeInstanceOf(Blob);
    expect(logo?.type).toBe("image/png");
    expect(logo?.size).toBeGreaterThan(0);
  });

  it("seed tetap jalan tanpa logo bila fetch logo gagal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await ambilLogoDemo()).toBeNull();
    expect(await jalankanSeedDemo()).toBe(true);
    expect((await ambilSettings()).logo).toBeNull();
    expect((await daftarProduk()).length).toBe(5);
  });

  it("mengisi settings, 5 produk, 1 bazar, 10 penjualan dan 3 PO bila DB kosong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(["logo-png"], { type: "image/png" }) })),
    );
    expect(await jalankanSeedDemo()).toBe(true);

    const s = await ambilSettings();
    expect(s.namaButik).toBe("KAYESA");
    expect(s.alamatBaris1).toBe("Jl. Tarumanegara No. 41");
    expect(s.alamatBaris2).toBe("Sebelah Pempak Nyai");
    expect(s.kotaKodePos).toBe("Ploso Ciptum 15419");
    expect(s.telepon1).toBe("0812 1141 4017");
    expect(s.telepon2).toBe("0821 1376 5892");
    expect(s.teksPenutup).toBe("Terima kasih, sampai jumpa!");
    expect(s.skalaFont).toBe(1);
    expect(s.tema).toBe("terang");
    // fake-indexeddb di lingkungan tes ini mengembalikan Blob hasil
    // structured clone sebagai objek kosong {}, jadi isi logo (type/size)
    // tidak bisa dicek lewat ambilSettings() di sini. Yang dicek di sini:
    // seed menyimpan sesuatu yang bukan null. Isi Blob-nya sendiri dicek
    // langsung di tes ambilLogoDemo di atas, dan jalur simpan Blob ->
    // IndexedDB -> URL.createObjectURL adalah jalur yang sama dengan
    // unggah logo di Pengaturan yang sudah dipakai di produksi.
    expect(s.logo).not.toBeNull();
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
