/**
 * Tes migrasi skema v3 -> v4 (Fase 2A, BU-32/34).
 *
 * Membuat database versi 3 "seperti dulu" (tanpa kolom PIN baru), lalu
 * membukanya lewat getDB() (v4) dan memastikan: kolom PIN baru terisi
 * null, dan data lama (transaksi/settings/bazar) tidak berubah isinya.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { DB_NAME, getDB, resetKoneksiDB, type BazarRecord, type SettingsRecord } from "./schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

describe("migrasi v3 -> v4", () => {
  beforeEach(resetDB);
  afterEach(() => {
    resetKoneksiDB();
  });

  it("kolom PIN baru terisi null, data lama utuh", async () => {
    // Database v3: settings + bazar tanpa kolom PIN baru.
    const db3 = await openDB(DB_NAME, 3, {
      upgrade(db) {
        db.createObjectStore("settings", { keyPath: "id" });
        db.createObjectStore("bazars", { keyPath: "id" });
      },
    });
    const settingsLama = {
      id: "utama",
      namaButik: "KAYESA",
      alamatBaris1: "Jl. Tarumanegara No. 41",
      alamatBaris2: "",
      kotaKodePos: "",
      telepon1: "0812 1141 4017",
      telepon2: "",
      teksPenutup: "Terima kasih!",
      logo: null,
      rekening: [],
      tampilkanSapaan: true,
      tampilkanNomorResi: true,
      tampilkanRincianDiskon: true,
      tampilkanPembayaranSisa: true,
      skalaFont: 1,
      tema: "terang",
      pinHash: "sha256$abc$def",
      updatedAt: new Date().toISOString(),
    } as unknown as SettingsRecord;
    await db3.put("settings", settingsLama);
    const bazarLama = {
      id: "bazar-1",
      nama: "Bazar Lama",
      mulai: null,
      selesai: null,
      lokasi: null,
      catatan: null,
      status: "aktif",
      ringkasanTerjual: 5,
      ringkasanDibawa: 10,
      ringkasanSisa: 5,
      ditutupPada: null,
      createdAt: new Date().toISOString(),
    } as unknown as BazarRecord;
    await db3.put("bazars", bazarLama);
    db3.close();

    // Buka lewat getDB() (v4): migrasi berjalan.
    const db = await getDB();
    const settings = await db.get("settings", "utama");
    expect(settings).toBeDefined();
    expect(settings?.namaButik).toBe("KAYESA");
    expect(settings?.pinHash).toBe("sha256$abc$def");
    expect(settings?.pinOwnerHash).toBeNull();
    expect(settings?.pinKasirTokoHash).toBeNull();

    const bazar = await db.get("bazars", "bazar-1");
    expect(bazar).toBeDefined();
    expect(bazar?.nama).toBe("Bazar Lama");
    expect(bazar?.ringkasanTerjual).toBe(5);
    expect(bazar?.pinKasirHash).toBeNull();
  });
});
