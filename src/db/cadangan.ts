/**
 * Cadangan (backup) & pemulihan data — Phase 7.
 *
 * Aturan (perintah utama bagian "Keamanan dan privasi"):
 *  - sediakan ekspor cadangan; jangan hapus data tanpa konfirmasi jelas
 *  - data pembeli seminimal mungkin; cadangan berisi data usaha pemilik sendiri
 *
 * Format cadangan: satu berkas JSON yang berisi SEMUA object store. Blob (foto, logo)
 * disimpan sebagai base64 agar satu berkas cukup dan tetap bisa dibaca di mana saja.
 *
 * Versi format dicatat supaya pemulihan dari cadangan lama bisa ditolak dengan jelas,
 * bukan menghasilkan data rusak diam-diam.
 */
import { getDB, resetKoneksiDB, DB_VERSION, type KasirDB } from "./schema.ts";
import { tanggalWIB } from "../lib/tanggal.ts";

export const VERSI_CADANGAN = 1;
export const NAMA_BERKAS_CADANGAN = (tgl: Date) =>
  // Tanggal nama berkas dalam WIB (C9) — sama dengan tanggal yang dilihat
  // pengguna di layar.
  `Cadangan-KasirKayesa-${tanggalWIB(tgl)}.json`;

/** Store yang ikut dicadangkan (semua data bisnis). */
export const STORE_CADANGAN = [
  "settings",
  "products",
  "product_photos",
  "bazars",
  "bazar_items",
  "bazar_biaya",
  "transactions",
  "transaction_items",
  "payments",
  "parked_carts",
  // F16, tes klik putaran 4 (22 Nov 2026): store data usaha yang dulu tidak
  // ikut dicadangkan — restore "Ganti semua data" tidak menghapusnya,
  // sehingga perangkat tidak pernah benar-benar bersih (catatan Tutup Harian
  // lama tetap tampil dan hari tidak bisa ditutup lagi). Format ini memang
  // diniatkan berisi SEMUA object store (lihat kepala berkas), jadi yang
  // berisi data usaha harus ikut; cadangan lama tanpa store ini tetap bisa
  // dibaca (store yang hilang dianggap kosong).
  "journal",
  "pelanggan",
  "pengiriman",
  "logSinkron",
  "tutupHarian",
] as const;

/**
 * Store state sync internal — TIDAK PERNAH diekspor ke berkas cadangan,
 * tapi DIHAPUS pada mode "ganti". Alasannya: antrean kirim (outbox) yang
 * tersisa akan menghidupkan lagi data yang baru dihapus (push ulang ke hub),
 * dan bayangan usang akan merusak gabung 3-arah berikutnya. Perangkat yang
 * datanya diganti total harus mulai sync dari nol.
 */
export const STORE_SYNC_INTERNAL = ["bayangan", "outbox"] as const;

type NamaStore = (typeof STORE_CADANGAN)[number];

export interface BerkasCadangan {
  /** Ejaan baru "Kasir Kayesa" (keputusan Andri 17 Nov 2026); cadangan lama
   *  masih bertuliskan "Kasir Kayesha" dan tetap diterima saat dibaca. */
  aplikasi: "Kasir Kayesa" | "Kasir Kayesha";
  versiFormat: number;
  versiDatabase: number;
  dibuatPada: string;
  jumlah: Record<string, number>;
  data: Record<string, unknown[]>;
}

/* --------------------------------------------------------- base64 */

/** Blob -> base64 (tanpa awalan data URL). */
export async function blobKeBase64(blob: Blob): Promise<string> {
  const { bytes: buf } = await bytesDari(blob);
  let biner = "";
  const potongan = 0x8000;
  for (let i = 0; i < buf.length; i += potongan) {
    biner += String.fromCharCode(...buf.subarray(i, i + potongan));
  }
  return btoa(biner);
}

/** base64 -> Blob dengan tipe asal. */
export function base64KeBlob(b64: string, tipe: string): Blob {
  const biner = atob(b64);
  const buf = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) buf[i] = biner.charCodeAt(i);
  return new Blob([buf], { type: tipe });
}

/**
 * Mengubah nilai menjadi bentuk JSON-aman: Blob diganti penanda.
 * Penanda sengaja eksplisit agar pemulihan tahu persis field mana yang harus jadi Blob.
 */
