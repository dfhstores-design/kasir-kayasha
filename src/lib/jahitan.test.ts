import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { getDB, resetKoneksiDB, type Rekening } from "../db/schema.ts";
import { terimaPembayaranKasir } from "../db/kasirOperasi.ts";
import {
  ambilPesananJahit,
  bacaBiayaLainTersimpan,
  biayaLainDariTransaksi,
  catatPengiriman,
  daftarPesananJahit,
  daftarPerluDitagih,
  labelStatusJahitan,
  periksaRencanaJahitan,
  simpanBiayaLainTersimpan,
  simpanPesananJahit,
  statusJahitan,
  ubahPesananJahit,
  uraiCatatanLama,
  type RencanaJahitan,
} from "./jahitan.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
  try {
    localStorage.clear();
  } catch {
    // lingkungan tanpa localStorage: abaikan
  }
}

const rekening: Rekening = {
  id: "rek-1",
  namaBank: "BCA",
  nomor: "676 017 885",
  namaPemilik: "NARSHITA DEWI",
  utama: true,
};

function rencana(over: Partial<RencanaJahitan> = {}): RencanaJahitan {
  return {
    namaPemesan: "Ibu Sari",
    kontak: "0812 0000 0000",
    items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: "M" }],
    perkiraanSelesai: "2026-11-23",
    catatan: null,
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    ...over,
  };
}

describe("periksaRencanaJahitan", () => {
  it("menolak nama pemesan kosong", () => {
    expect(periksaRencanaJahitan(rencana({ namaPemesan: " " })).ok).toBe(false);
  });

  it("menolak tanpa item", () => {
    expect(periksaRencanaJahitan(rencana({ items: [] })).ok).toBe(false);
  });

  it("menolak item tanpa nama", () => {
    expect(periksaRencanaJahitan(rencana({ items: [{ nama: " ", harga: 100000, kuantitas: 1, ukuran: null }] })).ok).toBe(false);
  });

  it("menolak harga item <= 0", () => {
    expect(periksaRencanaJahitan(rencana({ items: [{ nama: "Gaun", harga: 0, kuantitas: 1, ukuran: null }] })).ok).toBe(false);
    expect(periksaRencanaJahitan(rencana({ items: [{ nama: "Gaun", harga: -1, kuantitas: 1, ukuran: null }] })).ok).toBe(false);
  });

  it("menghitung total = item + biayaLain", () => {
    const h = periksaRencanaJahitan(rencana());
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.total).toBe(350000);
  });

  it("menghitung total banyak item (BU-55)", () => {
    const h = periksaRencanaJahitan(
      rencana({
        items: [
          { nama: "Gaun Panjang", harga: 2500000, kuantitas: 1, ukuran: "L" },
          { nama: "Dres tunik", harga: 2500000, kuantitas: 2, ukuran: null },
        ],
        biayaLain: [],
      }),
    );
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.total).toBe(7500000);
  });

  it("menolak biaya lain negatif", () => {
    const h = periksaRencanaJahitan(rencana({ biayaLain: [{ nama: "X", nominal: -100 }] }));
    expect(h.ok).toBe(false);
  });
});

describe("statusJahitan", () => {
  it("lunas / terbuka / batal (BU-20)", () => {
    expect(statusJahitan({ statusBayar: "lunas", dibatalkanPada: null, statusPesanan: "diproses" })).toBe("lunas");
    expect(statusJahitan({ statusBayar: "belum_dibayar", dibatalkanPada: null, statusPesanan: "diproses" })).toBe("terbuka");
    expect(statusJahitan({ statusBayar: "lunas", dibatalkanPada: "2026-11-16", statusPesanan: "dibatalkan" })).toBe("batal");
  });

  it("label bahasa Indonesia", () => {
    expect(labelStatusJahitan("lunas")).toBe("Lunas");
    expect(labelStatusJahitan("terbuka")).toBe("Belum lunas");
    expect(labelStatusJahitan("batal")).toBe("Batal");
  });
});

describe("biaya lain tersimpan (BU-15)", () => {
  beforeEach(resetDB);

  it("menyimpan & membaca nama biaya lain", () => {
    simpanBiayaLainTersimpan("Bahan payet", 50000);
    simpanBiayaLainTersimpan("Kancing", 10000);
    const b = bacaBiayaLainTersimpan();
    expect(b.map((x) => x.nama)).toEqual(["Kancing", "Bahan payet"]);
  });

  it("nama duplikat tidak menggandakan", () => {
    simpanBiayaLainTersimpan("Kancing", 10000);
    simpanBiayaLainTersimpan("Kancing", 20000);
    expect(bacaBiayaLainTersimpan()).toHaveLength(1);
  });
});

