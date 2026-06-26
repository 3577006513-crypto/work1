export const CONFIG = {
  camera: {
    width: 640,
    height: 480,
    targetFps: 30
  },
  particles: {
    high: 12000,
    medium: 8000,
    low: 5200,
    pixelRatioHigh: 1.45,
    pixelRatioLow: 1.0
  },
  gestures: {
    holdMs: 300,
    cooldownMs: 900
  },
  mediapipePath: './vendor/mediapipe/hands'
};

export const GESTURES = {
  IDLE: '粒子漂浮',
  POINT: '食指跟随',
  WAVE: '挥手散开',
  OK: 'OK 爱心',
  THUMB: '点赞星爆',
  VICTORY: '樱花雨',
  OPEN: '五指彩色扩散',
  DOUBLE_HEART: '双手巨大爱心',
  FIST: '拳头吸附',
  C_SHAPE: '陈奕萱'
};
