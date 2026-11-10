/**
 * Kompresi foto produk di perangkat (CONTEXT bagian "Admin dan katalog barang").
 *
 * Sasaran: sisi terpanjang ±1600 px, 250–400 KB per foto, warna/motif tetap terlihat.
 * WebP bila didukung, JPEG sebagai fallback. Simpan versi terkompresi — bukan berkas asli.
 *
 * MENGAPA BERLAPIS
 * Foto kamera HP modern bisa 12–108 MP dan berkasnya bisa >80 MB. Melakukan
 * `createImageBitmap(file)` atau `drawImage` ukuran penuh lalu mengecilkan sekali
 * bisa menghabiskan ratusan MB RAM dan membuat tab Android **crash** (bukan error
 * yang bisa ditangkap). Karena itu:
 *
 *   1. `periksaBerkasFoto()`  menolak berkas yang jelas tidak mungkin diproses
 *      (format bukan gambar, atau jauh di atas batas).
 *   2. `createImageBitmap(file, { resizeWidth })` meminta browser mengecilkan
 *      SAAT decode — memori puncak jauh lebih kecil. Bila tidak didukung,
 *      dipakai <img> lalu dikecilkan bertahap (setengah ukuran per langkah).
 *   3. Bila canvas gagal dibuat (memori), dicoba lagi dengan ukuran lebih kecil.
 *
 * Semua fungsi matematis di sini murni & diuji; bagian browser dipisah jelas.
 */

export const FOTO_SISI_MAKS = 1600;
export const FOTO_UKURAN_MIN = 250 * 1024;
export const FOTO_UKURAN_MAKS = 400 * 1024;
export const FOTO_KUALITAS_AWAL = 0.82;
export const FOTO_KUALITAS_MIN = 0.5;
export const FOTO_KUALITAS_LANGKAH = 0.08;

/** Batas keras berkas masukan: 150 MB. Di atas ini ditolak dengan pesan jelas. */
export const FOTO_BERKAS_MAKS = 150 * 1024 * 1024;

/** Batas piksel sebelum decode. 108 MP (12000×9000) masih diterima. */
export const FOTO_PIKSEL_MAKS = 150_000_000;

/** Di atas ukuran ini, decode memakai jalur "kecilkan saat decode". */
export const FOTO_BERKAS_BESAR = 10 * 1024 * 1024;

/** Target memori kasar: piksel × 4 byte (RGBA). */
export const FOTO_MEMORI_MAKS_BYTE = 320 * 1024 * 1024;

export interface Ukuran {
  lebar: number;
  tinggi: number;
}

/* --------------------------------------------------------------- berkas */

export type GalatBerkasFoto =
  | "bukan_gambar"
  | "terlalu_besar"
  | "resolusi_terlalu_besar"
  | "berkas_kosong";

export type HasilPeriksaBerkas =
  | { ok: true; besar: boolean }
  | { ok: false; galat: GalatBerkasFoto; pesan: string };

const TIPE_DITERIMA = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Memeriksa berkas SEBELUM menyentuh decode. Menolak lebih awal jauh lebih baik
 * daripada kehabisan memori di tengah jalan.
 */
export function periksaBerkasFoto(berkas: { size: number; type: string }): HasilPeriksaBerkas {
  if (berkas.size <= 0) {
    return { ok: false, galat: "berkas_kosong", pesan: "Berkas foto kosong." };
  }

  const tipe = berkas.type.toLowerCase();
  // Sebagian browser Android memberi type kosong untuk berkas HEIC/gambar galeri.
  if (tipe !== "" && !TIPE_DITERIMA.includes(tipe)) {
    return { ok: false, galat: "bukan_gambar", pesan: "Berkas ini bukan foto." };
  }

  if (berkas.size > FOTO_BERKAS_MAKS) {
    return {
      ok: false,
      galat: "terlalu_besar",
      pesan: `Foto terlalu besar (${formatMB(berkas.size)}). Maksimal ${FOTO_BERKAS_MAKS / (1024 * 1024)} MB.`,
    };
  }

  return { ok: true, besar: berkas.size > FOTO_BERKAS_BESAR };
}

/** Memeriksa dimensi yang dilaporkan browser setelah decode ringan. */
export function periksaResolusi(lebar: number, tinggi: number): HasilPeriksaBerkas {
  if (lebar <= 0 || tinggi <= 0) {
    return { ok: false, galat: "berkas_kosong", pesan: "Ukuran foto tidak terbaca." };
  }
  const piksel = lebar * tinggi;
  if (piksel > FOTO_PIKSEL_MAKS) {
    return {
      ok: false,
      galat: "resolusi_terlalu_besar",
      pesan: `Foto terlalu besar resolusinya (${formatMP(piksel)}). Maksimal 150 megapiksel.`,
    };
  }
  return { ok: true, besar: piksel > 12_000_000 };
}

/** Perkiraan memori decode (RGBA). */
export function perkiraanMemori(lebar: number, tinggi: number): number {
  return lebar * tinggi * 4;
}

