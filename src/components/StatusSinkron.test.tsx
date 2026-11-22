/**
 * Tes StatusSinkron (e, tes klik 22 Nov 2026): sync berjalan otomatis —
 * saat Beranda dibuka DAN berkala tiap 60 detik, tanpa perlu membuka ulang
 * Beranda atau menekan apa pun.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { act, cleanup, render } from "@testing-library/react";
import { resetKoneksiDB } from "../db/schema.ts";

const { jumlahAntreanMock, sinkronkanMock } = vi.hoisted(() => ({
  jumlahAntreanMock: vi.fn(),
  sinkronkanMock: vi.fn(),
}));
vi.mock("../sync/mesin.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sync/mesin.ts")>();
  return { ...actual, jumlahAntrean: jumlahAntreanMock, sinkronkan: sinkronkanMock };
});

const hasilSiap = {
  status: "siap" as const,
  antrean: 0,
  terakhirBerhasil: "2026-11-22T03:00:00.000Z",
  terakhirTarik: null,
  ditarik: { transaksiBaru: 0, transaksiDigabung: 0, produk: 0, bazar: 0, biayaBazar: 0, pin: 0 },
  konflik: 0,
  pesan: null,
};

describe("StatusSinkron — sync otomatis berkala (e)", () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    resetKoneksiDB();
    vi.useFakeTimers();
    vi.stubEnv("VITE_SYNC_URL", "https://contoh.test/api/sync");
    vi.stubEnv("VITE_SYNC_TOKEN", "token-uji");
    jumlahAntreanMock.mockResolvedValue(0);
    sinkronkanMock.mockResolvedValue(hasilSiap);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sync jalan saat dipasang, lalu ulang tiap 60 detik tanpa buka ulang", async () => {
    const { default: StatusSinkron } = await import("./StatusSinkron.tsx");
    render(<StatusSinkron />);
    // Putaran pertama saat komponen dipasang.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sinkronkanMock).toHaveBeenCalledTimes(1);
    // Data baru yang masuk antrean sesudah putaran "siap" tetap terkirim
    // sendiri — dulu harus menunggu Beranda dibuka ulang.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(sinkronkanMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(sinkronkanMock).toHaveBeenCalledTimes(3);
  });
});
