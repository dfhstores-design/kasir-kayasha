import { useEffect, useState } from "react";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal } from "../lib/tanggal.ts";
import {
  ambilPesananJahit,
  labelStatusJahitan,
  catatPengiriman,
  type PesananJahitLengkap,
} from "../lib/jahitan.ts";
import { ambilSettings, type SettingsRecord } from "../db/repositori.ts";
import {
  NAMA_FILE_DOKUMEN,
  renderPng,
  bagikanDokumen,
  type DataDokumen,
} from "../lib/dokumen.ts";

interface Props {
  id: string;
  onKembali: () => void;
  segarkan: number;
  /** Buka layar terima pembayaran (KasirDetail) untuk pesanan ini. */
  onTerimaPembayaran?: () => void;
  /** Buka form ubah pesanan (BU-56). */
  onUbah?: () => void;
}

/**
 * Detail pesanan jahit: status, sisa tagihan, dan tombol Lihat/Bagikan dokumen.
 * Invoice menampilkan SISA (BU-26.C) untuk menagih sopan; judul otomatis invoice/resi
 * (K-02). Log pengiriman dicatat otomatis (BU-27/BU-28).
 */
export default function DetailPesananJahit({ id, onKembali, segarkan, onTerimaPembayaran, onUbah }: Props) {
  const [data, setData] = useState<PesananJahitLengkap | null>(null);
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    ambilPesananJahit(id)
      .then((d) => {
        if (hidup) setData(d ?? null);
      })
      .catch(() => {
        if (hidup) setData(null);
      });
    ambilSettings()
      .then((s) => {
        if (hidup) setSettings(s);
      })
      .catch(() => {
        if (hidup) setSettings(null);
      });
    return () => {
      hidup = false;
    };
  }, [id, segarkan]);

  if (data === null) {
    return (
      <div className="content">
        <p className="soft">Memuat pesanan…</p>
      </div>
    );
  }

  const t = data.transaksi;
  const dokumen: DataDokumen = {
    nomor: t.nomorResi,
    tanggal: t.waktu,
    namaPemesan: t.namaPemesan ?? "(tanpa nama)",
    items: data.items.map((i) => ({ nama: i.nama, kuantitas: i.kuantitas, harga: i.harga, ukuran: i.ukuran })),
    perkiraanSelesai: t.perkiraanSiap,
    biayaLain: data.biayaLain,
    total: t.total,
    terbayar: data.terbayar,
    // Kop + rekening + penutup dari Pengaturan (BU-51/52/53/54); bila
    // Pengaturan belum termuat, dokumen memakai bawaan (KOP_DOKUMEN).
    ...(settings
      ? {
          alamat: [settings.alamatBaris1, settings.alamatBaris2, settings.kotaKodePos],
          telepon: [settings.telepon1, settings.telepon2],
          rekening: settings.rekening,
          teksPenutup: settings.teksPenutup,
        }
      : {}),
  };
  const jenisJudul = data.sisa > 0 ? "invoice" : "resi";

  async function bagikan() {
    if (sibuk) return;
    setSibuk(true);
    setPesan(null);
    try {
      const logo = settings?.logo ? await buatImageBitmap(settings.logo) : null;
      const png = await renderPng(dokumen, { logo });
      const hasil = await bagikanDokumen(png, NAMA_FILE_DOKUMEN(t.nomorResi));
      await catatPengiriman(t.id, t.pelangganId, jenisJudul, hasil === "dibagikan" ? "whatsapp" : "galeri");
      setPesan(hasil === "dibagikan" ? "Dokumen siap dibagikan." : "Dokumen disimpan ke galeri.");
    } catch {
      setPesan("Dokumen belum bisa dibuat. Coba lagi.");
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

        <div>
          <p className="h1" style={{ margin: 0 }}>
            {t.namaPemesan ?? "(tanpa nama)"}
          </p>
          {t.kontak && <p className="soft" style={{ margin: "0.25rem 0 0" }}>{t.kontak}</p>}
          <div className="pilihan" style={{ marginTop: "0.5rem" }}>
            <span className="chip">{labelStatusJahitan(data.status)}</span>
            {data.sudahDikirim && <span className="chip">✓ sudah dikirim</span>}
          </div>
        </div>

        <div className="card">
          {dokumen.items.map((it, i) => (
            <div key={i} style={i > 0 ? { marginTop: "0.5rem" } : undefined}>
              <div className="ringkas">
                <span className="soft">
                  {it.nama}
                  {it.kuantitas > 1 ? ` ×${it.kuantitas}` : ""}
                </span>
                <span>{formatRupiah(it.harga * it.kuantitas)}</span>
              </div>
              {it.ukuran && (
                <div className="ringkas" style={{ marginTop: "0.25rem" }}>
                  <span className="soft">Ukuran/catatan khusus</span>
                  <span>{it.ukuran}</span>
                </div>
              )}
            </div>
          ))}
          {dokumen.perkiraanSelesai && (
            <div className="ringkas" style={{ marginTop: "0.25rem" }}>
              <span className="soft">Perkiraan selesai</span>
              <span>{formatTanggal(dokumen.perkiraanSelesai)}</span>
            </div>
          )}
          <div className="ringkas" style={{ marginTop: "0.25rem" }}>
            <span className="soft">Nomor</span>
            <span>{t.nomorResi}</span>
          </div>
        </div>

        <div className="card">
          {data.biayaLain.map((b, i) => (
            <div className="ringkas" key={i} style={{ marginTop: "0.25rem" }}>
              <span className="soft">{b.nama}</span>
              <span>{formatRupiah(b.nominal)}</span>
            </div>
          ))}
          <div className="ringkas" style={{ marginTop: "0.5rem" }}>
            <strong>TOTAL</strong>
            <strong className="money">{formatRupiah(t.total)}</strong>
          </div>
          <div className="ringkas" style={{ marginTop: "0.25rem" }}>
            <span className="soft">Terbayar</span>
            <span>{formatRupiah(data.terbayar)}</span>
          </div>
          <div className="ringkas" style={{ marginTop: "0.25rem" }}>
            <strong>SISA</strong>
            <strong className="money" style={{ fontSize: "1.375rem", color: data.sisa > 0 ? "var(--primary)" : "var(--accent-ink)" }}>
              {formatRupiah(data.sisa)}
            </strong>
          </div>
        </div>
      </div>

      <div className="bottombar">
        {data.sisa > 0 && onTerimaPembayaran && (
          <button type="button" className="btn btn--primary" onClick={onTerimaPembayaran}>
            Terima Pembayaran
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={bagikan} disabled={sibuk}>
          {sibuk ? "Membuat dokumen…" : data.sisa > 0 ? "Lihat & Bagikan Invoice" : "Lihat & Bagikan Resi"}
        </button>
        {data.status !== "batal" && onUbah && (
          <button type="button" className="btn btn--ghost" onClick={onUbah}>
            Ubah Pesanan
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--small" onClick={onKembali}>
          Kembali
        </button>
      </div>
    </>
  );
}

/** Logo Blob -> ImageBitmap untuk kanvas PNG; null bila tidak ada/gagal. */
async function buatImageBitmap(blob: Blob | null): Promise<ImageBitmap | null> {
  try {
    if (!blob || typeof createImageBitmap !== "function") return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}