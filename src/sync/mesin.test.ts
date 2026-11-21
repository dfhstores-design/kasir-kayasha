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

  it("F5: status yang ditahan hub dicatat di log sinkron (owner bisa melihat)", async () => {
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

    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({ ok: true, diterima: ["tx-1"], ditolak: [], statusDitahan: ["tx-1"] }),
    });

    // Kiriman tetap dianggap terkirim (antrean bersih), hanya statusnya ditahan.
    expect(r.status).toBe("siap");
    expect(await jumlahAntrean()).toBe(0);
    const log = await db.getAll("logSinkron");
    expect(log).toHaveLength(1);
    expect(log[0]?.jenis).toBe("konflik");
    expect(log[0]?.judul).toContain("KC.00001-20261110");
    expect(log[0]?.judul).toContain("ditahan");
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

describe("biaya bazar masuk antrean sync (F1, BU-34)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  async function bazarDenganBiaya() {
    const { buatBazar, tambahBiaya } = await import("../db/repositori.ts");
    const bz = await buatBazar("Pameran", "2026-11-10", null);
    const hasil = await tambahBiaya(bz.id, {
      kategori: "sewa_booth",
      judul: "Sewa booth",
      nominal: 750000,
      tanggal: "2026-11-10",
      catatan: null,
    });
    if (!hasil.ok) throw new Error("tambahBiaya gagal");
    return { bz, biaya: hasil.biaya };
  }

  it("tambahBiaya menandai biaya untuk sync", async () => {
    const { biaya } = await bazarDenganBiaya();
    expect(await jumlahAntrean()).toBe(2); // bazar baru + biaya
    const antrean = await daftarAntrean();
    const baris = antrean.find((a) => a.jenis === "Biaya bazar");
    expect(baris?.judul).toContain("Sewa booth");
    expect(baris?.judul).toContain("750.000");
    expect(biaya.id).toBeTruthy();
  });

  it("hapus menggantikan upsert yang masih antre (satu baris, aksi hapus)", async () => {
    const { hapusBiaya } = await import("../db/repositori.ts");
    const { biaya } = await bazarDenganBiaya();
    await hapusBiaya(biaya.id);
    const db = await getDB();
    const outbox = await db.getAll("outbox");
    const baris = outbox.filter((o) => o.idRecord === biaya.id);
    expect(baris).toHaveLength(1);
    expect(baris[0]?.aksi).toBe("hapus");
  });

  it("kirimAntrean mengirim kiriman biaya_bazar, bukan mengabaikannya", async () => {
    const { biaya } = await bazarDenganBiaya();
    let terkirim: Array<Record<string, unknown>> = [];
    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        terkirim = JSON.parse(String(init?.body ?? "{}")).kiriman as Array<Record<string, unknown>>;
        const diterima = terkirim.map((k) => String(k.id));
        return new Response(JSON.stringify({ ok: true, diterima }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    expect(r.status).toBe("siap");
    const kirimanBiaya = terkirim.find((k) => k.jenis === "biaya_bazar");
    expect(kirimanBiaya?.id).toBe(biaya.id);
    expect(kirimanBiaya?.judul).toBe("Sewa booth");
    expect(kirimanBiaya?.nominal).toBe(750000);
    expect(await jumlahAntrean()).toBe(0);
  });

  it("kirimAntrean mengirim tombstone untuk biaya yang dihapus", async () => {
    const { hapusBiaya } = await import("../db/repositori.ts");
    const { biaya } = await bazarDenganBiaya();
    await hapusBiaya(biaya.id);
    let terkirim: Array<Record<string, unknown>> = [];
    await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        terkirim = JSON.parse(String(init?.body ?? "{}")).kiriman as Array<Record<string, unknown>>;
        const diterima = terkirim.map((k) => String(k.id));
        return new Response(JSON.stringify({ ok: true, diterima }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    const tombstone = terkirim.find((k) => k.jenis === "biaya_bazar" && k.id === biaya.id);
    expect(tombstone?.dihapus).toBe(true);
  });
});

describe("PIN tersinkron antar perangkat (F3, BU-32/33)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  const HASH = "sha256$saltA$digestA";

  it("simpanPin menulis hash + waktu ubah + menandai antrean sync", async () => {
    const { simpanPin } = await import("./mesin.ts");
    await simpanPin("admin", HASH);
    const db = await getDB();
    const s = await db.get("settings", "utama");
    expect(s?.pinHash).toBe(HASH);
    expect(s?.pinDiubahPada?.admin).toBeTruthy();
    const outbox = await db.getAll("outbox");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.jenisRecord).toBe("pin");
    expect(outbox[0]?.idRecord).toBe("pin:admin");
  });

  it("kirimAntrean mengirim hash PIN — tidak pernah PIN teks biasa", async () => {
    const { simpanPin } = await import("./mesin.ts");
    await simpanPin("owner", HASH);
    let terkirim: Array<Record<string, unknown>> = [];
    const r = await kirimAntrean({
      url: "https://contoh/api/sync",
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        terkirim = JSON.parse(String(init?.body ?? "{}")).kiriman as Array<Record<string, unknown>>;
        const diterima = terkirim.map((k) => String(k.id));
        return new Response(JSON.stringify({ ok: true, diterima }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    expect(r.status).toBe("siap");
    const kirimanPin = terkirim.find((k) => k.jenis === "pin");
    expect(kirimanPin?.id).toBe("pin:owner");
    expect(kirimanPin?.hash).toBe(HASH);
    // Tidak ada kolom yang bisa berisi PIN teks biasa.
    expect("pin" in (kirimanPin ?? {})).toBe(false);
    expect("pinTeks" in (kirimanPin ?? {})).toBe(false);
    expect(await jumlahAntrean()).toBe(0);
  });

  it("tarikPerubahan menerapkan PIN dari perangkat lain", async () => {
    const hasil = await tarikPerubahan({
      url: "https://contoh/api/sync",
      fetchImpl: jawab({
        ok: true,
        sekarang: "2026-11-21T12:00:00.000Z",
        transaksi: [],
        produk: [],
        bazar: [],
        biayaBazar: [],
        pin: [
          {
            jenis: "pin",
            id: "pin:admin",
            peran: "admin",
            hash: HASH,
            diubahPada: "2026-11-21T10:00:00.000Z",
            perangkat: "hp-a",
          },
        ],
      }),
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.ditarik?.pinDigabung).toBe(1);
    const db = await getDB();
    const s = await db.get("settings", "utama");
    expect(s?.pinHash).toBe(HASH);
  });

  it("daftarAntrean menampilkan PIN tanpa pernah menampilkan hash-nya", async () => {
    const { simpanPin } = await import("./mesin.ts");
    await simpanPin("kasir_toko", HASH);
    const antrean = await daftarAntrean();
    expect(antrean).toHaveLength(1);
    expect(antrean[0]?.jenis).toBe("PIN");
    expect(antrean[0]?.judul).toBe("PIN kasir toko");
    expect(JSON.stringify(antrean)).not.toContain(HASH);
  });
});

describe("perbaikiNomorSementara — nomor offline diganti nomor hub (F4, BU-19/21)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
  });

  it("pesanan offline mendapat nomor resmi dari hub saat online lagi", async () => {
    const { simpanPesananJahit } = await import("../lib/jahitan.ts");
    const { perbaikiNomorSementara } = await import("./mesin.ts");
    const hasil = await simpanPesananJahit(
      {
        namaPemesan: "Ibu Sari",
        kontak: "0812 0000 0000",
        items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: "M" }],
        perkiraanSelesai: "2026-11-23",
        catatan: null,
        biayaLain: [],
      },
      { rekening: [], waktu: new Date("2026-11-21T09:00:00.000Z") },
    );
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    const db = await getDB();
    const sebelum = await db.get("transactions", hasil.pesanan.id);
    expect(sebelum?.nomorUrutSementara).toBe(true); // offline: nomor lokal sementara

    const diperbaiki = await perbaikiNomorSementara({
      urlSync: "https://contoh/api/sync",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ ok: true, bulan: "2026-11", nomor: 5 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    });
    expect(diperbaiki).toBe(1);
    const sesudah = await db.get("transactions", hasil.pesanan.id);
    expect(sesudah?.nomorUrutBulan).toBe(5);
    expect(sesudah?.nomorResi).toBe("KC.00005-20261121");
    expect(sesudah?.nomorUrutSementara).toBe(false);
    // Nomor yang sudah diperbaiki ikut dikirim ke hub.
    const outbox = await db.getAll("outbox");
    expect(outbox.some((o) => o.idRecord === hasil.pesanan.id)).toBe(true);
  });

  it("hub tidak menjawab → nomor sementara tetap, tidak ada yang rusak", async () => {
    const { simpanPesananJahit } = await import("../lib/jahitan.ts");
    const { perbaikiNomorSementara } = await import("./mesin.ts");
    const hasil = await simpanPesananJahit(
      {
        namaPemesan: "Ibu Sari",
        kontak: "0812 0000 0000",
        items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: "M" }],
        perkiraanSelesai: "2026-11-23",
        catatan: null,
        biayaLain: [],
      },
      { rekening: [], waktu: new Date("2026-11-21T09:00:00.000Z") },
    );
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    const diperbaiki = await perbaikiNomorSementara({
      urlSync: "https://contoh/api/sync",
      fetchImpl: (async () => {
        throw new Error("jaringan mati");
      }) as unknown as typeof fetch,
    });
    expect(diperbaiki).toBe(0);
    const db = await getDB();
    const tetap = await db.get("transactions", hasil.pesanan.id);
    expect(tetap?.nomorUrutSementara).toBe(true);
  });
});
