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
    model: "Gaun pesta",
    ukuran: "M",
    perkiraanSelesai: "2026-11-23",
    catatan: null,
    biayaJasa: 300000,
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    ...over,
  };
}

describe("periksaRencanaJahitan", () => {
  it("menolak nama pemesan kosong", () => {
    expect(periksaRencanaJahitan(rencana({ namaPemesan: " " })).ok).toBe(false);
  });

  it("menolak model kosong", () => {
    expect(periksaRencanaJahitan(rencana({ model: "" })).ok).toBe(false);
  });

  it("menolak biaya jasa <= 0", () => {
    expect(periksaRencanaJahitan(rencana({ biayaJasa: 0 })).ok).toBe(false);
    expect(periksaRencanaJahitan(rencana({ biayaJasa: -1 })).ok).toBe(false);
  });

  it("menghitung total = biayaJasa + biayaLain", () => {
    const h = periksaRencanaJahitan(rencana());
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.total).toBe(350000);
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
    expect(daftar[0]?.nomor).toBe("KC.1-20261116");
    expect(h.pesanan.pelangganId).toBeTruthy();
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
    await simpanPesananJahit(rencana({ model: "Kebaya", perkiraanSelesai: "2099-01-01" }), { rekening: [rekening] });
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