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
import { daftarPesananJahit } from "../lib/jahitan.ts";
import { resetKoneksiDB, type ProdukRecord } from "./schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
  try {
    localStorage.clear();
  } catch {
    // lingkungan tanpa localStorage: abaikan
  }
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

  it("mengisi settings, 5 produk, 1 bazar, 10 penjualan dan 2 pesanan jahit bila DB kosong", async () => {
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
    expect(semua).toHaveLength(12);
    const penjualan = semua.filter((t) => t.jenis === "langsung");
    const jahit = semua.filter((t) => t.jenisDokumen === "jasa");
    expect(penjualan).toHaveLength(10);
    // Seed TIDAK lagi membuat PO barang stok (BU-24: Pesanan = pesanan jahit).
    expect(semua.filter((t) => t.jenis === "po" && t.jenisDokumen !== "jasa")).toHaveLength(0);
    expect(jahit).toHaveLength(2);
    expect(jahit.map((t) => t.namaPemesan).sort()).toEqual(["CONTOH – Dewi", "CONTOH – Sari"]);
    expect(jahit.every((t) => t.namaPemesan?.startsWith("CONTOH – "))).toBe(true);
    expect(jahit.every((t) => t.bazarId === null)).toBe(true);
    expect(penjualan.every((t) => t.bazarId === bazar?.id)).toBe(true);

    const pesananJahit = await daftarPesananJahit();
    expect(pesananJahit).toHaveLength(2);
    const sari = pesananJahit.find((p) => p.namaPemesan === "CONTOH – Sari");
    const dewi = pesananJahit.find((p) => p.namaPemesan === "CONTOH – Dewi");
    // Sari: Kebaya brokat 850.000 + Payet 125.000 = 975.000, DP 300.000.
    expect(sari?.model).toBe("Kebaya brokat");
    expect(sari?.total).toBe(975000);
    expect(sari?.terbayar).toBe(300000);
    expect(sari?.sisa).toBe(675000);
    expect(sari?.status).toBe("terbuka");
    expect(sari?.perkiraanSelesai).toBe("2026-11-19");
    // Dewi: Gaun Pesta 350.000, bayar penuh.
    expect(dewi?.model).toBe("Gaun Pesta");
    expect(dewi?.total).toBe(350000);
    expect(dewi?.terbayar).toBe(350000);
    expect(dewi?.sisa).toBe(0);
    expect(dewi?.status).toBe("lunas");
    expect(dewi?.perkiraanSelesai).toBe("2026-11-18");
  });

  it("tidak mengubah apa pun bila dijalankan dua kali", async () => {
    expect(await jalankanSeedDemo()).toBe(true);
    expect(await jalankanSeedDemo()).toBe(false);
    expect((await daftarProduk()).length).toBe(5);
    expect((await daftarTransaksi()).length).toBe(12);
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
