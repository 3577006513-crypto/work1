import * as THREE from 'three';
import { gsap } from 'gsap';
import { fillButterfly, fillCloud, fillExplosion, fillHeart, fillName, fillSakura, fillStar } from './shapes.js';

const vertexShader = `
attribute vec3 target;
attribute vec3 velocity;
attribute vec3 customColor;
attribute float size;
attribute float seed;
uniform float uTime;
uniform float uMorph;
uniform float uPointSize;
uniform vec3 uAttractor;
uniform float uFollow;
uniform float uAbsorb;
uniform float uScatter;
uniform float uSakura;
uniform float uExplosion;
uniform float uStyle;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vStyle;

void main() {
  vec3 p = mix(position, target, uMorph);
  float drift = sin(uTime * (0.55 + seed) + seed * 24.0) * 0.06;
  p.xy += vec2(cos(seed * 18.0 + uTime * 0.35), sin(seed * 13.0 + uTime * 0.42)) * drift;
  p.x += sin(uTime * 0.7 + seed * 28.0) * uSakura * 0.36;
  p.y -= mod(uTime * (0.38 + seed * 0.28) + seed * 6.0, 6.6) * uSakura;

  vec3 toPointer = uAttractor - p;
  float pointerDistance = max(length(toPointer), 0.001);
  vec3 swirl = vec3(-toPointer.y, toPointer.x, sin(seed * 18.0)) / max(pointerDistance, 0.75);
  vec3 absorbOrbit = normalize(vec3(cos(seed * 41.0), sin(seed * 37.0), sin(seed * 29.0)));
  float followMask = smoothstep(0.0, 1.0, 1.0 - abs(fract(seed * 9.0 + uTime * 0.18) - 0.5));
  p += toPointer * uFollow * (0.18 + followMask * 0.42) / (1.0 + pointerDistance * 0.22);
  p += swirl * uFollow * 0.22;
  p = mix(p, uAttractor + absorbOrbit * (0.08 + seed * 0.34), uAbsorb);

  vec3 radial = normalize(vec3(cos(seed * 92.0), sin(seed * 71.0), sin(seed * 47.0)));
  p += radial * uScatter * (0.35 + seed * 1.4);
  p += normalize(target + radial * 0.5) * uExplosion * (1.0 + seed * 2.4);
  p += velocity * sin(uTime * 0.7 + seed * 31.0) * 0.26;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPointSize * size * (8.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vColor = customColor;
  vAlpha = clamp(0.52 + uMorph * 0.45 + 0.18 * sin(uTime + seed * 9.0), 0.35, 1.0);
  vSeed = seed;
  vStyle = uStyle;
}`;

const fragmentShader = `
precision highp float;
uniform float uGlow;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vStyle;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float core = smoothstep(0.34, 0.0, d);
  float halo = smoothstep(0.5, 0.08, d) * 0.36;
  float cross = max(smoothstep(0.035, 0.0, abs(uv.x)) * smoothstep(0.48, 0.02, abs(uv.y)), smoothstep(0.035, 0.0, abs(uv.y)) * smoothstep(0.48, 0.02, abs(uv.x)));
  float petal = smoothstep(0.46, 0.05, length(vec2(uv.x * 0.68, uv.y * 1.34))) * (0.7 + 0.3 * sin(atan(uv.y, uv.x) * 5.0));
  float textDust = smoothstep(0.42, 0.0, d) * (0.78 + 0.22 * sin(vSeed * 80.0));
  float starMix = smoothstep(0.35, 0.65, vStyle);
  float petalMix = smoothstep(1.35, 1.65, vStyle) - smoothstep(1.9, 2.2, vStyle);
  float textMix = smoothstep(2.35, 2.75, vStyle);
  float shape = mix(core + halo * uGlow, core + cross * 0.95 + halo * 0.45, starMix);
  shape = mix(shape, petal, petalMix);
  shape = mix(shape, textDust + halo * 0.7, textMix);
  float alpha = shape * vAlpha;
  if (alpha < 0.02) discard;
  vec3 color = vColor * (1.0 + core * uGlow + cross * starMix * 1.5);
  gl_FragColor = vec4(color, alpha);
}`;

