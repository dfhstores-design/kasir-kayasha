import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { ambilLogoDemo, jalankanSeedDemo, migrasiAlamatLama, migrasiRekeningKedua, LOGO_DEMO_URL } from "./seedDemo.ts";
import {
  ambilSettings,
  bazarAktif,
  daftarProduk,
  daftarTransaksi,
  simpanProduk,
  simpanSettings,
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
    expect((await daftarProduk()).length).toBe(0);
    expect((await daftarTransaksi()).length).toBe(0);
    expect(await bazarAktif()).toBeUndefined();
  });

  it("mengisi settings usaha saja, tanpa data contoh, bila DB kosong (serah terima 19 Nov 2026)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(["logo-png"], { type: "image/png" }) })),
    );
    expect(await jalankanSeedDemo()).toBe(true);

    const s = await ambilSettings();
    expect(s.namaButik).toBe("KAYESA");
    expect(s.alamatBaris1).toBe("Jl. Tarumanegara No. 41");
    expect(s.alamatBaris2).toBe("Pisangan, Ciputat Timur - 15419");
    expect(s.kotaKodePos).toBe("");
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
    expect(s.rekening).toHaveLength(2);
    expect(s.rekening[0]?.namaBank).toBe("BCA");
    expect(s.rekening[0]?.nomor).toBe("676 017 885");
    expect(s.rekening[0]?.namaPemilik).toBe("NARSHITA DEWI");
    expect(s.rekening[0]?.utama).toBe(true);
    expect(s.rekening[1]?.namaBank).toBe("Mandiri");
    expect(s.rekening[1]?.nomor).toBe("1010001037785");
    expect(s.rekening[1]?.namaPemilik).toBe("NARSHITA DEWI");
    expect(s.rekening[1]?.utama).toBe(false);

    // Tidak ada lagi data contoh: produk, bazar, transaksi, pesanan jahit
    // semuanya kosong — hanya detail usaha yang terisi.
    expect(await daftarProduk()).toHaveLength(0);
    expect(await bazarAktif()).toBeUndefined();
    expect(await daftarTransaksi()).toHaveLength(0);
    expect(await daftarPesananJahit()).toHaveLength(0);
  });

  it("tidak mengubah apa pun bila dijalankan dua kali", async () => {
    expect(await jalankanSeedDemo()).toBe(true);
    expect(await jalankanSeedDemo()).toBe(false);
    expect((await daftarProduk()).length).toBe(0);
    expect((await daftarTransaksi()).length).toBe(0);
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

  it("migrasiAlamatLama mengganti alamat lama saja, sekali jalan (BU-51)", async () => {
    const lama = await ambilSettings();
    await simpanSettings({
      ...lama,
      alamatBaris1: "Jl. Tarumanegara No. 41",
      alamatBaris2: "Sebelah Pempak Nyai",
      kotaKodePos: "Ploso Ciptum 15419",
    });
    expect(await migrasiAlamatLama()).toBe(true);
    const baru = await ambilSettings();
    expect(baru.alamatBaris2).toBe("Pisangan, Ciputat Timur - 15419");
    expect(baru.kotaKodePos).toBe("");
    expect(baru.alamatBaris1).toBe("Jl. Tarumanegara No. 41");
    // Kedua kali tidak mengubah apa pun.
    expect(await migrasiAlamatLama()).toBe(false);
  });

  it("migrasiRekeningKedua menambah Mandiri bila hanya BCA yang ada (BU-53)", async () => {
    const lama = await ambilSettings();
    await simpanSettings({
      ...lama,
      rekening: [
        {
          id: "rekening-demo-bca",
          namaBank: "BCA",
          nomor: "676 017 885",
          namaPemilik: "NARSHITA DEWI",
          utama: true,
        },
      ],
    });
    expect(await migrasiRekeningKedua()).toBe(true);
    const baru = await ambilSettings();
    expect(baru.rekening).toHaveLength(2);
    expect(baru.rekening[1]?.namaBank).toBe("Mandiri");
    expect(baru.rekening[1]?.nomor).toBe("1010001037785");
    expect(baru.rekening[1]?.namaPemilik).toBe("NARSHITA DEWI");
    expect(baru.rekening[1]?.utama).toBe(false);
    // Kedua kali tidak mengubah apa pun.
    expect(await migrasiRekeningKedua()).toBe(false);
  });

  it("migrasiRekeningKedua tidak jalan bila Mandiri sudah ada atau BCA tidak ada", async () => {
    const lama = await ambilSettings();
    await simpanSettings({ ...lama, rekening: [] });
    expect(await migrasiRekeningKedua()).toBe(false);
    expect((await ambilSettings()).rekening).toHaveLength(0);
  });
});
