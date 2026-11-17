import { useEffect, useMemo, useState } from "react";
import { ambilSettings, daftarBazar, type SettingsRecord } from "../db/repositori.ts";
import { ambilPesanan, type PesananLengkap } from "../db/pesananOperasi.ts";
import { susunResi, NAMA_FILE_RESI, NAMA_BUTIK_BAWAAN, subjudulDariNama, type DataResi } from "../lib/resi.ts";
import PratinjauResi from "../components/PratinjauResi.tsx";

import { sapaanDariWaktu } from "../lib/sapaan.ts";

interface Props {
  transaksiId: string;
  onSelesai: () => void;
}

/**
 * Layar 6 — Resi (PDF). Pratinjau memakai `susunResi` yang SAMA dengan PDF,
 * sehingga yang dilihat pasti sama dengan yang dibagikan. Dibuat di perangkat,
 * jadi tetap bekerja saat offline.
 */
export default function Resi({ transaksiId }: Props) {
  const [data, setData] = useState<DataResi | null>(null);
  const [logo, setLogo] = useState<Blob | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const [s, l, bazar] = await Promise.all([ambilSettings(), ambilPesanan(transaksiId), daftarBazar()]);
      if (!hidup || !l) return;
      setLogo(s.logo);
      setData(dariPesanan(l, s, bazar.find((x) => x.id === l.transaksi.bazarId)?.nama ?? null));
    })().catch(() => setPesan("Resi tidak dapat dimuat."));
    return () => {
      hidup = false;
    };
  }, [transaksiId]);

  const baris = useMemo(() => (data ? susunResi(data) : []), [data]);

  // URL pratinjau DITURUNKAN dari `logo` (bukan disimpan di state) agar tidak ada
  // render berantai; dilepas saat logo berubah atau komponen dilepas.
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => {
    const u = logoUrl;
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [logoUrl]);

  if (pesan) {
    return (
      <div className="content">
        <div className="panel panel--warn" role="alert">
          {pesan}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="content">
        <p className="soft">Menyiapkan resi…</p>
      </div>
    );
  }

  async function bagikan() {
    if (!data) return;
    setSibuk(true);
    setPesan(null);
    try {
      const { buatPdfResi, bagikanAtauUnduh } = await import("../lib/pdfResi.ts");
      const blob = await buatPdfResi(baris, { judul: `Resi ${data.nomorResi}`, logo });
      const hasil = await bagikanAtauUnduh(blob, NAMA_FILE_RESI(data.nomorResi));
      setPesan(hasil === "dibagikan" ? "Resi dibagikan." : "PDF disimpan di folder Unduhan.");
    } catch {
      setPesan("PDF belum bisa dibuat. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="content">
        {pesan && (
          <div className="panel panel--ok" role="status">
            {pesan}
          </div>
        )}

        <PratinjauResi baris={baris} logoUrl={logoUrl} />
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={bagikan} disabled={sibuk}>
          {sibuk ? "Membuat PDF…" : "Bagikan PDF"}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={bagikan} disabled={sibuk}>
          Simpan PDF
        </button>
      </div>
    </>
  );
}


/** Menyusun DataResi dari transaksi tersimpan + pengaturan saat ini. */
function dariPesanan(l: PesananLengkap, s: SettingsRecord, namaBazar: string | null): DataResi {
  const t = l.transaksi;
  const rekening = t.rekeningSnapshot.length > 0 ? t.rekeningSnapshot : s.rekening;
  const namaButik = s.namaButik.trim() || NAMA_BUTIK_BAWAAN;
  // Metode bayar terakhir; transfer dilengkapi nama bank utama ("Transfer BCA").
  const bayarTerakhir = l.pembayaran[l.pembayaran.length - 1];
  const bankUtama = rekening.find((r) => r.utama) ?? rekening[0];
  const metodeBayar = bayarTerakhir?.metode
    ? bayarTerakhir.metode === "transfer" && bankUtama
      ? `Transfer ${bankUtama.namaBank}`
      : bayarTerakhir.metode === "tunai"
        ? "Tunai"
        : bayarTerakhir.metode === "qris"
          ? "QRIS"
          : bayarTerakhir.metode
    : null;
  return {
    nomorResi: t.nomorResi,
    nomorUrutHari: t.nomorUrutHari,
    waktu: t.waktu,
    jenis: t.jenis,
    sapaan: t.sapaan ?? sapaanDariWaktu(new Date(t.waktu)),
    namaButik,
    subjudulButik: subjudulDariNama(namaButik),
    alamat: [s.alamatBaris1, s.alamatBaris2, s.kotaKodePos].filter((x) => x.trim()),
    telepon: [s.telepon1, s.telepon2].filter((x) => x.trim()),
    logoAda: !!s.logo,
    contohFiktif: false,
    lokasi: t.jenis === "langsung" ? namaBazar : null,
    pembeli: t.jenis === "langsung" ? t.namaPemesan : null,
    metodeBayar,
    // Model pesanan jahit (jenis jahitan, biaya jasa) BELUM ada di skema
    // transaksi — jenisJahitan sengaja null, bukan ditebak dari nama barang.
    jenisJahitan: null,
    catatanPesanan: t.catatanPesanan,
    items: l.item.map((i) => ({
      nama: i.namaSnapshot,
      kuantitas: i.kuantitas,
      hargaSatuan: i.hargaSatuan,
      diskonPerUnit: i.diskonPerUnit,
      ...(t.jenis === "langsung"
        ? { keterangan: t.bazarId ? "Barang stok bazar" : "Barang stok gudang" }
        : {}),
    })),
    subtotalAwal: t.subtotalAwal,
    diskonItem: t.diskonItem,
    diskonTotal: t.diskonTotal,
    ongkir: { mode: t.ongkirMode, nominal: t.ongkirNominal },
    total: t.total,
    pembayaran: l.pembayaran.map((p) => ({ waktu: p.waktu, nominal: p.nominal, metode: p.metode, catatan: p.catatan })),
    statusBayar: t.statusBayar,
    dibatalkan: t.dibatalkanPada !== null || t.statusPesanan === "dibatalkan",
    perkiraanSiap: t.perkiraanSiap,
    namaPemesan: t.namaPemesan,
    rekening,
    teksPenutup: s.teksPenutup,
    tampilkanSapaan: s.tampilkanSapaan,
    tampilkanNomorResi: s.tampilkanNomorResi,
    tampilkanRincianDiskon: s.tampilkanRincianDiskon,
    tampilkanPembayaranSisa: s.tampilkanPembayaranSisa,
  };
}



