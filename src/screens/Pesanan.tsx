import { useEffect, useMemo, useState } from "react";
import { ambilTransaksi, daftarTransaksi } from "../db/repositori.ts";
import type { TransaksiRecord } from "../db/schema.ts";
import { formatRupiah } from "../lib/money.ts";
import { labelStatusBayar } from "../lib/keranjang.ts";
import {
  cariPesanan,
  kelompokkanPesanan,
  labelStatusPesanan,
  totalSisaPO,
  type RingkasanPesanan,
} from "../lib/pesanan.ts";
import { formatTanggal } from "../lib/tanggal.ts";

interface Props {
  onBuka: (id: string) => void;
  onPesananBaru: () => void;
  /** Naikkan nilai ini untuk memuat ulang daftar. */
  segarkan: number;
}

/**
 * Layar 7 — Daftar Pesanan (docs/design/screens/07-pesanan.md).
 * Dikelompokkan: Siap → Diproses → Selesai → Dibatalkan.
 */
export default function Pesanan({ onBuka, onPesananBaru, segarkan }: Props) {
  const [daftar, setDaftar] = useState<RingkasanPesanan[] | null>(null);
  const [cari, setCari] = useState("");
  const [bukaSelesai, setBukaSelesai] = useState(false);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const semua = await daftarTransaksi();
      const hasil: RingkasanPesanan[] = [];
      for (const t of semua.filter((x: TransaksiRecord) => x.jenis === "po")) {
        const l = await ambilTransaksi(t.id);
        if (!l) continue;
        const sudahDibayar = l.pembayaran.reduce((n, p) => n + p.nominal, 0);
        hasil.push({
          id: t.id,
          nomorResi: t.nomorResi,
          namaPemesan: t.namaPemesan ?? "(tanpa nama)",
          waktu: t.waktu,
          total: t.total,
          sudahDibayar,
          sisa: t.total - sudahDibayar,
          statusPesanan: t.statusPesanan,
          statusBayar: t.statusBayar,
        });
      }
      if (hidup) setDaftar(hasil);
    })().catch(() => setDaftar([]));
    return () => {
      hidup = false;
    };
  }, [segarkan]);

  const tersaring = useMemo(() => (daftar ? cariPesanan(daftar, cari) : []), [daftar, cari]);
  const kelompok = useMemo(() => kelompokkanPesanan(tersaring), [tersaring]);
  const sisaTotal = useMemo(() => totalSisaPO(daftar ?? []), [daftar]);

  if (daftar === null) {
    return (
      <div className="content">
        <p className="soft">Memuat pesanan…</p>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        <button type="button" className="btn btn--primary btn--small" onClick={onPesananBaru}>
          + Pesanan Baru
        </button>

        <label htmlFor="cari-pesanan" className="sr-only">
          Cari nama pemesan
        </label>
        <input
          id="cari-pesanan"
          type="search"
          placeholder="Cari nama pemesan atau nomor"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />

        {daftar.length === 0 && (
          <div className="panel panel--ok">
            <strong>Belum ada pesanan.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Buat pesanan lewat tombol di atas.</p>
          </div>
        )}

        {daftar.length > 0 && tersaring.length === 0 && (
          <p className="soft">Tidak ada pesanan atas nama itu.</p>
        )}

        {kelompok.map((g) => {
          const dilipat = (g.status === "selesai" || g.status === "dibatalkan") && !bukaSelesai;
          return (
            <div key={g.status}>
              <button
                type="button"
                className="kelompok"
                aria-expanded={!dilipat}
                onClick={() => setBukaSelesai((v) => !v)}
                disabled={g.status !== "selesai" && g.status !== "dibatalkan"}
              >
                <span>
                  {labelStatusPesanan(g.status)} ({g.pesanan.length})
                </span>
                {(g.status === "selesai" || g.status === "dibatalkan") && (
                  <span aria-hidden="true">{dilipat ? "▸" : "▾"}</span>
                )}
              </button>

              {!dilipat &&
                g.pesanan.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="listrow"
                    style={{ textAlign: "left", font: "inherit", cursor: "pointer", marginBottom: "0.5rem" }}
                    onClick={() => onBuka(p.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <strong>{p.namaPemesan}</strong>
                      <div className="soft" style={{ fontSize: "0.95rem" }}>
                        {p.nomorResi} · {formatTanggal(p.waktu)}
                      </div>
                      <div className="soft" style={{ fontSize: "0.95rem" }}>
                        {p.sisa > 0 ? `Sisa ${formatRupiah(p.sisa)}` : "Lunas"}
                      </div>
                    </div>
                    <span className="chip">{labelStatusBayar(p.statusBayar)}</span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>

      {sisaTotal > 0 && (
        <div className="bottombar">
          <div className="ringkas">
            <span className="soft">Sisa tagihan semua pesanan</span>
            <span className="money">{formatRupiah(sisaTotal)}</span>
          </div>
        </div>
      )}
    </>
  );
}