describe("simpanPesananJahit (BU-28: pelanggan otomatis)", () => {
  beforeEach(resetDB);

  it("menyimpan dokumen jasa + pelanggan otomatis", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;

    const daftar = await daftarPesananJahit();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]?.namaPemesan).toBe("Ibu Sari");
    expect(daftar[0]?.status).toBe("terbuka");
    expect(daftar[0]?.sisa).toBe(350000);
    expect(daftar[0]?.nomor).toBe("KC.00001-20261116");
    expect(h.pesanan.pelangganId).toBeTruthy();
  });

  it("nomor urut bulanan 5 digit, reset tiap bulan (BU-19/21)", async () => {
    const w1 = new Date("2026-11-16T07:20:00.000Z");
    const w2 = new Date("2026-12-01T07:20:00.000Z");
    const a = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: w1 });
    const b = await simpanPesananJahit(rencana({ namaPemesan: "Ibu Dewi" }), { rekening: [rekening], waktu: w1 });
    const c = await simpanPesananJahit(rencana({ namaPemesan: "Ibu Ani" }), { rekening: [rekening], waktu: w2 });
    expect(a.ok && a.pesanan.nomor).toBe("KC.00001-20261116");
    expect(b.ok && b.pesanan.nomor).toBe("KC.00002-20261116");
    expect(c.ok && c.pesanan.nomor).toBe("KC.00001-20261201");
  });

  it("menyimpan banyak item sebagai baris transaction_items (BU-55)", async () => {
    const h = await simpanPesananJahit(
      rencana({
        items: [
          { nama: "Gaun Panjang", harga: 2500000, kuantitas: 1, ukuran: "L" },
          { nama: "Dres tunik", harga: 2500000, kuantitas: 2, ukuran: null },
        ],
        biayaLain: [],
      }),
      { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") },
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.pesanan.total).toBe(7500000);
    expect(h.pesanan.items).toHaveLength(2);
  });

  it("menolak rencana tidak valid (tanpa menulis)", async () => {
    const h = await simpanPesananJahit(rencana({ namaPemesan: " " }), { rekening: [rekening] });
    expect(h.ok).toBe(false);
    expect(await daftarPesananJahit()).toHaveLength(0);
  });
});

describe("daftarPerluDitagih & catatPengiriman", () => {
  beforeEach(resetDB);

  it("perlu ditagih hanya yang perkiraan selesai lewat & belum lunas", async () => {
    await simpanPesananJahit(rencana({ perkiraanSelesai: "2020-01-01" }), { rekening: [rekening] });
    await simpanPesananJahit(
      rencana({
        items: [{ nama: "Kebaya", harga: 300000, kuantitas: 1, ukuran: null }],
        perkiraanSelesai: "2099-01-01",
      }),
      { rekening: [rekening] },
    );
    const t = await daftarPerluDitagih(new Date("2026-11-16T00:00:00.000Z"));
    expect(t).toHaveLength(1);
    expect(t[0]?.model).toBe("Gaun pesta");
  });

  it("catatPengiriman menandai sudah dikirim", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    if (!h.ok) return;
    await catatPengiriman(h.pesanan.id, h.pesanan.pelangganId, "invoice", "whatsapp");
    const daftar = await daftarPesananJahit();
    expect(daftar[0]?.sudahDikirim).toBe(true);
  });
});

describe("biayaLainDariTransaksi", () => {
  it("mengurai nama + nominal dari catatanPesanan", () => {
    const r = biayaLainDariTransaksi({ catatanPesanan: "Gaun pesta · M · Bahan payet:50000|Kancing:10000" });
    expect(r).toEqual([
      { nama: "Bahan payet", nominal: 50000 },
      { nama: "Kancing", nominal: 10000 },
    ]);
  });
});

