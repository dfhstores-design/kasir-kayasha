import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buatPdfResi, LEBAR_A5, TINGGI_A5 } from "./pdfResi.ts";
import { susunResi, type DataResi } from "./resi.ts";

const data = (over: Partial<DataResi> = {}): DataResi => ({
  nomorResi: "KYS-0012",
  nomorUrutHari: 7,
  waktu: "2026-11-11T07:20:00.000Z",
  jenis: "langsung",
  sapaan: "Sore",
  namaButik: "Kayesha Clothing",
  alamat: ["Jl. Melati No. 12"],
  telepon: ["0812-1111-2222"],
  logoAda: false,
  items: [{ nama: "Blus Linen", kuantitas: 2, hargaSatuan: 180000, diskonPerUnit: 0 }],
  subtotalAwal: 360000,
  diskonItem: 0,
  diskonTotal: 0,
  ongkir: { mode: "ambil_sendiri", nominal: 0 },
  total: 360000,
  pembayaran: [{ waktu: "x", nominal: 360000, metode: "tunai", catatan: null }],
  statusBayar: "lunas",
  dibatalkan: false,
  perkiraanSiap: null,
  namaPemesan: null,
  rekening: [],
  teksPenutup: "Terima kasih",
  tampilkanSapaan: true,
  tampilkanNomorResi: true,
  tampilkanRincianDiskon: true,
  tampilkanPembayaranSisa: true,
  ...over,
});

/** Lima byte pertama PDF harus persis "%PDF-". */
async function magicPdf(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new TextDecoder().decode(bytes.slice(0, 5));
}

describe("buatPdfResi", () => {
  it("menghasilkan Blob application/pdf yang valid", async () => {
    const blob = await buatPdfResi(susunResi(data()), { judul: "Resi KYS-0012" });
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
    expect(await magicPdf(blob)).toBe("%PDF-");
  });

  it("dapat dibaca ulang oleh pdf-lib dengan ukuran A5", async () => {
    const blob = await buatPdfResi(susunResi(data()), { judul: "Resi" });
    const bytes = await blob.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const halaman = doc.getPages();
    expect(halaman.length).toBeGreaterThanOrEqual(1);
    expect(halaman[0]?.getWidth()).toBe(LEBAR_A5);
    expect(halaman[0]?.getHeight()).toBe(TINGGI_A5);
  });

  it("menambah halaman bila isi panjang (banyak barang)", async () => {
    const banyak = Array.from({ length: 40 }, (_, i) => ({
      nama: `Barang ${i + 1}`,
      kuantitas: 1,
      hargaSatuan: 10000,
      diskonPerUnit: 0,
    }));
    const blob = await buatPdfResi(susunResi(data({ items: banyak })), { judul: "Resi panjang" });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPages().length).toBeGreaterThan(1);
  });

  it("tetap membuat PDF walau logo tidak ada", async () => {
    const blob = await buatPdfResi(susunResi(data({ logoAda: false })), { judul: "Resi" });
    expect(blob.size).toBeGreaterThan(500);
  });

  it("tahan terhadap logo rusak (tidak melempar)", async () => {
    const logoRusak = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const blob = await buatPdfResi(susunResi(data({ logoAda: true })), { judul: "Resi", logo: logoRusak });
    expect(blob.type).toBe("application/pdf");
  });
});