export class ParticleEngine {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.count = quality.particleCount;
    this.mode = 'cloud';
    this.wind = new THREE.Vector3(0.08, 0, 0);
    this.gravity = -0.02;
    this.pointer = new THREE.Vector3(0, 0, 0);
    this.pointerTarget = new THREE.Vector3(0, 0, 0);
    this.followTarget = 0;
    this.absorbTarget = 0;
    this.tmpTarget = new Float32Array(this.count * 3);

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.targets = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.seeds = new Float32Array(this.count);

    this.#initAttributes();
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0.75 },
        uPointSize: { value: /Android/i.test(navigator.userAgent) ? 4.2 : 5.2 },
        uAttractor: { value: this.pointer },
        uFollow: { value: 0 },
        uAbsorb: { value: 0 },
        uScatter: { value: 0 },
        uGlow: { value: quality.bloom },
        uSakura: { value: 0 },
        uExplosion: { value: 0 },
        uStyle: { value: 0 }
      }
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
    this.streaks = this.#createStreaks();
  }

  #createStreaks() {
    const max = 96;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(max * 2 * 3);
    const colors = new Float32Array(max * 2 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(geometry, material);
    this.scene.add(lines);
    return { lines, positions, colors, max };
  }

  #initAttributes() {
    fillCloud(this.positions, this.count, 1);
    fillCloud(this.targets, this.count, 1);
    for (let i = 0; i < this.count; i += 1) {
      const i3 = i * 3;
      this.velocities[i3] = (Math.random() - 0.5) * 0.055;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.055;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.035;
      this.sizes[i] = 0.45 + Math.random() * 1.75;
      this.seeds[i] = Math.random();
      this.#setPalette(i3, 'cloud');
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('target', new THREE.BufferAttribute(this.targets, 3));
    this.geometry.setAttribute('velocity', new THREE.BufferAttribute(this.velocities, 3));
    this.geometry.setAttribute('customColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('seed', new THREE.BufferAttribute(this.seeds, 1));
  }

  #setPalette(i3, mode) {
    const palettes = {
      heart: [[1, 0.18, 0.56], [1, 0.66, 0.88], [1, 0.04, 0.34], [1, 0.95, 0.98]],
      star: [[1, 0.82, 0.12], [0.38, 0.78, 1], [1, 1, 0.86], [1, 0.32, 0.84]],
      sakura: [[1, 0.72, 0.84], [1, 0.9, 0.95], [0.95, 0.48, 0.72]],
      butterfly: [[0.75, 0.55, 1], [1, 0.62, 0.82], [0.52, 0.86, 1]],
      name: [[1, 0.42, 0.78], [1, 0.92, 1], [0.58, 0.78, 1], [1, 0.68, 0.22]],
      rainbow: [[1, 0.35, 0.55], [0.34, 0.82, 1], [0.84, 1, 0.45], [1, 0.72, 0.26]],
      cloud: [[1, 0.76, 0.88], [0.78, 0.88, 1], [1, 0.96, 0.98]]
    };
    const set = palettes[mode] || palettes.cloud;
    const color = set[Math.floor(Math.random() * set.length)];
    this.colors[i3] = color[0];
    this.colors[i3 + 1] = color[1];
    this.colors[i3 + 2] = color[2];
  }

  morphTo(mode, options = {}) {
    this.mode = mode;
    const scale = options.scale || 1;
    if (mode === 'heart') fillHeart(this.tmpTarget, this.count, 0.19 * scale, options.y || 0);
    else if (mode === 'giantHeart') fillHeart(this.tmpTarget, this.count, 0.34 * scale, -0.2);
    else if (mode === 'star') fillStar(this.tmpTarget, this.count, 1.2 * scale);
    else if (mode === 'explosion') fillExplosion(this.tmpTarget, this.count, 1.0 * scale);
    else if (mode === 'butterfly') fillButterfly(this.tmpTarget, this.count);
    else if (mode === 'sakura') fillSakura(this.tmpTarget, this.count);
    else if (mode === 'name') fillName(this.tmpTarget, this.count);
    else fillCloud(this.tmpTarget, this.count, scale);

    this.targets.set(this.tmpTarget);
    const style = mode === 'explosion' || mode === 'star' ? 1 : mode === 'sakura' ? 1.55 : mode === 'name' ? 3 : 0;
    gsap.to(this.material.uniforms.uSakura, { value: mode === 'sakura' ? 1 : 0, duration: 0.45, ease: 'power2.out', overwrite: true });
    gsap.to(this.material.uniforms.uStyle, { value: style, duration: 0.45, ease: 'power2.out', overwrite: true });
    for (let i = 0; i < this.count; i += 1) this.#setPalette(i * 3, mode === 'giantHeart' ? 'heart' : mode === 'explosion' ? 'star' : mode);
    this.geometry.attributes.target.needsUpdate = true;
    this.geometry.attributes.customColor.needsUpdate = true;
    gsap.fromTo(this.material.uniforms.uMorph, { value: 0.05 }, { value: 1, duration: options.duration || 1.2, ease: 'power3.out', overwrite: true });
    const size = mode === 'name' ? 5.6 : mode === 'explosion' ? 7.4 : mode === 'heart' || mode === 'giantHeart' ? 5.9 : /Android/i.test(navigator.userAgent) ? 4.4 : 5.6;
    gsap.to(this.material.uniforms.uPointSize, { value: size, duration: 0.5, ease: 'power2.out', overwrite: true });
  }

  setPointer(point, power = 0.42) {
    this.pointerTarget.set(point.x, point.y, point.z || 0);
    this.followTarget = power;
    this.absorbTarget = 0;
  }

  clearPointer() {
    this.followTarget = 0;
    this.absorbTarget = 0;
  }

  scatter(power = 2.2) {
    gsap.fromTo(this.material.uniforms.uScatter, { value: power }, { value: 0, duration: 1.25, ease: 'expo.out', overwrite: true });
  }

  burst(mode = 'star') {
    this.morphTo(mode === 'star' ? 'explosion' : mode, { duration: 0.35, scale: 1.15 });
    gsap.fromTo(this.material.uniforms.uExplosion, { value: 4.2 }, { value: 0, duration: 1.28, ease: 'expo.out', overwrite: true });
    this.#streakBurst();
    this.scatter(mode === 'star' ? 1.5 : 2.8);
  }

  #streakBurst() {
    const { positions, colors, lines, max } = this.streaks;
    for (let i = 0; i < max; i += 1) {
      const a = (i / max) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
      const inner = 0.15 + Math.random() * 0.35;
      const outer = 2.0 + Math.random() * 3.2;
      const i6 = i * 6;
      positions[i6] = Math.cos(a) * inner;
      positions[i6 + 1] = Math.sin(a) * inner;
      positions[i6 + 2] = (Math.random() - 0.5) * 0.25;
      positions[i6 + 3] = Math.cos(a) * outer;
      positions[i6 + 4] = Math.sin(a) * outer;
      positions[i6 + 5] = (Math.random() - 0.5) * 0.9;
      const c = Math.random() < 0.45 ? [1, 0.82, 0.18] : Math.random() < 0.75 ? [0.5, 0.82, 1] : [1, 0.36, 0.9];
      colors[i6] = c[0]; colors[i6 + 1] = c[1]; colors[i6 + 2] = c[2];
      colors[i6 + 3] = c[0]; colors[i6 + 4] = c[1]; colors[i6 + 5] = c[2];
    }
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.attributes.color.needsUpdate = true;
    gsap.fromTo(lines.material, { opacity: 0.95 }, { opacity: 0, duration: 0.62, ease: 'power3.out', overwrite: true });
    gsap.fromTo(lines.scale, { x: 0.3, y: 0.3, z: 0.3 }, { x: 1.18, y: 1.18, z: 1.18, duration: 0.62, ease: 'expo.out', overwrite: true });
  }

  absorb(point) {
    this.pointerTarget.set(point.x, point.y, point.z || 0);
    this.followTarget = 0;
    this.absorbTarget = 0.82;
  }

  update(delta, elapsed) {
    this.material.uniforms.uTime.value = elapsed;
    const pointerEase = 1 - Math.exp(-delta * (this.absorbTarget > 0 ? 9 : 18));
    const uniformEase = 1 - Math.exp(-delta * (this.absorbTarget > 0 ? 5.5 : 10));
    this.pointer.lerp(this.pointerTarget, pointerEase);
    this.material.uniforms.uFollow.value += (this.followTarget - this.material.uniforms.uFollow.value) * uniformEase;
    this.material.uniforms.uAbsorb.value += (this.absorbTarget - this.material.uniforms.uAbsorb.value) * uniformEase;
  }

  setReducedQuality() {
    this.material.uniforms.uPointSize.value *= 0.92;
    this.material.uniforms.uGlow.value = Math.max(0.42, this.material.uniforms.uGlow.value - 0.08);
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
