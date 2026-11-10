import { useEffect, useMemo, useState } from "react";
import { ambilSettings, type SettingsRecord } from "../db/repositori.ts";
import { ambilPesanan, type PesananLengkap } from "../db/pesananOperasi.ts";
import { susunResi, NAMA_FILE_RESI, type DataResi } from "../lib/resi.ts";
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
      const [s, l] = await Promise.all([ambilSettings(), ambilPesanan(transaksiId)]);
      if (!hidup || !l) return;
      setLogo(s.logo);
      setData(dariPesanan(l, s));
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
function dariPesanan(l: PesananLengkap, s: SettingsRecord): DataResi {
  const t = l.transaksi;
  const rekening = t.rekeningSnapshot.length > 0 ? t.rekeningSnapshot : s.rekening;
  return {
    nomorResi: t.nomorResi,
    nomorUrutHari: t.nomorUrutHari,
    waktu: t.waktu,
    jenis: t.jenis,
    sapaan: t.sapaan ?? sapaanDariWaktu(new Date(t.waktu)),
    namaButik: s.namaButik || "Kasir Kayasha",
    alamat: [s.alamatBaris1, s.alamatBaris2, s.kotaKodePos].filter((x) => x.trim()),
    telepon: [s.telepon1, s.telepon2].filter((x) => x.trim()),
    logoAda: !!s.logo,
    items: l.item.map((i) => ({
      nama: i.namaSnapshot,
      kuantitas: i.kuantitas,
      hargaSatuan: i.hargaSatuan,
      diskonPerUnit: i.diskonPerUnit,
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



