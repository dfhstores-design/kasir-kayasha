import { describe, expect, it } from "vitest";
import {
  alamatWajib,
  cariPesanan,
  formatCatatanPerubahanTotal,
  hitungIsiOngkir,
  hitungPembayaranBaru,
  kelompokkanPesanan,
  labelStatusPesanan,
  periksaRencanaPO,
  pesanKonfirmasiBatal,
  masihBisaDitagih,
  totalSisaPO,
  transisiSah,
  type ItemPO,
  type RencanaPO,
  type RingkasanPesanan,
} from "./pesanan.ts";

const item = (harga: number, qty: number, diskon = 0, nama = "Gamis"): ItemPO => ({
  produkId: nama,
  nama,
  hargaSatuan: harga,
  kuantitas: qty,
  diskonPerUnit: diskon,
});

const rencana = (over: Partial<RencanaPO> = {}): RencanaPO => ({
  items: [item(450000, 1)],
  diskonTotal: 0,
  ongkir: { mode: "ambil_sendiri", nominal: 0 },
  namaPemesan: "Ibu Sari",
  kontak: null,
  perkiraanSiap: null,
  alamat: null,
  catatan: null,
  dibayarSekarang: 0,
  jenisBayar: "transfer",
  bazarId: null,
  ...over,
});

describe("periksaRencanaPO", () => {
  it("menolak tanpa barang", () => {
    expect(periksaRencanaPO(rencana({ items: [] }))).toEqual({ ok: false, pesan: "Pilih barang dulu." });
  });

  it("menolak tanpa nama pemesan", () => {
    expect(periksaRencanaPO(rencana({ namaPemesan: " " }))).toEqual({ ok: false, pesan: "Isi nama pemesan." });
  });

  it("tanpa DP → belum dibayar", () => {
    const h = periksaRencanaPO(rencana());
    expect(h).toMatchObject({ ok: true, total: 450000, sudahDibayar: 0, sisa: 450000, status: "belum_dibayar" });
  });

  it("dengan DP → status dp dan sisa benar", () => {
    const h = periksaRencanaPO(rencana({ dibayarSekarang: 150000 }));
    expect(h).toMatchObject({ ok: true, sudahDibayar: 150000, sisa: 300000, status: "dp" });
  });

  it("DP penuh → lunas", () => {
    const h = periksaRencanaPO(rencana({ dibayarSekarang: 450000 }));
    expect(h).toMatchObject({ ok: true, sisa: 0, status: "lunas" });
  });

  it("menolak DP melebihi total", () => {
    expect(periksaRencanaPO(rencana({ dibayarSekarang: 500000 }))).toEqual({
      ok: false,
      pesan: "DP tidak boleh melebihi total.",
    });
  });

  it("menolak DP negatif", () => {
    expect(periksaRencanaPO(rencana({ dibayarSekarang: -1 })).ok).toBe(false);
  });

  it("ongkir butik masuk total PO", () => {
    const h = periksaRencanaPO(rencana({ ongkir: { mode: "butik", nominal: 25000 } }));
    expect(h.ok && h.total).toBe(475000);
  });

  it("ongkir ke kurir TIDAK masuk total", () => {
    const h = periksaRencanaPO(rencana({ ongkir: { mode: "kurir", nominal: 0 } }));
    expect(h.ok && h.total).toBe(450000);
  });

  it("menolak diskon melebihi harga", () => {
    const h = periksaRencanaPO(rencana({ items: [item(100000, 1, 150000)] }));
    expect(h.ok).toBe(false);
  });
});

describe("alamatWajib", () => {
  it("wajib bila dikirim (butik/kurir)", () => {
    expect(alamatWajib({ mode: "butik", nominal: 0 })).toBe(true);
    expect(alamatWajib({ mode: "kurir", nominal: 0 })).toBe(true);
  });

  it("tidak wajib bila ambil sendiri atau belum ditentukan", () => {
    expect(alamatWajib({ mode: "ambil_sendiri", nominal: 0 })).toBe(false);
    expect(alamatWajib({ mode: "belum_ditentukan", nominal: null })).toBe(false);
  });
});

describe("hitungPembayaranBaru", () => {
  it("pelunasan sebagian menambah sudah dibayar", () => {
    const h = hitungPembayaranBaru(450000, [150000], 100000);
    expect(h).toMatchObject({ ok: true, sudahDibayar: 250000, sisa: 200000, status: "dp" });
  });

  it("pelunasan penuh menjadi lunas", () => {
    const h = hitungPembayaranBaru(450000, [150000], 300000);
    expect(h).toMatchObject({ ok: true, sisa: 0, status: "lunas" });
  });

  it("menolak melebihi sisa dengan pesan jelas", () => {
    const h = hitungPembayaranBaru(450000, [150000], 300001);
    expect(h).toEqual({ ok: false, pesan: "Nominal melebihi sisa tagihan Rp 300.000." });
  });

  it("menolak nominal 0", () => {
    expect(hitungPembayaranBaru(450000, [], 0)).toEqual({ ok: false, pesan: "Nominal harus lebih dari 0." });
  });
});

