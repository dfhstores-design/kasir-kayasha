/**
 * Tampilan aplikasi — ukuran huruf dan tema.
 *
 * Disimpan di SettingsRecord (IndexedDB), jadi ikut tersimpan di perangkat
 * dan ikut tercadangkan. Nilai lama yang belum punya field ini dianggap
 * "normal" / "terang", jadi tidak perlu migrasi database.
 *
 * Diterapkan lewat atribut data di <html>: CSS di tokens.css membaca
 * [data-tema="gelap"] dan [data-ukuran-font="besar"].
 */

export type UkuranFont = "normal" | "besar";
export type Tema = "terang" | "gelap";

export const UKURAN_FONT_BAWAAN: UkuranFont = "normal";
export const TEMA_BAWAAN: Tema = "terang";

/** Nilai apa pun yang bukan "besar" dianggap "normal" (aman untuk data lama). */
export function ukuranFontDari(nilai: unknown): UkuranFont {
  return nilai === "besar" ? "besar" : "normal";
}

/** Nilai apa pun yang bukan "gelap" dianggap "terang" (aman untuk data lama). */
export function temaDari(nilai: unknown): Tema {
  return nilai === "gelap" ? "gelap" : "terang";
}

/** Tulis pilihan tampilan ke elemen <html> supaya CSS langsung menerapkannya. */
export function terapkanTampilan(
  ukuranFont: UkuranFont,
  tema: Tema,
  akar: HTMLElement = document.documentElement,
): void {
  akar.dataset.ukuranFont = ukuranFont;
  akar.dataset.tema = tema;
}
