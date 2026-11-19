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
}

/**
 * Detail pesanan jahit: status, sisa tagihan, dan tombol Lihat/Bagikan dokumen.
 * Invoice menampilkan SISA (BU-26.C) untuk menagih sopan; judul otomatis invoice/resi
 * (K-02). Log pengiriman dicatat otomatis (BU-27/BU-28).
 */
export default function DetailPesananJahit({ id, onKembali, segarkan, onTerimaPembayaran }: Props) {
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
  const biayaLainTotal = data.biayaLain.reduce((n, b) => n + b.nominal, 0);
  const biayaJasa = t.subtotalAwal - biayaLainTotal;
  const dokumen: DataDokumen = {
    nomor: t.nomorResi,
    tanggal: t.waktu,
    namaPemesan: t.namaPemesan ?? "(tanpa nama)",
    model: modelDariCatatan(t.catatanPesanan),
    ukuran: ukuranDariCatatan(t.catatanPesanan),
    perkiraanSelesai: t.perkiraanSiap,
    biayaJasa,
    biayaLain: data.biayaLain,
    total: t.total,
    terbayar: data.terbayar,
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
          <div className="ringkas">
            <span className="soft">Model / Jenis</span>
            <strong>{dokumen.model}</strong>
          </div>
          {dokumen.ukuran && (
            <div className="ringkas" style={{ marginTop: "0.25rem" }}>
              <span className="soft">Ukuran</span>
              <span>{dokumen.ukuran}</span>
            </div>
          )}
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
          <div className="ringkas">
            <span className="soft">Biaya jasa</span>
            <span>{formatRupiah(biayaJasa)}</span>
          </div>
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

function modelDariCatatan(catatan: string | null): string {
  return catatan?.split(" · ")[0]?.trim() || "Jasa jahit";
}

function ukuranDariCatatan(catatan: string | null): string | null {
  const bagian = catatan?.split(" · ")[1]?.trim();
  return bagian && !bagian.includes(":") ? bagian : null;
}