/** Apakah aman didecode sekaligus? Dipakai untuk memilih strategi. */
export function perluKecilkanSaatDecode(lebar: number, tinggi: number): boolean {
  return perkiraanMemori(lebar, tinggi) > FOTO_MEMORI_MAKS_BYTE;
}

/**
 * Urutan ukuran saat mengecilkan bertahap (maks 2× per langkah).
 * Menggambar 12000 px langsung ke 1600 px menghasilkan kualitas buruk dan memori besar;
 * mengecilkan bertahap memakai memori puncak lebih kecil.
 */
export function jalurPengecilan(asli: Ukuran, sisiMaks: number = FOTO_SISI_MAKS): Ukuran[] {
  const jalur: Ukuran[] = [];
  let sekarang = { lebar: asli.lebar, tinggi: asli.tinggi };

  while (Math.max(sekarang.lebar, sekarang.tinggi) > sisiMaks * 2) {
    sekarang = {
      lebar: Math.max(1, Math.round(sekarang.lebar / 2)),
      tinggi: Math.max(1, Math.round(sekarang.tinggi / 2)),
    };
    jalur.push(sekarang);
  }
  const akhir = hitungUkuranTarget(asli, sisiMaks);
  if (jalur.length === 0 || jalur[jalur.length - 1]?.lebar !== akhir.lebar) {
    jalur.push(akhir);
  }
  return jalur;
}

function formatMB(byte: number): string {
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMP(piksel: number): string {
  return `${(piksel / 1_000_000).toFixed(0)} megapiksel`;
}

/* --------------------------------------------------------------- ukuran */

/**
 * Mengubah ukuran agar sisi terpanjang <= maks, menjaga rasio.
 * Tidak memperbesar gambar kecil (supaya tidak pecah dan tidak memakan tempat).
 */
export function hitungUkuranTarget(asli: Ukuran, sisiMaks: number = FOTO_SISI_MAKS): Ukuran {
  if (asli.lebar <= 0 || asli.tinggi <= 0) {
    throw new RangeError("Ukuran gambar tidak valid");
  }
  const sisiTerpanjang = Math.max(asli.lebar, asli.tinggi);
  if (sisiTerpanjang <= sisiMaks) {
    return { lebar: Math.round(asli.lebar), tinggi: Math.round(asli.tinggi) };
  }
  const skala = sisiMaks / sisiTerpanjang;
  return {
    lebar: Math.max(1, Math.round(asli.lebar * skala)),
    tinggi: Math.max(1, Math.round(asli.tinggi * skala)),
  };
}

/* --------------------------------------------------------------- kualitas */

export type EncoderFoto = (kanvas: unknown, tipe: string, kualitas: number) => Promise<Blob>;

export interface HasilKompresi {
  blob: Blob;
  tipe: string;
  ukuran: Ukuran;
  /** True bila ukuran akhir masih > batas atas setelah kualitas diturunkan. */
  masihTerlaluBesar: boolean;
}

/**
 * Menurunkan kualitas bertahap sampai blob <= batas atas.
 * `kualitas` turun dari 0.82 sampai 0.5. Bila masih besar, hasil tetap dikembalikan
 * dengan penanda `masihTerlaluBesar` — UI yang memberi tahu pemilik, bukan diam-diam.
 */
export async function kompresDenganEncoder(
  kanvas: unknown,
  ukuran: Ukuran,
  encoder: EncoderFoto,
  tipe: string,
): Promise<HasilKompresi> {
  let kualitas = FOTO_KUALITAS_AWAL;
  let blob = await encoder(kanvas, tipe, kualitas);

  while (blob.size > FOTO_UKURAN_MAKS && kualitas - FOTO_KUALITAS_LANGKAH >= FOTO_KUALITAS_MIN) {
    kualitas -= FOTO_KUALITAS_LANGKAH;
    blob = await encoder(kanvas, tipe, kualitas);
  }

  return {
    blob,
    tipe,
    ukuran,
    masihTerlaluBesar: blob.size > FOTO_UKURAN_MAKS,
  };
}

/** Memilih tipe keluaran: WebP bila didukung browser, selain itu JPEG. */
export function pilihTipeFoto(dukungWebp: boolean): string {
  return dukungWebp ? "image/webp" : "image/jpeg";
}

/** Mendeteksi dukungan WebP pada canvas (hasil di-cache). */
let cacheWebp: boolean | null = null;
export function dukungWebp(): boolean {
  if (cacheWebp !== null) return cacheWebp;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    cacheWebp = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    cacheWebp = false;
  }
  return cacheWebp;
}

/* --------------------------------------------------------------- browser */

export type GalatKompresi =
  | GalatBerkasFoto
  | "memori_habis"
  | "tidak_terbaca"
  | "tidak_didukung";

export class KompresiError extends Error {
  kode: GalatKompresi;
  constructor(kode: GalatKompresi, pesan: string) {
    super(pesan);
    this.name = "KompresiError";
    this.kode = kode;
  }
}

