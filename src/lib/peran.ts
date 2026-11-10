/** Peran aktif di aplikasi (ROLE-BIAYA-RINGKASAN.md). */
export type Peran = "kasir" | "admin";

/** Fitur yang hanya boleh dibuka admin. */
export const LAYAR_KHUSUS_ADMIN = [
  "barang",
  "form-barang",
  "bazar",
  "alokasi-bazar",
  "tutup-bazar",
  "ringkasan",
  "pengaturan",
  "biaya-bazar",
  "atur-pin",
  "cadangan",
] as const;

export function khususAdmin(layar: string): boolean {
  return (LAYAR_KHUSUS_ADMIN as readonly string[]).includes(layar);
}
