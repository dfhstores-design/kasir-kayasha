/**
 * Progres pengolahan foto — WAJIB tampil di layar (permintaan pemilik, 10 Nov 2026).
 *
 * Ada dua jenis progres yang harus dibedakan:
 *   "proses"  — membaca berkas, mengecilkan, mengompres (terjadi di perangkat, offline)
 *   "unggah"  — mengirim ke server / R2 (baru ada di Phase 6; saat ini selalu 0 pekerjaan)
 *
 * Fungsi di sini MURNI (kecuali tipe Blob) sehingga bisa diuji tanpa browser.
 */

export type TahapProses = "baca" | "kecilkan" | "kompres" | "simpan" | "selesai";

/** Bobot relatif tiap tahap; total 100. */
export const BOBOT_TAHAP: Record<TahapProses, number> = {
  baca: 15,
  kecilkan: 25,
  kompres: 45,
  simpan: 15,
  selesai: 0,
};

export type StatusProses = "menunggu" | "berjalan" | "selesai" | "gagal";

export interface ProgresFoto {
  /** 0–100 */
  persen: number;
  tahap: TahapProses;
  status: StatusProses;
  pesan: string;
}

export const PROGRES_AWAL: ProgresFoto = {
  persen: 0,
  tahap: "baca",
  status: "menunggu",
  pesan: "Menunggu",
};

const LABEL_TAHAP: Record<TahapProses, string> = {
  baca: "Membaca foto…",
  kecilkan: "Mengecilkan foto…",
  kompres: "Mengompres foto…",
  simpan: "Menyimpan foto…",
  selesai: "Foto siap",
};

export function labelTahap(tahap: TahapProses): string {
  return LABEL_TAHAP[tahap];
}

/** Menghitung persen dari tahap yang sudah selesai. */
export function persenSelesai(tahap: TahapProses): number {
  const urutan: TahapProses[] = ["baca", "kecilkan", "kompres", "simpan", "selesai"];
  const idx = urutan.indexOf(tahap);
  let total = 0;
  for (let i = 0; i < idx; i++) {
    const t = urutan[i];
    if (t) total += BOBOT_TAHAP[t];
  }
  return total;
}

/**
 * Progres pengompresan: tahap * berikutnya dimulai saat tahap sebelumnya selesai.
 * `tahapSelesai` berisi tahap yang sudah rampung.
 */
export function progresUntuk(tahapSelesai: TahapProses[]): ProgresFoto {
  if (tahapSelesai.includes("selesai")) {
    return { persen: 100, tahap: "selesai", status: "selesai", pesan: LABEL_TAHAP.selesai };
  }
  const urutan: TahapProses[] = ["baca", "kecilkan", "kompres", "simpan"];
  const berikutnya = urutan.find((t) => !tahapSelesai.includes(t)) ?? "simpan";
  return {
    persen: Math.min(99, persenSelesai(berikutnya)),
    tahap: berikutnya,
    status: "berjalan",
    pesan: LABEL_TAHAP[berikutnya],
  };
}

export function progresGagal(pesan: string): ProgresFoto {
  return { persen: 0, tahap: "baca", status: "gagal", pesan };
}

export function progresSelesai(): ProgresFoto {
  return { persen: 100, tahap: "selesai", status: "selesai", pesan: LABEL_TAHAP.selesai };
}

/** Teks untuk pembaca layar, mis. "Mengompres foto, 55 persen". */
export function teksAksesibel(p: ProgresFoto): string {
  if (p.status === "selesai") return "Foto siap";
  if (p.status === "gagal") return `Gagal: ${p.pesan}`;
  return `${p.pesan.replace("…", "")}, ${p.persen} persen`;
}

/* ---------------------------------------------------------------- unggah */

export type StatusUnggah = "belum" | "menunggu" | "unggah" | "berhasil" | "gagal";

export interface ProgresUnggah {
  status: StatusUnggah;
  persen: number;
  pesan: string;
}

export function progresUnggahAwal(): ProgresUnggah {
  // Phase 3: foto disimpan di perangkat saja. Unggah ke R2 baru ada di Phase 6.
  return { status: "belum", persen: 0, pesan: "Tersimpan di perangkat" };
}

export function progresUnggahBerjalan(selesai: number, total: number): ProgresUnggah {
  if (total <= 0) return progresUnggahAwal();
  const persen = Math.round((selesai / total) * 100);
  return {
    status: persen >= 100 ? "berhasil" : "unggah",
    persen,
    pesan: persen >= 100 ? "Terkirim" : `Mengunggah ${selesai} dari ${total} foto…`,
  };
}
