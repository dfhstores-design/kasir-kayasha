import { useEffect, useState } from "react";
import {
  ambilTutupHarian,
  buatId,
  daftarPembayaran,
  daftarTransaksi,
  simpanTutupHarian,
} from "../db/repositori.ts";
import { getDB, type TutupHarianRecord } from "../db/schema.ts";
import { hitungRingkasanKeuangan, metodeBayarSah } from "../lib/bazar.ts";
import { formatRupiah } from "../lib/money.ts";
import type { Peran } from "../lib/peran.ts";
import { formatJam, formatTanggal, tanggalHariIni } from "../lib/tanggal.ts";
import { catatLogSinkron } from "../sync/tarik.ts";

interface Props {
  /** Bazar kasir ini (null = toko/gudang). */
  bazarId: string | null;
  /** Label lokasi yang tampil di judul, mis. "Bazar Plaza Senayan" atau "Toko". */
  label: string;
  /** Peran yang membuka layar — dicatat di jejak penutupan. */
  peran: Peran;
}

/**
 * Tutup harian untuk kasir (Fase 2C, BU-34): "saat tutup harian aplikasi
 * menampilkan uang tunai yang seharusnya ada di tangan kasir".
 *
 * Sengaja HANYA menampilkan angka harian kasir sendiri — tanpa omzet total,
 * laba, biaya, atau riwayat (itu tetap di layar Ringkasan khusus admin).
 * Angka dihitung dari baris pembayaran (F2), bukan total pesanan: DP tunai +
 * pelunasan transfer dihitung terpisah per metode.
 *
 * (c, tes klik 22 Nov 2026): layar ini dulu hanya ringkasan baca saja —
 * tidak ada tombol tutup/konfirmasi dan tidak ada jejak penutupan. Sekarang
 * ada satu tombol besar "Tutup Harian": ditekan → konfirmasi dua langkah
 * di dalam aplikasi (bukan window.confirm, pelajaran C1) → hari itu
 * tercatat ditutup (tanggal + kasir + ringkasan, di store tutupHarian dan
 * di logSinkron untuk owner). Sesudah ditutup, layar menampilkan jejak
 * penutupannya; buka lagi besok untuk hari berikutnya.
 *
 * (b, tes klik 22 Nov 2026): pengembalian dipisah dua baris — "Pengembalian
 * DP (pesanan jahit)" dan "Pengembalian penjualan batal" — supaya tidak
 * tercampur di bawah satu label "DP".
 */
