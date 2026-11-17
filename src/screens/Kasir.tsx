import { useEffect, useMemo, useState } from "react";
import { daftarPesananJahit, labelStatusJahitan, type RingkasanJahitan } from "../lib/jahitan.ts";
import KasirDetail from "./KasirDetail.tsx";
import { formatRupiah } from "../lib/money.ts";

interface Props {
  /** Naikkan untuk memuat ulang daftar setelah ada perubahan. */
  segarkan: number;
  onPesananBaru: () => void;
  /**
   * Buka alur jual barang (pilih-barang). Null = tombol Penjualan nonaktif:
   * penjaga yang sama dengan Beranda — kasir hanya menjual bila ada bazar aktif.
   */
  onPenjualan: (() => void) | null;
}

type Tab = "belum-lunas" | "riwayat";

/**
 * Antar-muka kasir (BU-18, BU-24, BU-29).
 * Dua alur besar: "Pesanan Jahit" dan "Penjualan". Entri "Penjualan" dari layar Kasir
 * dibuka atas keputusan Andri 17 Nov 2026 (P0+P1): penjualan barang sudah berjalan
 * lewat Beranda, jadi bukan lagi ditunda sampai tahap stok (kunci BU-24 lama).
 * Penjualan tetap hanya untuk kasir bila ada bazar aktif — penjaga yang sama dengan
 * Beranda (onPenjualan null = tombol nonaktif).
 * Daftar memakai dua tab besar: Belum Lunas (default) & Riwayat; kartu besar menampilkan
 * nama, jenis jahitan, sisa, dan tanda sudah dikirim. Ketuk kartu untuk detail (terima bayar).
 * Daftar & entitas dipakai ulang dari `lib/jahitan.ts` (agent ui-tante) — tidak diduplikasi.
 */
export default function Kasir({ segarkan, onPesananBaru, onPenjualan }: Props) {
  const [daftarView, setDaftarView] = useState(false);
  const [tab, setTab] = useState<Tab>("belum-lunas");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [daftar, setDaftar] = useState<RingkasanJahitan[] | null>(null);

  useEffect(() => {
    let hidup = true;
    daftarPesananJahit()
      .then((d) => hidup && setDaftar(d))
      .catch(() => hidup && setDaftar([]));
    return () => {
      hidup = false;
    };
  }, [segarkan]);

  const belumLunas = useMemo(() => (daftar ?? []).filter((p) => p.status === "terbuka"), [daftar]);
  const riwayat = useMemo(() => (daftar ?? []).filter((p) => p.status !== "terbuka"), [daftar]);

  if (detailId) {
    return <KasirDetail id={detailId} onKembali={() => setDetailId(null)} />;
  }

  return (
    <div className="content">
      {!daftarView ? (
        <MenuUtama
          onPesanan={() => setDaftarView(true)}
          onPenjualan={onPenjualan}
        />
      ) : (
        <>
          <div className="pilihan kastab" role="tablist" aria-label="Daftar pesanan kasir">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "belum-lunas"}
              className="pilihan__item kastab__item"
              style={{ flex: 1, minHeight: "3.5rem", fontSize: "1.125rem" }}
              onClick={() => setTab("belum-lunas")}
            >
              Belum Lunas ({belumLunas.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "riwayat"}
              className="pilihan__item kastab__item"
              style={{ flex: 1, minHeight: "3.5rem", fontSize: "1.125rem" }}
              onClick={() => setTab("riwayat")}
            >
              Riwayat ({riwayat.length})
            </button>
          </div>

          <button type="button" className="btn btn--primary btn--small" onClick={onPesananBaru}>
            + Pesanan Baru
          </button>

          {daftar === null ? (
            <p className="soft">Memuat pesanan…</p>
          ) : (
            <DaftarKartu data={tab === "belum-lunas" ? belumLunas : riwayat} onBuka={setDetailId} tab={tab} />
          )}
        </>
      )}
    </div>
  );
}

/** Dua tombol besar pintu kasir. "Penjualan" dibuka atas keputusan Andri 17 Nov 2026 (P0+P1). */
function MenuUtama({ onPesanan, onPenjualan }: { onPesanan: () => void; onPenjualan: (() => void) | null }) {
  return (
    <div className="kastiles">
      <button type="button" className="kastile" onClick={onPesanan}>
        <span className="kastile__judul">Pesanan Jahit</span>
        <span className="kastile__sub">Pesan jahitan &amp; terima pembayaran</span>
      </button>

      {onPenjualan ? (
        <button type="button" className="kastile" onClick={onPenjualan}>
          <span className="kastile__judul">Penjualan</span>
          <span className="kastile__sub">Jual barang stok</span>
        </button>
      ) : (
        <button type="button" className="kastile kastile--mati" disabled title="Kasir hanya menjual bila ada bazar aktif">
          <span className="kastile__judul">Penjualan</span>
          <span className="kastile__sub">Perlu bazar aktif</span>
        </button>
      )}
    </div>
  );
}

function DaftarKartu({
  data,
  onBuka,
  tab,
}: {
  data: RingkasanJahitan[];
  onBuka: (id: string) => void;
  tab: Tab;
}) {
  if (data.length === 0) {
    return (
      <div className="panel panel--ok">
        <strong>{tab === "belum-lunas" ? "Belum ada pesanan belum lunas." : "Belum ada riwayat."}</strong>
      </div>
    );
  }

  return (
    <div className="kaslist">
      {data.map((p) => (
        <button
          key={p.id}
          type="button"
          className="kaskartu"
          style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
          onClick={() => onBuka(p.id)}
        >
          <div className="kaskartu__atas">
            <strong className="kaskartu__nama">{p.namaPemesan}</strong>
            <span className="chip">{labelStatusJahitan(p.status)}</span>
          </div>
          <div className="soft">{p.model}</div>
          <div className="kaskartu__bawah">
            <span className="soft">
              {p.status === "terbuka" ? `Sisa ${formatRupiah(p.sisa)}` : labelStatusJahitan(p.status)}
            </span>
            {p.sudahDikirim && <span className="soft">✓ dikirim</span>}
          </div>
        </button>
      ))}
    </div>
  );
}