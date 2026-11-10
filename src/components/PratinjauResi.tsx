import type { BarisResi } from "../lib/resi.ts";
import { formatRupiah } from "../lib/money.ts";

/**
 * Pratinjau resi di layar. Memakai baris yang SAMA dengan PDF (`susunResi`),
 * jadi yang dilihat pemilik persis sama dengan yang dibagikan.
 *
 * `logoUrl` digambar terpisah di atas karena baris `logo` tidak memuat data gambar.
 */
export default function PratinjauResi({ baris, logoUrl }: { baris: readonly BarisResi[]; logoUrl: string | null }) {
  return (
    <div className="resi">
      {logoUrl && (
        <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <img src={logoUrl} alt="Logo butik" style={{ maxWidth: "88px", maxHeight: "88px", objectFit: "contain" }} />
        </div>
      )}
      {baris.map((b, i) => {
        switch (b.jenis) {
          case "logo":
            return null;
          case "judul":
            return (
              <p key={i} className="resi__judul">
                {b.teks}
              </p>
            );
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
          case "kosong":
            return <div key={i} style={{ height: "0.4rem" }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
