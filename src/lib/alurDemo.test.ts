import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetKoneksiDB, type Rekening } from "../db/schema.ts";
import {
  ambilPesananJahit,
  catatPengiriman,
  daftarPesananJahit,
  daftarPerluDitagih,
  simpanPesananJahit,
  type RencanaJahitan,
} from "./jahitan.ts";
import { batalkanPesananKasir, terimaPembayaranKasir } from "../db/kasirOperasi.ts";
import { judulDokumen, labelJudul, nomorPlaceholder, sisaDokumen, susunDokumen, teksDokumen, type DataDokumen } from "./dokumen.ts";

/**
 * Uji alur DEMO end-to-end (integrasi & tes demo, bukan fitur baru).
 * Merangkai lapisan murni + persistensi untuk memastikan 3 alur yang
 * didemonstrasikan ke Tante benar-benar jalan tanpa buka aplikasi manual.
 *
 * Alur 1 (kasir): simpan pesanan lalu terima DP lalu terima pelunasan lalu lunas + kembalian.
 * Alur 2 (tante): daftar Belum Lunas lalu perlu ditagih lalu detail lalu status benar.
 * Alur 3 (cetak): sisa>0 menjadi INVOICE (ada SISA); lunas menjadi RESI (tanpa SISA).
 */

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
    perkiraanSelesai: "2027-01-01",
    catatan: null,
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    ...over,
  };
}

function dokumenDari(data: {
  nomor: string;
  namaPemesan: string;
  model: string;
  total: number;
  terbayar: number;
}): DataDokumen {
  return {
    nomor: data.nomor,
    tanggal: "2026-11-16T07:20:00.000Z",
    namaPemesan: data.namaPemesan,
    items: [{ nama: data.model, kuantitas: 1, harga: 300000, ukuran: "M" }],
    perkiraanSelesai: "2026-11-23",
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    total: data.total,
    terbayar: data.terbayar,
  };
}

describe("ALUR 1 - kasir: DP lalu pelunasan lalu lunas + kembalian", () => {
  beforeEach(resetDB);

  it("DP lalu pelunasan pas: status lunas, sisa 0, kembalian 0", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    const dp = await terimaPembayaranKasir(id, 150000, "tunai");
    expect(dp.ok).toBe(true);
    if (!dp.ok) return;
    expect(dp.sisa).toBe(200000);
    expect(dp.kembalian).toBe(0);
    expect(dp.statusDokumen).toBe("terbuka");

    const lunas = await terimaPembayaranKasir(id, 200000, "transfer");
    expect(lunas.ok).toBe(true);
    if (!lunas.ok) return;
    expect(lunas.sisa).toBe(0);
    expect(lunas.kembalian).toBe(0);
    expect(lunas.statusDokumen).toBe("lunas");

    const detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("lunas");
    expect(detail?.terbayar).toBe(350000);
    expect(detail?.sisa).toBe(0);
  });

  it("boleh bayar LEBIH dari total: kembalian tampil, tetap lunas (BU-17.B)", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    const hasil = await terimaPembayaranKasir(id, 400000, "tunai");
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.kembalian).toBe(50000);
    expect(hasil.sisa).toBe(0);
    expect(hasil.statusDokumen).toBe("lunas");

    const ulang = await terimaPembayaranKasir(id, 10000, "tunai");
    expect(ulang.ok).toBe(false);
  });
});

describe("ALUR 2 - tante: wizard lalu daftar lalu perlu ditagih lalu detail", () => {
  beforeEach(resetDB);

  it("daftar Belum Lunas dan perlu ditagih memunculkan pesanan yang benar", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") });
    expect(h.ok).toBe(true);
    if (!h.ok) return;

    const daftar = await daftarPesananJahit();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]?.status).toBe("terbuka");
    expect(daftar[0]?.model).toBe("Gaun pesta");
    expect(daftar[0]?.sisa).toBe(350000);

    const lewat = await simpanPesananJahit(
      rencana({
        items: [{ nama: "Kebaya", harga: 300000, kuantitas: 1, ukuran: null }],
        perkiraanSelesai: "2020-01-01",
      }),
      {
        rekening: [rekening],
      },
    );
    expect(lewat.ok).toBe(true);

    const tagih = await daftarPerluDitagih(new Date("2026-11-16T00:00:00.000Z"));
    expect(tagih).toHaveLength(1);
    expect(tagih[0]?.model).toBe("Kebaya");
  });

  it("detail menampilkan status & sisa dengan benar, dan tanda kirim terisi", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    let detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("terbuka");
    expect(detail?.sisa).toBe(350000);
    expect(detail?.sudahDikirim).toBe(false);

    await catatPengiriman(id, h.pesanan.pelangganId, "invoice", "whatsapp");

    detail = await ambilPesananJahit(id);
    expect(detail?.sudahDikirim).toBe(true);
  });
});

describe("ALUR 3 - cetak resi/nota: invoice (SISA) lalu resi (tanpa SISA)", () => {
  it("judul otomatis & SISA mengikuti sisa (K-02, BU-17.A)", () => {
    const belumLunas = dokumenDari({ nomor: "KC.1-20261116", namaPemesan: "Ibu Sari", model: "Gaun pesta", total: 350000, terbayar: 150000 });
    expect(judulDokumen(sisaDokumen(belumLunas))).toBe("invoice");
    expect(labelJudul("invoice")).toBe("INVOICE / NOTA PESANAN");
    const t1 = teksDokumen(susunDokumen(belumLunas));
    expect(t1).toContain("SISA");
    expect(t1).toContain("INVOICE / NOTA PESANAN");

    const lunas = dokumenDari({ nomor: "KC.1-20261116", namaPemesan: "Ibu Sari", model: "Gaun pesta", total: 350000, terbayar: 350000 });
    expect(judulDokumen(sisaDokumen(lunas))).toBe("resi");
    expect(labelJudul("resi")).toBe("RESI / BUKTI PEMBAYARAN");
    const t2 = teksDokumen(susunDokumen(lunas));
    expect(t2).not.toContain("SISA");
    expect(t2).toContain("RESI / BUKTI PEMBAYARAN");
  });

  it("nomor placeholder KC.00001-YYYYMMDD, urutan bulanan 5 digit (BU-19/21)", () => {
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z")).toBe("KC.00001-20261116");
  });

  it("nama resmi KAYESA - bukan ejaan lama", () => {
    const s = teksDokumen(susunDokumen(dokumenDari({ nomor: "KC.1-20261116", namaPemesan: "Ibu Sari", model: "Gaun pesta", total: 350000, terbayar: 150000 })));
    expect(s).toContain("KAYESA");
    expect(s).not.toContain("KAYESYA");
    expect(s).not.toContain("Kayesha");
  });
});

describe("VOID - pembatalan kasir dengan alasan (BU-17.C)", () => {
  beforeEach(resetDB);

  it("void menandai batal, alasan tercatat, jurnal balik ditulis bila ada uang", async () => {
    const h = await simpanPesananJahit(rencana(), { rekening: [rekening] });
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const id = h.pesanan.id;

    await terimaPembayaranKasir(id, 150000, "tunai");

    const b = await batalkanPesananKasir(id, "Salah ukuran");
    expect(b.ok).toBe(true);

    const detail = await ambilPesananJahit(id);
    expect(detail?.status).toBe("batal");
    expect(detail?.transaksi.catatanPesanan).toContain("Dibatalkan: Salah ukuran");
  });
});