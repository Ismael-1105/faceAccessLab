/**
 * Copia el runtime wasm de MediaPipe desde node_modules hacia public/.
 *
 * El detector de rostros del kiosco carga su wasm desde el propio dominio en
 * lugar de un CDN externo, para que el kiosco funcione sin internet de terceros
 * y sin depender de la disponibilidad de jsdelivr. Los binarios pesan cerca de
 * 22 MB, asi que no se versionan: este script los regenera antes de cada
 * `dev` y de cada `build`.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'public', 'mediapipe', 'wasm');

// Solo los archivos que pide FilesetResolver.forVisionTasks: la variante con
// SIMD y la de respaldo para navegadores que no la soportan.
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

if (!existsSync(source)) {
  console.error('[mediapipe] No se encontro @mediapipe/tasks-vision. Ejecuta la instalacion de dependencias.');
  process.exit(1);
}

mkdirSync(target, { recursive: true });

for (const file of FILES) {
  const from = join(source, file);
  if (!existsSync(from)) {
    console.error(`[mediapipe] Falta ${file} en el paquete instalado.`);
    process.exit(1);
  }
  cpSync(from, join(target, file));
}

console.log(`[mediapipe] Runtime wasm copiado a public/mediapipe/wasm (${FILES.length} archivos).`);