function keJsonAman(nilai: unknown): unknown {
  if (nilai instanceof Blob) {
    return { __blob: nilai.type || "application/octet-stream" };
  }
  if (Array.isArray(nilai)) return nilai.map(keJsonAman);
  if (nilai && typeof nilai === "object") {
    const hasil: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nilai as Record<string, unknown>)) hasil[k] = keJsonAman(v);
    return hasil;
  }
  return nilai;
}

/**
 * Blob yang tersimpan/total di IndexedDB.
 * `instanceof Blob` tidak cukup: lingkungan uji (fake-indexeddb) mengembalikan Blob
 * sebagai objek biasa. Karena itu diperiksa dari bentuknya (ada `arrayBuffer` + `size`).
 */
export function sepertiBlob(v: unknown): v is Blob {
  if (v instanceof Blob) return true;
  if (!v || typeof v !== "object") return false;
  const o = v as { arrayBuffer?: unknown; size?: unknown; type?: unknown };
  return typeof o.arrayBuffer === "function" && typeof o.size === "number";
}

/** Baca bytes dari Blob apa pun (termasuk Blob "palsu" dari lingkungan uji). */
async function bytesDari(v: Blob): Promise<{ bytes: Uint8Array; tipe: string }> {
  const buf = await v.arrayBuffer();
  return { bytes: new Uint8Array(buf), tipe: v.type || "application/octet-stream" };
}

/* --------------------------------------------------------- ekspor */

export type HasilEkspor = { ok: true; berkas: BerkasCadangan; blob: Blob } | { ok: false; pesan: string };

/**
 * Mengumpulkan seluruh data ke satu objek cadangan lalu menjadi Blob JSON.
 * Foto/logo diubah ke base64 lebih dulu (async).
 */
export async function buatCadangan(sekarang: Date = new Date()): Promise<HasilEkspor> {
  try {
    const db = await getDB();
    const data: Record<string, unknown[]> = {};
    const jumlah: Record<string, number> = {};

    for (const store of STORE_CADANGAN) {
      const baris = (await db.getAll(store as keyof KasirDB & NamaStore)) as unknown[];
      jumlah[store] = baris.length;

      if (store === "product_photos") {
        // Foto: simpan blob sebagai base64 dengan field tipe.
        const foto: unknown[] = [];
        for (const f of baris as Array<Record<string, unknown>>) {
          const blob = f.blob;
          // keJsonAman dulu agar field lain aman, lalu blob diganti base64.
          const obj = keJsonAman(f) as Record<string, unknown>;
          obj.blob = sepertiBlob(blob) ? await blobKeBase64(blob) : null;
          foto.push(obj);
        }
        data[store] = foto;
        continue;
      }

      if (store === "settings") {
        const s = baris as Array<Record<string, unknown>>;
        const hasil: unknown[] = [];
        for (const rec of s) {
          // Mulai dari versi JSON-aman (agar Blob tidak menjadi {}), lalu isi logo base64.
          const obj = keJsonAman(rec) as Record<string, unknown>;
          if (sepertiBlob(rec.logo)) obj.logo = await blobKeBase64(rec.logo);
          else obj.logo = null;
          hasil.push(obj);
        }
        data[store] = hasil;
        continue;
      }

      data[store] = baris.map(keJsonAman);
    }

    const berkas: BerkasCadangan = {
      aplikasi: "Kasir Kayesa",
      versiFormat: VERSI_CADANGAN,
      versiDatabase: DB_VERSION,
      dibuatPada: sekarang.toISOString(),
      jumlah,
      data,
    };

    const blob = new Blob([JSON.stringify(berkas)], { type: "application/json" });
    return { ok: true, berkas, blob };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : "Cadangan gagal dibuat." };
  }
}

/* -------------------------------------------------------- validasi */

export type HasilPeriksa =
  | { ok: true; berkas: BerkasCadangan; ringkas: string[] }
  | { ok: false; pesan: string };

