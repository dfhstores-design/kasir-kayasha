/**
 * Tes layar MasukAdmin — gate pemuatan pengaturan (F3/F4, tes klik 22 Nov 2026).
 *
 * Yang dikunci:
 *  - Selama pengaturan belum selesai dimuat (memuat=true), layar TIDAK
 *    boleh menyimpulkan "PIN belum diatur" (masuk gratis) atau "PIN sudah
 *    diatur" (minta PIN). Yang tampil: "Memuat pengaturan…" + "Coba lagi".
 *  - Sesudah dimuat, perilaku lama tetap: tanpa PIN → masuk gratis sekali;
 *    dengan PIN → minta PIN.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MasukAdmin from "./MasukAdmin.tsx";

describe("MasukAdmin — gate pemuatan pengaturan", () => {
  afterEach(cleanup);

  function renderLayar(props: { pinHash: string | null; memuat?: boolean; peran?: "admin" | "owner" }) {
    const onMuatUlang = vi.fn();
    const onMasukAdmin = vi.fn();
    render(
      <MasukAdmin
        peran={props.peran ?? "admin"}
        pinHash={props.pinHash}
        memuat={props.memuat ?? false}
        onMuatUlang={onMuatUlang}
        onMasukAdmin={onMasukAdmin}
        onBatal={() => {}}
        onLupaPin={() => {}}
      />,
    );
    return { onMuatUlang, onMasukAdmin };
  }

  it("selama memuat, tidak ada masuk gratis dan tidak ada kolom PIN", () => {
    renderLayar({ pinHash: null, memuat: true });
    expect(screen.getByText("Memuat pengaturan…")).toBeDefined();
    expect(screen.queryByText(/Buka sebagai admin/i)).toBeNull();
    expect(screen.queryByLabelText("PIN")).toBeNull();
  });

  it("selama memuat walau PIN sudah diatur, kolom PIN tidak tampil dulu", () => {
    renderLayar({ pinHash: "sha256$salt$hash", memuat: true });
    expect(screen.getByText("Memuat pengaturan…")).toBeDefined();
    expect(screen.queryByLabelText("PIN")).toBeNull();
    expect(screen.queryByText(/Lupa PIN/)).toBeNull();
  });

  it("tombol 'Coba lagi' memanggil onMuatUlang", () => {
    const { onMuatUlang } = renderLayar({ pinHash: null, memuat: true });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(onMuatUlang).toHaveBeenCalledTimes(1);
  });

  it("sesudah dimuat tanpa PIN, masuk gratis tetap bisa", () => {
    const { onMasukAdmin } = renderLayar({ pinHash: null, memuat: false });
    fireEvent.click(screen.getByRole("button", { name: /Buka sebagai admin/i }));
    expect(onMasukAdmin).toHaveBeenCalledTimes(1);
  });

  it("sesudah dimuat dengan PIN, kolom PIN tampil", () => {
    renderLayar({ pinHash: "sha256$salt$hash", memuat: false });
    expect(screen.getByLabelText("PIN")).toBeDefined();
    expect(screen.queryByText(/Buka sebagai admin/i)).toBeNull();
  });
});
