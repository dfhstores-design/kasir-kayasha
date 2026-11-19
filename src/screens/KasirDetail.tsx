import { useCallback, useEffect, useState } from "react";
import {
  ambilPesananJahit,
  catatPengiriman,
  labelStatusJahitan,
  type PesananJahitLengkap,
} from "../lib/jahitan.ts";
import { ambilSettings, type SettingsRecord } from "../db/repositori.ts";
import { batalkanPesananKasir, terimaPembayaranKasir } from "../db/kasirOperasi.ts";
import { terimaPembayaran } from "../lib/pembayaran.ts";
import { formatRupiah, parseRupiah } from "../lib/money.ts";
import { dalamRupiah } from "../lib/ketikUang.ts";
import type { DataDokumen } from "../lib/dokumen.ts";
import { formatTanggal } from "../lib/tanggal.ts";

interface Props {
  id: string;
  onKembali: () => void;
}

type Lembar = "tidak-ada" | "batal";

/**
 * Detail pesanan di sisi KASIR: terima pembayaran (boleh lebih, tampil kembalian),
 * bagikan/simpan dokumen invoice/resi (PNG), dan void dengan alasan (BU-23, BU-26, BU-17.C).
 * Data pesanan & log pengiriman dipakai ulang dari `lib/jahitan.ts` (agent ui-tante).
 */