/** Memeriksa berkas cadangan sebelum apa pun ditulis. Pesan jelas untuk pemilik. */
export function periksaCadangan(teks: string): HasilPeriksa {
  let mentah: unknown;
  try {
    mentah = JSON.parse(teks);
  } catch {
    return { ok: false, pesan: "Berkas cadangan tidak dapat dibaca." };
  }

  const b = mentah as Partial<BerkasCadangan>;
  // Cadangan lama bertuliskan "Kasir Kayesha" — tetap diterima.
  if (!b || (b.aplikasi !== "Kasir Kayesa" && b.aplikasi !== "Kasir Kayesha")) {
    return { ok: false, pesan: "Berkas ini bukan cadangan Kasir Kayesa." };
  }
  if (typeof b.versiFormat !== "number") {
    return { ok: false, pesan: "Format cadangan tidak dikenal." };
  }
  if (b.versiFormat > VERSI_CADANGAN) {
    return {
      ok: false,
      pesan: "Cadangan dibuat oleh aplikasi versi lebih baru. Perbarui aplikasi dulu.",
    };
  }
  if (!b.data || typeof b.data !== "object") {
    return { ok: false, pesan: "Isi cadangan kosong." };
  }

  const berkas = b as BerkasCadangan;
  const ringkas: string[] = [];
  const jumlah = berkas.jumlah ?? {};
  for (const store of STORE_CADANGAN) {
    const n = jumlah[store] ?? (Array.isArray(berkas.data[store]) ? berkas.data[store].length : 0);
    if (n > 0) ringkas.push(`${labelStore(store)}: ${n}`);
  }

  return { ok: true, berkas, ringkas };
}

const LABEL: Record<NamaStore, string> = {
  settings: "pengaturan",
  products: "barang",
  product_photos: "foto",
  bazars: "bazar",
  bazar_items: "barang bazar",
  bazar_biaya: "biaya",
  transactions: "transaksi",
  transaction_items: "baris transaksi",
  payments: "pembayaran",
  parked_carts: "transaksi tertahan",
  journal: "jurnal",
  pelanggan: "pelanggan",
  pengiriman: "pengiriman",
  logSinkron: "log sinkron",
  tutupHarian: "tutup harian",
};

export function labelStore(store: NamaStore): string {
  return LABEL[store];
}

/* ------------------------------------------------------- pemulihan */

export type ModePulihkan = "gabung" | "ganti";

export interface OpsiPulihkan {
  /**
   * "gabung" (bawaan): data yang ada TIDAK dihapus, data cadangan ditambahkan/menimpa
   *   baris dengan id sama. Aman untuk pemulihan sebagian.
   * "ganti": seluruh data terkait dihapus lebih dulu. Hanya dipakai bila pemilik
   *   secara eksplisit meminta (konfirmasi di layar).
   */
  mode: ModePulihkan;
}

export type HasilPulihkan = { ok: true; dipulihkan: Record<string, number> } | { ok: false; pesan: string };

/**
 * Apakah error ini berarti koneksi IndexedDB sudah tertutup (F17, tes klik
 * putaran 5, 22 Nov 2026)? Chrome melempar DOMException InvalidStateError
 * "The database connection is closing" saat transaksi dibuka di koneksi
 * yang sedang ditutup; fake-indexeddb melempar InvalidStateError dengan
 * pesan berbeda — yang dicek adalah NAMA error, bukan pesannya.
 * Error lain (data rusak, kunci hilang, kuota) TIDAK dianggap koneksi
 * tertutup: mengulanginya tidak ada gunanya.
 */
export function koneksiTertutup(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "InvalidStateError") return true;
  return e instanceof Error && /connection is closing/i.test(e.message);
}

/**
 * Menulis isi cadangan ke IndexedDB dalam SATU transaksi per store.
 * Bila satu store gagal, error dilempar dan pemanggil yang memutuskan
 * (coba ulang bila koneksi tertutup, laporkan bila bukan).
 */
async function jalankanPulihkan(cadangan: BerkasCadangan, opsi: OpsiPulihkan): Promise<Record<string, number>> {
  const db = await getDB();
  const dipulihkan: Record<string, number> = {};

  // Urutan penting: induk sebelum anak agar foreign key buatan (bazarId/produkId) konsisten.
  const urutan: NamaStore[] = [
    "settings",
    "products",
    "product_photos",
    "bazars",
    "bazar_items",
    "bazar_biaya",
    "transactions",
    "transaction_items",
    "payments",
    "parked_carts",
    "journal",
    "pelanggan",
    "pengiriman",
    "logSinkron",
    "tutupHarian",
  ];

  // F16: pada mode "ganti", state sync internal ikut dihapus (tidak pernah
  // diekspor — lihat STORE_SYNC_INTERNAL). Tanpa ini, antrean kirim yang
  // tersisa akan menghidupkan lagi data yang baru dihapus.
  if (opsi.mode === "ganti") {
    for (const store of STORE_SYNC_INTERNAL) {
      const txInternal = db.transaction(store, "readwrite");
      await txInternal.store.clear();
      await txInternal.done;
    }
  }

  for (const store of urutan) {
    const baris = Array.isArray(cadangan.data[store]) ? (cadangan.data[store] as unknown[]) : [];
    if (baris.length === 0 && opsi.mode === "gabung") continue;

    const tx = db.transaction(store as keyof KasirDB & NamaStore, "readwrite");
    if (opsi.mode === "ganti") await tx.store.clear();

    let n = 0;
    for (const rec of baris) {
      if (!rec || typeof rec !== "object") continue;
      const obj = { ...(rec as Record<string, unknown>) };

      if (store === "product_photos" && typeof obj.blob === "string") {
        obj.blob = base64KeBlob(obj.blob, String(obj.tipe ?? "image/webp"));
      }
      if (store === "settings" && typeof obj.logo === "string") {
        obj.logo = base64KeBlob(obj.logo, "image/webp");
      }

      await tx.store.put(obj as never);
      n++;
    }
    await tx.done;
    dipulihkan[store] = n;
  }

  return dipulihkan;
}

