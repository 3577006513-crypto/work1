import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { ParticleEngine } from '../particles/ParticleEngine.js';
import { FrameGovernor } from '../utils/performance.js';

export class Stage {
  constructor(canvas, quality, onDowngrade) {
    this.canvas = canvas;
    this.quality = quality;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xfff2f8, 0.035);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 8.2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));

    this.composer = null;
    this.bloomPass = { strength: quality.bloom, setSize() {} };
    if (quality.postprocessing) {
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), quality.bloom, 0.72, 0.12);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloomPass);
    }

    this.engine = new ParticleEngine(this.scene, quality);
    this.#addAtmosphere();
    this.governor = new FrameGovernor((fps) => {
      this.bloomPass.strength = Math.max(0.25, this.bloomPass.strength - 0.12);
      this.engine.setReducedQuality();
      onDowngrade?.(fps);
    });

    this.resize = this.resize.bind(this);
    this.animate = this.animate.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('orientationchange', this.resize, { passive: true });
    this.resize();
  }

  #addAtmosphere() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    const geometry = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 9; i += 1) {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5.2, -2.8 - Math.random() * 2);
      const s = 0.4 + Math.random() * 1.3;
      mesh.scale.set(s, s * 0.12, 1);
      mesh.rotation.z = Math.random() * Math.PI;
      group.add(mesh);
    }
    this.scene.add(group);
    this.atmosphere = group;
  }

  start() {
    gsap.fromTo(this.camera.position, { z: 10.5 }, { z: 8.2, duration: 2.2, ease: 'expo.out' });
    this.engine.morphTo('cloud', { duration: 1.8 });
    this.renderer.setAnimationLoop(this.animate);
  }

  animate() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    if (this.atmosphere) {
      this.atmosphere.rotation.z = Math.sin(elapsed * 0.08) * 0.035;
      this.atmosphere.children.forEach((mesh, index) => {
        mesh.material.opacity = 0.08 + Math.sin(elapsed * 0.4 + index) * 0.035;
      });
    }
    this.engine.update(delta, elapsed);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.governor.tick();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }
}
