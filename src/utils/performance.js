import { CONFIG } from '../config.js';

export function getQualityProfile() {
  const cinematic = new URLSearchParams(window.location.search).get('cinema') === '1';
  const isMobileShell = /Android|MicroMessenger|MQQBrowser/i.test(navigator.userAgent);
  if (!cinematic) {
    return {
      name: isMobileShell ? '流畅' : '均衡影院',
      particleCount: isMobileShell ? CONFIG.particles.low : CONFIG.particles.medium,
      pixelRatio: isMobileShell ? CONFIG.particles.pixelRatioLow : 1.15,
      bloom: isMobileShell ? 0.55 : 0.72,
      trails: 0.78,
      postprocessing: !isMobileShell
    };
  }

  return {
    name: '影院',
    particleCount: CONFIG.particles.high,
    pixelRatio: CONFIG.particles.pixelRatioHigh,
    bloom: 0.78,
    trails: 0.88,
    postprocessing: true
  };
}

export class FrameGovernor {
  constructor(onDowngrade) {
    this.onDowngrade = onDowngrade;
    this.frames = 0;
    this.last = performance.now();
    this.lowFpsHits = 0;
  }

  tick() {
    this.frames += 1;
    const now = performance.now();
    if (now - this.last < 1300) return;

    const fps = (this.frames * 1000) / (now - this.last);
    this.frames = 0;
    this.last = now;

    if (fps < 44) this.lowFpsHits += 1;
    else this.lowFpsHits = Math.max(0, this.lowFpsHits - 1);

    if (this.lowFpsHits >= 3) {
      this.lowFpsHits = 0;
      this.onDowngrade?.(fps);
    }
  }
}
