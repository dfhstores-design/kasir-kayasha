import { describe, expect, it } from "vitest";
import {
  biayaPadaHari,
  hitungRingkasanKeuangan,
  hitungUlangSisa,
  pesanSelisih,
  transaksiPadaHari,
  type BiayaRingkas,
  type PembayaranRingkas,
  type TransaksiRingkas,
} from "./bazar.ts";

const p = (nominal: number, metode: PembayaranRingkas["metode"]): PembayaranRingkas => ({
  nominal,
  metode,
  waktu: "2026-11-10T10:00:00.000Z",
});

/** Bawaan: lunas sekali bayar penuh dengan metodenya (bentuk lama). */
const t = (
  total: number,
  jenisBayar: TransaksiRingkas["jenisBayar"],
  pembayaran: PembayaranRingkas[] = [p(total, jenisBayar)],
  dibatalkan = false,
  waktu = "2026-11-10T10:00:00.000Z",
): TransaksiRingkas => ({
  total,
  jenisBayar,
  dibatalkan,
  waktu,
  pembayaran,
});

const b = (nominal: number, kategori: BiayaRingkas["kategori"] = "sewa_booth", tanggal = "2026-11-10"): BiayaRingkas => ({
  kategori,
  judul: "Biaya",
  nominal,
  tanggal,
});

describe("hitungRingkasanKeuangan", () => {
  it("menghitung omzet per metode bayar", () => {
    const r = hitungRingkasanKeuangan([t(100000, "tunai"), t(250000, "transfer"), t(50000, "qris")], []);
    expect(r.jumlahTransaksi).toBe(3);
    expect(r.omzet).toBe(400000);
    expect(r.uangMasuk).toBe(400000);
    expect(r.tunai).toBe(100000);
    expect(r.transfer).toBe(250000);
    expect(r.qris).toBe(50000);
  });

  it("transaksi dibatalkan TIDAK masuk omzet maupun uang masuk", () => {
    const r = hitungRingkasanKeuangan([t(100000, "tunai"), t(999999, "tunai", [p(999999, "tunai")], true)], []);
    expect(r.jumlahTransaksi).toBe(1);
    expect(r.omzet).toBe(100000);
    expect(r.uangMasuk).toBe(100000);
  });

  it("menghitung laba = omzet − biaya", () => {
    const r = hitungRingkasanKeuangan([t(1000000, "tunai")], [b(300000), b(200000, "transport")]);
    expect(r.totalBiaya).toBe(500000);
    expect(r.laba).toBe(500000);
  });

  it("laba boleh NEGATIF dan tidak dibulatkan ke nol", () => {
    const r = hitungRingkasanKeuangan([t(100000, "tunai")], [b(500000)]);
    expect(r.laba).toBe(-400000);
  });

  it("biaya per kategori dijumlah benar", () => {
    const r = hitungRingkasanKeuangan([], [b(100000, "sewa_booth"), b(50000, "sewa_booth"), b(25000, "konsumsi")]);
    expect(r.biayaPerKategori).toEqual([
      { kategori: "sewa_booth", total: 150000 },
      { kategori: "konsumsi", total: 25000 },
    ]);
  });

  it("transaksi tanpa metode bayar dipisah", () => {
    const r = hitungRingkasanKeuangan([t(75000, null)], []);
    expect(r.tanpaMetode).toBe(75000);
    expect(r.uangMasuk).toBe(75000);
    expect(r.tunai).toBe(0);
  });

  it("data kosong menghasilkan nol, bukan error", () => {
    const r = hitungRingkasanKeuangan([], []);
    expect(r).toMatchObject({ jumlahTransaksi: 0, omzet: 0, uangMasuk: 0, totalBiaya: 0, laba: 0 });
  });

  it("F2: DP + pelunasan beda metode dihitung terpisah, bukan dibebankan ke metode terakhir", () => {
    // Pesanan total 350rb: DP tunai 175rb + pelunasan transfer 175rb.
    // Cara lama: tunai 0 + transfer 350rb. Cara benar: tunai 175rb + transfer 175rb.
    const r = hitungRingkasanKeuangan(
      [t(350000, "transfer", [p(175000, "tunai"), p(175000, "transfer")])],
      [],
    );
    expect(r.omzet).toBe(350000);
    expect(r.uangMasuk).toBe(350000);
    expect(r.tunai).toBe(175000);
    expect(r.transfer).toBe(175000);
  });

  it("F2: omzet dipisah dari uang masuk bila pesanan baru DP", () => {
    // Pesanan total 840rb, baru dibayar tunai 175rb + transfer 527.500.
    const r = hitungRingkasanKeuangan(
      [t(840000, "transfer", [p(175000, "tunai"), p(527500, "transfer")])],
      [],
    );
    expect(r.omzet).toBe(840000);
    expect(r.uangMasuk).toBe(702500);
    expect(r.tunai).toBe(175000);
    expect(r.transfer).toBe(527500);
  });

  it("F2: angka trial butik 21 Nov 2026 — omzet 5.840.000, uang masuk 5.702.500, tunai 2.735.000", () => {
    const r = hitungRingkasanKeuangan(
      [
        t(5000000, "transfer", [p(2560000, "tunai"), p(2440000, "transfer")]),
        t(840000, "transfer", [p(175000, "tunai"), p(527500, "transfer")]),
      ],
      [],
    );
    expect(r.omzet).toBe(5840000);
    expect(r.uangMasuk).toBe(5702500);
    expect(r.tunai).toBe(2735000);
    expect(r.transfer).toBe(2967500);
  });

  it("F2: angka trial bazar 2 — tunai benar 1.445.000, bukan 1.745.000 versi lama", () => {
    // Pesanan total 600rb jenisBayar tunai tapi dibayar tunai 300rb + transfer 300rb:
    // cara lama membebankan penuh 600rb ke tunai.
    const r = hitungRingkasanKeuangan(
      [
        t(4090000, "transfer", [p(1145000, "tunai"), p(2507500, "transfer")]),
        t(600000, "tunai", [p(300000, "tunai"), p(300000, "transfer")]),
      ],
      [],
    );
    expect(r.omzet).toBe(4690000);
    expect(r.uangMasuk).toBe(4252500);
    expect(r.tunai).toBe(1445000);
    expect(r.transfer).toBe(2807500);
  });
});

