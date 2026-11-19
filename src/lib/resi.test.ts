import { describe, expect, it } from "vitest";
import { NAMA_FILE_RESI, NAMA_FILE_RESI_PNG, dataContoh, dataContohPO, susunResi, teksResi, type DataResi } from "./resi.ts";

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
  namaButik: "Kayesa Clothing",
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

const pengaturanContoh = {
  namaButik: "KAYESA",
  alamatBaris1: "Jl. Tarumanegara No. 41",
  alamatBaris2: "Pisangan, Ciputat Timur - 15419",
  kotaKodePos: "",
  telepon1: "0812 1141 4017",
  telepon2: "0821 1376 5892",
  teksPenutup: "Terima kasih, sampai jumpa!",
  logo: null,
  rekening: [rekening({ namaBank: "BCA", nomor: "676 017 885", namaPemilik: "NARSHITA DEWI" })],
  tampilkanSapaan: true,
  tampilkanNomorResi: true,
  tampilkanRincianDiskon: true,
  tampilkanPembayaranSisa: true,
};

describe("susunResi — urutan & isi (contoh v8/v9/v4)", () => {
  it("logo, nama butik, alamat, telepon ada di atas", () => {
    const t = teksResi(susunResi(dasar()));
    const potong = t.split("\n").slice(0, 6).join("\n");
    expect(potong).toContain("[logo]");
    expect(potong).toContain("KAYESA CLOTHING");
    expect(potong).toContain("Jl. Melati No. 12");
    expect(potong).toContain("0812-1111-2222");
  });

  it("alamat baris 2 dicetak sebagai baris sendiri, tanpa kurung (BU-52)", () => {
    const t = teksResi(susunResi(dasar()));
    expect(t).toContain("Jl. Melati No. 12");
    expect(t).toContain("JAKARTA 12130");
    expect(t).not.toContain("Jl. Melati No. 12 (JAKARTA 12130)");
  });

  it("tanpa logo tetap rapi dengan nama butik sebagai judul", () => {
    const t = teksResi(susunResi(dasar({ logoAda: false })));
    expect(t).toContain("KAYESA CLOTHING");
  });

  it("menampilkan judul dokumen RESI, kode transaksi, dan tanggal resi", () => {
    const t = teksResi(susunResi(dasar()));
    expect(t).toContain("RESI");
    expect(t).toContain("BUKTI PEMBAYARAN PENJUALAN BARANG");
    expect(t).toContain("KODE TRANSAKSI (USULAN)");
    expect(t).toContain("KYS-0012");
    expect(t).toContain("TANGGAL RESI");
  });

  it("sapaan tidak lagi dicetak di resi (tidak ada di contoh)", () => {
    expect(teksResi(susunResi(dasar()))).not.toContain("- Sore -");
  });

  it("menampilkan barang, diskon barang, dan total penjualan", () => {
    const t = teksResi(susunResi(dasar()));
    expect(t).toContain("Blus Linen 2x");
    expect(t).toMatch(/Diskon barang/);
    expect(t).toContain("Total penjualan Rp365.000");
  });

  it("baris barang membawa diskon per unit untuk PDF", () => {
    const baris = susunResi(dasar()).find((b) => b.jenis === "barang");
    expect(baris && baris.jenis === "barang" ? baris.diskonPerUnit : null).toBe(10000);
  });

  it("ongkir hanya tampil bila ada nominalnya; Rp0 tidak tampil", () => {
    const tanpaOngkir = teksResi(susunResi(dasar({ ongkir: { mode: "ambil_sendiri", nominal: 0 } })));
    expect(tanpaOngkir).not.toContain("Ongkos kirim");
    const denganOngkir = teksResi(susunResi(dasar({ ongkir: { mode: "butik", nominal: 25000 } })));
    expect(denganOngkir).toContain("Ongkos kirim Rp25.000");
  });

  it("ongkir belum ditentukan tertulis jelas, bukan Rp0", () => {
    const t = teksResi(susunResi(dasar({ ongkir: { mode: "belum_ditentukan", nominal: null } })));
    expect(t).toContain("Ongkos kirim Belum ditentukan");
    expect(t).toContain("Total belum termasuk ongkir");
  });

  it("ongkir ke kurir tertulis siapa yang membayar", () => {
    const t = teksResi(susunResi(dasar({ ongkir: { mode: "kurir", nominal: 0 } })));
    expect(t).toContain("Dibayar langsung ke kurir");
  });
});

