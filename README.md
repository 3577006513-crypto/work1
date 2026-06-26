# Gesture Particle Cinema

一个纯前端手势粒子交互网页，适合直接构建并部署到 GitHub Pages。

## 技术栈

- Vite
- HTML5 / CSS3 / JavaScript ES6
- Three.js
- MediaPipe Hands
- GSAP

## 本地运行

```bash
npm install
npm run dev
```

摄像头需要安全上下文。`localhost` 可直接使用；手机真机测试建议使用 HTTPS 预览或部署到 GitHub Pages。

## 构建

```bash
npm run build
```

构建产物在 `dist/`。`vite.config.js` 已设置 `base: './'`，可直接部署到 GitHub Pages 子路径。

## MediaPipe 本地化

`postinstall` 和 `build` 会执行 `scripts/copy-mediapipe.mjs`，把 `@mediapipe/hands` 需要的 `.js`、`.wasm`、`.binarypb` 等文件复制到：

```text
public/vendor/mediapipe/hands
```

运行时不会从 CDN 加载 MediaPipe 文件。
