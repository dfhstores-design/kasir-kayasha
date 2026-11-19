import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetKoneksiDB, type Rekening } from "../db/schema.ts";
import {
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
    items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1 }],
    ukuran: "M",
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
    expect(periksaRencanaJahitan(rencana({ items: [{ nama: " ", harga: 100000, kuantitas: 1 }] })).ok).toBe(false);
  });

  it("menolak harga item <= 0", () => {
    expect(periksaRencanaJahitan(rencana({ items: [{ nama: "Gaun", harga: 0, kuantitas: 1 }] })).ok).toBe(false);
    expect(periksaRencanaJahitan(rencana({ items: [{ nama: "Gaun", harga: -1, kuantitas: 1 }] })).ok).toBe(false);
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
          { nama: "Gaun Panjang", harga: 2500000, kuantitas: 1 },
          { nama: "Dres tunik", harga: 2500000, kuantitas: 2 },
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
          { nama: "Gaun Panjang", harga: 2500000, kuantitas: 1 },
          { nama: "Dres tunik", harga: 2500000, kuantitas: 2 },
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
        items: [{ nama: "Kebaya", harga: 300000, kuantitas: 1 }],
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