import { describe, expect, it } from "vitest";
import { snapshotNama, snapshotRekening } from "./snapshot.ts";
import type { Rekening } from "../db/schema.ts";

describe("snapshotNama", () => {
  it("menyalin nama (immutabel)", () => {
    expect(snapshotNama("Blus Linen")).toBe("Blus Linen");
  });
});

describe("snapshotRekening", () => {
  it("salinan elemen per elemen — perubahan asli tidak merembes", () => {
    const asli: Rekening[] = [
      { id: "r1", namaBank: "BCA", nomor: "676017885", namaPemilik: "Narsita", utama: true },
    ];
    const salinan = snapshotRekening(asli);

    // mengubah rekening asli TIDAK mengubah snapshot
    asli[0]!.namaBank = "BNI";
    asli[0]!.nomor = "999";

    expect(salinan[0]?.namaBank).toBe("BCA");
    expect(salinan[0]?.nomor).toBe("676017885");
  });

  it("array baru, bukan referensi ke array asli", () => {
    const asli: Rekening[] = [];
    const salinan = snapshotRekening(asli);
    asli.push({ id: "r2", namaBank: "BNI", nomor: "1", namaPemilik: "Siti", utama: false });
    expect(salinan).toHaveLength(0);
  });
});