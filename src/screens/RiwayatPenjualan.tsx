/**
 * Riwayat Penjualan (C5, tes klik 22 Nov 2026): riwayat penjualan barang
 * yang bisa dibuka semua peran dari Beranda.
 *
 * Latar belakang: alur penjualan (Beranda → pilih barang → keranjang)
 * tidak punya layar riwayat sama sekali — satu-satunya daftar penjualan
 * ada di Ringkasan (admin saja), dan `batalkanTransaksi` tidak punya
 * pemanggil di layar. Saat tab "Jualan | Riwayat" yang dilaporkan hilang
 * dicari di kode, tab itu tidak ditemukan di mana pun (bukan fitur yang
 * rusak, melainkan fitur yang belum pernah ada) — jadi yang dibangun di
 * sini adalah layar riwayatnya: daftar terbaru dulu, ketuk untuk melihat
 * resi, dan "Batalkan" per baris dengan alasan wajib (BU-63).
 */
import { useEffect, useState } from "react";
import { daftarTransaksi } from "../db/repositori.ts";
import { batalkanTransaksi } from "../db/pesananOperasi.ts";
import type { TransaksiRecord } from "../db/schema.ts";
import { formatRupiah } from "../lib/money.ts";
import { labelJenisBayar } from "../lib/penjualan.ts";
import { formatTanggalJam } from "../lib/tanggal.ts";

interface Props {
  /** Buka resi satu penjualan (App menampilkan layar Resi). */
  onLihatResi: (transaksiId: string) => void;
  onKembali: () => void;
}

const BATAS_TAMPIL = 20;

function labelStatus(t: TransaksiRecord): string {
  if (t.dibatalkanPada !== null || t.statusPesanan === "dibatalkan") return "Dibatalkan";
  if (t.statusBayar === "lunas") return "Lunas";
  if (t.statusBayar === "dp") return "Baru DP";
  return "Belum dibayar";
}

export default function RiwayatPenjualan({ onLihatResi, onKembali }: Props) {
  const [daftar, setDaftar] = useState<TransaksiRecord[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tampilSemua, setTampilSemua] = useState(false);
  /** Id penjualan yang sedang dibatalkan (form alasan tampil di baris itu). */
  const [batalId, setBatalId] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function muat() {
    const semua = await daftarTransaksi();
    setDaftar(semua.filter((t) => t.jenisDokumen === "penjualan"));
  }

  useEffect(() => {
    // Pola sama seperti layar lain: setState hanya di dalam callback
    // promise (bukan langsung di badan effect).
    let hidup = true;
    daftarTransaksi()
      .then((semua) => {
        if (hidup) setDaftar(semua.filter((t) => t.jenisDokumen === "penjualan"));
      })
      .catch(() => {
        if (hidup) setDaftar([]);
      });
    return () => {
      hidup = false;
    };
  }, []);

  async function batalkan(id: string) {
    if (alasan.trim().length < 3) {
      setPesan("Isi alasan pembatalan (minimal 3 huruf).");
      return;
    }
    setSibuk(true);
    const h = await batalkanTransaksi(id, alasan.trim());
    setSibuk(false);
    if (!h.ok) {
      setPesan(h.pesan);
      return;
    }
    setBatalId(null);
    setAlasan("");
    setPesan("Penjualan dibatalkan — stok kembali, uang yang sudah diterima dicatat sebagai pengembalian.");
    await muat();
  }

  if (daftar === null) {
    return (
      <div className="content">
        <p className="soft">Memuat riwayat…</p>
      </div>
    );
  }

  const tampil = tampilSemua ? daftar : daftar.slice(0, BATAS_TAMPIL);

  return (
    <div className="content">
      <div>
        <p className="h2" style={{ margin: 0 }}>
          Riwayat Penjualan
        </p>
        <p className="soft" style={{ margin: "0.25rem 0 0" }}>
          Terbaru dulu. Ketuk baris untuk melihat resi.
        </p>
      </div>

      {pesan && (
        <div className="panel panel--warn" role="alert">
          {pesan}
        </div>
      )}

      {daftar.length === 0 ? (
        <div className="panel panel--ok">
          <strong>Belum ada penjualan.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Penjualan yang tersimpan akan muncul di sini.</p>
        </div>
      ) : (
        <>
          {tampil.map((t) => {
            const dibatalkan = t.dibatalkanPada !== null || t.statusPesanan === "dibatalkan";
            return (
              <div key={t.id} className="card">
                <button
                  type="button"
                  onClick={() => onLihatResi(t.id)}
                  style={{
                    all: "unset",
                    display: "block",
                    width: "100%",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div className="ringkas">
                    <span className="soft">{formatTanggalJam(t.waktu)}</span>
                    <strong>{t.nomorResi}</strong>
                  </div>
                  <div className="ringkas">
                    <span>
                      {t.jenisBayar ? labelJenisBayar(t.jenisBayar) : "—"} · {labelStatus(t)}
                    </span>
                    <strong className="money">{formatRupiah(t.total)}</strong>
                  </div>
                </button>
                {!dibatalkan &&
                  (batalId === t.id ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <input
                        placeholder="Alasan pembatalan"
                        aria-label="Alasan pembatalan"
                        value={alasan}
                        onChange={(e) => setAlasan(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={sibuk || alasan.trim().length < 3}
                          onClick={() => void batalkan(t.id)}
                        >
                          {sibuk ? "Membatalkan…" : "Ya, Batalkan"}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={sibuk}
                          onClick={() => {
                            setBatalId(null);
                            setAlasan("");
                          }}
                        >
                          Tidak jadi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => {
                        setBatalId(t.id);
                        setAlasan("");
                        setPesan(null);
                      }}
                    >
                      Batalkan
                    </button>
                  ))}
              </div>
            );
          })}
          {daftar.length > BATAS_TAMPIL && !tampilSemua && (
            <button type="button" className="btn" onClick={() => setTampilSemua(true)}>
              Tampilkan semua ({daftar.length})
            </button>
          )}
        </>
      )}

      <button type="button" className="btn btn--ghost" onClick={onKembali}>
        ‹ Kembali ke Beranda
      </button>
    </div>
  );
}
