import { useEffect, useMemo, useState } from "react";
import { daftarPesananJahit, labelStatusJahitan, type RingkasanJahitan } from "../lib/jahitan.ts";
import KasirDetail from "./KasirDetail.tsx";
import { formatRupiah } from "../lib/money.ts";

interface Props {
  /** Naikkan untuk memuat ulang daftar setelah ada perubahan. */
  segarkan: number;
  onPesananBaru: () => void;
}

type Tab = "belum-lunas" | "riwayat";

/**
 * Antar-muka kasir (BU-18, BU-24, BU-29).
 * Dua alur besar: "Pesanan" (aktif) dan "Penjualan" (nonaktif sampai tahap stok, label "segera").
 * Daftar memakai dua tab besar: Belum Lunas (default) & Riwayat; kartu besar menampilkan
 * nama, jenis jahitan, sisa, dan tanda sudah dikirim. Ketuk kartu untuk detail (terima bayar).
 * Daftar & entitas dipakai ulang dari `lib/jahitan.ts` (agent ui-tante) — tidak diduplikasi.
 */
export default function Kasir({ segarkan, onPesananBaru }: Props) {
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

/** Dua tombol besar pintu kasir (BU-24). "Penjualan" ditunda sampai tahap stok (BU-12). */
function MenuUtama({ onPesanan }: { onPesanan: () => void }) {
  return (
    <div className="kastiles">
      <button type="button" className="kastile" onClick={onPesanan}>
        <span className="kastile__judul">Pesanan</span>
        <span className="kastile__sub">Pesan jahitan &amp; terima pembayaran</span>
      </button>

      <button type="button" className="kastile kastile--mati" disabled title="Dibuka pada tahap stok">
        <span className="kastile__judul">Penjualan</span>
        <span className="kastile__sub">Segera</span>
      </button>
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