/**
 * Menulis isi cadangan ke IndexedDB. Bila satu store gagal, UI menampilkan
 * pesan — tidak setengah jadi tanpa kabar.
 *
 * F17 (tes klik putaran 5, 22 Nov 2026): restore gagal di percobaan pertama
 * dengan "The database connection is closing" — koneksi yang di-cache sudah
 * tertutup (siklus hidup halaman) dan aplikasi memakainya terus sampai
 * halaman dimuat ulang. Karena itu, bila gagal karena koneksi tertutup,
 * koneksi dibuang, dibuka yang segar, dan restore diulang SEKALI dari awal
 * (aman diulang: mode "ganti" menghapus lalu menulis ulang — put menimpa
 * kunci yang sama; mode "gabung" hanya menimpa baris yang sama).
 * Bila percobaan kedua tetap gagal, kegagalan dilaporkan jujur — tidak
 * pernah ada sukses palsu.
 */
export async function pulihkanCadangan(cadangan: BerkasCadangan, opsi: OpsiPulihkan): Promise<HasilPulihkan> {
  // Cadangan lama bertuliskan "Kasir Kayesha" — tetap diterima.
  if (cadangan.aplikasi !== "Kasir Kayesa" && cadangan.aplikasi !== "Kasir Kayesha") {
    return { ok: false, pesan: "Berkas ini bukan cadangan Kasir Kayesa." };
  }
  if (cadangan.versiFormat > VERSI_CADANGAN) {
    return { ok: false, pesan: "Cadangan dibuat oleh aplikasi versi lebih baru." };
  }

  const pesanGalat = (e: unknown): string => (e instanceof Error ? e.message : "Pemulihan gagal.");

  try {
    const dipulihkan = await jalankanPulihkan(cadangan, opsi);
    return { ok: true, dipulihkan };
  } catch (e) {
    if (!koneksiTertutup(e)) {
      return { ok: false, pesan: pesanGalat(e) };
    }
    resetKoneksiDB();
    try {
      const dipulihkan = await jalankanPulihkan(cadangan, opsi);
      return { ok: true, dipulihkan };
    } catch (e2) {
      return { ok: false, pesan: pesanGalat(e2) };
    }
  }
}

/* ------------------------------------------------------------- CSV */

/**
 * Daftar transaksi sebagai CSV untuk dibuka di spreadsheet.
 * Nilai uang tetap integer Rupiah (tanpa titik) agar bisa dihitung.
 */
export function buatCsvTransaksi(
  transaksi: ReadonlyArray<{
    nomorResi: string;
    waktu: string;
    jenis: string;
    statusPesanan: string;
    statusBayar: string;
    namaPemesan: string | null;
    ongkirMode: string;
    total: number;
    dibatalkanPada: string | null;
  }>,
): string {
  const kepala = [
    "nomor_resi",
    "waktu",
    "jenis",
    "status_pesanan",
    "status_bayar",
    "nama_pemesan",
    "ongkir_mode",
    "total_rupiah",
    "dibatalkan",
  ];
  const baris = transaksi.map((t) => [
    t.nomorResi,
    t.waktu,
    t.jenis,
    t.statusPesanan,
    t.statusBayar,
    t.namaPemesan ?? "",
    t.ongkirMode,
    String(t.total),
    t.dibatalkanPada ? "ya" : "tidak",
  ]);
  return [kepala, ...baris].map((r) => r.map(kutipCsv).join(",")).join("\r\n");
}

/** Kutip bila mengandung koma/kutip/baris baru; gandakan kutip di dalamnya. */
export function kutipCsv(nilai: string): string {
  if (/[",\r\n]/.test(nilai)) return `"${nilai.replace(/"/g, '""')}"`;
  return nilai;
}
