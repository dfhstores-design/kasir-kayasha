import { describe, expect, it } from "vitest";
import { NAMA_FILE_RESI, susunResi, teksResi, type DataResi } from "./resi.ts";

const rekening = (over: Partial<{ id: string; namaBank: string; nomor: string; namaPemilik: string; utama: boolean }> = {}) => ({
  id: "r1",
  namaBank: "BNI",
  nomor: "0971092588",
  namaPemilik: "Siti Aminah",
  utama: true,
  ...over,
});

const dasar = (over: Partial<DataResi> = {}): DataResi => ({
  nomorResi: "KYS-0012",
  nomorUrutHari: 7,
  waktu: "2026-11-11T07:20:00.000Z",
  jenis: "langsung",
  sapaan: "Sore",
  namaButik: "Kayesha Clothing",
  alamat: ["Jl. Melati No. 12", "JAKARTA 12130"],
  telepon: ["0812-1111-2222"],
  logoAda: true,
  items: [{ nama: "Blus Linen", kuantitas: 2, hargaSatuan: 180000, diskonPerUnit: 10000 }],
  subtotalAwal: 360000,
  diskonItem: 20000,
  diskonTotal: 0,
  ongkir: { mode: "butik", nominal: 25000 },
  total: 365000,
  pembayaran: [],
  statusBayar: "lunas",
  dibatalkan: false,
  perkiraanSiap: null,
  namaPemesan: null,
  rekening: [rekening()],
  teksPenutup: "Sore, sampai jumpa!",
  tampilkanSapaan: true,
  tampilkanNomorResi: true,
  tampilkanRincianDiskon: true,
  tampilkanPembayaranSisa: true,
  ...over,
});

describe("susunResi — urutan & isi", () => {
  it("logo, nama butik, alamat, telepon ada di atas", () => {
    const t = teksResi(susunResi(dasar()));
    const potong = t.split("\n").slice(0, 6).join("\n");
    expect(potong).toContain("[logo]");
    expect(potong).toContain("KAYESHA CLOTHING");
    expect(potong).toContain("Jl. Melati No. 12");
    expect(potong).toContain("0812-1111-2222");
  });

  it("tanpa logo tetap rapi dengan nama butik sebagai judul", () => {
    const t = teksResi(susunResi(dasar({ logoAda: false })));
    expect(t).toContain("KAYESHA CLOTHING");
  });

  it("menampilkan tanggal dan nomor urut hari", () => {
    const t = teksResi(susunResi(dasar()));
    expect(t).toMatch(/#7/);
    expect(t).toContain("KYS-0012");
  });

  it("menampilkan sapaan sesuai snapshot", () => {
    expect(teksResi(susunResi(dasar()))).toContain("- Sore -");
  });

  it("menampilkan barang, diskon barang, dan total", () => {
    const t = teksResi(susunResi(dasar()));
    expect(t).toContain("Blus Linen 2x");
    expect(t).toMatch(/Diskon barang/);
    expect(t).toContain("Total Rp365.000");
  });

  it("baris barang membawa diskon per unit untuk PDF", () => {
    const baris = susunResi(dasar()).find((b) => b.jenis === "barang");
    expect(baris && baris.jenis === "barang" ? baris.diskonPerUnit : null).toBe(10000);
  });

  it("ongkos kirim SELALU tampil termasuk Rp0", () => {
    const t = teksResi(susunResi(dasar({ ongkir: { mode: "ambil_sendiri", nominal: 0 } })));
    expect(t).toContain("Ongkos kirim Rp0");
  });

  it("ongkir belum ditentukan tertulis jelas, bukan Rp0", () => {
    const t = teksResi(susunResi(dasar({ ongkir: { mode: "belum_ditentukan", nominal: null } })));
    expect(t).toContain("Ongkos kirim Belum ditentukan");
  });

  it("ongkir ke kurir tertulis siapa yang membayar", () => {
    const t = teksResi(susunResi(dasar({ ongkir: { mode: "kurir", nominal: 0 } })));
    expect(t).toContain("Dibayar langsung ke kurir");
  });
});

describe("susunResi — status bayar & rekening", () => {
  it("LUNAS penuh tidak menulis status & tidak mencetak rekening", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 365000,
          statusBayar: "lunas",
          pembayaran: [{ waktu: "2026-11-11T07:00:00.000Z", nominal: 365000, metode: "tunai", catatan: null }],
        }),
      ),
    );
    expect(t).not.toContain("Lunas");
    expect(t).not.toContain("Sisa");
    expect(t).not.toContain("BNI");
  });

  it("DP mencetak status, bayar, sisa, dan rekening", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 500000,
          statusBayar: "dp",
          pembayaran: [{ waktu: "2026-11-11T07:00:00.000Z", nominal: 150000, metode: "transfer", catatan: null }],
        }),
      ),
    );
    expect(t).toContain("DP");
    expect(t).toContain("Bayar (Transfer) Rp150.000");
    expect(t).toContain("Sisa Rp350.000");
    expect(t).toContain("BNI 0971092588");
  });

  it("belum dibayar mencetak sisa penuh", () => {
    const t = teksResi(susunResi(dasar({ total: 360000, statusBayar: "belum_dibayar", pembayaran: [] })));
    expect(t).toContain("Belum dibayar");
    expect(t).toContain("Sisa Rp360.000");
  });

  it("maksimal 2 rekening dicetak", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 100000,
          statusBayar: "dp",
          pembayaran: [],
          rekening: [
            rekening(),
            rekening({ id: "r2", namaBank: "BCA", nomor: "8810295431" }),
            rekening({ id: "r3", namaBank: "Mandiri", nomor: "999" }),
          ],
        }),
      ),
    );
    expect(t).toContain("BNI");
    expect(t).toContain("BCA");
    expect(t).not.toContain("Mandiri");
  });
});