describe("ukuran/catatan khusus per item (BU-56)", () => {
  beforeEach(resetDB);

  it("simpan menyimpan ukuran per item, catatan tidak lagi memuat ukuran", async () => {
    const h = await simpanPesananJahit(
      rencana({
        items: [
          { nama: "Kebaya brokat", harga: 850000, kuantitas: 1, ukuran: "M" },
          { nama: "Gaun pesta", harga: 500000, kuantitas: 1, ukuran: "bahu lebar" },
        ],
        biayaLain: [],
      }),
      { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") },
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const lengkap = await ambilPesananJahit(h.pesanan.id);
    expect(lengkap?.items.map((i) => i.ukuran)).toEqual(["M", "bahu lebar"]);
    expect(lengkap?.transaksi.catatanPesanan).toBe("Kebaya brokat");
  });
});

describe("uraiCatatanLama (BU-56)", () => {
  it("format lama: ukuran di [1], biaya lain, lalu catatan bebas", () => {
    const r = uraiCatatanLama("Kebaya brokat · M · Payet:125000 · tolong cepat", { ukuranDiCatatan: true });
    expect(r).toEqual({ ukuranLama: "M", catatanBebas: "tolong cepat" });
  });

  it("format baru: segmen [1] tanpa ':' adalah catatan bebas, bukan ukuran", () => {
    const r = uraiCatatanLama("Gaun pesta · tolong cepat", { ukuranDiCatatan: false });
    expect(r).toEqual({ ukuranLama: null, catatanBebas: "tolong cepat" });
  });

  it("tanpa catatan -> keduanya null", () => {
    expect(uraiCatatanLama(null, { ukuranDiCatatan: true })).toEqual({ ukuranLama: null, catatanBebas: null });
    expect(uraiCatatanLama("Gaun pesta", { ukuranDiCatatan: true })).toEqual({ ukuranLama: null, catatanBebas: null });
  });
});

describe("ambilPesananJahit - pesanan lama (BU-56)", () => {
  beforeEach(resetDB);

  it("ukuran lama di catatan pindah ke item pertama, catatan bebas tetap terbaca", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    // Ubah data tersimpan menjadi format lama: ukuran di catatan, tanpa ukuran di baris.
    const db = await getDB();
    const t = await db.get("transactions", h.pesanan.id);
    if (!t) return;
    db.put("transactions", { ...t, catatanPesanan: "Gaun pesta · M · Bahan payet:50000 · tolong cepat" });
    const baris = await db.getAllFromIndex("transaction_items", "by-transaksi", h.pesanan.id);
    for (const b of baris) {
      const tanpaUkuran = { ...b };
      delete tanpaUkuran.ukuran;
      db.put("transaction_items", tanpaUkuran);
    }

    const lengkap = await ambilPesananJahit(h.pesanan.id);
    expect(lengkap?.items[0]?.ukuran).toBe("M");
    expect(lengkap?.catatan).toBe("tolong cepat");
    expect(lengkap?.biayaLain).toEqual([{ nama: "Bahan payet", nominal: 50000 }]);
  });
});

describe("ubahPesananJahit (BU-56)", () => {
  beforeEach(resetDB);

  it("mengubah nama, item, ukuran, dan total; nomor KC tetap", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const u = await ubahPesananJahit(
      h.pesanan.id,
      rencana({
        namaPemesan: "Ibu Dewi",
        items: [{ nama: "Kebaya brokat", harga: 850000, kuantitas: 1, ukuran: "L" }],
        biayaLain: [],
      }),
    );
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(u.pesanan.nomor).toBe("KC.00001-20261116");
    expect(u.pesanan.namaPemesan).toBe("Ibu Dewi");
    expect(u.pesanan.total).toBe(850000);
    const lengkap = await ambilPesananJahit(h.pesanan.id);
    expect(lengkap?.items).toEqual([{ nama: "Kebaya brokat", harga: 850000, kuantitas: 1, ukuran: "L" }]);
    expect(lengkap?.transaksi.namaPemesan).toBe("Ibu Dewi");
    expect(await daftarPesananJahit()).toHaveLength(1);
  });

  it("pembayaran yang sudah masuk tidak berubah; sisa dihitung ulang", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const dp = await terimaPembayaranKasir(h.pesanan.id, 150000, "tunai");
    expect(dp.ok).toBe(true);
    const u = await ubahPesananJahit(
      h.pesanan.id,
      rencana({ items: [{ nama: "Gaun pesta", harga: 400000, kuantitas: 1, ukuran: "M" }], biayaLain: [] }),
    );
    expect(u.ok).toBe(true);
    const lengkap = await ambilPesananJahit(h.pesanan.id);
    expect(lengkap?.terbayar).toBe(150000);
    expect(lengkap?.sisa).toBe(250000);
  });

  it("menolak total baru di bawah yang sudah terbayar", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const dp = await terimaPembayaranKasir(h.pesanan.id, 300000, "tunai");
    expect(dp.ok).toBe(true);
    const u = await ubahPesananJahit(
      h.pesanan.id,
      rencana({ items: [{ nama: "Gaun pesta", harga: 200000, kuantitas: 1, ukuran: "M" }], biayaLain: [] }),
    );
    expect(u.ok).toBe(false);
    const lengkap = await ambilPesananJahit(h.pesanan.id);
    expect(lengkap?.transaksi.total).toBe(350000);
  });

  it("menolak id yang tidak ada", async () => {
    const u = await ubahPesananJahit("tidak-ada", rencana());
    expect(u.ok).toBe(false);
  });
});
describe("simpanPesananJahit — nomor urut dari hub (F4, BU-19/21)", () => {
  beforeEach(resetDB);

  const jawabNomor = (nomor: number): typeof fetch =>
    (async () =>
      new Response(JSON.stringify({ ok: true, bulan: "2026-11", nomor }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

  it("online: memakai nomor dari hub, bukan hitungan lokal", async () => {
    const h = await simpanPesananJahit(rencana(), {
      rekening: [rekening],
      waktu: new Date("2026-11-16T07:20:00.000Z"),
      urlSync: "https://contoh/api/sync",
      fetchImpl: jawabNomor(7),
    });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.pesanan.nomor).toBe("KC.00007-20261116");
    const db = await getDB();
    const t = await db.get("transactions", h.pesanan.id);
    expect(t?.nomorUrutBulan).toBe(7);
    expect(t?.nomorUrutSementara).toBeUndefined();
  });

  it("offline (hub tidak menjawab): nomor lokal sementara + ditandai", async () => {
    const h = await simpanPesananJahit(rencana(), {
      rekening: [rekening],
      waktu: new Date("2026-11-16T07:20:00.000Z"),
      urlSync: "https://contoh/api/sync",
      fetchImpl: (async () => {
        throw new Error("jaringan mati");
      }) as unknown as typeof fetch,
    });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    // Penjualan tetap jalan dengan nomor lokal — tidak menunggu hub.
    expect(h.pesanan.nomor).toBe("KC.00001-20261116");
    const db = await getDB();
    const t = await db.get("transactions", h.pesanan.id);
    expect(t?.nomorUrutBulan).toBe(1);
    expect(t?.nomorUrutSementara).toBe(true);
  });

  it("tanpa URL sync: nomor lokal sementara seperti dulu", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.pesanan.nomor).toBe("KC.00001-20261116");
    const db = await getDB();
    const t = await db.get("transactions", h.pesanan.id);
    expect(t?.nomorUrutSementara).toBe(true);
  });
});

