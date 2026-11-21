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
  bacaTerakhirTarik,
  daftarAntrean,
  jedaCobaLagi,
  jumlahAntrean,
  kirimAntrean,
  perangkatId,
  sinkronkan,
  tandaiUntukSync,
  tarikPerubahan,
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
    await simpanSettings({ ...SETTINGS_KOSONG, namaButik: "Kayesa" });
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
      // Hapus dulu properti milik instance (yang dipasang tes ini), baru
      // pulihkan getter prototipe — kalau tidak, navigator.onLine tetap
      // false dan mencemari tes lain di berkas ini.
      delete (navigator as unknown as Record<string, unknown>).onLine;
      if (asli) Object.defineProperty(Navigator.prototype, "onLine", asli);
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

describe("tarikPerubahan — tarik dari hub (Fase 2B)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  const paket = (transaksi: unknown[] = []) => ({
    ok: true,
    sekarang: "2026-11-10T12:00:00.000Z",
    transaksi,
    produk: [],
    bazar: [],
  });

  const kirimanJauh = {
    jenis: "transaksi",
    id: "22222222-2222-2222-2222-222222222222",
    nomorResi: "KYS-0002",
    waktu: "2026-11-10T08:00:00.000Z",
    jenisDokumen: "jasa",
    arahStok: "tidak_ada",
    pelangganId: null,
    statusPesanan: "diproses",
    statusBayar: "belum_dibayar",
    bazarId: null,
    namaPemesan: "Sari",
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: 850000,
    diskonItem: 0,
    diskonTotal: 0,
    total: 850000,
    dibatalkanPada: null,
    dibuatPada: "2026-11-10T08:00:00.000Z",
    diubahPada: "2026-11-10T09:00:00.000Z",
    items: [
      { id: "item-jauh-1", produkId: null, namaSnapshot: "Kebaya brokat", hargaSatuan: 850000, kuantitas: 1, diskonPerUnit: 0, subtotalBersih: 850000 },
    ],
    pembayaran: [],
  };

  it("transaksi dari perangkat lain masuk ke lokal + kursor tersimpan", async () => {
    const r = await tarikPerubahan({
      url: "https://contoh/api/sync",
      fetchImpl: jawab(paket([kirimanJauh])),
    });
    expect(r.ok).toBe(true);
    expect(r.ditarik?.transaksiBaru).toBe(1);
    const db = await getDB();
    const t = await db.get("transactions", "22222222-2222-2222-2222-222222222222");
    expect(t?.namaPemesan).toBe("Sari");
    expect(t?.terakhirSyncPada).toBe("2026-11-10T12:00:00.000Z");
    expect(await bacaTerakhirTarik()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("tanpa URL sync → tidak tarik, tidak error", async () => {
    const r = await tarikPerubahan({});
    expect(r.ok).toBe(false);
    expect(r.ditarik).toBeNull();
  });

  it("jawaban server yang rusak dilaporkan, bukan dilempar", async () => {
    const r = await tarikPerubahan({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({ ok: true, transaksi: "bukan-array" }),
    });
    expect(r.ok).toBe(false);
    expect(r.pesan).toContain("tidak bisa dibaca");
  });

  it("perangkatId stabil di semua panggilan", async () => {
    const a = await perangkatId();
    const b = await perangkatId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});

describe("sinkronkan — kirim lalu tarik (Fase 2B)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  it("kirim antrean lalu tarik perubahan dalam satu putaran", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);
    const fetchGabung = (async (_u: string, init?: RequestInit) => {
      if (init?.method === "GET") {
        return new Response(JSON.stringify({ ok: true, sekarang: "2026-11-10T12:00:00.000Z", transaksi: [], produk: [], bazar: [] }));
      }
      return new Response(JSON.stringify({ ok: true, diterima: [p.id] }));
    }) as unknown as typeof fetch;

    const r = await sinkronkan({ url: "https://contoh/api/sync", fetchImpl: fetchGabung });
    expect(r.antrean).toBe(0);
    expect(r.status).toBe("siap");
    expect(r.terakhirTarik).toBe("2026-11-10T12:00:00.000Z");
  });

  it("tanpa URL → status mati, antrean tetap", async () => {
    const p = await produk("Kebaya");
    await tandaiUntukSync("produk", p.id);
    const r = await sinkronkan({});
    expect(r.status).toBe("mati");
    expect(r.antrean).toBe(1);
  });
});

describe("daftarAntrean — daftar belum terkirim (Fase 2B)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  it("baris outbox tampil dengan nomor resi & nama pemesan", async () => {
    const db = await getDB();
    await db.put("transactions", {
      id: "tx-1",
      nomorResi: "KC.00001-20261110",
      nomorUrutHari: 1,
      waktu: "2026-11-10T08:00:00.000Z",
      jenis: "po",
      jenisDokumen: "jasa",
      arahStok: "tidak_ada",
      pelangganId: null,
      statusPesanan: "diproses",
      bazarId: null,
      namaPemesan: "Sari",
      kontak: null,
      perkiraanSiap: null,
      alamat: null,
      catatanPesanan: null,
      riwayatTotal: [],
      ongkirMode: "ambil_sendiri",
      ongkirNominal: 0,
      subtotalAwal: 850000,
      diskonItem: 0,
      diskonTotal: 0,
      total: 850000,
      sapaan: "Pagi",
      rekeningSnapshot: [],
      jenisBayar: null,
      statusBayar: "belum_dibayar",
      dibatalkanPada: null,
      createdAt: "2026-11-10T08:00:00.000Z",
      updatedAt: "2026-11-10T08:00:00.000Z",
    });
    await tandaiUntukSync("transaksi", "tx-1");
    const daftar = await daftarAntrean();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]?.judul).toContain("KC.00001-20261110");
    expect(daftar[0]?.judul).toContain("Sari");
  });
});
