import { describe, expect, it } from "vitest";
import {
  judulDokumen,
  labelJudul,
  sisaDokumen,
  nomorPlaceholder,
  susunDokumen,
  teksDokumen,
  NAMA_FILE_DOKUMEN,
  NAMA_FILE_PDF,
  type DataDokumen,
} from "./dokumen.ts";

const dasar = (over: Partial<DataDokumen> = {}): DataDokumen => ({
  nomor: "KC.1-20261116",
  tanggal: "2026-11-16T07:20:00.000Z",
  namaPemesan: "Ibu Sari",
  model: "Gaun Pesta",
  ukuran: "M",
  perkiraanSelesai: "2026-11-23",
  biayaJasa: 300000,
  biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
  total: 350000,
  terbayar: 150000,
  ...over,
});

describe("judulDokumen", () => {
  it("sisa > 0 -> invoice", () => {
    expect(judulDokumen(100000)).toBe("invoice");
  });

  it("sisa = 0 -> resi", () => {
    expect(judulDokumen(0)).toBe("resi");
  });

  it("label judul dua wajah (K-02)", () => {
    expect(labelJudul("invoice")).toBe("INVOICE / NOTA PESANAN");
    expect(labelJudul("resi")).toBe("RESI / BUKTI PEMBAYARAN");
  });
});

describe("sisaDokumen", () => {
  it("sisa = total - terbayar", () => {
    expect(sisaDokumen({ total: 350000, terbayar: 150000 })).toBe(200000);
    expect(sisaDokumen({ total: 350000, terbayar: 350000 })).toBe(0);
  });
});

describe("nomorPlaceholder", () => {
  it("memakai format KC.001-YYYYMMDD dan bertanda BELUM FINAL di komentar", () => {
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z")).toBe("KC.001-20261116");
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z", 2)).toBe("KC.002-20261116");
  });
});

describe("susunDokumen - isi (invoice)", () => {
  const t = () => teksDokumen(susunDokumen(dasar()));

  it("nama besar KAYESA dan logo KAYESA'S CLOTHING (K-04)", () => {
    expect(t()).toContain("KAYESA");
    expect(t()).not.toContain("KAYESYA");
    expect(t()).not.toContain("Kayesha");
  });

  it("kop memakai alamat & telepon faktur lama", () => {
    const s = t();
    expect(s).toContain("Jl. Tarumanegara No. 41");
    expect(s).toContain("Ploso Ciptum 15419");
    expect(s).toContain("0812 1141 4017");
    expect(s).toContain("0821 1376 5892");
  });

  it("ada NO:, TANGGAL, KEPADA YTH.", () => {
    const s = t();
    expect(s).toContain("NO: KC.1-20261116");
    expect(s).toContain("TANGGAL 16 Nov 2026");
    expect(s).toContain("KEPADA YTH. Ibu Sari");
  });

  it("detail jahitan tampil", () => {
    const s = t();
    expect(s).toContain("Model / Jenis Gaun Pesta");
    expect(s).toContain("Ukuran M");
    expect(s).toContain("Perkiraan Selesai 2026-11-23");
  });

  it("biaya + TOTAL + terbayar + SISA", () => {
    const s = t();
    expect(s).toContain("Biaya Jasa Rp300.000");
    expect(s).toContain("Bahan payet Rp50.000");
    expect(s).toContain("TOTAL Rp350.000");
    expect(s).toContain("Terbayar Rp150.000");
    expect(s).toContain("SISA Rp200.000");
  });

  it("rekening SELALU tampil (BU-16)", () => {
    const s = t();
    expect(s).toContain("REK BCA 676 017 885");
    expect(s).toContain("a.n. NARSHITA DEWI");
  });

  it("penutup PERHATIAN + Hormat Kami", () => {
    const s = t();
    expect(s).toContain("PERHATIAN!!!");
    expect(s).toContain("Hormat Kami,");
  });
});

describe("susunDokumen - resi (lunas)", () => {
  it("judul berubah jadi RESI dan tanpa baris SISA", () => {
    const s = teksDokumen(susunDokumen(dasar({ total: 350000, terbayar: 350000 })));
    expect(s).toContain("RESI / BUKTI PEMBAYARAN");
    expect(s).not.toContain("SISA");
    expect(s).not.toContain("INVOICE");
  });
});

describe("susunDokumen - biaya lain nol / kosong", () => {
  it("biaya lain bernominal 0 tidak dicetak", () => {
    const s = teksDokumen(
      susunDokumen(dasar({ biayaLain: [{ nama: "Kosong", nominal: 0 }] })),
    );
    expect(s).not.toContain("Kosong");
  });
});

describe("nama berkas", () => {
  it("aman untuk sistem berkas", () => {
    expect(NAMA_FILE_DOKUMEN("KC.1-20261116")).toBe("Nota-KC-1-20261116.png");
    expect(NAMA_FILE_PDF("KC.1/2026")).toBe("Nota-KC-1-2026.pdf");
  });
});