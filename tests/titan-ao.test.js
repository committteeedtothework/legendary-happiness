import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { TitanContactAO, arenaAOEnabled } from "../src/titan-ao.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { installTitanBreach } from "../src/titan-finale-view.js";
test("breached torso uses its clipped AO normal material and restores every material after GPU failure", () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(),
    pass = new TitanContactAO(scene, camera),
    body = new T.Group();
  const torso = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()),
    rock = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  body.add(torso);
  scene.add(body, rock);
  installTitanBreach(body, {
    inverse: { value: new T.Matrix4() },
    radius: { value: 7 },
  });
  const originals = [torso.material, rock.material],
    override = new T.MeshNormalMaterial();
  scene.overrideMaterial = override;
  const renderer = {
    autoClear: true,
    getClearColor: (c) => c.set(0x123456),
    getClearAlpha: () => 0.5,
    setRenderTarget() {},
    setClearColor() {},
    clear() {},
    render() {
      assert.equal(scene.overrideMaterial, null);
      assert.equal(torso.material, torso.userData.titanBreachNormal);
      assert.equal(rock.material, pass.normalMaterial);
      throw Error("GPU failure");
    },
  };
  assert.throws(
    () => pass._renderOverride(renderer, pass.normalMaterial, {}, 0, 1),
    /GPU failure/,
  );
  assert.equal(torso.material, originals[0]);
  assert.equal(rock.material, originals[1]);
  assert.equal(scene.overrideMaterial, override);
  assert.equal(renderer.autoClear, true);
  pass.dispose();
  torso.customDepthMaterial.dispose();
  torso.userData.titanBreachNormal.dispose();
});
test("arena contact shading scales its buffers and is disabled by low quality, missing support or disabled post-processing", () => {
  const s = new T.Scene(),
    c = new T.PerspectiveCamera();
  for (const [quality, scale, kernel] of [
    ["low", 0.5, 16],
    ["high", 0.75, 32],
  ]) {
    const pass = new TitanContactAO(s, c, quality);
    pass.setSize(640, 400);
    assert.equal(pass.width, 640 * scale);
    assert.equal(pass.height, 400 * scale);
    assert.equal(pass.kernel.length, kernel);
    assert.equal(pass.ssaoMaterial.uniforms.titanAOStrength.value, 0.55);
    pass.setSize(0, 0);
    assert.equal(pass.width, 1);
    pass.dispose();
  }
  assert.ok(
    arenaAOEnabled({ ambientOcclusion: "low", postProcessing: true }, 2),
  );
  for (const [config, quality, supported] of [
    [{ ambientOcclusion: "off", postProcessing: true }, 3, true],
    [{ ambientOcclusion: "high", postProcessing: false }, 3, true],
    [{ ambientOcclusion: "high", postProcessing: true }, 1, true],
    [{ ambientOcclusion: "high", postProcessing: true }, 3, false],
  ])
    assert.equal(arenaAOEnabled(config, quality, supported), false);
});
test("contact pass restores renderer, override and all hidden effects even after a failed GPU render", () => {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(),
    pass = new TitanContactAO(scene, camera);
  const glow = new T.Mesh(
    new T.BoxGeometry(),
    new T.MeshBasicMaterial({ transparent: true }),
  );
  const excluded = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  excluded.userData.titanAO = false;
  const invisible = excluded.clone();
  invisible.visible = false;
  scene.add(glow, excluded, invisible);
  const override = { saved: true },
    target = { saved: true };
  scene.overrideMaterial = override;
  const r = {
    autoClear: false,
    shadowMap: { enabled: true },
    getRenderTarget: () => target,
    getClearColor: (c) => c.set(0x123456),
    getClearAlpha: () => 0.25,
    setClearColor: (c, a) => {
      r.color = c.getHex();
      r.alpha = a;
    },
    setRenderTarget: (t) => (r.target = t),
  };
  const old = SSAOPass.prototype.render;
  SSAOPass.prototype.render = function () {
    assert.equal(glow.visible, false);
    assert.equal(excluded.visible, false);
    assert.equal(r.shadowMap.enabled, false);
    this.scene.overrideMaterial = { temporary: true };
    r.autoClear = true;
    throw Error("GPU failure");
  };
  try {
    assert.throws(() => pass.render(r), /GPU failure/);
  } finally {
    SSAOPass.prototype.render = old;
    pass.dispose();
  }
  assert.equal(glow.visible, true);
  assert.equal(excluded.visible, true);
  assert.equal(invisible.visible, false);
  assert.equal(scene.overrideMaterial, override);
  assert.equal(r.shadowMap.enabled, true);
  assert.equal(r.autoClear, false);
  assert.equal(r.target, target);
  assert.equal(r.color, 0x123456);
  assert.equal(r.alpha, 0.25);
});
