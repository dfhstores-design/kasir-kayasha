/*
 * Pendaftaran service worker.
 * Hanya di build produksi: pada dev server, SW akan menyajikan berkas lama dan
 * merusak hot reload.
 */
export function daftarkanServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline tetap bisa dipakai; hanya app-shell cache yang tidak aktif.
      console.warn("Kasir Kayesha: mode offline belum aktif di perangkat ini.");
    });
  });
}

/**
 * Meminta penyimpanan permanen (CONTEXT: "minta persistent browser storage bila tersedia").
 * Mengembalikan true bila browser menjamin data tidak dihapus otomatis.
 */
export async function mintaPenyimpananPermanen(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