export default function TutupHarian({ bazarId, label, peran }: Props) {
  const [memuat, setMemuat] = useState(true);
  const [jumlahTransaksi, setJumlahTransaksi] = useState(0);
  const [uangMasuk, setUangMasuk] = useState(0);
  const [tunai, setTunai] = useState(0);
  const [transfer, setTransfer] = useState(0);
  const [qris, setQris] = useState(0);
  const [pengembalianDp, setPengembalianDp] = useState(0);
  const [pengembalianBatal, setPengembalianBatal] = useState(0);
  /** Jejak penutupan hari ini di lokasi ini (null = belum ditutup). */
  const [ditutup, setDitutup] = useState<TutupHarianRecord | null>(null);
  /** Konfirmasi dua langkah di dalam aplikasi (C1). */
  const [mintaKonfirmasi, setMintaKonfirmasi] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  const hari = tanggalHariIni();

  useEffect(() => {
    let hidup = true;
    (async () => {
      const [semuaTrx, semuaBayar, tutup] = await Promise.all([
        daftarTransaksi(),
        daftarPembayaran(),
        ambilTutupHarian(hari, bazarId),
      ]);
      const bayarPerTrx = new Map<string, typeof semuaBayar>();
      for (const p of semuaBayar) {
        const daftar = bayarPerTrx.get(p.transaksiId) ?? [];
        daftar.push(p);
        bayarPerTrx.set(p.transaksiId, daftar);
      }
      const harian = hitungRingkasanKeuangan(
        semuaTrx
          .filter((t) => t.bazarId === bazarId)
          .map((t) => ({
            total: t.total,
            jenisBayar: metodeBayarSah(t.jenisBayar),
            dibatalkan: t.dibatalkanPada !== null,
            waktu: t.waktu,
            jenisDokumen: t.jenisDokumen,
            pembayaran: (bayarPerTrx.get(t.id) ?? []).map((p) => ({
              nominal: p.nominal,
              metode: metodeBayarSah(p.metode),
              waktu: p.waktu,
            })),
          })),
        [],
        hari,
      );
      if (!hidup) return;
      setJumlahTransaksi(harian.jumlahTransaksi);
      setUangMasuk(harian.uangMasuk);
      setTunai(harian.tunai);
      setTransfer(harian.transfer);
      setQris(harian.qris);
      setPengembalianDp(harian.pengembalianDp);
      setPengembalianBatal(harian.pengembalianBatal);
      setDitutup(tutup);
      setMemuat(false);
    })().catch(() => setMemuat(false));
    return () => {
      hidup = false;
    };
  }, [bazarId, hari]);

  /** Langkah tutup: klik pertama membuka panel konfirmasi, klik kedua mencatat. */
  const tutup = async () => {
    if (!mintaKonfirmasi) {
      setPesan(null);
      setMintaKonfirmasi(true);
      return;
    }
    setMintaKonfirmasi(false);
    setSibuk(true);
    setPesan(null);
    try {
      const record: TutupHarianRecord = {
        id: buatId(),
        tanggal: hari,
        bazarId,
        label,
        peran,
        jumlahTransaksi,
        uangMasuk,
        tunai,
        transfer,
        qris,
        pengembalian: pengembalianDp + pengembalianBatal,
        pengembalianDp,
        pengembalianBatal,
        ditutupPada: new Date().toISOString(),
      };
      await simpanTutupHarian(record);
      // Jejak di log sinkron (jenis "info", dibaca owner di Riwayat Sinkron).
      try {
        const db = await getDB();
        await catatLogSinkron(db, {
          jenis: "info",
          judul: `Tutup harian ${label} ${formatTanggal(hari)}`,
          rincian: `Ditutup ${peran}, ${jumlahTransaksi} transaksi, uang masuk ${formatRupiah(uangMasuk)} (tunai ${formatRupiah(tunai)}).`,
        });
      } catch {
        // Log gagal ditulis: penutupan lokal sudah sah — log hanyalah catatan.
      }
      setDitutup(record);
      setPesan("Tutup harian sudah dicatat.");
    } catch {
      setPesan("Tutup harian belum tercatat. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  };

  if (memuat) {
    return (
      <div className="content">
        <p className="soft">Menghitung tutup harian…</p>
      </div>
    );
  }

  return (
    <div className="content">
      <div>
        <p className="h2" style={{ margin: 0 }}>
          Tutup Harian — {label}
        </p>
        <p className="soft" style={{ margin: 0 }}>
          {formatTanggal(hari)}
        </p>
      </div>

      {ditutup && (
        <div className="panel panel--ok" role="status">
          <strong>Sudah ditutup pukul {formatJam(ditutup.ditutupPada)}.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>
            {ditutup.jumlahTransaksi} transaksi, uang masuk {formatRupiah(ditutup.uangMasuk)} (tunai{" "}
            {formatRupiah(ditutup.tunai)}).
          </p>
        </div>
      )}

      {pesan && !ditutup && (
        <div className="panel panel--warn" role="alert">
          {pesan}
        </div>
      )}

      <div className="card">
        <div className="ringkas">
          <span>Transaksi hari ini</span>
          <span className="money">{jumlahTransaksi}</span>
        </div>
        <div className="ringkas">
          <span>Uang masuk hari ini</span>
          <span className="money">{formatRupiah(uangMasuk)}</span>
        </div>
        {pengembalianDp > 0 && (
          <div className="ringkas soft">
            <span>Pengembalian DP (pesanan jahit) hari ini</span>
            <span>− {formatRupiah(pengembalianDp)}</span>
          </div>
        )}
        {pengembalianBatal > 0 && (
          <div className="ringkas soft">
            <span>Pengembalian penjualan batal hari ini</span>
            <span>− {formatRupiah(pengembalianBatal)}</span>
          </div>
        )}
        <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
        <div className="ringkas">
          <strong>Uang tunai di tangan</strong>
          <strong className="money" style={{ fontSize: "1.5rem" }}>
            {formatRupiah(tunai)}
          </strong>
        </div>
        <div className="ringkas soft">
          <span>Transfer</span>
          <span>{formatRupiah(transfer)}</span>
        </div>
        <div className="ringkas soft">
          <span>QRIS</span>
          <span>{formatRupiah(qris)}</span>
        </div>
      </div>

      <p className="hint">
        Hitung uang tunai fisik dengan angka di atas. Angka dihitung dari pembayaran yang sudah
        diterima — pesanan yang baru DP dihitung sebesar DP-nya.
      </p>

      {mintaKonfirmasi && (
        <div className="panel panel--warn" role="alert">
          <strong>Tutup harian {label} hari ini?</strong>
          <p style={{ margin: "0.25rem 0 0" }}>
            {jumlahTransaksi} transaksi, uang masuk {formatRupiah(uangMasuk)} (tunai {formatRupiah(tunai)}).
            Sesudah ditutup, ringkasan hari ini tetap bisa dilihat.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="button" className="btn btn--primary" onClick={tutup} disabled={sibuk}>
              {sibuk ? "Mencatat…" : "Ya, Tutup Harian"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setMintaKonfirmasi(false)}
              disabled={sibuk}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="bottombar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={tutup}
          disabled={sibuk || !!ditutup}
        >
          {ditutup ? "Sudah Ditutup Hari Ini" : sibuk ? "Mencatat…" : "Tutup Harian"}
        </button>
      </div>
    </div>
  );
}