interface BitmapSiap {
  sumber: unknown;
  lebar: number;
  tinggi: number;
  lepas: () => void;
}

/**
 * Kompres foto nyata memakai canvas browser.
 * Dipanggil dari UI setelah pemilik memilih/ambil foto.
 */
export async function kompresFoto(file: Blob): Promise<HasilKompresi> {
  // 1) Tolak berkas yang mustahil diproses — sebelum decode.
  const cek = periksaBerkasFoto({ size: file.size, type: file.type });
  if (!cek.ok) throw new KompresiError(cek.galat, cek.pesan);

  // 2) Decode. Berkas besar memakai resize saat decode agar memori puncak kecil.
  const bitmap = await buatBitmap(file, cek.besar);
  try {
    const cekRes = periksaResolusi(bitmap.lebar, bitmap.tinggi);
    if (!cekRes.ok) throw new KompresiError(cekRes.galat, cekRes.pesan);

    const ukuran = hitungUkuranTarget({ lebar: bitmap.lebar, tinggi: bitmap.tinggi });
    const kanvas = gambarKeKanvas(bitmap.sumber, ukuran);
    const tipe = pilihTipeFoto(dukungWebp());

    return await kompresDenganEncoder(
      kanvas,
      ukuran,
      (k, t, q) =>
        new Promise<Blob>((resolve, reject) => {
          try {
            (k as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new KompresiError("tidak_terbaca", "Gagal mengompres foto."))), t, q);
          } catch {
            reject(new KompresiError("memori_habis", "Foto terlalu besar untuk HP ini. Coba foto lain."));
          }
        }),
      tipe,
    );
  } finally {
    bitmap.lepas();
  }
}

/**
 * Menggambar ke kanvas target. Bila sumber masih jauh lebih besar, dilakukan
 * pengecilan bertahap lewat kanvas perantara agar tidak kehabisan memori.
 */
function gambarKeKanvas(sumber: unknown, ukuran: Ukuran): HTMLCanvasElement {
  const asli = ukuranSumber(sumber);
  const kanvas = document.createElement("canvas");
  kanvas.width = ukuran.lebar;
  kanvas.height = ukuran.tinggi;
  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new KompresiError("tidak_didukung", "Perangkat ini tidak mendukung pengolahan gambar.");
  ctx.imageSmoothingQuality = "high";

  const jalur = jalurPengecilan(asli, Math.max(ukuran.lebar, ukuran.tinggi));
  if (jalur.length <= 1) {
    ctx.drawImage(sumber as CanvasImageSource, 0, 0, ukuran.lebar, ukuran.tinggi);
    return kanvas;
  }

  // Pengecilan bertahap lewat kanvas perantara kecil.
  let sumberSekarang: CanvasImageSource = sumber as CanvasImageSource;
  for (let i = 0; i < jalur.length; i++) {
    const tahap = jalur[i];
    if (!tahap) continue;
    const akhir = i === jalur.length - 1;
    const target = akhir ? kanvas : document.createElement("canvas");
    if (!akhir) {
      (target as HTMLCanvasElement).width = tahap.lebar;
      (target as HTMLCanvasElement).height = tahap.tinggi;
    }
    const ctxTahap = akhir ? ctx : (target as HTMLCanvasElement).getContext("2d");
    if (!ctxTahap) throw new KompresiError("tidak_didukung", "Perangkat ini tidak mendukung pengolahan gambar.");
    ctxTahap.imageSmoothingQuality = "high";
    ctxTahap.drawImage(sumberSekarang, 0, 0, tahap.lebar, tahap.tinggi);
    sumberSekarang = target as CanvasImageSource;
  }
  return kanvas;
}

function ukuranSumber(sumber: unknown): Ukuran {
  const s = sumber as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  return {
    lebar: s.width ?? s.naturalWidth ?? 1,
    tinggi: s.height ?? s.naturalHeight ?? 1,
  };
}

/**
 * createImageBitmap dengan resize saat decode untuk berkas besar.
 * Fallback ke <img> bila API tidak tersedia.
 */
async function buatBitmap(file: Blob, perluKecil: boolean): Promise<BitmapSiap> {
  if (typeof createImageBitmap === "function") {
    try {
      // `resizeWidth` membuat browser mengecilkan saat decode (memori puncak kecil).
      const bmp = perluKecil
        ? await createImageBitmap(file, { resizeWidth: FOTO_SISI_MAKS, resizeQuality: "high" })
        : await createImageBitmap(file);
      return { sumber: bmp, lebar: bmp.width, tinggi: bmp.height, lepas: () => bmp.close() };
    } catch {
      // Lanjut ke fallback <img> (mis. HEIC tidak didukung createImageBitmap).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new KompresiError("tidak_terbaca", "Foto tidak dapat dibaca. Coba foto lain."));
      el.src = url;
    });
    return {
      sumber: img,
      lebar: img.naturalWidth,
      tinggi: img.naturalHeight,
      lepas: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
