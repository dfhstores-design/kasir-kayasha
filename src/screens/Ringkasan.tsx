/* eslint-disable react-refresh/only-export-components --
  Helper murni di bawah diekspor supaya Ringkasan.test.ts bisa mengujinya lepas
  tanpa berkas lib baru (tugas P1-4 hanya membolehkan Ringkasan.tsx + tes). */
import { useEffect, useMemo, useState } from "react";
import {
  ambilSettings,
  ambilTransaksi,
  daftarBiaya as ambilBiaya,
  daftarBazar,
  daftarTransaksi,
  itemBazar,
  type BazarRecord,
  type BiayaBazarRecord,
  type SettingsRecord,
} from "../db/repositori.ts";
import type { ItemTransaksiRecord, JenisDokumen, PembayaranRecord, TransaksiRecord } from "../db/schema.ts";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal, formatTanggalJam } from "../lib/tanggal.ts";
import {
  biayaPadaHari,
  hitungRingkasanKeuangan,
  labelKategori,
  transaksiPadaHari,
} from "../lib/bazar.ts";
import { labelJenisBayar } from "../lib/penjualan.ts";
import { labelStatusBayar } from "../lib/keranjang.ts";
import Resi from "./Resi.tsx";
import { ambilPesananJahit, catatPengiriman } from "../lib/jahitan.ts";
import {
  bagikanDokumen,
  judulDokumen,
  NAMA_FILE_DOKUMEN,
  renderPng,
  type DataDokumen,
} from "../lib/dokumen.ts";

interface Props {
  bazar: BazarRecord | null;
}

/** Tampilan awal riwayat: 20 transaksi terbaru; tombol "Tampilkan semua" membuka sisanya. */
export const BATAS_RIWAYAT_AWAL = 20;

/** Label jenis dokumen untuk riwayat. */
export function labelJenisDokumen(jenisDokumen: JenisDokumen): string {
  switch (jenisDokumen) {
    case "penjualan":
      return "Penjualan";
    case "pesanan":
      return "Pesanan";
    case "jasa":
      return "Jahit";
  }
}

/**
 * Ringkasan item satu baris: "Kemeja ×2, Celana ×1".
 * Lebih dari 2 item dipotong: "A ×1, B ×1 dan 1 barang lain".
 */
export function ringkasItem(
  items: ReadonlyArray<Pick<ItemTransaksiRecord, "namaSnapshot" | "kuantitas">>,
): string {
  if (items.length === 0) return "—";
  const sebut = items
    .slice(0, 2)
    .map((i) => `${i.namaSnapshot} ×${i.kuantitas}`)
    .join(", ");
  return items.length > 2 ? `${sebut} dan ${items.length - 2} barang lain` : sebut;
}

/**
 * Metode bayar yang ditampilkan di riwayat: jenisBayar transaksi; kalau kosong
 * (pesanan jahit & PO yang bayarnya bertahap) pakai metode pembayaran terakhir;
 * kalau belum ada pembayaran sama sekali, "—".
 */
export function labelMetodeBayar(
  jenisBayar: TransaksiRecord["jenisBayar"],
  pembayaran: ReadonlyArray<Pick<PembayaranRecord, "metode" | "waktu">>,
): string {
  if (jenisBayar) return labelJenisBayar(jenisBayar);
  const terakhir = [...pembayaran].sort((a, b) => a.waktu.localeCompare(b.waktu)).at(-1);
  const m = terakhir?.metode ?? null;
  if (m === "tunai") return "Tunai";
  if (m === "transfer") return "Transfer";
  if (m === "qris") return "QRIS";
  return m ?? "—";
}

/** Terbaru dulu (daftarTransaksi sudah mengurutkan begitu; fungsi ini menguncinya). */
export function urutRiwayatBaruDulu<T extends Pick<TransaksiRecord, "waktu">>(daftar: readonly T[]): T[] {
  return [...daftar].sort((a, b) => b.waktu.localeCompare(a.waktu));
}

/** Potong tampilan awal riwayat; tampilkanSemua = tampilkan seluruh daftar. */
export function batasiRiwayat<T>(daftar: readonly T[], tampilkanSemua: boolean): T[] {
  return tampilkanSemua ? [...daftar] : daftar.slice(0, BATAS_RIWAYAT_AWAL);
}

/**
 * Ringkasan harian & akhir bazar (ROLE-BIAYA-RINGKASAN.md bagian 5).
 * Admin saja (dijaga di App).
 */
