/**
 * Tes layar reset PIN oleh owner (BU-65).
 *
 * Yang dikunci:
 *  - Daftar peran tampil dengan status PIN-nya; peran yang PIN-nya belum
 *    diatur tidak bisa di-reset (tombol nonaktif).
 *  - Reset memakai konfirmasi dua langkah di dalam aplikasi (bukan
 *    window.confirm); "Batal" membatalkan tanpa memanggil onReset.
 *  - "Ya, Hapus PIN" memanggil onReset dengan peran yang benar dan
 *    menampilkan pesan sukses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ResetPinOwner from "./ResetPinOwner.tsx";
import { getDB, resetKoneksiDB } from "../db/schema.ts";
import { SETTINGS_KOSONG, simpanSettings, type SettingsRecord } from "../db/repositori.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

describe("ResetPinOwner", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("menampilkan daftar peran dengan status PIN dan reset dua langkah", async () => {
    const settings: SettingsRecord = { ...SETTINGS_KOSONG, pinHash: "sha256$salt$admin", pinKasirTokoHash: null };
    // Status PIN dibaca segar dari DB (F3(b)) — tanam dulu di DB.
    await simpanSettings(settings);
    const onReset = vi.fn(async () => {});
    render(<ResetPinOwner settings={settings} onReset={onReset} onKembali={() => {}} />);

    expect(await screen.findByText("PIN Admin")).toBeDefined();
    expect(screen.getByText("PIN Kasir Toko")).toBeDefined();

    // PIN kasir toko belum diatur: tombolnya nonaktif.
    const tombol = screen.getAllByRole("button", { name: "Reset PIN" }) as HTMLButtonElement[];
    expect(tombol).toHaveLength(2);
    expect(tombol[1]!.disabled).toBe(true);
    expect(tombol[0]!.disabled).toBe(false);

    // Klik reset admin → panel konfirmasi muncul; batal dulu.
    fireEvent.click(tombol[0]!);
    expect(await screen.findByText(/Hapus PIN Admin\?/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(onReset).not.toHaveBeenCalled();

    // Klik lagi lalu konfirmasi.
    fireEvent.click(tombol[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Ya, Hapus PIN" }));
    expect(await screen.findByText("PIN Admin sudah dihapus. Pemilik peran itu harus mengatur PIN baru.")).toBeDefined();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledWith("admin");
  });

  it("menampilkan PIN kasir bazar aktif di daftar", async () => {
    const sekarang = new Date().toISOString();
    const db = await getDB();
    await db.put("bazars", {
      id: "bazar-1",
      nama: "Bazar Uji",
      status: "aktif",
      lokasi: "Plaza",
      mulai: "2026-11-22",
      selesai: "2026-11-24",
      catatan: null,
      pinKasirHash: "sha256$salt$bazar",
      ringkasanTerjual: null,
      ringkasanDibawa: null,
      ringkasanSisa: null,
      ditutupPada: null,
      createdAt: sekarang,
      updatedAt: sekarang,
    });
    render(<ResetPinOwner settings={SETTINGS_KOSONG} onReset={vi.fn(async () => {})} onKembali={() => {}} />);
    expect(await screen.findByText("PIN Kasir Bazar: Bazar Uji")).toBeDefined();
  });

  it("F3(b): prop settings yang basi kalah dengan bacaan segar dari DB", async () => {
    // Prop bilang PIN admin belum diatur (basi), tapi DB sudah punya PIN.
    await simpanSettings({ ...SETTINGS_KOSONG, pinHash: "sha256$salt$admin" });
    render(
      <ResetPinOwner
        settings={SETTINGS_KOSONG}
        onReset={vi.fn(async () => {})}
        onKembali={() => {}}
      />,
    );
    expect(await screen.findByText("PIN Admin")).toBeDefined();
    // Status dari DB: PIN diatur, tombol Reset aktif.
    const tombol = screen.getAllByRole("button", { name: "Reset PIN" }) as HTMLButtonElement[];
    expect(tombol[0]!.disabled).toBe(false);
    expect(screen.getByText("PIN diatur")).toBeDefined();
  });
});
