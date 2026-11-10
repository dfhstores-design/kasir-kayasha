interface Props {
  bazarAktifAda: boolean;
  onMintaAdmin: () => void;
}

/**
 * Panel penjaga: tampil saat pengguna memilih fitur yang hanya untuk admin
 * (ROLE-BIAYA-RINGKASAN.md bagian 6).
 */
export function AksesAdminSaja({ bazarAktifAda, onMintaAdmin }: Props) {
  return (
    <div className="content">
      <div className="panel panel--warn" role="alert">
        <strong>Fitur ini untuk admin.</strong>
        <p style={{ margin: "0.25rem 0 0" }}>
          {bazarAktifAda
            ? "Masuk sebagai admin untuk melihat ringkasan, mengatur bazar, atau mencatat biaya."
            : "Belum ada bazar aktif."}
        </p>
      </div>
      <button type="button" className="btn btn--primary" onClick={onMintaAdmin}>
        Masuk sebagai Admin
      </button>
    </div>
  );
}

export default AksesAdminSaja;
