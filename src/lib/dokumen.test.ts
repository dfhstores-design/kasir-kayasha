import { describe, expect, it } from "vitest";
import {
  hitungTinggiPng,
  judulDokumen,
  labelJudul,
  sisaDokumen,
  nomorPlaceholder,
  susunDokumen,
  teksDokumen,
  tinggiLogoPng,
  NAMA_FILE_DOKUMEN,
  NAMA_FILE_PDF,
  type DataDokumen,
} from "./dokumen.ts";

const dasar = (over: Partial<DataDokumen> = {}): DataDokumen => ({
  nomor: "KC.00001-20261116",
  tanggal: "2026-11-16T07:20:00.000Z",
  namaPemesan: "Ibu Sari",
  items: [{ nama: "Gaun Pesta", kuantitas: 1, harga: 300000, ukuran: "M" }],
  perkiraanSelesai: "2026-11-23",
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
  it("memakai format KC.00001-YYYYMMDD, urutan bulanan 5 digit (BU-19/21)", () => {
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z")).toBe("KC.00001-20261116");
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z", 2)).toBe("KC.00002-20261116");
    expect(nomorPlaceholder("2026-11-16T07:20:00.000Z", 123)).toBe("KC.00123-20261116");
  });
});

describe("susunDokumen - isi (invoice)", () => {
  const t = () => teksDokumen(susunDokumen(dasar()));

  it("nama besar KAYESA dan logo KAYESA'S CLOTHING (K-04)", () => {
    expect(t()).toContain("KAYESA");
    expect(t()).not.toContain("KAYESYA");
    expect(t()).not.toContain("Kayesha");
  });

  it("kop memakai alamat & telepon baru (BU-51), tanpa kurung (BU-52)", () => {
    const s = t();
    expect(s).toContain("Jl. Tarumanegara No. 41");
    expect(s).toContain("Pisangan, Ciputat Timur - 15419");
    expect(s).not.toContain("Ploso Ciptum");
    expect(s).not.toContain("Sebelah Pempak");
    expect(s).not.toContain("(");
    expect(s).toContain("0812 1141 4017");
    expect(s).toContain("0821 1376 5892");
  });

  it("ada NO:, TANGGAL, KEPADA YTH.", () => {
    const s = t();
    expect(s).toContain("NO: KC.00001-20261116");
    expect(s).toContain("TANGGAL 16 Nov 2026");
    expect(s).toContain("KEPADA YTH. Ibu Sari");
  });

  it("detail jahitan tampil (BU-56: ukuran menempel di item)", () => {
    const s = t();
    expect(s).toContain("Gaun Pesta · M Rp300.000");
    expect(s).toContain("Perkiraan Selesai 2026-11-23");
  });

  it("item tanpa ukuran tampil tanpa tambahan (BU-56)", () => {
    const s = teksDokumen(susunDokumen(dasar({ items: [{ nama: "Gaun Pesta", kuantitas: 1, harga: 300000, ukuran: null }] })));
    expect(s).toContain("Gaun Pesta Rp300.000");
    expect(s).not.toContain(" · ");
  });

  it("item + biaya lain + TOTAL + terbayar + SISA", () => {
    const s = t();
    expect(s).toContain("Gaun Pesta · M Rp300.000");
    expect(s).toContain("Bahan payet Rp50.000");
    expect(s).toContain("TOTAL Rp350.000");
    expect(s).toContain("Terbayar Rp150.000");
    expect(s).toContain("SISA Rp200.000");
  });

  it("banyak item tampil satu baris per item, jumlah bila > 1 (BU-55)", () => {
    const s = teksDokumen(
      susunDokumen(
        dasar({
          items: [
            { nama: "Gaun Panjang", kuantitas: 1, harga: 2500000, ukuran: "L" },
            { nama: "Dres tunik", kuantitas: 2, harga: 2500000, ukuran: null },
          ],
          total: 7500000,
          terbayar: 0,
        }),
      ),
    );
    expect(s).toContain("Gaun Panjang · L Rp2.500.000");
    expect(s).toContain("Dres tunik ×2 Rp5.000.000");
    expect(s).toContain("TOTAL Rp7.500.000");
  });

  it("rekening SELALU tampil (BU-16)", () => {
    const s = t();
    expect(s).toContain("REK BCA 676 017 885");
    expect(s).toContain("a.n. NARSHITA DEWI");
  });

  it("semua rekening tampil bila diisi lebih dari 1 (BU-53)", () => {
    const s = teksDokumen(
      susunDokumen(
        dasar({
          rekening: [
            { namaBank: "BCA", nomor: "676 017 885", namaPemilik: "NARSHITA DEWI" },
            { namaBank: "Mandiri", nomor: "1370012345678", namaPemilik: "NARSHITA DEWI" },
          ],
        }),
      ),
    );
    expect(s).toContain("REK BCA 676 017 885");
    expect(s).toContain("REK Mandiri 1370012345678");
  });

  it("penutup lengkap: PERHATIAN + Hormat Kami + nama + terima kasih (BU-54)", () => {
    const s = t();
    expect(s).toContain("PERHATIAN!!!");
    expect(s).toContain("Hormat Kami,");
    expect(s).toContain("KAYESA");
    expect(s).toContain("Terima kasih telah mempercayakan pesanan jahit kepada KAYESA.");
  });

  it("teksPenutup dari Pengaturan dipakai bila terisi", () => {
    const s = teksDokumen(susunDokumen(dasar({ teksPenutup: "Terima kasih, sampai jumpa!" })));
    expect(s).toContain("Terima kasih, sampai jumpa!");
    expect(s).not.toContain("Terima kasih telah mempercayakan");
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

describe("tinggi PNG menghitung logo (BU-54)", () => {
  it("logo monogram KC menambah tinggi kanvas sejumlah tinggi gambar + jarak", () => {
    const logo = { width: 2300, height: 2332 } as unknown as ImageBitmap;
    const tl = tinggiLogoPng(logo);
    expect(tl).toBeGreaterThan(0);
    expect(tl).toBeCloseTo(82, 0);
    expect(tinggiLogoPng(null)).toBe(0);
  });

  it("hitungTinggiPng menambah tinggi logo ke total (bawah tidak terpotong)", () => {
    const baris = susunDokumen(dasar());
    const logo = { width: 2300, height: 2332 } as unknown as ImageBitmap;
    const tl = tinggiLogoPng(logo);
    expect(hitungTinggiPng(baris, tl)).toBe(hitungTinggiPng(baris) + tl);
  });
});

describe("nama berkas", () => {
  it("aman untuk sistem berkas", () => {
    expect(NAMA_FILE_DOKUMEN("KC.1-20261116")).toBe("Nota-KC-1-20261116.png");
    expect(NAMA_FILE_PDF("KC.1/2026")).toBe("Nota-KC-1-2026.pdf");
  });
});