describe("susunResi — status bayar & rekening", () => {
  it("LUNAS menampilkan lencana LUNAS dan tetap mencetak kotak rekening", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 365000,
          statusBayar: "lunas",
          pembayaran: [{ waktu: "2026-11-11T07:00:00.000Z", nominal: 365000, metode: "tunai", catatan: null }],
        }),
      ),
    );
    expect(t).toContain("LUNAS");
    expect(t).toContain("REKENING KAYESA CLOTHING");
    expect(t).toContain("BNI · 0971092588");
    expect(t).not.toContain("Sisa pembayaran");
  });

  it("DP menampilkan BELUM LUNAS, baris DP, dan kotak sisa pembayaran", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 500000,
          statusBayar: "dp",
          pembayaran: [{ waktu: "2026-11-11T07:00:00.000Z", nominal: 150000, metode: "transfer", catatan: null }],
        }),
      ),
    );
    expect(t).toContain("BELUM LUNAS");
    expect(t).toContain("Transfer diterima Rp150.000");
    expect(t).toContain("Sisa pembayaran");
    expect(t).toContain("Rp350.000");
    expect(t).toContain("BNI · 0971092588");
  });

  it("belum dibayar menampilkan BELUM LUNAS dan sisa penuh", () => {
    const t = teksResi(susunResi(dasar({ total: 360000, statusBayar: "belum_dibayar", pembayaran: [] })));
    expect(t).toContain("BELUM LUNAS");
    expect(t).toContain("Sisa pembayaran");
    expect(t).toContain("Rp360.000");
  });

  it("semua rekening dicetak, utama paling atas (BU-53)", () => {
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
    expect(t).toContain("BNI · 0971092588");
    expect(t).toContain("BCA · 8810295431");
    expect(t).toContain("Mandiri · 999");
    // Utama (BNI) tampil sebelum yang lain.
    expect(t.indexOf("BNI")).toBeLessThan(t.indexOf("BCA"));
  });

  it("kembalian ditampilkan saat tunai melebihi total", () => {
    const t = teksResi(
      susunResi(
        dasar({
          total: 180000,
          statusBayar: "lunas",
          pembayaran: [{ waktu: "2026-11-15T09:00:00.000Z", nominal: 200000, metode: "tunai", catatan: null }],
        }),
      ),
    );
    expect(t).toContain("Kembalian");
    expect(t).toContain("Rp20.000");
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
    expect(t).not.toContain("Sisa pembayaran");
    expect(t).not.toContain("PEMBAYARAN DITERIMA");
  });
});

describe("susunResi — penutup pengganti (keputusan Andri 17 Nov 2026)", () => {
  it("teksPenutup yang terisi dipakai sebagai kalimat penutup, bukan bawaan", () => {
    const t = teksResi(susunResi(dasar({ teksPenutup: "Terima kasih, sampai jumpa!" })));
    expect(t).toContain("Terima kasih, sampai jumpa!");
    expect(t).not.toContain("Terima kasih telah berbelanja di");
  });

  it("teksPenutup kosong memakai penutup bawaan penjualan", () => {
    const t = teksResi(susunResi(dasar({ teksPenutup: "   " })));
    expect(t).toContain("Terima kasih telah berbelanja di KAYESA CLOTHING.");
  });

  it("teksPenutup kosong pada PO memakai penutup bawaan pesanan jahit", () => {
    const t = teksResi(susunResi(dasar({ jenis: "po", teksPenutup: "", namaPemesan: "Nadia Putri" })));
    expect(t).toContain("Terima kasih telah mempercayakan pesanan jahit kepada KAYESA CLOTHING.");
  });

  it("contoh pratinjau memakai teksPenutup seed sebagai penutup pengganti", () => {
    const t = teksResi(susunResi(dataContoh(pengaturanContoh)));
    expect(t).toContain("Terima kasih, sampai jumpa!");
    expect(t).not.toContain("Terima kasih telah berbelanja di");
  });
});

