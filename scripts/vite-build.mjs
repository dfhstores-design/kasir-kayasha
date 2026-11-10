/*
 * Pembungkus `vite build`.
 *
 * Di sebagian mesin (termasuk mesin pengembangan ini) esbuild gagal menghapus
 * berkas sementara di folder system temp ("Access is denied"). Skrip ini
 * mengarahkan TMP/TEMP/ESBUILD_TMPDIR ke folder di dalam proyek, lalu menjalankan
 * `vite build`, dan membersihkannya setelah selesai.
 *
 * Tidak mengubah keluaran build; hanya lokasi berkas sementara.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const tmp = join(process.cwd(), ".tmp-esbuild");
mkdirSync(tmp, { recursive: true });

const hasil = spawnSync(process.execPath, [join("node_modules", "vite", "bin", "vite.js"), "build"], {
  stdio: "inherit",
  env: { ...process.env, TMP: tmp, TEMP: tmp, ESBUILD_TMPDIR: tmp },
});

if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
process.exit(hasil.status ?? 1);