export default function Ringkasan({ bazar }: Props) {
  const [trx, setTrx] = useState<TransaksiRecord[]>([]);
  const [semuaTrx, setSemuaTrx] = useState<TransaksiRecord[]>([]);
  const [biaya, setBiaya] = useState<BiayaBazarRecord[]>([]);
  const [selisih, setSelisih] = useState(0);
  const [hari, setHari] = useState(new Date().toISOString().slice(0, 10));
  const [memuat, setMemuat] = useState(true);
  // Rincian (item + pembayaran) hanya untuk baris riwayat yang sedang tampil,
  // supaya tidak membaca seluruh IndexedDB saat daftar panjang.
  const [rincian, setRincian] = useState<
    Map<string, { item: ItemTransaksiRecord[]; pembayaran: PembayaranRecord[] }>
  >(new Map());
  const [tampilkanSemua, setTampilkanSemua] = useState(false);
  // Transaksi yang resi/dokumennya sedang dibuka dari riwayat (null = daftar).
  const [dokumenTerbuka, setDokumenTerbuka] = useState<{ id: string; jenisDokumen: JenisDokumen } | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const semua = await daftarTransaksi();
      const bz = bazar ?? (await daftarBazar()).find((b) => b.status === "selesai") ?? null;
      const biayaBazar = bz ? await ambilBiaya(bz.id) : [];
      const items = bz ? await itemBazar(bz.id) : [];
      if (!hidup) return;
      setSemuaTrx(semua);
      setTrx(bz ? semua.filter((t) => t.bazarId === bz.id) : []);
      setBiaya(biayaBazar);
      setSelisih(items.reduce((n, i) => n + Math.abs(i.selisih ?? 0), 0));
      setMemuat(false);
    })().catch(() => setMemuat(false));
    return () => {
      hidup = false;
    };
  }, [bazar]);

  const riwayatTampil = useMemo(
    () => batasiRiwayat(urutRiwayatBaruDulu(semuaTrx), tampilkanSemua),
    [semuaTrx, tampilkanSemua],
  );

  // Muat item + pembayaran untuk baris riwayat yang tampil; hasilnya di-cache
  // per id transaksi supaya toggle "Tampilkan semua" tidak mengulang semuanya.
  useEffect(() => {
    if (riwayatTampil.length === 0) return;
    let hidup = true;
    (async () => {
      const hasil = await Promise.all(
        riwayatTampil.map(async (t) => {
          const l = await ambilTransaksi(t.id);
          return { id: t.id, item: l?.item ?? [], pembayaran: l?.pembayaran ?? [] };
        }),
      );
      if (!hidup) return;
      setRincian((lama) => {
        const baru = new Map(lama);
        for (const h of hasil) baru.set(h.id, { item: h.item, pembayaran: h.pembayaran });
        return baru;
      });
    })().catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, [riwayatTampil]);

  if (memuat) {
    return (
      <div className="content">
        <p className="soft">Menghitung ringkasan…</p>
      </div>
    );
  }

  // Sengaja memakai semuaTrx (bukan trx yang terfilter bazar): penjualan tanpa
  // bazar tetap harus terlihat di layar ini lewat riwayat di bawah.
  if (!bazar && semuaTrx.length === 0 && biaya.length === 0) {
    return (
      <div className="content">
        <div className="panel panel--ok">
          <strong>Belum ada data ringkasan.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Buka bazar dan catat transaksi untuk melihat ringkasan.</p>
        </div>
      </div>
    );
  }

  const keRingkas = (list: TransaksiRecord[]) =>
    list.map((t) => ({
      total: t.total,
      jenisBayar: t.jenisBayar,
      dibatalkan: t.dibatalkanPada !== null,
      waktu: t.waktu,
    }));

  const daftarTrx = keRingkas(trx);
  const daftarBiaya = biaya.map((b) => ({ kategori: b.kategori, judul: b.judul, nominal: b.nominal, tanggal: b.tanggal }));

  const harian = hitungRingkasanKeuangan(transaksiPadaHari(daftarTrx, hari), biayaPadaHari(daftarBiaya, hari));
  const total = hitungRingkasanKeuangan(daftarTrx, daftarBiaya);

  return (
    <div className="content">
      <div>
        <p className="h2" style={{ margin: 0 }}>
          {bazar ? bazar.nama : "Ringkasan"}
        </p>
        {bazar && (
          <p className="soft" style={{ margin: 0 }}>
            {bazar.status === "selesai" && bazar.ditutupPada
              ? `Ditutup ${formatTanggal(bazar.ditutupPada)}`
              : "Bazar aktif"}
          </p>
        )}
      </div>

      {/* ---------------- harian ---------------- */}
      <div>
        <label htmlFor="tanggal-ringkasan">Ringkasan harian</label>
        <input
          id="tanggal-ringkasan"
          type="date"
          value={hari}
          onChange={(e) => setHari(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="ringkas">
          <span>Transaksi</span>
          <span className="money">{harian.jumlahTransaksi}</span>
        </div>
        <div className="ringkas">
          <span>Omzet hari itu</span>
          <span className="money">{formatRupiah(harian.omzet)}</span>
        </div>
        <div className="ringkas soft">
          <span>Tunai</span>
          <span>{formatRupiah(harian.tunai)}</span>
        </div>
        <div className="ringkas soft">
          <span>Transfer</span>
          <span>{formatRupiah(harian.transfer)}</span>
        </div>
        <div className="ringkas soft">
          <span>QRIS</span>
          <span>{formatRupiah(harian.qris)}</span>
        </div>
        <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
        <div className="ringkas soft">
          <span>Biaya hari itu</span>
          <span>− {formatRupiah(harian.totalBiaya)}</span>
        </div>
        <div className="ringkas">
          <strong>Laba hari itu</strong>
          <strong className="money">{formatRupiah(harian.laba)}</strong>
        </div>
      </div>

      {/* ---------------- total ---------------- */}
      <span className="label">
        Ringkasan total {bazar?.status === "selesai" ? "setelah bazar ditutup" : "sejauh ini"}
      </span>
      <div className="card">
        <div className="ringkas">
          <span>Transaksi</span>
          <span className="money">{total.jumlahTransaksi}</span>
        </div>
        <div className="ringkas">
          <span>Omzet bazar</span>
          <span className="money">{formatRupiah(total.omzet)}</span>
        </div>
        <div className="ringkas">
          <span>Biaya bazar</span>
          <span className="money">− {formatRupiah(total.totalBiaya)}</span>
        </div>
        <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
        <div className="ringkas">
          <strong>LABA BAZAR</strong>
          <strong
            className="total"
            style={{ fontSize: "1.5rem", color: total.laba < 0 ? "var(--danger)" : "var(--ink)" }}
          >
            {formatRupiah(total.laba)}
          </strong>
        </div>
        {total.laba < 0 && (
          <p className="hint" style={{ color: "var(--danger)", margin: "0.25rem 0 0" }}>
            Biaya lebih besar dari omzet.
          </p>
        )}
      </div>

      {total.biayaPerKategori.length > 0 && (
        <div className="card">
          <span className="label">Rincian biaya</span>
          {total.biayaPerKategori.map((r) => (
            <div key={r.kategori} className="ringkas soft">
              <span>{labelKategori(r.kategori)}</span>
              <span>{formatRupiah(r.total)}</span>
            </div>
          ))}
        </div>
      )}

      {bazar?.status === "selesai" && (
        <div className="card">
          <div className="ringkas">
            <span>Dibawa</span>
            <span className="money">{bazar.ringkasanDibawa ?? 0} pcs</span>
          </div>
          <div className="ringkas">
            <span>Terjual</span>
            <span className="money">{bazar.ringkasanTerjual ?? 0} pcs</span>
          </div>
          <div className="ringkas">
            <span>Dikembalikan</span>
            <span className="money">{bazar.ringkasanSisa ?? 0} pcs</span>
          </div>
          {selisih > 0 && (
            <p className="hint" style={{ color: "var(--warn-ink)", margin: "0.25rem 0 0" }}>
              Ada selisih hitung {selisih} pcs pada penutupan.
            </p>
          )}
        </div>
      )}

      {/* ---------------- riwayat penjualan (semua) ----------------
        KEPUTUSAN FILTER (P1-4, audit 17 Nov 2026): riwayat menampilkan SEMUA
        jenisDokumen — "penjualan", "pesanan" (PO lama), dan "jasa" (pesanan
        jahit) — dengan label jenis yang jelas di tiap baris. Alasan: agregat
        di atas (hitungRingkasanKeuangan) sudah menghitung semua jenis dokumen
        dalam bazar; kalau riwayat hanya menampilkan penjualan barang, isinya
        tidak bisa dicocokkan dengan omzet di atas. Pesanan jahit adalah aliran
        uang masuk Tahap 1 (DP/pelunasan) dan PO lama mungkin masih ada di
        perangkat walaupun seed PO sudah dihapus — menyembunyikannya berarti
        menyembunyikan uang. Transaksi yang dibatalkan tetap tampil dengan
        label "Dibatalkan" (tidak dihitung di omzet, sama seperti di agregat).
        Penjualan TANPA bazar (bazarId null) ikut tampil: riwayat memakai SEMUA
        transaksi, bukan filter per bazarId seperti agregat.
      */}
      <span className="label">Riwayat penjualan (semua)</span>
      <p className="soft" style={{ margin: "0.25rem 0 0" }}>
        Mencakup semua transaksi — termasuk penjualan di luar bazar, pesanan (PO) lama, dan pesanan jahit.
        Terbaru dulu.
      </p>

      {dokumenTerbuka ? (
        <div className="card">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setDokumenTerbuka(null)}>
            ‹ Kembali ke riwayat
          </button>
          {dokumenTerbuka.jenisDokumen === "jasa" ? (
            <PratinjauDokumenJahit transaksiId={dokumenTerbuka.id} />
          ) : (
            <Resi transaksiId={dokumenTerbuka.id} onSelesai={() => setDokumenTerbuka(null)} />
          )}
        </div>
      ) : semuaTrx.length === 0 ? (
        <div className="panel panel--ok">
          <strong>Belum ada transaksi.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Transaksi yang tersimpan akan muncul di sini.</p>
        </div>
      ) : (
        <>
          {riwayatTampil.map((t) => {
            const r = rincian.get(t.id);
            const dibatalkan = t.dibatalkanPada !== null;
            return (
              <div key={t.id} className="card">
                <div className="ringkas">
                  <span className="soft">{formatTanggalJam(t.waktu)}</span>
                  <span className="chip">{labelJenisDokumen(t.jenisDokumen)}</span>
                </div>
                <div style={{ marginTop: "0.25rem" }}>
                  <strong>{t.namaPemesan ?? "—"}</strong>
                  {dibatalkan && (
                    <span className="chip warn" style={{ marginLeft: "0.5rem" }}>
                      Dibatalkan
                    </span>
                  )}
                </div>
                <div className="soft" style={{ fontSize: "0.95rem" }}>
                  {t.nomorResi}
                </div>
                <div className="soft" style={{ fontSize: "0.95rem" }}>
                  {r ? ringkasItem(r.item) : "Memuat…"}
                </div>
                <div className="ringkas" style={{ marginTop: "0.25rem" }}>
                  <span>
                    {r ? labelMetodeBayar(t.jenisBayar, r.pembayaran) : "—"}
                    {!dibatalkan && t.statusBayar !== "lunas" ? ` · ${labelStatusBayar(t.statusBayar)}` : ""}
                  </span>
                  <strong className="money">{formatRupiah(t.total)}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => setDokumenTerbuka({ id: t.id, jenisDokumen: t.jenisDokumen })}
                >
                  {t.jenisDokumen === "jasa" ? "Lihat Dokumen" : "Lihat Resi"}
                </button>
              </div>
            );
          })}
          {semuaTrx.length > BATAS_RIWAYAT_AWAL && (
            <button type="button" className="btn btn--ghost" onClick={() => setTampilkanSemua((v) => !v)}>
              {tampilkanSemua ? "Tampilkan 20 terbaru saja" : `Tampilkan semua (${semuaTrx.length} transaksi)`}
            </button>
          )}
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            Menampilkan {riwayatTampil.length} dari {semuaTrx.length} transaksi.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * BUKA RESI (P1-4): App sudah punya layar "resi" ({ nama: "resi", transaksiId })
 * yang menampilkan komponen Resi yang sama dengan yang dipakai setelah penjualan
 * (TransaksiTersimpan → "Buat Resi"). Ringkasan
 * tidak menerima callback navigasi dari App (props hanya `bazar`), dan App.tsx
 * di luar berkas yang boleh diubah tugas ini — jadi pratinjau resi dirender
 * INLINE di sini memakai komponen Resi yang sama, dengan tombol "Kembali ke
 * riwayat". TIDAK perlu perubahan App.tsx untuk ini; bila koordinator mau
 * navigasi layar penuh, cukup tambah prop onLihatResi di Ringkasan dan teruskan
 * ke setLayar({ nama: "resi", transaksiId }) di App.
 *
 * Pengecualian: pesanan JAHIT tidak dibuka lewat Resi.tsx — dokumennya memakai
 * dokumen.ts (renderPng, sama seperti DetailPesananJahit), karena susunResi
 * tidak mengenal biaya lain jahitan (hanya tersimpan di catatanPesanan) sehingga
 * rincian item di resi itu tidak cocok dengan totalnya.
 */
/** Logo Blob -> ImageBitmap untuk kanvas PNG; null bila tidak ada/gagal. */
async function buatImageBitmap(blob: Blob | null): Promise<ImageBitmap | null> {
  try {
    if (!blob || typeof createImageBitmap !== "function") return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function PratinjauDokumenJahit({ transaksiId }: { transaksiId: string }) {
  const [png, setPng] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dokumen, setDokumen] = useState<DataDokumen | null>(null);
  const [meta, setMeta] = useState<{ pelangganId: string | null; sisa: number } | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let hidup = true;
    let objectUrl: string | null = null;
    (async () => {
      const [lengkap, pesanan] = await Promise.all([ambilTransaksi(transaksiId), ambilPesananJahit(transaksiId)]);
      if (!hidup || !lengkap || !pesanan) {
        if (hidup) setPesan("Dokumen tidak dapat dimuat.");
        return;
      }
      // Logo pengaturan (bila gagal dibaca, pratinjau tetap jalan tanpa logo).
      const s: SettingsRecord | null = await ambilSettings().catch(() => null);
      const logo = s?.logo ? await buatImageBitmap(s.logo) : null;
      const t = lengkap.transaksi;
      // Susunan DataDokumen mengikuti DetailPesananJahit persis: item dari
      // transaction_items (BU-55); kop + rekening + penutup dari Pengaturan.
      const d: DataDokumen = {
        nomor: t.nomorResi,
        tanggal: t.waktu,
        namaPemesan: t.namaPemesan ?? "(tanpa nama)",
        items: pesanan.items.map((i) => ({ nama: i.nama, kuantitas: i.kuantitas, harga: i.harga, ukuran: i.ukuran })),
        perkiraanSelesai: t.perkiraanSiap,
        biayaLain: pesanan.biayaLain,
        total: t.total,
        terbayar: pesanan.terbayar,
        ...(s
          ? {
              alamat: [s.alamatBaris1, s.alamatBaris2, s.kotaKodePos],
              telepon: [s.telepon1, s.telepon2],
              rekening: s.rekening,
              teksPenutup: s.teksPenutup,
            }
          : {}),
      };
      const blob = await renderPng(d, { logo });
      if (!hidup) return;
      objectUrl = URL.createObjectURL(blob);
      setPng(blob);
      setUrl(objectUrl);
      setDokumen(d);
      setMeta({ pelangganId: t.pelangganId, sisa: pesanan.sisa });
    })().catch(() => {
      if (hidup) setPesan("Dokumen tidak dapat dimuat.");
    });
    return () => {
      hidup = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [transaksiId]);

  async function bagikan() {
    if (!png || !dokumen || !meta || sibuk) return;
    setSibuk(true);
    setPesan(null);
    try {
      const jenis = judulDokumen(meta.sisa);
      const hasil = await bagikanDokumen(png, NAMA_FILE_DOKUMEN(dokumen.nomor));
      await catatPengiriman(transaksiId, meta.pelangganId, jenis, hasil === "dibagikan" ? "whatsapp" : "galeri");
      setPesan(hasil === "dibagikan" ? "Dokumen siap dibagikan." : "Dokumen disimpan ke galeri.");
    } catch {
      setPesan("Dokumen belum bisa dibuat. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  if (pesan && !dokumen) {
    return (
      <div className="panel panel--warn" role="alert" style={{ marginTop: "0.5rem" }}>
        {pesan}
      </div>
    );
  }

  if (!dokumen || !url) {
    return (
      <p className="soft" style={{ marginTop: "0.5rem" }}>
        Menyiapkan dokumen…
      </p>
    );
  }

  return (
    <>
      {pesan && (
        <div className="panel panel--ok" role="status" style={{ marginTop: "0.5rem" }}>
          {pesan}
        </div>
      )}
      <img
        src={url}
        alt={`Dokumen ${dokumen.nomor}`}
        style={{ width: "100%", marginTop: "0.5rem", borderRadius: "0.5rem" }}
      />
      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={bagikan} disabled={sibuk}>
          {sibuk ? "Membuat dokumen…" : "Bagikan Dokumen"}
        </button>
      </div>
    </>
  );
}