describe("hitungIsiOngkir (ongkir menyusul)", () => {
  const dasar = {
    subtotalAwal: 450000,
    diskonItem: 0,
    diskonTotal: 0,
    totalSekarang: 450000,
    pembayaran: [] as number[],
    statusSekarang: "belum_dibayar" as const,
  };

  it("total bertambah sesuai ongkir dan catatan riwayat dibuat", () => {
    const h = hitungIsiOngkir({ ...dasar, ongkirBaru: { mode: "butik", nominal: 25000 } }, "2026-11-12T09:00:00.000Z");
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.totalBaru).toBe(475000);
    expect(h.catatan).toMatchObject({ totalLama: 450000, totalBaru: 475000 });
    expect(formatCatatanPerubahanTotal(h.catatan)).toContain("Rp 450.000 → Rp 475.000");
  });

  it("LUNAS berubah menjadi DP saat ongkir ditambahkan", () => {
    const h = hitungIsiOngkir(
      { ...dasar, pembayaran: [450000], statusSekarang: "lunas", ongkirBaru: { mode: "butik", nominal: 25000 } },
      "2026-11-12T09:00:00.000Z",
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.statusBerubah).toBe(true);
    expect(h.status).toBe("dp");
    expect(h.sisa).toBe(25000);
  });

  it("ongkir ke kurir tidak mengubah total", () => {
    const h = hitungIsiOngkir({ ...dasar, ongkirBaru: { mode: "kurir", nominal: 0 } }, "2026-11-12T09:00:00.000Z");
    expect(h.ok && h.totalBaru).toBe(450000);
    if (h.ok) expect(h.statusBerubah).toBe(false);
  });

  it("menolak bila masih 'belum ditentukan'", () => {
    expect(hitungIsiOngkir({ ...dasar, ongkirBaru: { mode: "belum_ditentukan", nominal: null } }, "x").ok).toBe(false);
  });

  it("menolak bila pembayaran lama melebihi total baru", () => {
    // total turun karena ongkir dikurangi
    const h = hitungIsiOngkir(
      { ...dasar, subtotalAwal: 100000, totalSekarang: 200000, pembayaran: [150000], statusSekarang: "dp", ongkirBaru: { mode: "ambil_sendiri", nominal: 0 } },
      "2026-11-12T09:00:00.000Z",
    );
    expect(h).toEqual({ ok: false, pesan: "Pembayaran yang sudah ada melebihi total baru." });
  });
});

describe("transisiSah", () => {
  it("diproses → siap", () => {
    expect(transisiSah("diproses", "siap")).toBe(true);
  });

  it("siap → selesai", () => {
    expect(transisiSah("siap", "selesai")).toBe(true);
  });

  it("diproses tidak boleh langsung selesai", () => {
    expect(transisiSah("diproses", "selesai")).toBe(false);
  });

  it("batal boleh dari mana saja kecuali yang sudah final", () => {
    expect(transisiSah("diproses", "dibatalkan")).toBe(true);
    expect(transisiSah("siap", "dibatalkan")).toBe(true);
    expect(transisiSah("selesai", "dibatalkan")).toBe(false);
    expect(transisiSah("dibatalkan", "diproses")).toBe(false);
  });

  it("status sama tidak dihitung transisi", () => {
    expect(transisiSah("siap", "siap")).toBe(false);
  });
});

describe("label & pembatalan", () => {
  it("label Bahasa Indonesia", () => {
    expect(labelStatusPesanan("siap")).toBe("Siap diambil atau dikirim");
  });

  it("pesan konfirmasi menyebut pembayaran tetap disimpan", () => {
    expect(pesanKonfirmasiBatal("KYS-PO-0003")).toContain("Riwayat pembayaran tetap disimpan");
  });

  it("PO batal tidak bisa ditagih lagi", () => {
    expect(masihBisaDitagih("dibatalkan")).toBe(false);
    expect(masihBisaDitagih("diproses")).toBe(true);
  });
});

describe("daftar pesanan", () => {
  const p = (over: Partial<RingkasanPesanan>): RingkasanPesanan => ({
    id: "1",
    nomorResi: "KYS-PO-0001",
    namaPemesan: "Ibu Sari",
    waktu: "2026-11-10T10:00:00.000Z",
    total: 450000,
    sudahDibayar: 150000,
    sisa: 300000,
    statusPesanan: "diproses",
    statusBayar: "dp",
    ...over,
  });

  it("mengelompokkan dengan urutan siap → diproses → selesai → dibatalkan", () => {
    const g = kelompokkanPesanan([
      p({ id: "a", statusPesanan: "selesai" }),
      p({ id: "b", statusPesanan: "siap" }),
      p({ id: "c", statusPesanan: "diproses" }),
    ]);
    expect(g.map((x) => x.status)).toEqual(["siap", "diproses", "selesai"]);
  });

  it("kelompok kosong tidak ditampilkan", () => {
    expect(kelompokkanPesanan([p({ statusPesanan: "diproses" })])).toHaveLength(1);
  });

  it("cari berdasarkan nama atau nomor", () => {
    const daftar = [p({ id: "a", namaPemesan: "Ibu Sari" }), p({ id: "b", namaPemesan: "Bu Dewi", nomorResi: "KYS-PO-0009" })];
    expect(cariPesanan(daftar, "sari")).toHaveLength(1);
    expect(cariPesanan(daftar, "0009")).toHaveLength(1);
    expect(cariPesanan(daftar, "")).toHaveLength(2);
  });

  it("total sisa PO mengabaikan yang lunas dan dibatalkan", () => {
    const daftar = [
      p({ id: "a", sisa: 300000 }),
      p({ id: "b", sisa: 0, statusBayar: "lunas" }),
      p({ id: "c", sisa: 100000, statusBayar: "belum_dibayar" }),
      p({ id: "d", sisa: 500000, statusPesanan: "dibatalkan" }),
    ];
    expect(totalSisaPO(daftar)).toBe(400000);
  });
});
