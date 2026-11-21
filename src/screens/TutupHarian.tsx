import { useEffect, useState } from "react";
import { daftarPembayaran, daftarTransaksi } from "../db/repositori.ts";
import { hitungRingkasanKeuangan, metodeBayarSah } from "../lib/bazar.ts";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal, tanggalHariIni } from "../lib/tanggal.ts";

interface Props {
  /** Bazar kasir ini (null = toko/gudang). */
  bazarId: string | null;
  /** Label lokasi yang tampil di judul, mis. "Bazar Plaza Senayan" atau "Toko". */
  label: string;
}

/**
 * Tutup harian untuk kasir (Fase 2C, BU-34): "saat tutup harian aplikasi
 * menampilkan uang tunai yang seharusnya ada di tangan kasir".
 *
 * Sengaja HANYA menampilkan angka harian kasir sendiri — tanpa omzet total,
 * laba, biaya, atau riwayat (itu tetap di layar Ringkasan khusus admin).
 * Angka dihitung dari baris pembayaran (F2), bukan total pesanan: DP tunai +
 * pelunasan transfer dihitung terpisah per metode.
 */
export default function TutupHarian({ bazarId, label }: Props) {
  const [memuat, setMemuat] = useState(true);
  const [jumlahTransaksi, setJumlahTransaksi] = useState(0);
  const [uangMasuk, setUangMasuk] = useState(0);
  const [tunai, setTunai] = useState(0);
  const [transfer, setTransfer] = useState(0);
  const [qris, setQris] = useState(0);
  const [pengembalian, setPengembalian] = useState(0);

  const hari = tanggalHariIni();

  useEffect(() => {
    let hidup = true;
    (async () => {
      const [semuaTrx, semuaBayar] = await Promise.all([daftarTransaksi(), daftarPembayaran()]);
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
      setPengembalian(harian.pengembalian);
      setMemuat(false);
    })().catch(() => setMemuat(false));
    return () => {
      hidup = false;
    };
  }, [bazarId, hari]);

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

      <div className="card">
        <div className="ringkas">
          <span>Transaksi hari ini</span>
          <span className="money">{jumlahTransaksi}</span>
        </div>
        <div className="ringkas">
          <span>Uang masuk hari ini</span>
          <span className="money">{formatRupiah(uangMasuk)}</span>
        </div>
        {pengembalian > 0 && (
          <div className="ringkas soft">
            <span>Pengembalian DP hari ini</span>
            <span>− {formatRupiah(pengembalian)}</span>
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
    </div>
  );
}
