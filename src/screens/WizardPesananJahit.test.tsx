/**
 * Tes mode input pesanan jahit (BU-22): wizard langkah-demi-langkah dan
 * satu layar sekaligus, bisa diganti-ganti tanpa menghapus isian.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WizardPesananJahit from "./WizardPesananJahit.tsx";
import { KUNCI_MODE_INPUT } from "../lib/modeInput.ts";

function buka(props: { onSimpan?: (r: unknown) => void } = {}) {
  return render(
    <WizardPesananJahit
      sibuk={false}
      pesanGalat={null}
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

describe("mode wizard (bawaan)", () => {
  it("menampilkan langkah 1 saja, dengan tombol ganti ke 1 layar", () => {
    buka();
    expect(screen.getByText("Langkah 1 dari 4")).toBeTruthy();
    expect(screen.getByText("Siapa yang memesan?")).toBeTruthy();
    expect(screen.queryByText("Jahit apa?")).toBeNull();
    expect(screen.getByRole("button", { name: "Ubah ke 1 layar" })).toBeTruthy();
  });
});

describe("mode satu layar", () => {
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
    expect(rencana.items).toEqual([{ nama: "Gaun pesta", harga: 300000, kuantitas: 1 }]);
  });
});