describe("F8/BU-63: pengembalian DP pesanan yang dibatalkan", () => {
  // Baris pembayaran dengan waktu bebas (untuk uji hitungan harian).
  const pw = (nominal: number, metode: PembayaranRingkas["metode"], waktu: string): PembayaranRingkas => ({
    nominal,
    metode,
    waktu,
  });

  it("pesanan batal dengan DP yang dikembalikan: uang masuk net 0, omzet tidak masuk, pengembalian tercatat", () => {
    // Pesanan jahit total 350rb, DP tunai 150rb, lalu dibatalkan + DP dikembalikan.
    const r = hitungRingkasanKeuangan(
      [t(350000, "tunai", [p(150000, "tunai"), p(-150000, "tunai")], true)],
      [],
    );
    expect(r.jumlahTransaksi).toBe(0);
    expect(r.omzet).toBe(0);
    expect(r.uangMasuk).toBe(0);
    expect(r.tunai).toBe(0);
    expect(r.pengembalian).toBe(150000);
  });

  it("pesanan batal: DP tunai + pelunasan transfer dikembalikan per metode", () => {
    // Total 350rb: DP tunai 175rb + pelunasan transfer 175rb, keduanya dikembalikan.
    const r = hitungRingkasanKeuangan(
      [
        t(
          350000,
          "transfer",
          [p(175000, "tunai"), p(175000, "transfer"), p(-175000, "tunai"), p(-175000, "transfer")],
          true,
        ),
      ],
      [],
    );
    expect(r.uangMasuk).toBe(0);
    expect(r.tunai).toBe(0);
    expect(r.transfer).toBe(0);
    expect(r.pengembalian).toBe(350000);
  });

  it("pesanan batal TANPA baris pengembalian (data lama sebelum BU-63) tetap tidak dihitung", () => {
    // Nasib DP tidak diketahui — tetap dikecualikan seperti sebelum F8.
    const r = hitungRingkasanKeuangan([t(350000, "tunai", [p(150000, "tunai")], true)], []);
    expect(r.uangMasuk).toBe(0);
    expect(r.pengembalian).toBe(0);
  });

  it("harian: DP masuk di hari pesanan, pengembalian muncul di hari pembatalan", () => {
    // Pesanan 10 Nov, DP tunai 200rb tanggal 10 Nov; dibatalkan 11 Nov, DP dikembalikan 11 Nov.
    const batal = t(
      500000,
      "tunai",
      [pw(200000, "tunai", "2026-11-10T10:00:00.000Z"), pw(-200000, "tunai", "2026-11-11T09:00:00.000Z")],
      true,
      "2026-11-10T10:00:00.000Z",
    );
    const hariPesan = hitungRingkasanKeuangan([batal], [], "2026-11-10");
    expect(hariPesan.uangMasuk).toBe(200000);
    expect(hariPesan.tunai).toBe(200000);
    expect(hariPesan.pengembalian).toBe(0);
    const hariBatal = hitungRingkasanKeuangan([batal], [], "2026-11-11");
    expect(hariBatal.uangMasuk).toBe(-200000);
    expect(hariBatal.tunai).toBe(-200000);
    expect(hariBatal.pengembalian).toBe(200000);
    const total = hitungRingkasanKeuangan([batal], []);
    expect(total.uangMasuk).toBe(0);
    expect(total.pengembalian).toBe(200000);
  });

  it("harian: DP dan pelunasan beda hari dihitung di harinya masing-masing", () => {
    // Pesanan aktif: DP tunai 175rb tanggal 10 Nov, pelunasan transfer 175rb tanggal 12 Nov.
    const aktif = t(
      350000,
      "transfer",
      [pw(175000, "tunai", "2026-11-10T10:00:00.000Z"), pw(175000, "transfer", "2026-11-12T10:00:00.000Z")],
      false,
      "2026-11-10T10:00:00.000Z",
    );
    expect(hitungRingkasanKeuangan([aktif], [], "2026-11-10").uangMasuk).toBe(175000);
    expect(hitungRingkasanKeuangan([aktif], [], "2026-11-12").uangMasuk).toBe(175000);
    expect(hitungRingkasanKeuangan([aktif], []).uangMasuk).toBe(350000);
  });
});

