import { seededRandom } from '../utils/math.js';

const rand = seededRandom(73021);

export function fillCloud(array, count, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 3.8 * scale;
    array[i3] = Math.cos(angle) * radius;
    array[i3 + 1] = Math.sin(angle) * radius * 0.58 + (rand() - 0.5) * 0.35;
    array[i3 + 2] = (rand() - 0.5) * 2.2;
  }
}

export function fillHeart(array, count, scale = 0.22, yOffset = 0) {
  for (let i = 0; i < count; i += 1) {
    const t = rand() * Math.PI * 2;
    const jitter = 0.84 + rand() * 0.2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const i3 = i * 3;
    array[i3] = x * scale * jitter;
    array[i3 + 1] = y * scale * jitter + yOffset;
    array[i3 + 2] = (rand() - 0.5) * 0.55;
  }
}

export function fillStar(array, count, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const arm = Math.floor(rand() * 5);
    const a = arm * 1.256 + (rand() - 0.5) * 0.32;
    const r = (0.08 + rand() * 3.7) * scale;
    const core = rand() < 0.5 ? rand() * 0.42 : 1;
    array[i3] = Math.cos(a) * r * core;
    array[i3 + 1] = Math.sin(a) * r * core;
    array[i3 + 2] = (rand() - 0.5) * 1.8;
  }
}

export function fillExplosion(array, count, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const a = rand() * Math.PI * 2;
    const spoke = Math.floor(rand() * 18) * (Math.PI * 2 / 18);
    const useSpoke = rand() < 0.7;
    const angle = useSpoke ? spoke + (rand() - 0.5) * 0.08 : a;
    const radius = (0.2 + rand() ** 0.36 * 4.2) * scale;
    array[i3] = Math.cos(angle) * radius;
    array[i3 + 1] = Math.sin(angle) * radius;
    array[i3 + 2] = (rand() - 0.5) * 2.4;
  }
}

export function fillButterfly(array, count) {
  for (let i = 0; i < count; i += 1) {
    const side = rand() < 0.5 ? -1 : 1;
    const t = rand() * Math.PI;
    const r = Math.sin(t) * (1.2 + rand() * 1.7);
    const i3 = i * 3;
    array[i3] = side * (0.45 + r * Math.cos(t) + rand() * 0.45);
    array[i3 + 1] = r * Math.sin(t) * (rand() < 0.52 ? 1 : -0.62);
    array[i3 + 2] = (rand() - 0.5) * 0.8;
  }
}

export function fillSakura(array, count) {
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    array[i3] = (rand() - 0.5) * 8;
    array[i3 + 1] = 3.2 + rand() * 3.4;
    array[i3 + 2] = (rand() - 0.5) * 2.5;
  }
}

export function fillName(array, count) {
  const points = sampleTextPoints('陈奕萱');
  for (let i = 0; i < count; i += 1) {
    const point = points[Math.floor(rand() * points.length)];
    const i3 = i * 3;
    array[i3] = point.x + (rand() - 0.5) * 0.025;
    array[i3 + 1] = point.y + (rand() - 0.5) * 0.025;
    array[i3 + 2] = (rand() - 0.5) * 0.18;
  }
}

function sampleTextPoints(text) {
  const canvas = document.createElement('canvas');
  const width = 1024;
  const height = 320;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 210px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(text, width / 2, height / 2 + 4);

  const data = ctx.getImageData(0, 0, width, height).data;
  const points = [];
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      if (data[(y * width + x) * 4 + 3] > 32) {
        points.push({
          x: (x / width - 0.5) * 6.4,
          y: (0.5 - y / height) * 2.15
        });
      }
    }
  }
  return points.length ? points : [{ x: 0, y: 0 }];
}
