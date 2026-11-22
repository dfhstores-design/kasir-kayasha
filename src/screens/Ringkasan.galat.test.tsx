/**
 * Tes panel galat muat Ringkasan (F7, tes klik 22 Nov 2026): bila baca
 * IndexedDB gagal, layar harus menampilkan "Ringkasan tidak bisa dimuat."
 * + tombol "Coba lagi" — BUKAN panel "Belum ada data ringkasan." dengan
 * angka nol, seolah tidak ada transaksi.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("../db/repositori.ts", async (importOriginal) => {
  const asli = await importOriginal<typeof import("../db/repositori.ts")>();
  return {
    ...asli,
    daftarTransaksi: vi.fn().mockRejectedValue(new Error("IndexedDB gagal dibaca")),
  };
});

import Ringkasan from "./Ringkasan.tsx";
import { resetKoneksiDB } from "../db/schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

describe("Ringkasan — galat muat (F7)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("muat gagal → panel galat + 'Coba lagi', bukan 'Belum ada data'", async () => {
    render(<Ringkasan bazar={null} />);
    expect(await screen.findByText("Ringkasan tidak bisa dimuat.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(screen.queryByText("Belum ada data ringkasan.")).toBeNull();
  });
});