describe("anti-dobel re-entry kertas pesanan jahit (Fase 2C, BU-34)", () => {
  beforeEach(resetDB);

  it("kunciItemJahitan: urutan tidak penting, nama/harga/jumlah penting", async () => {
    const { kunciItemJahitan } = await import("./jahitan.ts");
    const a = { nama: "Gaun", harga: 300000, kuantitas: 1, ukuran: null };
    const b = { nama: "Kebaya", harga: 200000, kuantitas: 2, ukuran: "M" };
    expect(kunciItemJahitan([a, b])).toBe(kunciItemJahitan([b, a]));
    expect(kunciItemJahitan([a])).not.toBe(kunciItemJahitan([{ ...a, harga: 310000 }]));
    expect(kunciItemJahitan([a])).not.toBe(kunciItemJahitan([{ ...a, kuantitas: 2 }]));
    // Ukuran/catatan khusus tidak masuk kunci.
    expect(kunciItemJahitan([a])).toBe(kunciItemJahitan([{ ...a, ukuran: "L" }]));
  });

  it("pesanan kertas yang sama persis (pemesan sama) ditolak sebagai duplikat", async () => {
    const kemarin = new Date(Date.now() - 86400000);
    const r = rencana();
    const pertama = await simpanPesananJahit(r, { rekening: [rekening], waktu: kemarin });
    expect(pertama.ok).toBe(true);

    const kedua = await simpanPesananJahit(r, { rekening: [rekening], waktu: kemarin });
    expect(kedua.ok).toBe(false);
    if (kedua.ok) return;
    expect(kedua.duplikat).toBe(true);
    expect(kedua.pesan).toMatch(/Sudah ada pesanan yang sama/);

    const ketiga = await simpanPesananJahit(r, { rekening: [rekening], waktu: kemarin, izinkanDuplikat: true });
    expect(ketiga.ok).toBe(true);
  });

  it("bukan duplikat: pemesan beda memesan barang yang sama di hari yang sama", async () => {
    const kemarin = new Date(Date.now() - 86400000);
    const a = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: kemarin });
    expect(a.ok).toBe(true);
    const b = await simpanPesananJahit(rencana({ namaPemesan: "Ibu Dewi" }), { rekening: [rekening], waktu: kemarin });
    expect(b.ok).toBe(true);
  });

  it("pesanan kertas: createdAt tetap hari dimasukkan (penanda dari kertas)", async () => {
    const tigaHariLalu = new Date(Date.now() - 3 * 86400000);
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: tigaHariLalu });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const lengkap = await ambilPesananJahit(h.pesanan.id);
    const { transaksiDariKertas } = await import("./tanggal.ts");
    expect(lengkap?.transaksi.waktu.slice(0, 10)).toBe(tigaHariLalu.toISOString().slice(0, 10));
    expect(lengkap?.transaksi.createdAt.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
    expect(transaksiDariKertas(lengkap!.transaksi.waktu, lengkap!.transaksi.createdAt)).toBe(true);
  });
});
