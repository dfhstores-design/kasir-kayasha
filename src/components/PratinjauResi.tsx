import type { BarisResi } from "../lib/resi.ts";
import { formatRupiah } from "../lib/money.ts";

/**
 * Pratinjau resi di layar. Memakai baris yang SAMA dengan PDF (`susunResi`),
 * jadi yang dilihat pemilik persis sama dengan yang dibagikan.
 *
 * `logoUrl` digambar terpisah di atas karena baris `logo` tidak memuat data gambar.
 * Kop dirender sebagai satu baris: logo di kiri, nama butik + nama lengkap di
 * kanan — mengikuti contoh resi (mockup v8/v9/v4).
 */
export default function PratinjauResi({ baris, logoUrl }: { baris: readonly BarisResi[]; logoUrl: string | null }) {
  return (
    <div className="resi">
      {baris.map((b, i) => {
        switch (b.jenis) {
          case "logo":
            return null;
          case "judul": {
            const sub = baris[i + 1]?.jenis === "subjudul" ? baris[i + 1] : null;
            return (
              <div key={i} className="resi__kop">
                {logoUrl && (
                  <img src={logoUrl} alt="Logo butik" className="resi__logo" />
                )}
                <div>
                  <p className="resi__judul resi__judul--kop">{b.teks}</p>
                  {sub && sub.jenis === "subjudul" && <p className="resi__subjudul">{sub.teks}</p>}
                </div>
              </div>
            );
          }
          case "subjudul":
            // Sudah dirender bersama judul di atas.
            return null;
          case "teks":
            return (
              <p
                key={i}
                className={`resi__teks${b.tengah ? " resi__tengah" : ""}${b.kecil ? " resi__kecil" : ""}`}
                style={b.tebal ? { fontWeight: 700 } : undefined}
              >
                {b.teks}
              </p>
            );
          case "garis":
            return <hr key={i} className="resi__garis" />;
          case "kiriKanan":
            return (
              <div key={i} className={`resi__baris${b.kecil ? " resi__kecil" : ""}`}>
                <span>{b.kiri}</span>
                <span style={b.tebal ? { fontWeight: 700 } : undefined}>{b.kanan}</span>
              </div>
            );
          case "total":
            return (
              <div key={i} className="resi__total">
                <span>{b.kiri}</span>
                <span>{b.kanan}</span>
              </div>
            );
          case "barang":
            return (
              <div key={i}>
                <p className="resi__barang">{b.nama}</p>
                {b.keterangan && <p className="resi__keterangan">{b.keterangan}</p>}
                <div className="resi__baris resi__kecil">
                  <span>
                    {b.jumlah}x {b.hargaSatuan.toLocaleString("id-ID")}
                  </span>
                  <span>{b.subtotal.toLocaleString("id-ID")}</span>
                </div>
                {b.diskonPerUnit ? (
                  <div className="resi__baris resi__kecil">
                    <span>
                      Diskon @ {formatRupiah(b.diskonPerUnit)} x {b.jumlah}
                    </span>
                    <span>{(b.diskonPerUnit * b.jumlah).toLocaleString("id-ID")}</span>
                  </div>
                ) : null}
              </div>
            );
          case "rincian":
            return (
              <div key={i}>
                <div className="resi__baris">
                  <span className="resi__barang" style={{ margin: 0 }}>{b.label}</span>
                  <span style={{ fontWeight: 700 }}>{formatRupiah(b.nominal)}</span>
                </div>
                {b.keterangan && <p className="resi__keterangan">{b.keterangan}</p>}
              </div>
            );
          case "lencana":
            return (
              <p key={i} style={{ margin: "0.375rem 0" }}>
                <span className={`resi__lencana${b.varian === "status" ? " resi__lencana--status" : ""}`}>{b.teks}</span>
              </p>
            );
          case "dokumen":
            return (
              <div key={i}>
                <p className="resi__dokumen">{b.judul}</p>
                <p className="resi__dokumen-sub">{b.subjudul}</p>
              </div>
            );
          case "kotak":
            return (
              <div key={i} className={`resi__kotak${b.sorot ? " resi__kotak--sorot" : ""}`}>
                <p className="resi__kotak-judul">{b.judul}</p>
                {b.isi.map((t, j) => (
                  <p key={j} className={b.sorot ? "resi__kotak-nilai" : "resi__kotak-isi"}>{t}</p>
                ))}
              </div>
            );
          case "metaPasangan":
            return (
              <div key={i} className="resi__meta">
                <div>
                  <p className="resi__meta-label">{b.kiri.label}</p>
                  <p className="resi__meta-nilai">{b.kiri.nilai}</p>
                </div>
                {b.kanan && (
                  <div>
                    <p className="resi__meta-label">{b.kanan.label}</p>
                    <p className="resi__meta-nilai">{b.kanan.nilai}</p>
                  </div>
                )}
              </div>
            );
          case "tandatangan":
            return (
              <div key={i} className="resi__tandatangan">
                <p>Hormat Kami,</p>
                <p className="resi__tandatangan-garis" aria-hidden="true" />
                <p className="resi__tandatangan-nama">{b.nama}</p>
              </div>
            );
          case "kosong":
            return <div key={i} style={{ height: "0.4rem" }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