describe("(b, tes klik 22 Nov 2026): pengembalian dipisah DP jahit vs penjualan batal", () => {
  it("pesanan jahit batal → pengembalianDp; penjualan batal → pengembalianBatal; jumlahnya tetap pengembalian", () => {
    // Skenario tes klik: penjualan batal KYS-0002 Rp180.000 (tanpa DP) +
    // pengembalian DP Sari Rp150.000 — dulu tercampur jadi satu baris
    // "Pengembalian DP −Rp330.000".
    const jahitBatal: TransaksiRingkas = {
      total: 400000,
      jenisBayar: "tunai",
      dibatalkan: true,
      waktu: "2026-11-22T10:00:00.000Z",
      jenisDokumen: "jasa",
      pembayaran: [
        { nominal: 150000, metode: "tunai", waktu: "2026-11-22T10:00:00.000Z" },
        { nominal: -150000, metode: "tunai", waktu: "2026-11-22T11:00:00.000Z" },
      ],
    };
    const jualBatal: TransaksiRingkas = {
      total: 180000,
      jenisBayar: "tunai",
      dibatalkan: true,
      waktu: "2026-11-22T10:00:00.000Z",
      jenisDokumen: "penjualan",
      pembayaran: [
        { nominal: 180000, metode: "tunai", waktu: "2026-11-22T10:00:00.000Z" },
        { nominal: -180000, metode: "tunai", waktu: "2026-11-22T11:00:00.000Z" },
      ],
    };
    const r = hitungRingkasanKeuangan([jahitBatal, jualBatal], [], "2026-11-22");
    expect(r.pengembalian).toBe(330000);
    expect(r.pengembalianDp).toBe(150000);
    expect(r.pengembalianBatal).toBe(180000);
    expect(r.pengembalianDp + r.pengembalianBatal).toBe(r.pengembalian);
    // Uang masuk bersih tetap 0 (diterima lalu dikembalikan).
    expect(r.uangMasuk).toBe(0);
  });

  it("tanpa jenisDokumen (pemanggil lama), pengembalian masuk pengembalianBatal supaya total tetap benar", () => {
    const r = hitungRingkasanKeuangan(
      [t(350000, "tunai", [p(150000, "tunai"), p(-150000, "tunai")], true)],
      [],
    );
    expect(r.pengembalian).toBe(150000);
    expect(r.pengembalianDp).toBe(0);
    expect(r.pengembalianBatal).toBe(150000);
  });
});

