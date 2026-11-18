/**
 * Tes helper operasi pesanan (pembayaran, ongkir menyusul, transisi status).
 *
 * DULU file ini juga menguji pembuatan PO barang (periksaRencanaPO,
 * kelompokkanPesanan, cariPesanan, totalSisaPO) — dihapus 18 Nov 2026
 * bersama fitur PO barang. Yang tersisa hanya helper generik yang masih
 * dipakai `db/pesananOperasi.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  formatCatatanPerubahanTotal,
  hitungIsiOngkir,
  hitungPembayaranBaru,
  labelStatusPesanan,
  pesanKonfirmasiBatal,
  masihBisaDitagih,
  transisiSah,
} from "./pesanan.ts";

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
    expect(pesanKonfirmasiBatal("KC.1-20261112")).toContain("Riwayat pembayaran tetap disimpan");
  });

  it("pesanan batal tidak bisa ditagih lagi", () => {
    expect(masihBisaDitagih("dibatalkan")).toBe(false);
    expect(masihBisaDitagih("diproses")).toBe(true);
  });
});
