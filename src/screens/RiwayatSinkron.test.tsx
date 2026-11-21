/**
 * Tes layar Riwayat Sinkronisasi (Fase 2B, BU-33).
 *
 * Yang dikunci:
 *  - Antrean yang belum terkirim tampil dengan nomor resi & nama pemesan.
 *  - Catatan sinkronisasi hanya tampil untuk owner, tidak untuk kasir/admin.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";
import RiwayatSinkron from "./RiwayatSinkron.tsx";
import { getDB, resetKoneksiDB } from "../db/schema.ts";
import { tandaiUntukSync } from "../sync/mesin.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

async function seedAntrean() {
  const db = await getDB();
  await db.put("transactions", {
    id: "tx-1",
    nomorResi: "KC.00001-20261110",
    nomorUrutHari: 1,
    waktu: "2026-11-10T08:00:00.000Z",
    jenis: "po",
    jenisDokumen: "jasa",
    arahStok: "tidak_ada",
    pelangganId: null,
    statusPesanan: "diproses",
    bazarId: null,
    namaPemesan: "Sari",
    kontak: null,
    perkiraanSiap: null,
    alamat: null,
    catatanPesanan: null,
    riwayatTotal: [],
    ongkirMode: "ambil_sendiri",
    ongkirNominal: 0,
    subtotalAwal: 850000,
    diskonItem: 0,
    diskonTotal: 0,
    total: 850000,
    sapaan: "Pagi",
    rekeningSnapshot: [],
    jenisBayar: null,
    statusBayar: "belum_dibayar",
    dibatalkanPada: null,
    createdAt: "2026-11-10T08:00:00.000Z",
    updatedAt: "2026-11-10T08:00:00.000Z",
  });
  await tandaiUntukSync("transaksi", "tx-1");
}

describe("RiwayatSinkron", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("menampilkan antrean belum terkirim dengan nomor resi", async () => {
    await seedAntrean();
    render(<RiwayatSinkron peran="admin" />);
    expect(await screen.findByText(/KC\.00001-20261110/)).toBeTruthy();
    expect(await screen.findByText(/Sari/)).toBeTruthy();
    expect(await screen.findByText("Belum terkirim, tersimpan di HP dulu.")).toBeTruthy();
  });

  it("tanpa antrean menampilkan 'Semua sudah terkirim.'", async () => {
    render(<RiwayatSinkron peran="admin" />);
    expect(await screen.findByText("Semua sudah terkirim.")).toBeTruthy();
  });

  it("catatan sinkronisasi hanya tampil untuk owner", async () => {
    const db = await getDB();
    await db.put("logSinkron", {
      id: "log-1",
      waktu: "2026-11-10T09:00:00.000Z",
      jenis: "konflik",
      judul: 'Barang "Kebaya" diubah di dua tempat',
      rincian: "Dipakai yang terbaru.",
      perangkat: null,
    });
    render(<RiwayatSinkron peran="owner" />);
    expect(await screen.findByText(/diubah di dua tempat/)).toBeTruthy();
  });

  it("catatan sinkronisasi tidak tampil untuk admin", async () => {
    const db = await getDB();
    await db.put("logSinkron", {
      id: "log-1",
      waktu: "2026-11-10T09:00:00.000Z",
      jenis: "konflik",
      judul: 'Barang "Kebaya" diubah di dua tempat',
      rincian: "Dipakai yang terbaru.",
      perangkat: null,
    });
    render(<RiwayatSinkron peran="admin" />);
    await screen.findByText("Semua sudah terkirim.");
    expect(screen.queryByText(/diubah di dua tempat/)).toBeNull();
    expect(screen.queryByText("Catatan sinkronisasi")).toBeNull();
  });
});
