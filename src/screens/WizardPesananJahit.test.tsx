/**
 * Tes mode input pesanan jahit (BU-22): wizard langkah-demi-langkah dan
 * satu layar sekaligus, bisa diganti-ganti tanpa menghapus isian.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resetKoneksiDB, type Rekening } from "../db/schema.ts";
import { simpanPesananJahit } from "../lib/jahitan.ts";
import WizardPesananJahit from "./WizardPesananJahit.tsx";
import { KUNCI_MODE_INPUT } from "../lib/modeInput.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
  try {
    localStorage.clear();
  } catch {
    // lingkungan tanpa localStorage: abaikan
  }
}

const rekening: Rekening = {
  id: "rek-1",
  namaBank: "BCA",
  nomor: "676 017 885",
  namaPemilik: "NARSHITA DEWI",
  utama: true,
};

function buka(props: { onSimpan?: (r: unknown) => void; editId?: string } = {}) {
  return render(
    <WizardPesananJahit
      sibuk={false}
      pesanGalat={null}
      editId={props.editId}
      onSimpan={(rencana) => props.onSimpan?.(rencana)}
      onBatal={vi.fn()}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/");
});

afterEach(cleanup);

describe("mode wizard (lewat param URL)", () => {
  it("?mode=wizard menampilkan langkah 1 saja, dengan tombol ganti ke 1 layar", () => {
    window.history.pushState({}, "", "/?mode=wizard&layar=pesanan-jahit");
    buka();
    expect(screen.getByText("Langkah 1 dari 4")).toBeTruthy();
    expect(screen.getByText("Siapa yang memesan?")).toBeTruthy();
    expect(screen.queryByText("Jahit apa?")).toBeNull();
    expect(screen.getByRole("button", { name: "Ubah ke 1 layar" })).toBeTruthy();
  });
});

describe("mode satu layar (bawaan sejak keputusan Tante 19 Nov 2026)", () => {
  it("tanpa param dan simpanan langsung menampilkan keempat bagian sekaligus", () => {
    buka();
    expect(screen.getByText("Satu layar — semua isian")).toBeTruthy();
    expect(screen.getByText("Siapa yang memesan?")).toBeTruthy();
    expect(screen.getByText("Jahit apa?")).toBeTruthy();
    expect(screen.getByText("Ada biaya lain?")).toBeTruthy();
    expect(screen.getByText("Periksa lagi")).toBeTruthy();
  });
  it("param URL ?mode=satu-layar menampilkan keempat bagian sekaligus", () => {
    window.history.pushState({}, "", "/?mode=satu-layar&layar=pesanan-jahit");
    buka();
    expect(screen.getByText("Satu layar — semua isian")).toBeTruthy();
    expect(screen.getByText("Siapa yang memesan?")).toBeTruthy();
    expect(screen.getByText("Jahit apa?")).toBeTruthy();
    expect(screen.getByText("Ada biaya lain?")).toBeTruthy();
    expect(screen.getByText("Periksa lagi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan Pesanan" })).toBeTruthy();
  });

  it("pilihan tersimpan dipakai bila tidak ada param URL", () => {
    localStorage.setItem(KUNCI_MODE_INPUT, "satu-layar");
    buka();
    expect(screen.getByText("Satu layar — semua isian")).toBeTruthy();
  });

  it("tombol ganti mode bolak-balik tanpa menghapus isian", () => {
    window.history.pushState({}, "", "/?mode=wizard");
    buka();
    fireEvent.change(screen.getByLabelText("Nama pemesan"), { target: { value: "Ibu Sari" } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah ke 1 layar" }));
    expect(screen.getByText("Satu layar — semua isian")).toBeTruthy();
    expect(localStorage.getItem(KUNCI_MODE_INPUT)).toBe("satu-layar");
    // Isian tetap ada setelah ganti mode.
    expect((screen.getByLabelText("Nama pemesan") as HTMLInputElement).value).toBe("Ibu Sari");
    fireEvent.click(screen.getByRole("button", { name: "Ubah ke langkah" }));
    expect(screen.getByText("Langkah 1 dari 4")).toBeTruthy();
    expect((screen.getByLabelText("Nama pemesan") as HTMLInputElement).value).toBe("Ibu Sari");
  });

  it("simpan dari satu layar memanggil onSimpan dengan item yang diisi", () => {
    window.history.pushState({}, "", "/?mode=satu-layar");
    const onSimpan = vi.fn();
    buka({ onSimpan });
    fireEvent.change(screen.getByLabelText("Nama pemesan"), { target: { value: "Ibu Sari" } });
    fireEvent.change(screen.getByLabelText("Nama item"), { target: { value: "Gaun pesta" } });
    fireEvent.change(screen.getByLabelText("Harga"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Pesanan" }));
    expect(onSimpan).toHaveBeenCalledTimes(1);
    const rencana = onSimpan.mock.calls[0]?.[0] as { namaPemesan: string; items: unknown[] };
    expect(rencana.namaPemesan).toBe("Ibu Sari");
    expect(rencana.items).toEqual([{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: null }]);
  });

  it("tiap item punya kolom Ukuran/catatan khusus (BU-56), ikut terkirim saat simpan", () => {
    window.history.pushState({}, "", "/?mode=satu-layar");
    const onSimpan = vi.fn();
    buka({ onSimpan });
    fireEvent.change(screen.getByLabelText("Nama pemesan"), { target: { value: "Ibu Sari" } });
    fireEvent.change(screen.getByLabelText("Nama item"), { target: { value: "Kebaya brokat" } });
    fireEvent.change(screen.getByLabelText("Harga"), { target: { value: "850000" } });
    fireEvent.change(screen.getByLabelText("Ukuran/catatan khusus (opsional)"), { target: { value: "M" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Pesanan" }));
    expect(onSimpan).toHaveBeenCalledTimes(1);
    const rencana = onSimpan.mock.calls[0]?.[0] as { items: unknown[] };
    expect(rencana.items).toEqual([{ nama: "Kebaya brokat", harga: 850000, kuantitas: 1, ukuran: "M" }]);
  });
});

describe("mode ubah pesanan (BU-56)", () => {
  beforeEach(resetDB);

  it("editId mengisi form dari pesanan lama, tombol menjadi Simpan Perubahan", async () => {
    window.history.pushState({}, "", "/?mode=satu-layar");
    const h = await simpanPesananJahit(
      {
        namaPemesan: "Ibu Sari",
        kontak: "0812 0000 0000",
        items: [{ nama: "Gaun pesta", harga: 300000, kuantitas: 1, ukuran: "M" }],
        perkiraanSelesai: "2026-11-23",
        catatan: "tolong cepat",
        biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
      },
      { rekening: [rekening], waktu: new Date("2026-11-16T07:20:00.000Z") },
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    buka({ editId: h.pesanan.id });
    expect(await screen.findByDisplayValue("Ibu Sari")).toBeTruthy();
    expect(await screen.findByDisplayValue("Gaun pesta")).toBeTruthy();
    expect(await screen.findByDisplayValue("M")).toBeTruthy();
    expect(await screen.findByDisplayValue("tolong cepat")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan Perubahan" })).toBeTruthy();
  });
});
