import './styles.css';
import { gsap } from 'gsap';
import { GESTURES } from './config.js';
import { getQualityProfile } from './utils/performance.js';
import { Stage } from './render/Stage.js';
import { HandTracker } from './gestures/HandTracker.js';
import { GestureRecognizer } from './gestures/GestureRecognizer.js';

const canvas = document.querySelector('#stage');
const video = document.querySelector('#camera');
const hero = document.querySelector('#hero');
const startButton = document.querySelector('#startButton');
const statusPanel = document.querySelector('#statusPanel');
const statusText = document.querySelector('#statusText');
const gestureText = document.querySelector('#gestureText');
const qualityText = document.querySelector('#qualityText');
const healthDot = document.querySelector('#healthDot');
const permissionCard = document.querySelector('#permissionCard');
const permissionText = document.querySelector('#permissionText');

const quality = getQualityProfile();
qualityText.textContent = `质量：${quality.name} · ${quality.particleCount} 粒子`;

const stage = new Stage(canvas, quality, () => {
  qualityText.textContent = `质量：${quality.name} · 自动降载`;
});

let tracker;
let recognizer;
let started = false;
let lastGesture = GESTURES.IDLE;
let lastPointerAt = 0;

intro();
stage.start();
bindTouchFallback();

startButton.addEventListener('click', startExperience, { passive: true });

async function startExperience() {
  if (started) return;
  started = true;
  startButton.disabled = true;
  statusText.textContent = '请求摄像头权限...';

  recognizer = new GestureRecognizer(handleGesture);
  tracker = new HandTracker(video, (results) => {
    const state = recognizer.update(results);
    const now = performance.now();
    if (state.point && now - lastPointerAt > 33 && (state.gesture === GESTURES.POINT || state.gesture === GESTURES.FIST)) {
      lastPointerAt = now;
      if (state.gesture === GESTURES.FIST) stage.engine.absorb(state.point);
      else stage.engine.setPointer(state.point, 1.15);
    } else if (state.point && now - lastPointerAt > 33 && lastGesture === GESTURES.POINT) {
      lastPointerAt = now;
      stage.engine.setPointer(state.point, 0.34);
    } else {
      stage.engine.clearPointer();
    }
    gestureText.textContent = `手势：${state.gesture}`;
  });

  try {
    await tracker.start();
    healthDot.classList.add('active');
    statusText.textContent = '识别运行中';
    gsap.to(hero, { autoAlpha: 0, y: -24, duration: 0.8, ease: 'power3.out', pointerEvents: 'none' });
    gsap.to(statusPanel, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' });
  } catch (error) {
    started = false;
    startButton.disabled = false;
    statusText.textContent = '摄像头启动失败';
    permissionText.textContent = normalizeCameraError(error);
    permissionCard.hidden = false;
    gsap.fromTo(permissionCard, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power2.out' });
  }
}

function handleGesture(gesture, payload) {
  lastGesture = gesture;
  gestureText.textContent = `手势：${gesture}`;

  if (gesture === GESTURES.IDLE) {
    stage.engine.morphTo('cloud', { duration: 1.4 });
    return;
  }
  if (gesture === GESTURES.POINT) {
    if (payload.point) stage.engine.setPointer(payload.point, 1.25);
    return;
  }
  if (gesture === GESTURES.WAVE) {
    stage.engine.scatter(3.4);
    return;
  }
  if (gesture === GESTURES.OK) {
    stage.engine.morphTo('heart', { duration: 0.95, scale: 1.08 });
    pulseBloom();
    return;
  }
  if (gesture === GESTURES.THUMB) {
    stage.engine.burst('star');
    pulseBloom(1.6);
    return;
  }
  if (gesture === GESTURES.VICTORY) {
    stage.engine.morphTo('sakura', { duration: 1.1 });
    return;
  }
  if (gesture === GESTURES.OPEN) {
    stage.engine.morphTo('butterfly', { duration: 1.1 });
    stage.engine.scatter(3.1);
    return;
  }
  if (gesture === GESTURES.DOUBLE_HEART) {
    stage.engine.morphTo('giantHeart', { duration: 1.25, scale: 1.18 });
    pulseBloom(1.55);
    return;
  }
  if (gesture === GESTURES.FIST) {
    if (payload.point) stage.engine.absorb(payload.point);
    return;
  }
  if (gesture === GESTURES.C_SHAPE) {
    stage.engine.morphTo('name', { duration: 1.05 });
    pulseBloom(1.1);
  }
}

function pulseBloom(scale = 1) {
  gsap.fromTo(stage.bloomPass, { strength: quality.bloom * 1.7 * scale }, { strength: quality.bloom, duration: 0.9, ease: 'power3.out' });
}

function intro() {
  gsap.set(statusPanel, { autoAlpha: 0, y: 16 });
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.eyebrow', { autoAlpha: 0, y: 16, duration: 0.7 })
    .from('h1', { autoAlpha: 0, y: 26, duration: 0.9 }, '-=0.35')
    .from('.subtitle', { autoAlpha: 0, y: 18, duration: 0.7 }, '-=0.45')
    .from('.primary-button', { autoAlpha: 0, scale: 0.92, duration: 0.62 }, '-=0.25')
    .from('.hint', { autoAlpha: 0, y: 8, duration: 0.5 }, '-=0.25');
}

function bindTouchFallback() {
  const updatePointer = (event) => {
    const touch = event.touches?.[0] || event;
    const x = (0.5 - touch.clientX / window.innerWidth) * 8;
    const y = (0.5 - touch.clientY / window.innerHeight) * -5.6;
    stage.engine.setPointer({ x: -x, y, z: 0 }, 0.7);
  };
  window.addEventListener('pointermove', updatePointer, { passive: true });
  window.addEventListener('touchmove', updatePointer, { passive: true });
  window.addEventListener('pointerup', () => stage.engine.clearPointer(), { passive: true });
  window.addEventListener('touchend', () => stage.engine.clearPointer(), { passive: true });
}

function normalizeCameraError(error) {
  if (!navigator.mediaDevices?.getUserMedia) return '当前浏览器不支持摄像头 API，请升级 Android Chrome、Edge、微信或 QQ 浏览器。';
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return '摄像头需要 HTTPS 或 localhost。部署到 GitHub Pages 后即可正常申请权限。';
  if (error?.name === 'NotAllowedError') return '摄像头权限被拒绝，请在浏览器权限设置中允许摄像头。';
  if (error?.name === 'NotFoundError') return '未检测到可用摄像头。';
  return '请检查浏览器摄像头权限后刷新页面。';
}
