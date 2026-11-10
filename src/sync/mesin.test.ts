/**
 * Tes mesin sinkronisasi di perangkat (Phase 6).
 *
 * Yang dikunci:
 *  1. TANPA INTERNET penjualan tetap jalan; outbox hanya menumpuk diam-diam.
 *  2. Antrean hanya dihapus setelah server menjawab "diterima".
 *  3. Gagal jaringan TIDAK melempar error ke pemanggil.
 *  4. Satu record = satu baris outbox (tidak menumpuk).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetKoneksiDB, getDB } from "../db/schema.ts";
import {
  jedaCobaLagi,
  jumlahAntrean,
  kirimAntrean,
  tandaiUntukSync,
} from "./mesin.ts";
import { simpanProduk, simpanSettings, SETTINGS_KOSONG } from "../db/repositori.ts";

async function produk(nama: string) {
  const now = new Date().toISOString();
  const p = {
    id: crypto.randomUUID(),
    nama,
    kode: null,
    hargaJual: 150000,
    stokGudang: 4,
    catatan: null,
    arsip: false,
    createdAt: now,
    updatedAt: now,
  };
  await simpanProduk(p);
  return p;
}

const jawab = (isi: unknown, ok = true): typeof fetch =>
  (async () =>
    new Response(JSON.stringify(isi), {
      status: ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

describe("tandaiUntukSync", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  it("menambah satu baris antrean", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);
    expect(await jumlahAntrean()).toBe(1);
  });

  it("menandai record yang sama dua kali tidak menumpuk", async () => {
    const p = await produk("Rok");
    await tandaiUntukSync("produk", p.id);
    await tandaiUntukSync("produk", p.id);
    expect(await jumlahAntrean()).toBe(1);
  });
});

describe("kirimAntrean", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  it("tanpa alamat endpoint → sinkronisasi mati, aplikasi tetap jalan", async () => {
    const p = await produk("Blus");
    await tandaiUntukSync("produk", p.id);
    const r = await kirimAntrean({});
    expect(r.status).toBe("mati");
    expect(await jumlahAntrean()).toBe(1); // data tetap di HP
  });

  it("antrean kosong → siap tanpa memanggil jaringan", async () => {
    let dipanggil = false;
    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: (async () => {
        dipanggil = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });
    expect(r.status).toBe("siap");
    expect(dipanggil).toBe(false);
  });

  it("berhasil → antrean dikosongkan", async () => {
    const p = await produk("Gamis");
    await tandaiUntukSync("produk", p.id);

    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({ ok: true, diterima: [p.id], ditolak: [] }),
    });

    expect(r.status).toBe("siap");
    expect(r.antrean).toBe(0);
    expect(await jumlahAntrean()).toBe(0);
    expect(r.terakhirBerhasil).not.toBeNull();
  });

  it("hanya yang diakui diterima yang dihapus dari antrean", async () => {
    const a = await produk("A");
    const b = await produk("B");
    await tandaiUntukSync("produk", a.id);
    await tandaiUntukSync("produk", b.id);

    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({ ok: true, diterima: [a.id], ditolak: [] }),
    });

    expect(r.status).toBe("menunggu");
    expect(await jumlahAntrean()).toBe(1);
  });

  it("gagal jaringan TIDAK melempar error & antrean tetap", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);

    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });

    expect(r.status).toBe("gagal");
    expect(r.pesan).toContain("tetap aman di HP");
    expect(await jumlahAntrean()).toBe(1);
  });

  it("server menolak (500) → antrean tetap & percobaan bertambah", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);

    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({ ok: false }, false),
    });

    expect(r.status).toBe("gagal");
    const db = await getDB();
    const outbox = await db.getAll("outbox");
    expect(outbox[0]?.percobaan).toBe(1);
    expect(outbox[0]?.terakhirDicoba).not.toBeNull();
  });

  it("mengirim header token bila disediakan", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);
    let header: string | null = null;

    await kirimAntrean({
      url: "https://contoh/api/sync",
      token: "rahasia",
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        header = new Headers(init?.headers).get("x-sync-token");
        return new Response(JSON.stringify({ ok: true, diterima: [p.id] }));
      }) as unknown as typeof fetch,
    });

    expect(header).toBe("rahasia");
  });

  it("settings tidak dikirim dan antrean dibersihkan", async () => {
    await simpanSettings({ ...SETTINGS_KOSONG, namaButik: "Kayesha" });
    await tandaiUntukSync("settings", "utama");

    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({ ok: true, diterima: [] }),
    });

    expect(r.antrean).toBe(0);
  });

  it("navigator offline → menunggu, tidak memanggil jaringan", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);
    const asli = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    try {
      let dipanggil = false;
      const r = await kirimAntrean({
        url: "https://contoh/api/sync",
        fetchImpl: (async () => {
          dipanggil = true;
          return new Response("{}");
        }) as unknown as typeof fetch,
      });
      expect(r.status).toBe("menunggu");
      expect(dipanggil).toBe(false);
    } finally {
      if (asli) Object.defineProperty(Navigator.prototype, "onLine", asli);
      else delete (navigator as unknown as Record<string, unknown>).onLine;
    }
  });
});

describe("jedaCobaLagi", () => {
  it("meningkat lalu dibatasi 2 menit", () => {
    expect(jedaCobaLagi(0)).toBe(5000);
    expect(jedaCobaLagi(1)).toBe(15000);
    expect(jedaCobaLagi(2)).toBe(45000);
    expect(jedaCobaLagi(10)).toBe(120000);
  });
});
