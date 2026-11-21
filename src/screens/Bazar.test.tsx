/**
 * Tes layar Bazar: buka bazar kedua saat satu masih aktif, dan tombol
 * "Buka Toko" yang tampil tapi belum berfungsi (placeholder).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Bazar from "./Bazar.tsx";
import { buatBazar } from "../db/repositori.ts";
import { resetKoneksiDB } from "../db/schema.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

describe("Bazar — multi-bazar & Buka Toko", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("Buka Toko tampil abu-abu dan kliknya menampilkan 'sedang dalam pengembangan'", async () => {
    render(<Bazar onAturBarang={vi.fn()} onTutupBazar={vi.fn()} onUbah={vi.fn()} />);
    const tombol = await screen.findByRole("button", { name: /Buka Toko/ });
    expect(tombol.textContent).toContain("Segera");
    fireEvent.click(tombol);
    expect(await screen.findByText("sedang dalam pengembangan")).toBeTruthy();
  });

  it("bazar kedua bisa dibuka dari UI saat satu masih aktif; yang terbaru jadi bazar penjualan", async () => {
    await buatBazar("Bazar 1", null, null);
    render(<Bazar onAturBarang={vi.fn()} onTutupBazar={vi.fn()} onUbah={vi.fn()} />);

    // Bazar pertama tampil sebagai bazar penjualan.
    expect(await screen.findByText("Bazar 1")).toBeTruthy();
    expect(await screen.findByText("BAZAR PENJUALAN")).toBeTruthy();

    // Tombol Buka Bazar TIDAK nonaktif walau sudah ada yang aktif.
    const buka = screen.getByRole("button", { name: "+ Buka Bazar" });
    expect(buka.hasAttribute("disabled")).toBe(false);
    fireEvent.click(buka);

    fireEvent.change(screen.getByLabelText("Nama bazar"), { target: { value: "Bazar 2" } });
    // Fase 2A (BU-34): buka bazar wajib mengisi PIN kasir bazar itu.
    fireEvent.change(screen.getByLabelText("PIN kasir bazar (4–6 karakter, huruf atau angka)"), { target: { value: "2468" } });
    fireEvent.change(screen.getByLabelText("Ulangi PIN kasir bazar"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    // Bazar terbaru tampil sebagai bazar penjualan; yang lama tetap aktif.
    expect(await screen.findByText("Bazar 2")).toBeTruthy();
    expect(await screen.findByText("Bazar 1")).toBeTruthy();
    expect(screen.getAllByText("BAZAR PENJUALAN")).toHaveLength(1);
    expect(screen.getByText("BAZAR AKTIF")).toBeTruthy();
  });
});

describe("Bazar — form buka bazar meminta waktu + lokasi (Fase 2C, BU-34)", () => {
  beforeEach(resetDB);
  afterEach(cleanup);

  it("lokasi + tanggal mulai/selesai tersimpan dan tampil di kartu bazar", async () => {
    render(<Bazar onAturBarang={vi.fn()} onTutupBazar={vi.fn()} onUbah={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Buka Bazar" }));

    fireEvent.change(screen.getByLabelText("Nama bazar"), { target: { value: "Bazar Senayan" } });
    fireEvent.change(screen.getByLabelText("Lokasi (opsional)"), { target: { value: "Plaza Senayan" } });
    fireEvent.change(screen.getByLabelText("Mulai (opsional)"), { target: { value: "2026-11-21" } });
    fireEvent.change(screen.getByLabelText("Selesai (opsional)"), { target: { value: "2026-11-23" } });
    fireEvent.change(screen.getByLabelText("PIN kasir bazar (4–6 karakter, huruf atau angka)"), { target: { value: "2468" } });
    fireEvent.change(screen.getByLabelText("Ulangi PIN kasir bazar"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Bazar Senayan")).toBeTruthy();
    expect(await screen.findByText(/Plaza Senayan/)).toBeTruthy();
    expect(await screen.findByText(/21 Nov 2026/)).toBeTruthy();
    expect(await screen.findByText(/23 Nov 2026/)).toBeTruthy();

    const daftar = await import("../db/repositori.ts").then((m) => m.daftarBazar());
    expect(daftar[0]?.lokasi).toBe("Plaza Senayan");
    expect(daftar[0]?.mulai).toBe("2026-11-21");
    expect(daftar[0]?.selesai).toBe("2026-11-23");
  });

  it("tanggal selesai sebelum tanggal mulai ditolak", async () => {
    render(<Bazar onAturBarang={vi.fn()} onTutupBazar={vi.fn()} onUbah={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Buka Bazar" }));

    fireEvent.change(screen.getByLabelText("Nama bazar"), { target: { value: "Bazar Senayan" } });
    fireEvent.change(screen.getByLabelText("Mulai (opsional)"), { target: { value: "2026-11-23" } });
    fireEvent.change(screen.getByLabelText("Selesai (opsional)"), { target: { value: "2026-11-21" } });
    fireEvent.change(screen.getByLabelText("PIN kasir bazar (4–6 karakter, huruf atau angka)"), { target: { value: "2468" } });
    fireEvent.change(screen.getByLabelText("Ulangi PIN kasir bazar"), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText(/tanggal selesai tidak boleh sebelum tanggal mulai/i)).toBeTruthy();
    const daftar = await import("../db/repositori.ts").then((m) => m.daftarBazar());
    expect(daftar).toHaveLength(0);
  });
});