describe("susunResi — PO & pembatalan", () => {
  it("PO lunas berjudul RESI / BUKTI PEMBAYARAN PESANAN dengan info pemesan", () => {
    const t = teksResi(
      susunResi(dasar({ jenis: "po", perkiraanSiap: "2026-11-20", namaPemesan: "Ibu Sari" })),
    );
    expect(t).toContain("RESI");
    expect(t).toContain("BUKTI PEMBAYARAN PESANAN");
    expect(t).toContain("PEMESAN");
    expect(t).toContain("Ibu Sari");
    expect(t).toContain("PERKIRAAN SELESAI");
    expect(t).toContain("20 Nov 2026");
    expect(t).not.toContain("PRE-ORDER");
  });

  it("PO belum lunas berjudul INVOICE / NOTA PESANAN JAHIT", () => {
    const t = teksResi(
      susunResi(
        dasar({
          jenis: "po",
          statusBayar: "dp",
          total: 975000,
          pembayaran: [{ waktu: "2026-11-12T09:00:00.000Z", nominal: 300000, metode: "transfer", catatan: null }],
          namaPemesan: "Nadia Putri",
        }),
      ),
    );
    expect(t).toContain("INVOICE");
    expect(t).toContain("NOTA PESANAN JAHIT");
    expect(t).toContain("BELUM LUNAS");
    expect(t).toContain("PEMBAYARAN MELALUI");
    expect(t).toContain("Sisa pembayaran");
    expect(t).toContain("Rp675.000");
  });

  it("PO lunas menampilkan total pembayaran diterima", () => {
    const t = teksResi(
      susunResi(
        dasar({
          jenis: "po",
          statusBayar: "lunas",
          total: 975000,
          pembayaran: [
            { waktu: "2026-11-12T09:00:00.000Z", nominal: 300000, metode: "transfer", catatan: null },
            { waktu: "2026-11-15T10:00:00.000Z", nominal: 675000, metode: "tunai", catatan: null },
          ],
          namaPemesan: "Nadia Putri",
        }),
      ),
    );
    expect(t).toContain("TOTAL PEMBAYARAN DITERIMA");
    expect(t).toContain("Rp975.000");
  });

  it("catatan pesanan PO tampil di kotak PERHATIAN", () => {
    const t = teksResi(susunResi(dasar({ jenis: "po", catatanPesanan: "lengan panjang" })));
    expect(t).toContain("PERHATIAN!!!");
    expect(t).toContain("Catatan pesanan: lengan panjang");
  });

  it("transaksi dibatalkan diberi penanda", () => {
    expect(teksResi(susunResi(dasar({ dibatalkan: true })))).toContain("*** DIBATALKAN ***");
  });
});

describe("susunResi — data contoh pratinjau", () => {
  it("contoh penjualan mengikuti contoh resi bazar (Blus Batik, kembalian, PENGINGAT)", () => {
    const t = teksResi(susunResi(dataContoh(pengaturanContoh)));
    expect(t).toContain("CONTOH DATA FIKTIF");
    expect(t).toContain("RESI");
    expect(t).toContain("Blus Batik Motif Bunga");
    expect(t).toContain("Kembalian");
    expect(t).toContain("Rp20.000");
    expect(t).toContain("PENGINGAT");
    expect(t).toContain("REKENING KAYESA");
    expect(t).toContain("BCA · 676 017 885");
  });

  it("contoh PO mengikuti contoh resi v9 / nota v8 (Nadia Putri, Kebaya brokat)", () => {
    const t = teksResi(susunResi(dataContohPO(pengaturanContoh)));
    expect(t).toContain("CONTOH DATA FIKTIF");
    expect(t).toContain("Nadia Putri");
    expect(t).toContain("Kebaya brokat");
    expect(t).toContain("Jasa jahit Rp850.000");
    expect(t).toContain("Biaya lainnya Rp125.000");
    expect(t).toContain("Total tagihan Rp975.000");
    expect(t).toContain("TOTAL PEMBAYARAN DITERIMA");
    expect(t).toContain("PERHATIAN!!!");
  });
});

describe("NAMA_FILE_RESI", () => {
  it("aman untuk sistem berkas", () => {
    expect(NAMA_FILE_RESI("KYS-0012")).toBe("Resi-KYS-0012.pdf");
    expect(NAMA_FILE_RESI("KYS/PO 1")).toBe("Resi-KYS-PO-1.pdf");
  });
});

describe("NAMA_FILE_RESI_PNG", () => {
  it("aman untuk sistem berkas, berekstensi png (K-01: PNG yang dibagikan)", () => {
    expect(NAMA_FILE_RESI_PNG("KYS-0012")).toBe("Resi-KYS-0012.png");
    expect(NAMA_FILE_RESI_PNG("KYS/PO 1")).toBe("Resi-KYS-PO-1.png");
  });
});