describe("susunResi — sakelar pengaturan", () => {
  it("sapaan bisa dimatikan", () => {
    expect(teksResi(susunResi(dasar({ tampilkanSapaan: false })))).not.toContain("- Sore -");
  });

  it("nomor resi bisa disembunyikan", () => {
    expect(teksResi(susunResi(dasar({ tampilkanNomorResi: false })))).not.toContain("KYS-0012");
  });

  it("rincian diskon bisa disembunyikan", () => {
    const t = teksResi(susunResi(dasar({ tampilkanRincianDiskon: false })));
    expect(t).not.toContain("Diskon barang");
    expect(t).not.toContain("Diskon @");
  });

  it("pembayaran & sisa bisa disembunyikan", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 500000,
          statusBayar: "dp",
          pembayaran: [{ waktu: "x", nominal: 150000, metode: "tunai", catatan: null }],
          tampilkanPembayaranSisa: false,
        }),
      ),
    );
    expect(t).not.toContain("Sisa");
    expect(t).not.toContain("Bayar (");
  });
});

describe("susunResi — PO & pembatalan", () => {
  it("PO menampilkan label PRE-ORDER, perkiraan siap, dan nama pemesan", () => {
    const t = teksResi(
      susunResi(dasar({ jenis: "po", perkiraanSiap: "2026-11-20", namaPemesan: "Ibu Sari" })),
    );
    expect(t).toContain("PRE-ORDER");
    expect(t).toContain("siap ± 2026-11-20");
    expect(t).toContain("Pemesan: Ibu Sari");
  });

  it("transaksi dibatalkan diberi penanda", () => {
    expect(teksResi(susunResi(dasar({ dibatalkan: true })))).toContain("*** DIBATALKAN ***");
  });
});

describe("NAMA_FILE_RESI", () => {
  it("aman untuk sistem berkas", () => {
    expect(NAMA_FILE_RESI("KYS-0012")).toBe("Resi-KYS-0012.pdf");
    expect(NAMA_FILE_RESI("KYS/PO 1")).toBe("Resi-KYS-PO-1.pdf");
  });
});
