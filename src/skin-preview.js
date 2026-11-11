import * as THREE from "three";
import { createPlayerModel, animatePlayerModel } from "./player-model.js";
export function disposeSkinModel(model) {
  if (!model) return;
  const materials = new Set();
  model.traverse((o) => {
    o.geometry?.dispose();
    for (const m of o.material
      ? Array.isArray(o.material)
        ? o.material
        : [o.material]
      : [])
      materials.add(m);
  });
  for (const m of materials) {
    if (!m.userData.sharedMap) m.map?.dispose();
    m.dispose();
  }
  model.removeFromParent();
}
// A single, bounded preview context exists only while the wardrobe is open.
export class SkinPreview {
  constructor(container, id, options = {}) {
    this.options = options;
    this.inventoryMode = options.mode === "inventory";
    this.look = { yaw: 0, pitch: 0 };
    this.targetLook = { yaw: 0, pitch: 0 };
    this.container = container;
    this.disposed = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(33, 1, 0.1, 20);
    this.camera.position.set(0, 1.12, 3.6);
    this.camera.lookAt(0, 0.95, 0);
    this.gl = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.gl.domElement;
    canvas.setAttribute(
      "aria-label",
      this.inventoryMode
        ? "Your equipped skin in 3D. Looks toward the pointer."
        : "Interactive 3D outfit preview. Drag to turn.",
    );
    canvas.setAttribute("role", "img");
    container.append(canvas);
    this.scene.add(new THREE.HemisphereLight("#f4f5ff", "#5b5a66", 2.4));
    const key = new THREE.DirectionalLight("#fff1d5", 2);
    key.position.set(-3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#c0dbff", 0.8);
    fill.position.set(3, 2, -4);
    this.scene.add(fill);
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.065, 1.25),
      new THREE.MeshLambertMaterial({ color: "#575d54" }),
    );
    platform.position.y = -0.04;
    if (!this.inventoryMode) this.scene.add(platform);
    this.platform = platform;
    this.yaw = this.inventoryMode ? Math.PI : Math.PI - 0.32;
    this.abort = new AbortController();
    const signalOptions = { signal: this.abort.signal };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (this.inventoryMode || e.button !== 0) return;
        this.drag = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      },
      signalOptions,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (this.drag === undefined) return;
        this.yaw += (e.clientX - this.drag) * 0.012;
        this.drag = e.clientX;
      },
      signalOptions,
    );
    const end = () => {
      this.drag = undefined;
    };
    canvas.addEventListener("pointerup", end, signalOptions);
    canvas.addEventListener("pointercancel", end, signalOptions);
    canvas.addEventListener("lostpointercapture", end, signalOptions);
    if (this.inventoryMode) {
      document.addEventListener(
        "pointermove",
        (event) => {
          const rect = container.getBoundingClientRect();
          this.targetLook = inventoryPointerLook(
            rect,
            event.clientX,
            event.clientY,
          );
        },
        signalOptions,
      );
      window.addEventListener(
        "blur",
        () => {
          this.targetLook = { yaw: 0, pitch: 0 };
        },
        signalOptions,
      );
    }
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.setSkin(id, options.equipment || [], options.held);
    this.resize();
    const frame = (now) => {
      if (this.disposed) return;
      this.frame = requestAnimationFrame(frame);
      if (document.hidden || now - (this.last || 0) < 1000 / 30) return;
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;
      if (!this.reduced.matches)
        animatePlayerModel(
          this.model,
          { onGround: true, pitch: 0, vy: 0 },
          dt,
          false,
        );
      this.model.rotation.y = this.yaw;
      if (this.inventoryMode) {
        const ease = this.reduced.matches ? 1 : 1 - Math.exp(-18 * dt);
        this.look.yaw += (this.targetLook.yaw - this.look.yaw) * ease;
        this.look.pitch += (this.targetLook.pitch - this.look.pitch) * ease;
        this.model.rotation.y += this.look.yaw * 0.3;
        this.model.userData.head.rotation.set(
          this.look.pitch,
          this.look.yaw * 0.7,
          0,
        );
      }
      this.gl.render(this.scene, this.camera);
    };
    this.frame = requestAnimationFrame(frame);
  }
  resize() {
    const w = Math.max(1, this.container.clientWidth),
      h = Math.max(1, this.container.clientHeight);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setSkin(id, equipment = [], held) {
    const signature = JSON.stringify([id, equipment, held]);
    if (signature === this.signature) return;
    this.signature = signature;
    disposeSkinModel(this.model);
    this.model = createPlayerModel(id, equipment, held, this.options.atlas);
    this.scene.add(this.model);
    this.id = id;
    this.model.rotation.y = this.yaw;
  }
  turn(amount) {
    this.yaw += amount;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.abort.abort();
    disposeSkinModel(this.model);
    disposeSkinModel(this.platform);
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.gl.domElement.remove();
  }
}

// Clamp the head/body aim even if the pointer is well outside the panel.
export function inventoryPointerLook(rect, x, y) {
  return {
    yaw: Math.max(
      -0.75,
      Math.min(0.75, Math.atan2(x - rect.left - rect.width / 2, 160)),
    ),
    pitch: Math.max(
      -0.45,
      Math.min(0.45, -Math.atan2(y - rect.top - rect.height * 0.27, 180)),
    ),
  };
}