export default function KasirDetail({ id, onKembali }: Props) {
  const [data, setData] = useState<PesananJahitLengkap | null>(null);
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [nominalTeks, setNominalTeks] = useState("");
  const [metode, setMetode] = useState<string | null>("tunai");
  const [hasilTerima, setHasilTerima] = useState<{ kembalian: number; sisa: number } | null>(null);
  const [lembar, setLembar] = useState<Lembar>("tidak-ada");
  const [alasan, setAlasan] = useState("");

  const muat = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([ambilPesananJahit(id), ambilSettings()]);
      setData(p ?? null);
      setSettings(s);
    } catch {
      setGalat("Data pesanan tidak dapat dimuat.");
    }
  }, [id]);

  useEffect(() => {
    // Pola sama seperti DetailPesananJahit: setState hanya di dalam
    // callback promise (bukan langsung di badan effect).
    let hidup = true;
    Promise.all([ambilPesananJahit(id), ambilSettings()])
      .then(([p, s]) => {
        if (!hidup) return;
        setData(p ?? null);
        setSettings(s);
      })
      .catch(() => {
        if (hidup) setGalat("Data pesanan tidak dapat dimuat.");
      });
    return () => {
      hidup = false;
    };
  }, [id]);

  if (galat && !data) {
    return (
      <div className="content">
        <div className="panel panel--warn" role="alert">{galat}</div>
        <button type="button" className="btn btn--ghost btn--small" onClick={onKembali}>Kembali</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="content">
        <p className="soft">Memuat pesanan…</p>
      </div>
    );
  }

  const t = data.transaksi;
  const penuh = data;

  const nominalAngka = parseRupiah(nominalTeks);
  const pratinjau =
    nominalAngka.ok && nominalAngka.value > 0
      ? terimaPembayaran(t.total, data.terbayar, nominalAngka.value)
      : null;
  const nominalSah = nominalAngka.ok && nominalAngka.value > 0 && data.status === "terbuka";

  async function simpanPembayaran() {
    if (!nominalSah) return;
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    const hasil = await terimaPembayaranKasir(id, nominalAngka.value, metode);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.pesan);
      return;
    }
    setHasilTerima({ kembalian: hasil.kembalian, sisa: hasil.sisa });
    setNominalTeks("");
    await muat();
  }

  function susunDokumen(): DataDokumen {
    return {
      nomor: t.nomorResi,
      tanggal: t.waktu,
      namaPemesan: t.namaPemesan ?? "(tanpa nama)",
      items: penuh.items.map((i) => ({ nama: i.nama, kuantitas: i.kuantitas, harga: i.harga, ukuran: i.ukuran })),
      perkiraanSelesai: t.perkiraanSiap,
      biayaLain: penuh.biayaLain,
      total: t.total,
      terbayar: penuh.terbayar,
      ...(settings
        ? {
            alamat: [settings.alamatBaris1, settings.alamatBaris2, settings.kotaKodePos],
            telepon: [settings.telepon1, settings.telepon2],
            rekening: settings.rekening,
            teksPenutup: settings.teksPenutup,
          }
        : {}),
    };
  }

  async function bagikan() {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      const { renderPng, bagikanDokumen, NAMA_FILE_DOKUMEN } = await import("../lib/dokumen.ts");
      const dokumen = susunDokumen();
      const logo = settings?.logo ? await buatImageBitmap(settings.logo) : null;
      const blob = await renderPng(dokumen, { logo });
      await bagikanDokumen(blob, NAMA_FILE_DOKUMEN(dokumen.nomor));
      await catatPengiriman(t.id, t.pelangganId, penuh.sisa > 0 ? "invoice" : "resi", "whatsapp");
      setPesan("Dokumen dibagikan.");
      await muat();
    } catch {
      setGalat("Dokumen belum bisa dibuat. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  async function simpanFoto() {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      const { renderPng, simpanKeFoto, NAMA_FILE_DOKUMEN } = await import("../lib/dokumen.ts");
      const dokumen = susunDokumen();
      const logo = settings?.logo ? await buatImageBitmap(settings.logo) : null;
      const blob = await renderPng(dokumen, { logo });
      await simpanKeFoto(blob, NAMA_FILE_DOKUMEN(dokumen.nomor));
      await catatPengiriman(t.id, t.pelangganId, penuh.sisa > 0 ? "invoice" : "resi", "galeri");
      setPesan("Dokumen disimpan ke foto.");
      await muat();
    } catch {
      setGalat("Dokumen belum bisa dibuat. Coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  async function voidPesanan() {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    const hasil = await batalkanPesananKasir(id, alasan);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.pesan);
      return;
    }
    setAlasan("");
    setLembar("tidak-ada");
    setPesan("Pesanan dibatalkan.");
    await muat();
  }

  return (
    <>
      <div className="content">
        {galat && <div className="panel panel--warn" role="alert">{galat}</div>}
        {pesan && <div className="panel panel--ok" role="status">{pesan}</div>}

        <div>
          <p className="h1" style={{ margin: 0 }}>{t.namaPemesan ?? "(tanpa nama)"}</p>
          {t.kontak && <p className="soft" style={{ margin: "0.125rem 0 0" }}>{t.kontak}</p>}
          <div className="pilihan" style={{ marginTop: "0.5rem" }}>
            <span className="chip">{labelStatusJahitan(data.status)}</span>
            {data.sudahDikirim && <span className="chip">✓ sudah dikirim</span>}
          </div>
        </div>

        <div className="card">
          {penuh.items.map((it, i) => (
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
          {t.perkiraanSiap && (
            <div className="ringkas" style={{ marginTop: "0.25rem" }}>
              <span className="soft">Perkiraan selesai</span>
              <span>{formatTanggal(t.perkiraanSiap)}</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="ringkas">
            <span>Total</span>
            <span className="money">{formatRupiah(t.total)}</span>
          </div>
          <div className="ringkas">
            <span>Sudah dibayar</span>
            <span className="money">{formatRupiah(data.terbayar)}</span>
          </div>
          <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
          <div className="ringkas">
            <strong>{data.status === "batal" ? "STATUS" : "SISA TAGIHAN"}</strong>
            <strong className="money" style={{ fontSize: "1.375rem" }}>
              {data.status === "batal" ? "Dibatalkan" : formatRupiah(data.sisa)}
            </strong>
          </div>
        </div>

        {data.status === "terbuka" && (
          <div className="card">
            <span className="label">Terima Pembayaran</span>
            <p className="hint" style={{ marginTop: 0 }}>Sisa tagihan {formatRupiah(data.sisa)}</p>
            <input
              inputMode="numeric"
              placeholder="Nominal diterima"
              aria-label="Nominal diterima"
              value={nominalTeks}
              onChange={(e) => setNominalTeks(dalamRupiah(e.target.value))}
            />
            <div className="pilihan" style={{ marginTop: "0.5rem" }}>
              <button type="button" className="pilihan__item" aria-pressed={metode === "tunai"} onClick={() => setMetode("tunai")}>
                Tunai
              </button>
              <button type="button" className="pilihan__item" aria-pressed={metode === "transfer"} onClick={() => setMetode("transfer")}>
                Transfer BCA
              </button>
            </div>

            {pratinjau?.ok && (
              <div className="panel panel--ok" role="status" style={{ marginTop: "0.5rem" }}>
                {pratinjau.ringkasan.kembalian > 0
                  ? `Kembalian ${formatRupiah(pratinjau.ringkasan.kembalian)}`
                  : `Sisa setelah bayar ${formatRupiah(pratinjau.ringkasan.sisaBaru)}`}
              </div>
            )}

            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: "0.5rem" }}
              disabled={!nominalSah || sibuk}
              onClick={simpanPembayaran}
            >
              {sibuk ? "Menyimpan…" : "Simpan Pembayaran"}
            </button>
          </div>
        )}

        {hasilTerima && hasilTerima.kembalian > 0 && (
          <div className="panel panel--ok" role="status">
            <strong>Kembalian {formatRupiah(hasilTerima.kembalian)}</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Sisa tagihan sekarang {formatRupiah(hasilTerima.sisa)}</p>
          </div>
        )}

        {data.status === "terbuka" && lembar === "batal" && (
          <div className="card">
            <span className="label">Batalkan Pesanan</span>
            <input
              placeholder="Alasan pembatalan"
              aria-label="Alasan pembatalan"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setLembar("tidak-ada")}>
                Tutup
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                disabled={alasan.trim().length < 3 || sibuk}
                onClick={voidPesanan}
              >
                {sibuk ? "Membatalkan…" : "Batalkan"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bottombar">
        {data.status === "batal" ? (
          <button type="button" className="btn btn--ghost" onClick={onKembali}>Kembali ke Daftar</button>
        ) : (
          <>
            <div className="grid2">
              <button type="button" className="btn btn--primary" onClick={bagikan} disabled={sibuk}>
                Bagikan
              </button>
              <button type="button" className="btn btn--ghost" onClick={simpanFoto} disabled={sibuk}>
                Simpan ke Foto
              </button>
            </div>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setLembar("batal")}>
              Batalkan Pesanan
            </button>
          </>
        )}
      </div>
    </>
  );
}

async function buatImageBitmap(blob: Blob): Promise<ImageBitmap | null> {
  try {
    if (typeof createImageBitmap !== "function") return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}