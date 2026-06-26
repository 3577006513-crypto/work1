import { CONFIG, GESTURES } from '../config.js';
import { clamp, distance2, mapLandmark, smoothstep } from '../utils/math.js';

export class GestureRecognizer {
  constructor(onStableGesture) {
    this.onStableGesture = onStableGesture;
    this.current = GESTURES.IDLE;
    this.candidate = GESTURES.IDLE;
    this.candidateAt = 0;
    this.lastFire = new Map();
    this.history = [];
    this.cScoreHistory = [];
  }

  update(results) {
    const hands = (results.multiHandLandmarks || []).map((landmarks, index) => ({
      landmarks,
      handedness: results.multiHandedness?.[index]?.label || 'Unknown',
      center: handCenter(landmarks),
      fingers: fingerStates(landmarks)
    }));

    if (!hands.length) {
      this.#settle(GESTURES.IDLE, { hands });
      return { gesture: this.current, hands, point: null };
    }

    this.#trackWave(hands[0]);
    this.#trackCScore(hands[0]);
    const gesture = classify(hands, this.history);
    const primary = hands[0];
    const point = gesture === GESTURES.FIST ? mapPalm(primary.landmarks) : mapLandmark(primary.landmarks[8]);
    this.#settle(gesture, { hands, point });
    return { gesture: this.current, hands, point };
  }

  #trackWave(hand) {
    const now = performance.now();
    this.history.push({ x: hand.center.x, y: hand.center.y, time: now });
    while (this.history.length > 12 || (this.history[0] && now - this.history[0].time > 650)) this.history.shift();
  }

  #trackCScore(hand) {
    this.cScoreHistory.push(cShapeScore(hand));
    while (this.cScoreHistory.length > 5) this.cScoreHistory.shift();
    hand.cScore = this.cScoreHistory.reduce((sum, value) => sum + value, 0) / this.cScoreHistory.length;
  }

  #settle(gesture, payload) {
    const now = performance.now();
    if (gesture !== this.candidate) {
      this.candidate = gesture;
      this.candidateAt = now;
      return;
    }
    if (gesture === this.current || now - this.candidateAt < CONFIG.gestures.holdMs) return;

    const last = this.lastFire.get(gesture) || 0;
    this.current = gesture;
    if (now - last > CONFIG.gestures.cooldownMs || isContinuous(gesture)) {
      this.lastFire.set(gesture, now);
      this.onStableGesture?.(gesture, payload);
    }
  }
}

function isContinuous(gesture) {
  return gesture === GESTURES.POINT || gesture === GESTURES.FIST || gesture === GESTURES.IDLE;
}

function classify(hands, history) {
  if (hands.length >= 2 && isDoubleHeart(hands[0], hands[1])) return GESTURES.DOUBLE_HEART;
  const hand = hands[0];
  const { fingers } = hand;
  const openCount = Object.values(fingers).filter(Boolean).length;

  if (hand.cScore > 0.62) return GESTURES.C_SHAPE;
  if (isWave(history) && openCount >= 4) return GESTURES.WAVE;
  if (isOk(hand)) return GESTURES.OK;
  if (isThumbUp(hand)) return GESTURES.THUMB;
  if (!fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) return GESTURES.VICTORY;
  if (openCount >= 5) return GESTURES.OPEN;
  if (openCount === 0) return GESTURES.FIST;
  if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) return GESTURES.POINT;
  return GESTURES.IDLE;
}

function fingerStates(lm) {
  const vertical = (tip, pip) => lm[tip].y < lm[pip].y - 0.018;
  const thumbSpread = distance2(lm[4], lm[9]) > distance2(lm[3], lm[9]) + 0.025;
  return {
    thumb: thumbSpread && distance2(lm[4], lm[9]) > distance2(lm[3], lm[9]),
    index: vertical(8, 6),
    middle: vertical(12, 10),
    ring: vertical(16, 14),
    pinky: vertical(20, 18)
  };
}

function handCenter(lm) {
  let x = 0;
  let y = 0;
  for (const p of lm) {
    x += p.x;
    y += p.y;
  }
  return { x: x / lm.length, y: y / lm.length };
}

function mapPalm(lm) {
  const palm = {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
    y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
    z: (lm[0].z + lm[5].z + lm[9].z + lm[13].z + lm[17].z) / 5
  };
  return mapLandmark(palm, 1.4);
}

function isOk(hand) {
  const lm = hand.landmarks;
  const pinch = distance2(lm[4], lm[8]);
  const palm = distance2(lm[0], lm[9]);
  return pinch < palm * 0.34 && hand.fingers.middle && hand.fingers.ring;
}

function isCShape(hand) {
  return cShapeScore(hand) > 0.62;
}

function cShapeScore(hand) {
  const lm = hand.landmarks;
  const thumbIndex = distance2(lm[4], lm[8]);
  const palm = distance2(lm[0], lm[9]);
  const gap = thumbIndex / palm;
  const gapScore = smoothstep(0.42, 0.62, gap) * (1 - smoothstep(1.18, 1.42, gap));
  const thumbIndexHorizontal = Math.abs(lm[4].x - lm[8].x) / palm;
  const thumbIndexVertical = Math.abs(lm[4].y - lm[8].y) / palm;
  const horizontalScore = smoothstep(0.2, 0.58, thumbIndexHorizontal);
  const sidePenalty = smoothstep(0.9, 1.35, thumbIndexVertical);
  const indexBent = distance2(lm[8], lm[5]) < distance2(lm[6], lm[5]) * 1.72 ? 1 : 0.25;
  const middleSoft = lm[12].y > lm[10].y - palm * 0.62 ? 1 : 0.45;
  const notOk = gap > 0.42 ? 1 : 0;
  const notThumb = isThumbUp(hand) ? 0 : 1;
  return clamp(gapScore * 0.34 + horizontalScore * 0.24 + indexBent * 0.18 + middleSoft * 0.14 + notOk * 0.1 - sidePenalty * 0.22, 0, 1) * notThumb;
}

function isThumbUp(hand) {
  const lm = hand.landmarks;
  const palm = distance2(lm[0], lm[9]);
  const foldedFingers = !hand.fingers.index && !hand.fingers.middle && !hand.fingers.ring && !hand.fingers.pinky;
  const thumbClearlyUp = lm[4].y < lm[3].y - palm * 0.22 && lm[4].y < lm[6].y - palm * 0.18;
  const thumbAwayFromIndex = distance2(lm[4], lm[8]) > palm * 0.72;
  return foldedFingers && thumbClearlyUp && thumbAwayFromIndex;
}

function isDoubleHeart(a, b) {
  const dThumb = distance2(a.landmarks[4], b.landmarks[4]);
  const dIndex = distance2(a.landmarks[8], b.landmarks[8]);
  const centerDistance = distance2(a.center, b.center);
  return dThumb < 0.18 && dIndex < 0.2 && centerDistance < 0.55;
}

function isWave(history) {
  if (history.length < 7) return false;
  const xs = history.map((p) => p.x);
  const range = Math.max(...xs) - Math.min(...xs);
  let turns = 0;
  for (let i = 2; i < xs.length; i += 1) {
    const a = xs[i - 1] - xs[i - 2];
    const b = xs[i] - xs[i - 1];
    if (Math.sign(a) !== Math.sign(b) && Math.abs(a) > 0.012 && Math.abs(b) > 0.012) turns += 1;
  }
  return range > 0.16 && turns >= 2;
}
