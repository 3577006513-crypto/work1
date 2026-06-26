import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'node_modules', '@mediapipe', 'hands');
const target = join(root, 'public', 'vendor', 'mediapipe', 'hands');

if (!existsSync(source)) {
  console.warn('[copy-mediapipe] @mediapipe/hands is not installed yet. Run npm install.');
  process.exit(0);
}

mkdirSync(target, { recursive: true });

for (const file of readdirSync(source)) {
  if (/\.(js|wasm|binarypb|tflite|data)$/i.test(file)) {
    copyFileSync(join(source, file), join(target, file));
  }
}

console.log('[copy-mediapipe] MediaPipe Hands assets copied to public/vendor/mediapipe/hands');
