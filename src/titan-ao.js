import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import * as T from "three";
// Screen-space contact shading, without temporal accumulation or character
// copies. Keep all renderer/visibility state local to this arena pass.
export class TitanContactAO extends SSAOPass {
  constructor(scene, camera, quality = "low") {
    super(scene, camera, 1, 1, quality === "high" ? 32 : 16);
    this.quality = quality;
    this.scale = quality === "high" ? 0.75 : 0.5;
    this.kernelRadius = 3.2;
    this.minDistance = 0.00006;
    this.maxDistance = 0.004;
    this.ssaoMaterial.uniforms.titanAOStrength = { value: 0.55 };
    this.ssaoMaterial.fragmentShader =
      "uniform float titanAOStrength;\n" +
      this.ssaoMaterial.fragmentShader.replace(
        "1.0 - occlusion",
        "1.0 - occlusion * titanAOStrength",
      );
  }
  _renderOverride(renderer, material, target, clearColor, clearAlpha) {
    const swapped = [];
    this.scene.traverse((o) => {
      if (o.isMesh && o.userData.titanBreach?.radius.value > 0.01)
        swapped.push(o);
    });
    if (!swapped.length)
      return super._renderOverride(
        renderer,
        material,
        target,
        clearColor,
        clearAlpha,
      );
    const original = [],
      override = this.scene.overrideMaterial,
      auto = renderer.autoClear,
      color = renderer.getClearColor(new T.Color()),
      alpha = renderer.getClearAlpha();
    this.scene.traverse((o) => {
      if (o.isMesh) {
        original.push([o, o.material]);
        o.material =
          o.userData.titanBreach?.radius.value > 0.01
            ? o.userData.titanBreachNormal
            : material;
      }
    });
    try {
      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      renderer.setClearColor(clearColor, clearAlpha);
      renderer.clear();
      this.scene.overrideMaterial = null;
      renderer.render(this.scene, this.camera);
    } finally {
      for (const [o, m] of original) o.material = m;
      this.scene.overrideMaterial = override;
      renderer.autoClear = auto;
      renderer.setClearColor(color, alpha);
    }
  }
  setSize(width, height) {
    super.setSize(
      Math.max(1, Math.floor(width * (this.scale || 0.5))),
      Math.max(1, Math.floor(height * (this.scale || 0.5))),
    );
  }
  render(renderer, write, read, ...rest) {
    const hidden = [],
      override = this.scene.overrideMaterial,
      target = renderer.getRenderTarget(),
      auto = renderer.autoClear,
      color = renderer.getClearColor(new T.Color()),
      alpha = renderer.getClearAlpha(),
      shadows = renderer.shadowMap.enabled;
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (
        o.userData.titanAO === false ||
        mats.every((m) => m.transparent || m.depthWrite === false)
      ) {
        hidden.push(o);
        o.visible = false;
      }
    });
    this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(
      this.camera.projectionMatrix,
    );
    this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(
      this.camera.projectionMatrixInverse,
    );
    try {
      renderer.shadowMap.enabled = false;
      super.render(renderer, write, read, ...rest);
    } finally {
      this._restoreVisibility();
      for (const o of hidden) o.visible = true;
      this.scene.overrideMaterial = override;
      renderer.shadowMap.enabled = shadows;
      renderer.autoClear = auto;
      renderer.setClearColor(color, alpha);
      renderer.setRenderTarget(target);
    }
  }
}
export function arenaAOEnabled(config, quality, supported = true) {
  return (
    supported &&
    config.ambientOcclusion !== "off" &&
    config.postProcessing &&
    quality >= 2
  );
}
