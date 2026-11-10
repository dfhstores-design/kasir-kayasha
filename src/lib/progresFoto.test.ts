import { describe, expect, it } from "vitest";
import {
  PROGRES_AWAL,
  persenSelesai,
  progresGagal,
  progresSelesai,
  progresUnggahAwal,
  progresUnggahBerjalan,
  progresUntuk,
  teksAksesibel,
} from "./progresFoto.ts";

describe("persenSelesai", () => {
  it("naik bertahap dan tidak melewati 100", () => {
    expect(persenSelesai("baca")).toBe(0);
    expect(persenSelesai("kecilkan")).toBe(15);
    expect(persenSelesai("kompres")).toBe(40);
    expect(persenSelesai("simpan")).toBe(85);
    expect(persenSelesai("selesai")).toBe(100);
  });
});

describe("progresUntuk", () => {
  it("tahap pertama = membaca foto", () => {
    const p = progresUntuk([]);
    expect(p.tahap).toBe("baca");
    expect(p.status).toBe("berjalan");
    expect(p.persen).toBe(0);
  });

  it("berpindah tahap setelah tahap sebelumnya selesai", () => {
    expect(progresUntuk(["baca"]).tahap).toBe("kecilkan");
    expect(progresUntuk(["baca", "kecilkan"]).tahap).toBe("kompres");
    expect(progresUntuk(["baca", "kecilkan", "kompres"]).tahap).toBe("simpan");
  });

  it("selesai bila tahap 'selesai' ada", () => {
    const p = progresUntuk(["baca", "kecilkan", "kompres", "simpan", "selesai"]);
    expect(p.status).toBe("selesai");
    expect(p.persen).toBe(100);
  });

  it("persen tidak pernah 100 sebelum benar-benar selesai", () => {
    expect(progresUntuk(["baca", "kecilkan", "kompres"]).persen).toBeLessThan(100);
    expect(progresUntuk(["baca", "kecilkan", "kompres", "simpan"]).persen).toBeLessThan(100);
  });

  it("pesan memakai Bahasa Indonesia", () => {
    expect(progresUntuk([]).pesan).toContain("Membaca foto");
    expect(progresUntuk(["baca", "kecilkan"]).pesan).toContain("Mengompres foto");
  });
});

describe("keadaan gagal & selesai", () => {
  it("gagal membawa pesan jelas", () => {
    const p = progresGagal("Foto tidak dapat dibaca.");
    expect(p.status).toBe("gagal");
    expect(p.pesan).toBe("Foto tidak dapat dibaca.");
  });

  it("selesai selalu 100", () => {
    expect(progresSelesai()).toMatchObject({ persen: 100, status: "selesai" });
  });

  it("awal 0 dan belum berjalan", () => {
    expect(PROGRES_AWAL.status).toBe("menunggu");
    expect(PROGRES_AWAL.persen).toBe(0);
  });
});

describe("teksAksesibel", () => {
  it("menyebut persen agar pembaca layar paham", () => {
    const p = progresUntuk(["baca", "kecilkan"]);
    expect(teksAksesibel(p)).toMatch(/Mengompres foto, 40 persen/);
  });

  it("menyebut selesai & gagal", () => {
    expect(teksAksesibel(progresSelesai())).toBe("Foto siap");
    expect(teksAksesibel(progresGagal("Gagal simpan"))).toBe("Gagal: Gagal simpan");
  });
});

describe("progres unggah", () => {
  it("Phase 3: belum ada unggahan, tertulis tersimpan di perangkat", () => {
    const p = progresUnggahAwal();
    expect(p.status).toBe("belum");
    expect(p.pesan).toContain("perangkat");
  });

  it("menghitung persen dari jumlah foto", () => {
    expect(progresUnggahBerjalan(1, 3).persen).toBe(33);
    expect(progresUnggahBerjalan(1, 3).pesan).toContain("1 dari 3");
    expect(progresUnggahBerjalan(3, 3).status).toBe("berhasil");
    expect(progresUnggahBerjalan(3, 3).persen).toBe(100);
  });

  it("tanpa foto tidak membagi nol", () => {
    expect(progresUnggahBerjalan(0, 0).status).toBe("belum");
  });
});
