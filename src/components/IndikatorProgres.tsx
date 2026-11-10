import type { ProgresFoto, ProgresUnggah } from "../lib/progresFoto.ts";
import { teksAksesibel } from "../lib/progresFoto.ts";

/**
 * Indikator progres foto — WAJIB tampil (permintaan pemilik).
 *
 * Aturan tampilan:
 * - tulisan tahap + persen selalu terlihat (bukan hanya batang warna)
 * - `role="progressbar"` + aria-valuenow agar pembaca layar mengumumkan
 * - berhenti di 100% hanya saat benar-benar selesai; gagal ditandai jelas dengan teks
 * - tidak ada spinner tanpa keterangan
 */
export function IndikatorProgresFoto({ progres }: { progres: ProgresFoto }) {
  if (progres.status === "menunggu") return null;

  const gagal = progres.status === "gagal";
  const selesai = progres.status === "selesai";

  return (
    <div
      className={`progres ${gagal ? "progres--gagal" : selesai ? "progres--selesai" : ""}`}
      aria-live="polite"
    >
      <div className="progres__baris">
        <span className="progres__teks">{progres.pesan}</span>
        {!gagal && <span className="progres__persen">{progres.persen}%</span>}
      </div>

      {!gagal && (
        <div
          className="progres__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progres.persen}
          aria-valuetext={teksAksesibel(progres)}
        >
          <div className="progres__isi" style={{ width: `${progres.persen}%` }} />
        </div>
      )}
    </div>
  );
}

/** Baris status unggahan (Phase 6). Saat ini selalu "Tersimpan di perangkat". */
export function IndikatorUnggah({ progres }: { progres: ProgresUnggah }) {
  if (progres.status === "belum") {
    return (
      <p className="soft" style={{ margin: "0.25rem 0 0" }}>
        {progres.pesan}
      </p>
    );
  }
  return (
    <div className="progres" aria-live="polite">
      <div className="progres__baris">
        <span className="progres__teks">{progres.pesan}</span>
        <span className="progres__persen">{progres.persen}%</span>
      </div>
      <div
        className="progres__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progres.persen}
      >
        <div className="progres__isi" style={{ width: `${progres.persen}%` }} />
      </div>
    </div>
  );
}
