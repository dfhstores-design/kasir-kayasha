/**
 * Tes layar "Lupa PIN" (BU-65).
 *
 * Yang dikunci:
 *  - Kode kurang dari 6 angka: tombol belum bisa ditekan.
 *  - Kode salah: pesan galat dari hub tampil, tidak lanjut.
 *  - Kode benar: panel sukses tampil; tombol "Atur PIN Baru" memanggil onBerhasil.
 *  - Tidak ada internet: pesan dari verifikasi tampil apa adanya.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LupaPin, { type HasilVerifikasi } from "./LupaPin.tsx";

function renderLayar(verifikasi: (kode: string) => Promise<HasilVerifikasi>) {
  const onBerhasil = vi.fn();
  const onBatal = vi.fn();
  render(
    <LupaPin peranLabel="admin" onVerifikasi={verifikasi} onBerhasil={onBerhasil} onBatal={onBatal} />,
  );
  return { onBerhasil, onBatal };
}

describe("LupaPin", () => {
  afterEach(cleanup);

  it("tombol belum aktif sebelum 6 angka dimasukkan", () => {
    renderLayar(async () => ({ ok: true }));
    const tombol = screen.getByRole("button", { name: "Periksa Kode" }) as HTMLButtonElement;
    expect(tombol.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Kode reset dari Andri"), { target: { value: "12345" } });
    expect(tombol.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Kode reset dari Andri"), { target: { value: "123456" } });
    expect(tombol.disabled).toBe(false);
  });

  it("kode salah menampilkan pesan galat dan tetap di layar", async () => {
    renderLayar(async () => ({ ok: false, pesan: "Kode salah. Sisa percobaan: 4." }));
    fireEvent.change(screen.getByLabelText("Kode reset dari Andri"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Periksa Kode" }));
    expect(await screen.findByText("Kode salah. Sisa percobaan: 4.")).toBeDefined();
    expect(screen.queryByText("PIN admin sudah dihapus.")).toBeNull();
  });

  it("kode benar menampilkan panel sukses dan tombol atur PIN baru", async () => {
    const { onBerhasil } = renderLayar(async () => ({ ok: true }));
    fireEvent.change(screen.getByLabelText("Kode reset dari Andri"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Periksa Kode" }));
    expect(await screen.findByText("PIN admin sudah dihapus.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Atur PIN Baru" }));
    expect(onBerhasil).toHaveBeenCalledTimes(1);
  });

  it("menampilkan petunjuk minta kode ke Andri dan batas internet", () => {
    renderLayar(async () => ({ ok: true }));
    expect(screen.getByText(/Minta kode reset ke Andri lewat WA/)).toBeDefined();
    expect(screen.getByText(/Reset ini butuh internet/)).toBeDefined();
  });
});