describe("filter harian", () => {
  it("transaksiPadaHari hanya hari tersebut", () => {
    const daftar = [
      t(1, "tunai", undefined, false, "2026-11-10T08:00:00.000Z"),
      t(2, "tunai", undefined, false, "2026-11-11T08:00:00.000Z"),
    ];
    expect(transaksiPadaHari(daftar, "2026-11-10")).toHaveLength(1);
  });

  it("biayaPadaHari hanya tanggal tersebut", () => {
    const daftar = [b(1000, "sewa_booth", "2026-11-10"), b(2000, "transport", "2026-11-11")];
    expect(biayaPadaHari(daftar, "2026-11-11")).toEqual([daftar[1]]);
  });
});

describe("hitungUlangSisa", () => {
  const baris = (nama: string, tercatat: number, fisik: number) => ({ produkId: nama, nama, tercatat, fisik });

  it("fisik sama dengan tercatat → selisih 0", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 9)]);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.baris[0]).toMatchObject({ selisih: 0, dikembalikan: 9 });
    expect(h.adaSelisih).toBe(false);
    expect(pesanSelisih(h.baris)).toBeNull();
  });

  it("fisik lebih sedikit → selisih negatif (barang kurang)", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 7)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]).toMatchObject({ selisih: -2, dikembalikan: 7 });
    expect(h.adaSelisih).toBe(true);
  });

  it("fisik lebih banyak → selisih positif (barang lebih)", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 11)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]).toMatchObject({ selisih: 2, dikembalikan: 11 });
  });

  it("yang dikembalikan ke gudang = angka FISIK, bukan tercatat", () => {
    const h = hitungUlangSisa([baris("Blus", 9, 7)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]?.dikembalikan).toBe(7);
  });

  it("menolak fisik negatif", () => {
    expect(hitungUlangSisa([baris("Blus", 9, -1)])).toEqual({
      ok: false,
      pesan: "Perbaiki: hitungan Blus harus angka 0 atau lebih.",
    });
  });

  it("menolak fisik pecahan", () => {
    expect(hitungUlangSisa([baris("Blus", 9, 1.5)]).ok).toBe(false);
  });

  it("pesan peringatan menyebut jumlah barang selisih", () => {
    const h = hitungUlangSisa([baris("A", 5, 4), baris("B", 3, 3), baris("C", 2, 5)]);
    if (!h.ok) throw new Error("gagal");
    expect(pesanSelisih(h.baris)).toBe("2 barang selisih. Periksa lagi sebelum menutup.");
  });

  it("total selisih memakai nilai absolut", () => {
    const h = hitungUlangSisa([baris("A", 5, 4), baris("B", 3, 5)]);
    if (!h.ok) throw new Error("gagal");
    expect(h.baris[0]?.selisih).toBe(-1);
    expect(h.baris[1]?.selisih).toBe(2);
    expect(h.totalSelisih).toBe(3);
  });
});
