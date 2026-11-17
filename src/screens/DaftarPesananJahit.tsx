import { useEffect, useMemo, useState } from "react";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal } from "../lib/tanggal.ts";
import {
  daftarPesananJahit,
  labelStatusJahitan,
  type RingkasanJahitan,
} from "../lib/jahitan.ts";

interface Props {
  onBuka: (id: string) => void;
  onBaru: () => void;
  segarkan: number;
}

type Tab = "belum-lunas" | "riwayat";

/**
 * Daftar pesanan jahit — dua tab besar (BU-29): "Belum Lunas" (default) & "Riwayat".
 * Ditambah daftar "Perlu ditagih" (BU-30 Opsi A) di bagian atas: belum lunas yang
 * perkiraan selesainya sudah lewat. Kartu besar, ketuk untuk membuka detail.
 */
export default function DaftarPesananJahit({ onBuka, onBaru, segarkan }: Props) {
  const [daftar, setDaftar] = useState<RingkasanJahitan[] | null>(null);
  const [tab, setTab] = useState<Tab>("belum-lunas");

  useEffect(() => {
    let hidup = true;
    daftarPesananJahit()
      .then((d) => {
        if (hidup) setDaftar(d);
      })
      .catch(() => {
        if (hidup) setDaftar([]);
      });
    return () => {
      hidup = false;
    };
  }, [segarkan]);

  const belumLunas = useMemo(() => (daftar ?? []).filter((p) => p.status === "terbuka"), [daftar]);
  const riwayat = useMemo(() => (daftar ?? []).filter((p) => p.status !== "terbuka"), [daftar]);
  const perluDitagih = useMemo(
    () => belumLunas.filter((p) => p.perkiraanSelesai && p.perkiraanSelesai < tanggalHariIni()),
    [belumLunas],
  );

  if (daftar === null) {
    return (
      <div className="content">
        <p className="soft">Memuat pesanan jahit…</p>
      </div>
    );
  }

  const tampil = tab === "belum-lunas" ? belumLunas : riwayat;

  return (
    <>
      <div className="content">
        <button type="button" className="btn btn--primary" onClick={onBaru}>
          + Pesanan Jahit Baru
        </button>

        {perluDitagih.length > 0 && (
          <div className="card" style={{ borderColor: "var(--warn-ink)" }}>
            <span className="soft" style={{ fontWeight: 700, color: "var(--warn-ink)" }}>
              Perlu ditagih ({perluDitagih.length})
            </span>
            {perluDitagih.map((p) => (
              <button
                key={p.id}
                type="button"
                className="listrow"
                style={{ textAlign: "left", font: "inherit", cursor: "pointer", marginTop: "0.5rem", width: "100%" }}
                onClick={() => onBuka(p.id)}
              >
                <div style={{ flex: 1 }}>
                  <strong>{p.namaPemesan}</strong>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    {p.model} · selesai {formatTanggal(p.perkiraanSelesai ?? "")}
                  </div>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    Sisa {formatRupiah(p.sisa)}
                  </div>
                </div>
                <span aria-hidden="true">▸</span>
              </button>
            ))}
          </div>
        )}

        {/* Tab besar dua pilihan */}
        <div className="pilihan" role="tablist" aria-label="Daftar pesanan">
          <button
            type="button"
            className="pilihan__item"
            style={{ flex: 1, minHeight: "3.5rem", fontSize: "1.125rem" }}
            role="tab"
            aria-selected={tab === "belum-lunas"}
            onClick={() => setTab("belum-lunas")}
          >
            Belum Lunas ({belumLunas.length})
          </button>
          <button
            type="button"
            className="pilihan__item"
            style={{ flex: 1, minHeight: "3.5rem", fontSize: "1.125rem" }}
            role="tab"
            aria-selected={tab === "riwayat"}
            onClick={() => setTab("riwayat")}
          >
            Riwayat ({riwayat.length})
          </button>
        </div>

        {tampil.length === 0 && (
          <div className="panel panel--ok">
            <strong>{tab === "belum-lunas" ? "Belum ada pesanan yang belum lunas." : "Belum ada riwayat."}</strong>
            {tab === "belum-lunas" && (
              <p style={{ margin: "0.25rem 0 0" }}>Buat pesanan lewat tombol di atas.</p>
            )}
          </div>
        )}

        {tampil.map((p) => (
          <button
            key={p.id}
            type="button"
            className="listrow"
            style={{ textAlign: "left", font: "inherit", cursor: "pointer" }}
            onClick={() => onBuka(p.id)}
          >
            <div style={{ flex: 1 }}>
              <strong>{p.namaPemesan}</strong>
              <div className="soft" style={{ fontSize: "0.95rem" }}>
                {p.model} · {p.nomor}
              </div>
              <div className="soft" style={{ fontSize: "0.95rem" }}>
                {p.status === "terbuka" ? `Sisa ${formatRupiah(p.sisa)}` : labelStatusJahitan(p.status)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
              <span className="chip">{labelStatusJahitan(p.status)}</span>
              {p.sudahDikirim && (
                <span className="soft" style={{ fontSize: "0.85rem" }}>
                  ✓ dikirim
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function tanggalHariIni(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}