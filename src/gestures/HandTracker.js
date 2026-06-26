import { CONFIG } from '../config.js';

let handsLoader;

function loadHandsGlobal() {
  if (window.Hands) return Promise.resolve(window.Hands);
  if (handsLoader) return handsLoader;

  handsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${CONFIG.mediapipePath}/hands.js`;
    script.async = true;
    script.onload = () => window.Hands ? resolve(window.Hands) : reject(new Error('MediaPipe Hands failed to expose window.Hands'));
    script.onerror = () => reject(new Error('MediaPipe Hands script failed to load'));
    document.head.appendChild(script);
  });

  return handsLoader;
}

export class HandTracker {
  constructor(video, onResults) {
    this.video = video;
    this.onResults = onResults;
    this.hands = null;
    this.stream = null;
    this.running = false;
    this.processing = false;
    this.lastSend = 0;
    this.frameInterval = /Android|MicroMessenger|MQQBrowser/i.test(navigator.userAgent) ? 50 : 34;
    this.loop = this.loop.bind(this);
  }

  async start() {
    const Hands = await loadHandsGlobal();
    this.hands = new Hands({
      locateFile: (file) => `${CONFIG.mediapipePath}/${file}`
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.68,
      minTrackingConfidence: 0.72,
      selfieMode: true
    });
    this.hands.onResults((results) => this.onResults(results));

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: CONFIG.camera.width },
        height: { ideal: CONFIG.camera.height },
        frameRate: { ideal: CONFIG.camera.targetFps, max: 30 }
      }
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  async loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    if (this.processing || now - this.lastSend < this.frameInterval || this.video.readyState < 2) return;

    this.processing = true;
    this.lastSend = now;
    try {
      await this.hands.send({ image: this.video });
    } finally {
      this.processing = false;
    }
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
