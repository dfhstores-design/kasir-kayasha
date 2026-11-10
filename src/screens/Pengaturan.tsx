import { useEffect, useMemo, useRef, useState } from "react";
import { ambilSettings, buatId, simpanSettings, type SettingsRecord } from "../db/repositori.ts";
import type { Rekening } from "../db/schema.ts";
import { kompresFoto, KompresiError, periksaBerkasFoto } from "../lib/kompresiFoto.ts";
import { PROGRES_AWAL, progresGagal, progresSelesai, progresUntuk, type ProgresFoto } from "../lib/progresFoto.ts";
import { IndikatorProgresFoto } from "../components/IndikatorProgres.tsx";

interface Props {
  /** Dipanggil setelah pengaturan tersimpan. */
  onSimpan: () => void;
  onLihatContohResi: () => void;
  /** "profil" | "rekening" | "logo" */
  bagian: "profil" | "rekening" | "logo";
}

const HARI = ["Pagi", "Siang", "Sore", "Malam"];

/**
 * Pengaturan usaha (docs/design/screens/11-pengaturan.md):
 * profil + alamat + telepon, logo resi, dan rekening tujuan.
 */
export default function Pengaturan({ onSimpan, onLihatContohResi, bagian }: Props) {
  const [s, setS] = useState<SettingsRecord | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [progres, setProgres] = useState<ProgresFoto>(PROGRES_AWAL);
  const inputLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ambilSettings().then(setS).catch(() => setS(null));
  }, []);

  // URL pratinjau diturunkan dari logo (bukan state) agar tidak ada render berantai.
  const logoBlob = s?.logo ?? null;
  const logoUrl = useMemo(() => (logoBlob ? URL.createObjectURL(logoBlob) : null), [logoBlob]);
  useEffect(() => {
    const u = logoUrl;
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [logoUrl]);

  if (!s) {
    return (
      <div className="content">
        <p className="soft">Memuat pengaturan…</p>
      </div>
    );
  }

  const ubah = (v: Partial<SettingsRecord>) => setS({ ...s, ...v });

  async function simpan() {
    setGalat(null);
    setPesan(null);
    if (s && s.namaButik.trim().length < 2) {
      setGalat("Perbaiki: nama butik minimal 2 huruf.");
      return;
    }
    setSibuk(true);
    try {
      await simpanSettings(s as SettingsRecord);
      onSimpan();
      setPesan("Pengaturan tersimpan.");
    } catch {
      setGalat("Pengaturan belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function prosesLogo(berkas: File) {
    setPesan(null);
    const cek = periksaBerkasFoto({ size: berkas.size, type: berkas.type });
    if (!cek.ok) {
      setProgres(progresGagal(cek.pesan));
      return;
    }
    try {
      setProgres(progresUntuk(["baca"]));
      setProgres(progresUntuk(["baca", "kecilkan"]));
      const hasil = await kompresFoto(berkas);
      setProgres(progresUntuk(["baca", "kecilkan", "kompres"]));
      ubah({ logo: hasil.blob });
      setProgres(progresSelesai());
      setPesan("Logo siap. Tekan Simpan untuk menyimpan.");
    } catch (e) {
      setProgres(progresGagal(e instanceof KompresiError ? e.message : "Logo tidak dapat dibaca."));
    } finally {
      if (inputLogo.current) inputLogo.current.value = "";
    }
  }

  /* ---------------------------------------------------------- rekening */

  function tambahRekening() {
    const baru: Rekening = {
      id: buatId(),
      namaBank: "",
      nomor: "",
      namaPemilik: "",
      utama: s!.rekening.length === 0,
    };
    ubah({ rekening: [...s!.rekening, baru] });
  }

  function ubahRekening(id: string, v: Partial<Rekening>) {
    ubah({ rekening: s!.rekening.map((r) => (r.id === id ? { ...r, ...v } : r)) });
  }

  function jadikanUtama(id: string) {
    ubah({ rekening: s!.rekening.map((r) => ({ ...r, utama: r.id === id })) });
  }

  function hapusRekening(id: string) {
    if (!window.confirm("Hapus rekening ini?")) return;
    const sisa = s!.rekening.filter((r) => r.id !== id);
    ubah({ rekening: sisa.length > 0 && !sisa.some((r) => r.utama) ? sisa.map((r, i) => ({ ...r, utama: i === 0 })) : sisa });
  }

  /* ------------------------------------------------------------ render */

  return (
    <>
      <div className="content">
        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}
        {pesan && (
          <div className="panel panel--ok" role="status">
            {pesan}
          </div>
        )}

        {bagian === "profil" && (
          <>
            <div>
              <label htmlFor="nama-butik">Nama butik</label>
              <input id="nama-butik" value={s.namaButik} onChange={(e) => ubah({ namaButik: e.target.value })} />
            </div>
            <div>
              <label htmlFor="alamat1">Alamat</label>
              <input id="alamat1" value={s.alamatBaris1} onChange={(e) => ubah({ alamatBaris1: e.target.value })} />
              <input
                aria-label="Alamat baris 2"
                style={{ marginTop: "0.5rem" }}
                value={s.alamatBaris2}
                onChange={(e) => ubah({ alamatBaris2: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="kota">Kota & kode pos</label>
              <input id="kota" value={s.kotaKodePos} onChange={(e) => ubah({ kotaKodePos: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tel1">Telepon</label>
              <input id="tel1" value={s.telepon1} onChange={(e) => ubah({ telepon1: e.target.value })} />
              <input
                aria-label="Telepon kedua"
                style={{ marginTop: "0.5rem" }}
                value={s.telepon2}
                onChange={(e) => ubah({ telepon2: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="penutup">Teks penutup resi</label>
              <input
                id="penutup"
                value={s.teksPenutup}
                onChange={(e) => ubah({ teksPenutup: e.target.value })}
                placeholder="Contoh: Terima kasih, sampai jumpa!"
              />
            </div>
            <div>
              <span className="label">Sapaan resi (otomatis dari jam)</span>
              <p className="hint" style={{ margin: 0 }}>
                {HARI.join(" · ")} — hanya bisa dinyalakan/dimatikan.
              </p>
              <label className="tampil-arsip" style={{ marginTop: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={s.tampilkanSapaan}
                  onChange={(e) => ubah({ tampilkanSapaan: e.target.checked })}
                />
                Tampilkan sapaan
              </label>
            </div>
            <label className="tampil-arsip">
              <input
                type="checkbox"
                checked={s.tampilkanNomorResi}
                onChange={(e) => ubah({ tampilkanNomorResi: e.target.checked })}
              />
              Tampilkan nomor resi
            </label>
            <label className="tampil-arsip">
              <input
                type="checkbox"
                checked={s.tampilkanRincianDiskon}
                onChange={(e) => ubah({ tampilkanRincianDiskon: e.target.checked })}
              />
              Tampilkan rincian diskon
            </label>
            <label className="tampil-arsip">
              <input
                type="checkbox"
                checked={s.tampilkanPembayaranSisa}
                onChange={(e) => ubah({ tampilkanPembayaranSisa: e.target.checked })}
              />
              Tampilkan pembayaran & sisa
            </label>
            <button type="button" className="btn btn--ghost btn--small" onClick={onLihatContohResi}>
              Lihat contoh resi
            </button>
          </>
        )}

        {bagian === "logo" && (
          <>
            <div className="grid2" style={{ alignItems: "center" }}>
              <div className="slot-foto slot-foto--isi" style={{ width: "100%" }}>
                {logoUrl ? <img src={logoUrl} alt="Logo butik" /> : <span className="soft">Belum ada logo</span>}
              </div>
              <div>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => inputLogo.current?.click()}>
                  {s.logo ? "Ganti logo" : "Unggah logo"}
                </button>
                {s.logo && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    style={{ marginTop: "0.5rem" }}
                    onClick={() => {
                      if (window.confirm("Hapus logo?")) ubah({ logo: null });
                    }}
                  >
                    Hapus logo
                  </button>
                )}
              </div>
            </div>
            <input
              ref={inputLogo}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void prosesLogo(f);
              }}
            />
            <IndikatorProgresFoto progres={progres} />
            <p className="hint">
              Logo tampil proporsional di resi (tidak dipotong). Tanpa logo, nama butik menjadi judul resi.
            </p>
          </>
        )}

        {bagian === "rekening" && (
          <>
            {s.rekening.length === 0 && <p className="soft">Belum ada rekening tujuan.</p>}
            {s.rekening.map((r) => (
              <div key={r.id} className="card">
                <div>
                  <label htmlFor={`bank-${r.id}`}>Nama bank</label>
                  <input
                    id={`bank-${r.id}`}
                    value={r.namaBank}
                    onChange={(e) => ubahRekening(r.id, { namaBank: e.target.value })}
                    placeholder="BCA"
                  />
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <label htmlFor={`nomor-${r.id}`}>Nomor rekening</label>
                  <input
                    id={`nomor-${r.id}`}
                    inputMode="numeric"
                    value={r.nomor}
                    onChange={(e) => ubahRekening(r.id, { nomor: e.target.value })}
                  />
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <label htmlFor={`pemilik-${r.id}`}>Nama pemilik rekening</label>
                  <input
                    id={`pemilik-${r.id}`}
                    value={r.namaPemilik}
                    onChange={(e) => ubahRekening(r.id, { namaPemilik: e.target.value })}
                  />
                </div>
                <div className="pilihan" style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="pilihan__item"
                    aria-pressed={r.utama}
                    onClick={() => jadikanUtama(r.id)}
                  >
                    {r.utama ? "✓ Dipakai di resi" : "Pakai di resi"}
                  </button>
                  <button type="button" className="pilihan__item" onClick={() => hapusRekening(r.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn--ghost btn--small" onClick={tambahRekening}>
              + Tambah rekening
            </button>
            <p className="hint">
              Maksimal 2 rekening dicetak di resi. Rekening hanya muncul bila masih ada sisa tagihan.
              Nomor rekening tidak pernah ditulis ke log.
            </p>
          </>
        )}
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={simpan} disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </>
  );
}
