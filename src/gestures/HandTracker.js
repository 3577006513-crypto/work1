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
    this.isMobileShell = /Android|MicroMessenger|MQQBrowser/i.test(navigator.userAgent);
    this.inputCanvas = document.createElement('canvas');
    this.inputCanvas.width = this.isMobileShell ? 320 : CONFIG.camera.width;
    this.inputCanvas.height = this.isMobileShell ? 240 : CONFIG.camera.height;
    this.inputContext = this.inputCanvas.getContext('2d', { alpha: false, willReadFrequently: false });
    this.stream = null;
    this.running = false;
    this.processing = false;
    this.lastSend = 0;
    this.frameInterval = this.isMobileShell ? 66 : 34;
    this.loop = this.loop.bind(this);
  }

  async start() {
    const Hands = await loadHandsGlobal();
    this.hands = new Hands({
      locateFile: (file) => `${CONFIG.mediapipePath}/${file}`
    });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: this.isMobileShell ? 0 : 1,
      minDetectionConfidence: this.isMobileShell ? 0.5 : 0.68,
      minTrackingConfidence: this.isMobileShell ? 0.5 : 0.72,
      selfieMode: true
    });
    this.hands.onResults((results) => this.onResults(results));

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: this.isMobileShell ? 480 : CONFIG.camera.width },
        height: { ideal: this.isMobileShell ? 360 : CONFIG.camera.height },
        frameRate: { ideal: this.isMobileShell ? 24 : CONFIG.camera.targetFps, max: 30 }
      }
    });
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('webkit-playsinline', 'true');
    await this.video.play();
    await this.#waitForVideoFrame();
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  async loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    if (this.processing || now - this.lastSend < this.frameInterval || this.video.readyState < 2 || !this.video.videoWidth) return;

    this.processing = true;
    this.lastSend = now;
    try {
      const image = this.#getInputFrame();
      await this.hands.send({ image });
    } finally {
      this.processing = false;
    }
  }

  #getInputFrame() {
    if (!this.isMobileShell) return this.video;
    this.inputContext.save();
    this.inputContext.scale(-1, 1);
    this.inputContext.drawImage(this.video, -this.inputCanvas.width, 0, this.inputCanvas.width, this.inputCanvas.height);
    this.inputContext.restore();
    return this.inputCanvas;
  }

  #waitForVideoFrame() {
    if (this.video.videoWidth && this.video.videoHeight) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      this.video.addEventListener('loadedmetadata', done, { once: true });
      this.video.addEventListener('canplay', done, { once: true });
      setTimeout(done, 1200);
    });
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
