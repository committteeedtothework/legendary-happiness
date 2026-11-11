import { playWorldSound } from "./spatial-audio.js";
import { BLOCKS } from "./data.js";
import { interactionKey, openChestKeys } from "./world-interactions.js";
import {
  createWorldAnimation,
  worldVisualKind,
  disposeWorldAnimation,
} from "./world-animation-models.js";
export class WorldAnimations {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = { ...atlas };
    this.models = new Map();
    this.chunks = new Map();
  }
  clear() {
    for (const m of this.models.values()) disposeWorldAnimation(m);
    this.models.clear();
    this.chunks.clear();
  }
  atlasChanged(atlas) {
    if (this.atlas.texture === atlas.texture && this.atlas.pack === atlas.pack)
      return;
    const chunks = [...this.chunks].map(([key, keys]) => [
      key,
      [...keys].map((k) => this.models.get(k).userData.descriptor),
    ]);
    this.clear();
    this.atlas = { ...atlas };
    for (const [key, descriptors] of chunks) this.setChunk(key, descriptors);
  }
  setChunk(chunk, descriptors = []) {
    descriptors = descriptors.filter((t) => worldVisualKind(t.id));
    const keep = new Set(descriptors.map(interactionKey));
    for (const key of this.chunks.get(chunk) || [])
      if (!keep.has(key)) {
        disposeWorldAnimation(this.models.get(key));
        this.models.delete(key);
      }
    for (const t of descriptors) {
      const key = interactionKey(t),
        old = this.models.get(key);
      if (old && old.userData.kind === worldVisualKind(t.id)) {
        old.userData.descriptor = t;
        continue;
      }
      if (old) disposeWorldAnimation(old);
      const model = createWorldAnimation(t, this.atlas);
      this.models.set(key, model);
      this.scene.add(model);
    }
    this.chunks.set(chunk, keep);
  }
  removeChunk(key) {
    this.setChunk(key, []);
    this.chunks.delete(key);
  }
  update(game, dt, time) {
    if (!game) return;
    const open = openChestKeys(game),
      remote = new Map(
        (game.sharedBlockVisuals?.blocks || []).map((b) => [b.key, b]),
      );
    const animated =
      game.settings.animatedTextures !== false &&
      (game.running ||
        ["inventory", "enchanting", "jukebox"].includes(game.ui?.screen));
    for (const [key, m] of this.models) {
      const u = m.userData,
        t = u.descriptor;
      const dx = t.x - game.player.x,
        dz = t.z - game.player.z,
        dy = t.y - (game.player.y ?? t.y);
      const range = game.settings.blockEntityDistance ?? 96;
      m.visible =
        game.active !== false && dx * dx + dy * dy + dz * dz <= range * range;
      if (!m.visible) continue;
      const record = game.world.containers[key],
        shared = remote.get(key);
      if (u.kind === "chest") {
        const facing = record?.facing ?? t.facing ?? 0;
        u.chestPivot.rotation.y = (-(((facing % 4) + 4) % 4) * Math.PI) / 2;
        const want = open.has(key);
        if (
          want !== u.want &&
          u.want !== undefined &&
          Math.hypot(t.x - game.player.x, t.z - game.player.z) < 12
        )
          playWorldSound(game, want ? "open" : "close", t);
        if (
          want &&
          u.want === undefined &&
          Math.hypot(t.x - game.player.x, t.z - game.player.z) < 12
        )
          playWorldSound(game, "open", t);
        u.want = want;
        u.openness += ((want ? 1 : 0) - u.openness) * (1 - Math.exp(-12 * dt));
        u.hinge.rotation.x = u.openness * Math.PI * 0.48;
      } else if (u.kind === "furnace") {
        const burning =
          (game.multiplayer?.isGuest ? shared?.burn || 0 : record?.burn || 0) >
          0;
        u.fire.visible = burning;
        u.sparks.visible =
          burning && animated && game.settings.particles !== "minimal";
        u.fire.children.forEach((f, i) => {
          f.scale.y = animated ? 0.8 + Math.sin(time * 11 + i * 2) * 0.2 : 1;
        });
        u.sparks.children.forEach((s, i) => {
          const phase = (time * 0.7 + i / 3) % 1;
          s.position.y = 0.4 + phase * 0.7;
          s.position.x = 0.3 + i * 0.2 + Math.sin(time * 3 + i) * 0.035;
        });
      } else if (u.kind === "enchanting_table") {
        const near =
          Math.hypot(game.player.x - t.x - 0.5, game.player.z - t.z - 0.5) < 4;
        u.openness += ((near ? 1 : 0.2) - u.openness) * (1 - Math.exp(-5 * dt));
        u.book.position.set(
          0.5,
          1.3 + (animated ? Math.sin(time * 1.6) * 0.045 : 0),
          0.5,
        );
        if (near)
          u.book.rotation.y = Math.atan2(
            game.player.x - t.x - 0.5,
            game.player.z - t.z - 0.5,
          );
        u.pages.forEach(
          (p, i) => (p.rotation.z = (i ? -1 : 1) * (0.07 + u.openness * 0.32)),
        );
        u.leaf.rotation.z = animated
          ? (0.5 + 0.5 * Math.sin(time * 1.8)) * Math.PI * u.openness
          : 0;
      } else if (u.kind === "jukebox") {
        u.disc.visible = !!(game.multiplayer?.isGuest
          ? shared?.disc
          : record?.slots?.[0]);
        const selected = game.jukebox?.selection;
        if (
          animated &&
          game.jukebox?.state === "playing" &&
          selected?.key === key
        )
          u.disc.rotation.y += dt * 2;
      }
    }
  }
}
