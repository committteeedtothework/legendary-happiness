import * as T from "three";
import { ITEMS } from "./data.js";
import { isFlatItem } from "./item-shapes.js";
import { createHeldModel } from "./first-person.js";
import { setModelIconSource } from "./textures.js";
export class ModelIcons {
  constructor(atlas) {
    this.atlas = atlas;
    this.texture = atlas.texture;
    this.urls = new Map();
    this.queue = new Set();
    this.failed = false;
    setModelIconSource((id) => {
      if (this.busy || this.failed || !ITEMS[id] || isFlatItem(id)) return null;
      if (this.urls.has(id)) return this.urls.get(id);
      this.queue.add(id);
      return null;
    });
  }
  setAtlas(atlas) {
    if (this.texture !== atlas.texture) {
      this.atlas = atlas;
      this.texture = atlas.texture;
      this.urls.clear();
      this.queue.clear();
      for (const img of document.querySelectorAll("img[data-item-icon]"))
        if (!isFlatItem(img.dataset.itemIcon))
          this.queue.add(img.dataset.itemIcon);
    }
  }
  pump() {
    if (this.failed || !this.queue.size) return;
    const id = this.queue.values().next().value;
    this.queue.delete(id);
    this.busy = true;
    let model;
    try {
      if (!this.gl) {
        this.gl = new T.WebGLRenderer({
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        this.gl.setSize(64, 64);
        this.gl.setPixelRatio(1);
        this.gl.outputColorSpace = T.SRGBColorSpace;
        this.scene = new T.Scene();
        this.scene.add(new T.AmbientLight(0xffffff, 2.2));
        const light = new T.DirectionalLight(0xffffff, 2.5);
        light.position.set(-3, 5, 6);
        this.scene.add(light);
        this.camera = new T.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.01, 100);
        this.camera.position.set(3, 2.2, 5);
        this.camera.lookAt(0, 0, 0);
      }
      model = createHeldModel(id, this.atlas);
      if (!model) return;
      const bounds = new T.Box3().setFromObject(model);
      if (bounds.isEmpty()) return;
      const centre = bounds.getCenter(new T.Vector3()),
        size = bounds.getSize(new T.Vector3()),
        scale = 1.85 / Math.max(size.x, size.y, size.z, 0.01);
      model.scale.setScalar(scale);
      model.position.copy(centre).multiplyScalar(-scale);
      this.scene.add(model);
      this.gl.setClearColor(0x000000, 0);
      this.gl.render(this.scene, this.camera);
      const url = this.gl.domElement.toDataURL("image/png");
      this.urls.set(id, url);
      for (const img of document.querySelectorAll("img[data-item-icon]"))
        if (img.dataset.itemIcon === id) img.src = url;
    } catch {
      this.failed = true;
    } finally {
      if (model) {
        model.removeFromParent();
        const geos = new Set(),
          mats = new Set(),
          maps = new Set();
        model.traverse((o) => {
          if (o.geometry && !o.geometry.userData.shared) geos.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m && !m.userData.shared) {
              mats.add(m);
              if (
                m.map &&
                m.map !== this.atlas.texture &&
                !m.userData.sharedMap
              )
                maps.add(m.map);
            }
        });
        geos.forEach((x) => x.dispose());
        mats.forEach((x) => x.dispose());
        maps.forEach((x) => x.dispose());
      }
      this.busy = false;
    }
  }
}
