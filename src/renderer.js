import {
  geometryFromData,
  queueTerrainResult,
  injectTerrainCoverage,
} from "./terrain-stream.js";
import {
  injectBlockLight,
  itemLight,
  dirtyLightRegion,
} from "./block-light.js";
import { createArrowModel } from "./arrow-model.js";
import { isWeapon } from "./weapon-art.js";
import {
  customItemMotion,
  mountJavaItem,
  heldMountX,
  heldRestRoll,
} from "./java-item-motion.js";
import { anchorHeldItem } from "./item-framing.js";
import { shapeGeometry } from "./shape-geometry.js";
import { applyDisplayResolution } from "./render-budget.js";
import { blockParts } from "./block-shapes.js";
import { animateEditionWeapon } from "./edition-models.js";
import { AquaticVisuals } from "./aquatic-visuals.js";
import { playerEye } from "./player-body.js";
import { WorldAnimations } from "./world-animations.js";
import { StandVisuals } from "./stand-visuals.js";
import { inheritPlayerMotion } from "./player-motion.js";
import { boundedLook } from "./mob-look.js";
import { FARM_FOODS, farmScale } from "./livestock-data.js";
import { animateInfernalModel } from "./infernal-models.js";
import { TricksterEffects } from "./trickster-effects.js";
import { IncursionRenderer } from "./incursion-renderer.js";
import {
  createPistolModel,
  animatePistolModel,
  pistolRecoil,
  PISTOL_RECOIL_SECONDS,
} from "./pistol-model.js";
import { ArcaneEffects, animateMagic } from "./arcane-effects.js";
import {
  entryRevision as terrainEntryRevision,
  updateHorizonMask as updateTerrainCoverage,
  loadAround as streamTerrain,
  installTerrainMesh,
} from "./terrain-streaming.js";
import { WeatherRenderer } from "./weather-renderer.js";
import {
  CloudField,
  positionCelestials,
  celestialMaterial,
} from "./sky-effects.js";
import { daylightAt, caveExposure } from "./daylight.js";
import { armAppearanceFor } from "./skins.js";
import { createPlayerModel, animatePlayerModel } from "./player-model.js";
import * as THREE from "three";
import { easeAngle, particleCount } from "./graphics.js";
import {
  B,
  BLOCKS,
  MIN_Y,
  MAX_Y,
  SEA,
  ITEMS,
  HOSTILE_TYPES,
  MOB_INFO,
} from "./data.js";
import { index, chunkKey } from "./world.js";
import { makeAtlas, iconURL, COLS, ROWS, crackTextures } from "./textures.js";
import { meshChunk } from "./mesher.js";
import workerSource from "./worker-code.js";
import { createMobModel } from "./models.js";
import { FirstPersonAnimator } from "./animation.js";
import {
  fitHandGrip,
  applyHandAppearance,
  HAND_REST_Y,
  ITEM_REST_OFFSET,
  createHandRig,
  createHeldModel,
  createDroppedModel,
  updateHandRig,
} from "./first-person.js";
import { blockBounds } from "./doors.js";
export function buildGeometry(world, c, options) {
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) world.ensure(c.cx + dx, c.cz + dz);
  return meshChunk(world, c, options).map(geometryFromData);
}
export class Renderer {
  constructor(container, settings) {
    this.settings = settings;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#a8c9c3");
    this.scene.fog = new THREE.Fog("#a8c9c3", 35, 100);
    this.camera = new THREE.PerspectiveCamera(
      settings.FOV,
      innerWidth / innerHeight,
      0.05,
      400,
    );
    this.camera.rotation.order = "YXZ";
    this.gl = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.gl.setSize(innerWidth, innerHeight);
    this.gl.info.autoReset = false;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.toneMappingExposure = 1;
    this.gl.domElement.id = "game-canvas";
    container.append(this.gl.domElement);
    this.atlas = makeAtlas(settings.texturePack);
    this.worldAnimations = new WorldAnimations(this.scene, this.atlas);
    this.aquaticVisuals = new AquaticVisuals(this.scene);
    this.appliedPack = settings.texturePack;
    this.material = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
      alphaTest: 0.5,
    });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.horizonMaskData = new Uint8Array(32 * 32);
    this.horizonMask = new THREE.DataTexture(
      this.horizonMaskData,
      32,
      32,
      THREE.RedFormat,
    );
    this.horizonMask.magFilter = this.horizonMask.minFilter =
      THREE.NearestFilter;
    this.horizonMask.generateMipmaps = false;
    this.horizonOrigin = { value: new THREE.Vector2() };
    this.horizonMaskDirty = true;
    this.horizonMaterial = this.material.clone();
    this.horizonWaterMaterial = this.waterMaterial.clone();
    for (const material of [this.horizonMaterial, this.horizonWaterMaterial])
      material.onBeforeCompile = (shader) =>
        injectTerrainCoverage(shader, this, true);
    this.fluidTime = { value: 0 };
    this.fluidFancy = { value: 1 };
    this.material.onBeforeCompile = (shader) => {
      injectBlockLight(shader);
      injectTerrainCoverage(shader, this, false);
      shader.uniforms.dcsmTime = this.fluidTime;
      shader.fragmentShader =
        "uniform float dcsmTime;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        #ifdef USE_MAP
        float tile=floor(vMapUv.x*${COLS}.0)+(${ROWS - 1}.0-floor(vMapUv.y*${ROWS}.0))*${COLS}.0;
        if(tile>=${B.primed_tnt * 3}.0 && tile<${(B.primed_tnt + 1) * 3}.0 && sin(dcsmTime*20.0)>.2) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),.75);
        #endif`,
        );
    };
    this.waterMaterial.onBeforeCompile = (shader) => {
      injectBlockLight(shader);
      injectTerrainCoverage(shader, this, false);
      shader.uniforms.dcsmTime = this.fluidTime;
      shader.uniforms.dcsmFancy = this.fluidFancy;
      shader.fragmentShader =
        "uniform float dcsmTime;uniform float dcsmFancy;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
      #ifdef USE_MAP
      float dcsmTile=floor(vMapUv.x*${COLS}.0)+(${ROWS - 1}.0-floor(vMapUv.y*${ROWS}.0))*${COLS}.0;
      if(dcsmTile>=${B.kelp * 3}.0) diffuseColor.a=min(1.0,diffuseColor.a/0.72);
      if(dcsmFancy>0.5){
        if(dcsmTile>=15.0&&dcsmTile<18.0)diffuseColor.rgb*=0.94+0.06*sin(dcsmTime*1.8+vMapUv.x*760.0+vMapUv.y*340.0);
        if(dcsmTile>=84.0&&dcsmTile<87.0)diffuseColor.rgb*=1.1+0.24*sin(dcsmTime*2.0+vMapUv.x*500.0-vMapUv.y*400.0);
        if(dcsmTile>=93.0&&dcsmTile<96.0)diffuseColor.rgb*=1.05+0.1*sin(dcsmTime+vMapUv.x*300.0+vMapUv.y*600.0);
      }
      #endif`,
        );
    };
    this.hemi = new THREE.HemisphereLight("#d8e7dc", "#8f9270", 2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff4cf", 2.2);
    this.sun.position.set(30, 70, 30);
    this.scene.add(this.sun.target);
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -32,
      right: 32,
      top: 32,
      bottom: -32,
      near: 0.5,
      far: 240,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.sun);
    this.meshes = new Map();
    this.world = null;
    this.epoch = 0;
    this.ticket = 0;
    this.jobs = new Map();
    this.readyMeshes = [];
    this.workers = [];
    this.workerFallback = false;
    try {
      const sourceURL = URL.createObjectURL(
        new Blob([workerSource], { type: "application/javascript" }),
      );
      for (
        let i = 0;
        i < Math.min(2, navigator.hardwareConcurrency || 1);
        i++
      ) {
        const worker = new Worker(sourceURL),
          slot = { worker, busy: false };
        worker.onmessage = ({ data }) => queueTerrainResult(this, slot, data);
        worker.onerror = () => {
          slot.busy = false;
          this.jobs.delete(slot.ticket);
          this.workerFallback = true;
        };
        this.workers.push(slot);
      }
      URL.revokeObjectURL(sourceURL);
    } catch {
      this.workerFallback = true;
    }
    this.localLights = Array.from({ length: 4 }, () => {
      const light = new THREE.PointLight("#ffd17e", 0, 13, 2);
      light.visible = false;
      this.scene.add(light);
      return light;
    });
    this.fog = this.scene.fog;
    this.stars = new THREE.Group();
    const starPositions = [];
    for (let i = 0; i < 260; i++) {
      const a = i * 2.399963,
        r = 270,
        y = 45 + ((i * 73) % 210),
        horizontal = Math.sqrt(r * r - Math.min(y, 260) ** 2);
      starPositions.push(Math.cos(a) * horizontal, y, Math.sin(a) * horizontal);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    this.starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#ffffff",
        size: 1.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        fog: false,
      }),
    );
    this.celestialSky = new THREE.Group();
    celestialMaterial(this.starField.material);
    this.celestialSky.add(this.starField);
    this.scene.add(this.celestialSky);

    const outlineG = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(1.005, 1.005, 1.005),
    );
    this.outline = new THREE.LineSegments(
      outlineG,
      new THREE.LineBasicMaterial({
        color: "#161616",
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.cracks = crackTextures();
    this.breakOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.008, 1.008, 1.008),
      new THREE.MeshBasicMaterial({
        map: this.cracks[0],
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    this.breakOverlay.visible = false;
    this.scene.add(this.breakOverlay);
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.sunOrb = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 0.1),
      new THREE.MeshBasicMaterial({ color: "#fff0bd", fog: false }),
    );
    this.celestialSky.add(this.sunOrb);
    this.moonOrb = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 0.1),
      new THREE.MeshBasicMaterial({ color: "#c5d9db", fog: false }),
    );
    this.celestialSky.add(this.moonOrb);
    celestialMaterial(this.sunOrb.material);
    celestialMaterial(this.moonOrb.material);
    for (const [orb, moon] of [
      [this.sunOrb, false],
      [this.moonOrb, true],
    ]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      const ctx = canvas.getContext("2d");
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const rim = Math.min(x, y, 15 - x, 15 - y);
          ctx.fillStyle = moon
            ? (x * 7 + y * 11) % 19 < 5
              ? "#8c94a3"
              : rim < 1
                ? "#aeb7c8"
                : "#dde2e9"
            : rim < 2
              ? "#ffc765"
              : rim < 4
                ? "#ffe296"
                : "#fff5cc";
          ctx.fillRect(x, y, 1, 1);
        }
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      orb.material.map = texture;
      orb.material.color.set("#ffffff");
    }

    this.clouds = new CloudField(settings);
    this.scene.add(this.clouds);
    this.weatherVisual = new WeatherRenderer(this.scene, settings);
    this.arcane = new ArcaneEffects(this.scene);
    this.incursionVisual = new IncursionRenderer(this.scene);
    this.tricksterVisual = new TricksterEffects(this.scene);
    this.handScene = new THREE.Scene();
    this.handScene.add(new THREE.AmbientLight("#ffffff", 1.3));
    this.handLight = new THREE.DirectionalLight("#fff0cf", 1.8);
    this.handLight.position.set(-1, 3, 2);
    this.handScene.add(this.handLight);
    this.handCamera = new THREE.PerspectiveCamera(
      70,
      innerWidth / innerHeight,
      0.04,
      4,
    );
    this.handRig = createHandRig();
    this.handGroup = this.handRig.root;
    this.handScene.add(this.handGroup);
    this.leftHandRig = createHandRig();
    this.leftHandRig.root.position.x = -0.37;
    this.leftHandRig.root.scale.x = -1;
    this.leftHandRig.root.visible = false;
    this.handScene.add(this.leftHandRig.root);
    this.leftPistol = createPistolModel(true);
    this.leftHandRig.grip.add(this.leftPistol);
    this.animator = new FirstPersonAnimator();
    this.slash = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.008, 3, 22, Math.PI * 0.85),
      new THREE.MeshBasicMaterial({
        color: "#f9edd0",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.slash.position.set(-0.1, 0.12, -0.17);
    this.handGroup.add(this.slash);
    this.heldMesh = null;
    this.heldId = null;
    this.mobMeshes = new Map();
    this.dropMeshes = new Map();
    this.dropTextures = new Map();
    this.projectileMeshes = new Map();
    this.effects = [];
    this.entityTarget = new THREE.Vector3();
    this.standVisuals = new StandVisuals(this);
    this.applyGraphics();
    addEventListener("resize", () => {
      applyDisplayResolution(
        this,
        this.settings,
        innerWidth,
        innerHeight,
        devicePixelRatio,
      );
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.handCamera.aspect = innerWidth / innerHeight;
      this.handCamera.updateProjectionMatrix();
    });
  }
  applyGraphics() {
    const level = Math.round(this.settings.graphics || 3);
    if (this.atlas && this.appliedPack !== this.settings.texturePack) {
      const old = this.atlas;
      this.atlas = makeAtlas(this.settings.texturePack);
      this.material.map =
        this.waterMaterial.map =
        this.horizonMaterial.map =
        this.horizonWaterMaterial.map =
          this.atlas.texture;
      this.horizonMaterial.needsUpdate =
        this.horizonWaterMaterial.needsUpdate = true;
      this.material.needsUpdate = this.waterMaterial.needsUpdate = true;
      this.appliedPack = this.settings.texturePack;
      this.appliedMip = undefined;
      this.heldSignature = undefined;
      this.playerSignature = undefined;
      for (const m of this.dropMeshes.values()) this.disposeObject(m);
      this.dropMeshes.clear();
      for (const t of this.dropTextures.values()) t.dispose();
      this.dropTextures.clear();
      old.texture.dispose();
    }
    const levels = this.settings.mipmapLevels ?? 4;
    if (this.atlas && this.appliedMip !== levels) {
      // WebGL texture storage is immutable: a larger chain needs a fresh
      // allocation, even when its base image and sampler filter are unchanged.
      if (this.appliedMip !== undefined) {
        const old = this.atlas.texture;
        this.atlas.texture = new THREE.CanvasTexture(this.atlas.canvas);
        this.atlas.texture.colorSpace = THREE.SRGBColorSpace;
        this.atlas.texture.magFilter = THREE.NearestFilter;
        this.material.map =
          this.waterMaterial.map =
          this.horizonMaterial.map =
          this.horizonWaterMaterial.map =
            this.atlas.texture;
        this.horizonMaterial.needsUpdate =
          this.horizonWaterMaterial.needsUpdate = true;
        this.material.needsUpdate = this.waterMaterial.needsUpdate = true;
        this.heldSignature = undefined;
        this.playerSignature = undefined;
        for (const m of this.dropMeshes.values()) this.disposeObject(m);
        this.dropMeshes.clear();
        old.dispose();
      }
      const t = this.atlas.texture;
      t.mipmaps = [];
      t.generateMipmaps = false;
      if (levels > 0) {
        t.mipmaps.push(this.atlas.canvas);
        let last = this.atlas.canvas;
        for (let i = 1; i <= levels; i++) {
          const canvas = document.createElement("canvas");
          canvas.width = this.atlas.canvas.width >> i;
          canvas.height = this.atlas.canvas.height >> i;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
          t.mipmaps.push(canvas);
          last = canvas;
        }
      }
      t.minFilter = levels
        ? THREE.NearestMipmapLinearFilter
        : THREE.NearestFilter;
      t.needsUpdate = true;
      this.appliedMip = levels;
    }
    const anisotropy = Math.min(
      this.settings.anisotropy ?? 4,
      this.gl.capabilities.getMaxAnisotropy(),
    );
    if (
      this.appliedAnisotropy !== anisotropy ||
      this.anisotropyTexture !== this.atlas.texture
    ) {
      this.atlas.texture.anisotropy = anisotropy;
      this.atlas.texture.needsUpdate = true;
      this.appliedAnisotropy = anisotropy;
      this.anisotropyTexture = this.atlas.texture;
    }
    applyDisplayResolution(
      this,
      this.settings,
      innerWidth,
      innerHeight,
      devicePixelRatio,
    );
    if (this.clouds) this.clouds.visible = this.settings.clouds !== false;
    this.quality = level;
    if (
      this.world &&
      (this.appliedAO !== this.settings.ambientOcclusion ||
        this.appliedBlend !== this.settings.biomeBlend ||
        this.appliedColors !== this.settings.biomeColors ||
        this.appliedArt !== this.settings.texturePack)
    ) {
      this.epoch++;
      this.jobs.clear();
      for (const key of this.meshes.keys()) this.world.dirty.add(key);
    }
    this.appliedAO = this.settings.ambientOcclusion;
    this.appliedBlend = this.settings.biomeBlend;
    this.appliedColors = this.settings.biomeColors;
    this.appliedArt = this.settings.texturePack;
    if (this.appliedDistantDetail !== (this.settings.distantDetail ?? 4)) {
      this.epoch++;
      this.jobs.clear();
      for (const [key, mesh] of this.meshes)
        if (mesh.userData.horizon) this.world?.dirty.add(key);
      this.appliedDistantDetail = this.settings.distantDetail ?? 4;
    }
    this.worldAnimations?.atlasChanged(this.atlas);
    this.lastLights = undefined;
    const size = Math.min(
      this.settings.shadowResolution ?? 1024,
      this.gl.capabilities.maxTextureSize,
    );
    if (this.sun.shadow.mapSize.x !== size || this.settings.shadows !== true) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapPass?.dispose();
      this.sun.shadow.mapPass = null;
      this.sun.shadow.mapSize.set(size, size);
    }
    const half = (this.settings.shadowDistance ?? 64) / 2;
    Object.assign(this.sun.shadow.camera, {
      left: -half,
      right: half,
      top: half,
      bottom: -half,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    const shadowType =
      this.settings.shadowFilter === "hard"
        ? THREE.BasicShadowMap
        : THREE.PCFSoftShadowMap;
    const shadowChanged =
      this.gl.shadowMap.type !== shadowType ||
      this.gl.shadowMap.enabled !== (this.settings.shadows === true);
    this.gl.shadowMap.type = shadowType;
    this.gl.shadowMap.enabled = this.settings.shadows === true;
    this.sun.castShadow = this.settings.shadows === true;
    for (const m of [...this.mobMeshes.values(), ...this.dropMeshes.values()])
      m.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = this.settings.entityShadows !== false;
          if (shadowChanged)
            for (const mat of Array.isArray(o.material)
              ? o.material
              : [o.material])
              mat.needsUpdate = true;
        }
      });
    if (shadowChanged)
      for (const mat of [
        this.material,
        this.waterMaterial,
        this.horizonMaterial,
        this.horizonWaterMaterial,
      ])
        mat.needsUpdate = true;
  }
  setWorld(world) {
    this.streamSettled = false;
    this.lastLights = undefined;
    this.worldAnimations.clear();
    this.standVisuals?.clear();
    this.arcane?.clear();
    this.incursionVisual?.clear();
    this.tricksterVisual?.clear();
    this.pistolKick = 0;
    this.epoch++;
    this.jobs.clear();
    this.readyMeshes = [];
    this.planKeys = null;
    this.plan = null;
    for (const group of this.meshes.values()) {
      this.scene.remove(group);
      group.children.forEach((m) => m.geometry.dispose());
    }
    this.meshes.clear();
    this.horizonMaskDirty = true;
    for (const m of this.mobMeshes.values()) this.disposeObject(m);
    this.mobMeshes.clear();
    for (const m of this.dropMeshes.values()) this.disposeObject(m);
    this.dropMeshes.clear();
    this.syncProjectiles([]);
    this.world = world;
    this.itemLightCells = new Map();
    this.lastItemLightScan = undefined;
  }
  entryRevision(entry) {
    return terrainEntryRevision(this, entry);
  }
  updateHorizonMask(x, z) {
    return updateTerrainCoverage(this, x, z);
  }
  loadAround(x, z, radius, budget = 1) {
    return streamTerrain(this, x, z, radius, budget);
  }
  rebuild(c, surfaceOnly = false) {
    this.installMesh(
      c.cx,
      c.cz,
      buildGeometry(this.world, c, {
        surfaceOnly,
        interactiveModels: true,
        ambientOcclusion: this.settings.ambientOcclusion !== false,
        biomeColors: this.settings.biomeColors !== false,
        biomeBlend: this.settings.biomeBlend ?? 2,
        texturePack: this.settings.texturePack,
      }),
      surfaceOnly,
      {
        revision: this.world.revisions.get(c.key) || 0,
        worldVisuals: c.worldVisuals || [],
      },
    );
  }
  installMesh(cx, cz, geometries, surfaceOnly = false, entry = {}) {
    return installTerrainMesh(this, cx, cz, geometries, surfaceOnly, entry);
  }
  setHeld(id, stack) {
    const signature = JSON.stringify([
      id,
      stack?.enchantments || {},
      this.settings.texturePack,
    ]);
    if (signature === this.heldSignature) return;
    this.heldSignature = signature;
    this.heldId = id;
    this.handRig.armVisuals.visible = !id;
    this.leftHandRig.armVisuals.visible = !id;
    this.leftHandRig.root.visible = id === "matthew_dual_pistols";
    this.pistolKick = 0;
    const pistol = id === "matthew_dual_pistols";
    this.leftPistol.visible = pistol;
    this.handRig.wrist.rotation.set(
      pistol ? 0.04 : customItemMotion(id) ? -0.12 : 0,
      pistol ? 0.1 : customItemMotion(id) ? -0.12 : 0,
      pistol ? -0.07 : customItemMotion(id) ? -0.13 : 0,
    );
    this.leftHandRig.wrist.rotation.copy(this.handRig.wrist.rotation);
    animatePistolModel(this.leftPistol, 0);
    if (this.heldMesh) {
      this.handRig.grip.remove(this.heldMesh);
      this.disposeObject(this.heldMesh, false);
    }
    this.heldMesh = createHeldModel(id, this.atlas);
    if (this.heldMesh) {
      if (stack?.enchantments && Object.keys(stack.enchantments).length)
        this.heldMesh.traverse((m) => {
          if (m.isMesh && m.material.emissive) {
            m.material.emissive.set("#362458");
            m.userData.enchanted = true;
          }
        });
      this.handRig.grip.add(this.heldMesh);
    }
    fitHandGrip(this.handRig, id, this.heldMesh);
    fitHandGrip(
      this.leftHandRig,
      pistol ? id : null,
      pistol ? this.leftPistol : null,
    );
    this.animator.action = null;
    this.animator.trigger("equip");
  }
  setArmor(equipment = []) {
    const item = ITEMS[equipment[1]?.id];
    const appearance = armAppearanceFor(this.settings.skin);
    const armorId = item?.armorSlot === 1 ? equipment[1].id : null;
    applyHandAppearance(this.handRig, appearance, armorId);
    applyHandAppearance(this.leftHandRig, appearance, armorId);
    this.playerEquipment = equipment;
  }
  pulseEffect(player) {
    if (this.settings.particles !== "minimal") this.arcane?.burst(player, 64);
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.015, 4, 48),
        new THREE.MeshBasicMaterial({
          color: i ? "#b6a3ff" : "#ccfaff",
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.rotation.set(Math.PI / 2 + (i ? 0.28 : -0.28), 0, i * 0.7);
      ring.position.set(player.x, player.y + 1, player.z);
      this.scene.add(ring);
      this.effects.push({
        m: ring,
        v: new THREE.Vector3(),
        life: 0.6,
        pulse: true,
      });
    }
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.025, 4, 48),
      new THREE.MeshBasicMaterial({
        color: "#65eaff",
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(player.x, player.y + 0.6, player.z);
    this.scene.add(m);
    this.effects.push({ m, v: new THREE.Vector3(), life: 0.6, pulse: true });
  }
  syncIncursion(game, time) {
    this.incursionVisual.update(game, time);
    this.pistolHand = game.player.matthewHand || 0;
  }
  tricksterEffect(kind, from, to, direction) {
    this.tricksterVisual.start(kind, from, to, direction, this.settings);
  }
  tricksterTrail(from, to) {
    this.tricksterVisual.trail(from, to, this.settings);
  }
  action(kind) {
    if (kind === "fire") {
      this.pistolKick = PISTOL_RECOIL_SECONDS;
      this.playerSwing = PISTOL_RECOIL_SECONDS;
    }
    this.animator.trigger(kind, ITEMS[this.heldId]?.tool, this.heldId);
    if (["attack", "use", "place", "eat"].includes(kind))
      this.playerSwing = 0.32;
  }
  combatImpact(entity, { critical = false, killed = false } = {}) {
    if (this.heldId === "devin_sword" && this.settings.particles !== "minimal")
      this.arcane?.burst(entity, critical ? 20 : 10);
    const model = this.mobMeshes.get(entity.id);
    if (model) {
      model.userData.flinch = 1;
      if (killed) model.userData.death = 0.001;
    }
    for (let i = 0; i < particleCount(this.settings, critical ? 9 : 4); i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.045, 0.045),
        new THREE.MeshBasicMaterial({
          color: critical ? "#ffe4a2" : "#eee3ce",
        }),
      );
      m.position.set(
        entity.x + (Math.random() - 0.5) * 0.35,
        entity.y + 0.8 + Math.random() * 0.6,
        entity.z + (Math.random() - 0.5) * 0.35,
      );
      this.scene.add(m);
      this.effects.push({
        m,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          1 + Math.random(),
          (Math.random() - 0.5) * 2,
        ),
        life: 0.3,
      });
    }
  }
  updateTarget(target, progress) {
    this.outline.visible = !!target;
    this.targetDistance = target?.distance ?? Infinity;
    this.breakOverlay.visible = !!target && progress > 0;
    if (target) {
      const shaped = BLOCKS[target.id]?.edition;
      if (!this.legacyTargetGeometries)
        this.legacyTargetGeometries = [
          this.outline.geometry,
          this.breakOverlay.geometry,
        ];
      if (shaped) {
        const parts = blockParts(
            target.id,
            this.world,
            target.x,
            target.y,
            target.z,
          ),
          key = JSON.stringify(parts);
        if (this.targetShapeKey !== key) {
          if (this.targetShapeKey) {
            this.outline.geometry.dispose();
            this.breakOverlay.geometry.dispose();
          }
          const geometry = shapeGeometry(parts);
          this.outline.geometry = new THREE.EdgesGeometry(geometry);
          this.breakOverlay.geometry = geometry;
          this.targetShapeKey = key;
        }
        for (const mesh of [this.outline, this.breakOverlay]) {
          mesh.position.set(target.x, target.y, target.z);
          mesh.scale.setScalar(1.002);
        }
        this.breakOverlay.material.map =
          this.cracks[Math.min(9, Math.floor(progress * 10))];
        this.outline.material.color.set(progress > 0 ? "#ffffff" : "#111111");
        return;
      }
      if (this.targetShapeKey) {
        this.outline.geometry.dispose();
        this.breakOverlay.geometry.dispose();
        [this.outline.geometry, this.breakOverlay.geometry] =
          this.legacyTargetGeometries;
        this.targetShapeKey = null;
      }
      const b = blockBounds(target.id),
        size = [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
      for (const mesh of [this.outline, this.breakOverlay]) {
        mesh.position.set(
          target.x + (b[0] + b[3]) / 2,
          target.y + (b[1] + b[4]) / 2,
          target.z + (b[2] + b[5]) / 2,
        );
        mesh.scale.set(...size);
      }
      this.breakOverlay.material.map =
        this.cracks[Math.min(9, Math.floor(progress * 10))];
      this.outline.material.color.set(progress > 0 ? "#ffffff" : "#111111");
    }
  }
  makeMob(entity) {
    const model = createMobModel(entity);
    model.traverse((m) => {
      if (m.isMesh && m !== model.userData.shadow) {
        m.castShadow = this.settings.entityShadows !== false;
        m.receiveShadow = true;
      }
    });
    this.scene.add(model);
    this.mobMeshes.set(entity.id, model);
    return model;
  }
  syncEntities(entities, drops, time, dt = 1 / 60, projectiles = []) {
    const living = new Set();
    for (const e of entities) {
      living.add(e.id);
      const range = Math.min(
        192,
        (this.settings.renderDistance * 16 + 12) *
          (this.settings.entityDistance ?? 1),
      );
      if (
        Math.hypot(e.x - this.camera.position.x, e.z - this.camera.position.z) >
        range
      ) {
        const old = this.mobMeshes.get(e.id);
        if (old) {
          this.disposeObject(old);
          this.mobMeshes.delete(e.id);
        }
        continue;
      }
      const oldModel = this.mobMeshes.get(e.id);
      if (
        oldModel?.userData.entityType &&
        oldModel.userData.entityType !== e.type
      ) {
        this.disposeObject(oldModel);
        this.mobMeshes.delete(e.id);
      }
      const m = this.mobMeshes.get(e.id) || this.makeMob(e);
      m.userData.entityType = e.type;
      const u = m.userData;
      const px = m.position.x,
        py = m.position.y,
        pz = m.position.z,
        alpha = 1 - Math.exp(-18 * dt);
      const target = this.entityTarget.set(e.x, e.y, e.z);
      if (!u.renderReady || m.position.distanceToSquared(target) > 64) {
        m.position.set(e.x, e.y, e.z);
        m.rotation.y = e.yaw || 0;
        u.renderReady = true;
      } else m.position.lerp(target, alpha);
      const animateCreature = this.settings.entityAnimations !== false;
      const distance = animateCreature
        ? Math.min(
            0.35,
            Math.hypot(m.position.x - px, m.position.y - py, m.position.z - pz),
          )
        : 0;
      u.stride = (u.stride || 0) + distance * 6;
      u.gait =
        (u.gait || 0) +
        (Math.min(0.65, (distance / Math.max(0.001, dt)) * 0.23) -
          (u.gait || 0)) *
          (1 - Math.exp(-12 * dt));
      u.flinch = Math.max(0, (u.flinch || 0) - dt * 3.5);
      m.rotation.set(
        0,
        easeAngle(m.rotation.y, e.yaw || 0, alpha),
        Math.sin(u.flinch * Math.PI) * 0.13,
      );
      m.scale.y = 1 - Math.sin(u.flinch * Math.PI) * 0.04;
      for (let i = 0; i < (u.legs?.length || 0); i++) {
        const target =
          Math.sin(
            u.stride +
              (u.legs.length === 4
                ? i === 0 || i === 3
                  ? 0
                  : Math.PI
                : i * Math.PI),
          ) * u.gait;
        u.legs[i].rotation.x +=
          (target - u.legs[i].rotation.x) * (1 - Math.exp(-18 * dt));
      }
      const attackDuration =
        e.type === "iron_golem"
          ? 1.2
          : e.type === "devin_guardian"
            ? 1.6
            : ["dread_knight", "soul_reaver", "magma_maw"].includes(e.type)
              ? 2.8
              : 1;
      const attack =
        e.attack > 0.65
          ? Math.sin(
              ((attackDuration - e.attack) / (attackDuration - 0.65)) * Math.PI,
            )
          : 0;
      u.foldedArms?.forEach((arm, i) => {
        arm.rotation.x = animateCreature ? Math.sin(time * 1.4) * 0.015 : 0;
        arm.rotation.z = (i ? 1 : -1) * Math.sin((e.gesture || 0) * 6) * 0.025;
      });
      u.arms?.forEach((arm, i) => {
        arm.rotation.x =
          e.type === "iron_golem"
            ? attack * 2.2 + Math.sin(u.stride + i * Math.PI) * u.gait * 0.5
            : (e.type === "devin_guardian" || e.type === "cinder_wraith"
                ? 0.15
                : 0.9) +
              attack * 1.1 +
              Math.sin(u.stride + i * Math.PI) * u.gait * 0.25;
        arm.rotation.z = (i ? -1 : 1) * attack * 0.18;
        if (e.castTicks > 0) arm.rotation.x = -0.6 - Math.sin(time * 9) * 0.05;
      });
      m.visible =
        e.hp > 0 &&
        Math.hypot(e.x - this.camera.position.x, e.z - this.camera.position.z) <
          range;
      const head = m.userData.head;
      if (head) {
        let headPitch =
          animateCreature &&
          !HOSTILE_TYPES.has(e.type) &&
          e.type !== "villager" &&
          e.type !== "iron_golem" &&
          e.type !== "watcher" &&
          e.age % 280 < 60
            ? 0.25
            : 0;
        let headYaw =
          e.type === "watcher"
            ? 0
            : animateCreature
              ? Math.sin(time * 0.7 + e.age * 0.01) * 0.09
              : 0;
        if (
          e.type === "villager" &&
          Math.hypot(
            e.x - this.camera.position.x,
            e.z - this.camera.position.z,
          ) < 6
        ) {
          const dx = this.camera.position.x - e.x,
            dz = this.camera.position.z - e.z;
          headYaw = Math.atan2(-dx, -dz) - m.rotation.y;
          headPitch = Math.atan2(
            this.camera.position.y -
              (e.y + (MOB_INFO[e.type]?.height || 1.95) * 0.86),
            Math.max(0.1, Math.hypot(dx, dz)),
          );
        }
        if (e.type === "villager" && e.gesture > 0)
          headPitch = Math.sin(e.gesture * 12) * 0.15;
        const look = boundedLook(
          head.rotation.y,
          head.rotation.x,
          headYaw,
          headPitch,
          dt,
        );
        head.rotation.y = look.yaw;
        head.rotation.x = look.pitch;
      }
      if (u.aquaticStyle) {
        const bodyScale = e.baby ? 0.35 : e.inflated ? 1.4 : 1;
        m.scale.setScalar(bodyScale);
        if (u.tail)
          u.tail.rotation.y = animateCreature ? Math.sin(time * 7) * 0.35 : 0;
      }
      if (FARM_FOODS[e.type]) {
        m.scale.setScalar(farmScale(e));
        if (!u.farmHeart) {
          const s = new THREE.Shape();
          [
            [0, 0],
            [-3, 3],
            [-3, 5],
            [-1, 5],
            [0, 4],
            [1, 5],
            [3, 5],
            [3, 3],
            [0, 0],
          ].forEach(([x, y], i) =>
            i ? s.lineTo(x * 0.055, y * 0.055) : s.moveTo(x * 0.055, y * 0.055),
          );
          u.farmHeart = new THREE.Mesh(
            new THREE.ShapeGeometry(s),
            new THREE.MeshBasicMaterial({
              color: 0xe46c76,
              side: THREE.DoubleSide,
            }),
          );
          m.add(u.farmHeart);
        }
        u.farmHeart.visible = e.love > 0;
        u.farmHeart.position.set(
          0,
          (MOB_INFO[e.type]?.height || 1.2) + 0.15 + Math.sin(time * 3) * 0.08,
          0,
        );
        u.farmHeart.quaternion
          .copy(m.quaternion)
          .invert()
          .multiply(this.camera.quaternion);
        if (e.grazeTicks > 0 && u.head) u.head.rotation.x = 0.65;
      }
      if (u.tail)
        u.tail.rotation.z = animateCreature ? Math.sin(time * 2.3) * 0.15 : 0;
      u.spiderLegs?.forEach(({ joint, side, index, base }) => {
        joint.rotation.y =
          base + Math.sin(u.stride + index * Math.PI * 0.7) * u.gait * 0.4;
        joint.rotation.z =
          side *
          (1.05 + Math.cos(u.stride + index * Math.PI * 0.7) * u.gait * 0.22);
      });
      if (e.type === "creeper") {
        const fuse = (e.fuse || 0) / 30;
        m.scale.set(1 + fuse * 0.12, 1 + fuse * 0.08, 1 + fuse * 0.12);
      }
      if (["devin_guardian", "mad_titan"].includes(e.type)) {
        if (!u.warning) {
          u.warning = new THREE.Mesh(
            new THREE.RingGeometry(0.95, 1, 48),
            new THREE.MeshBasicMaterial({
              color: "#f5c27d",
              transparent: true,
              opacity: 0.6,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          u.warning.rotation.x = -Math.PI / 2;
          u.warning.position.y = 0.035;
          m.add(u.warning);
        }
        u.warning.visible = !!e.special && e.special !== "dash";
        const sigil = e.special === "sigil" && e.specialTarget;
        if (sigil) {
          const dx = e.specialTarget.x - e.x,
            dz = e.specialTarget.z - e.z,
            angle = -m.rotation.y;
          u.warning.position.set(
            dx * Math.cos(angle) + dz * Math.sin(angle),
            e.specialTarget.y - e.y + 0.04,
            -dx * Math.sin(angle) + dz * Math.cos(angle),
          );
        } else u.warning.position.set(0, 0.035, 0);
        u.warning.scale.setScalar(
          sigil
            ? 2.8
            : e.special === "shockwave"
              ? 6
              : e.special === "cleave"
                ? 4.5
                : 1.4,
        );
        u.warning.material.color.set(sigil ? "#70edff" : "#f5c27d");
        u.warning.material.opacity = 0.35 + Math.sin(time * 14) * 0.2;
        if (e.special && e.special !== "dash")
          u.arms?.forEach((a, i) => {
            a.rotation.x = 1.8;
            a.rotation.z = (i ? 1 : -1) * 0.35;
          });
      }
      if (e.type === "watcher") {
        u.arms?.forEach((a, i) => {
          a.rotation.x = Math.sin(time * 0.65 + i) * 0.035;
          a.rotation.z = (i ? 1 : -1) * 0.11;
        });
        if (u.head) u.head.rotation.z = Math.sin(time * 0.27) * 0.045;
      }
      if (e.type === "skeleton" && e.attack > 1.1)
        u.arms?.forEach((a) => (a.rotation.x = 1.5));
      m.userData.wings?.forEach((wing, i) => {
        wing.rotation.z =
          (i ? 1 : -1) *
          (0.15 +
            (e.onGround
              ? 0.08
              : animateCreature
                ? Math.abs(Math.sin(time * 18)) * 0.9
                : 0.4));
      });
      if (e.type === "boat")
        u.oars?.forEach((oar, i) => {
          oar.rotation.x =
            Math.sin(time * 6) * Math.min(0.6, (e.speed || 0) * 0.1);
          oar.rotation.z = (i ? -1 : 1) * 0.5;
        });
      if (u.flying)
        u.wings?.forEach(
          (wing, i) =>
            (wing.rotation.z =
              (i ? -1 : 1) * (0.15 + Math.sin(time * 4) * 0.3)),
        );
      if (m.userData.shadow) m.userData.shadow.visible = false;

      u.tailSegments?.forEach((joint, i) => {
        joint.rotation.y = animateCreature
          ? Math.sin(time * 1.7 - i * 0.55) * 0.12
          : 0;
      });
      animateInfernalModel(m, e, time, dt, animateCreature, attack);
      const hurt =
        e.hurt > 0 ||
        (e.burningTicks > 0 && Math.floor(time * 5) % 2 === 0) ||
        (e.type === "creeper" &&
          e.fuse > 0 &&
          Math.floor(e.fuse / 3) % 2 === 0);
      if (u.lastHurt !== hurt) {
        u.lastHurt = hurt;
        for (const mat of u.materials || [])
          if (mat.emissive)
            mat.emissive.copy(
              hurt
                ? new THREE.Color("#5c2015")
                : mat.userData.restEmissive || new THREE.Color("#000000"),
            );
      }
    }
    for (const [id, m] of this.mobMeshes)
      if (!living.has(id) && !m.userData.death) {
        this.disposeObject(m);
        this.mobMeshes.delete(id);
      }
    for (const [id, m] of this.mobMeshes) {
      if (!m.userData.death) continue;
      m.userData.death += dt;
      const p = Math.min(1, m.userData.death / 0.48);
      m.visible = true;
      m.rotation.z = (-p * Math.PI) / 2;
      m.scale.setScalar(1 - p * 0.2);
      if (p >= 1) {
        this.disposeObject(m);
        this.mobMeshes.delete(id);
      }
    }
    this.syncProjectiles(projectiles);
    // Quantize dropped emitters at 2 Hz; lighting survives model/frustum culling.
    // Only affected loaded chunks remesh, and moving items do not churn per frame.
    if (Math.floor(time * 2) !== this.lastItemLightScan) {
      this.lastItemLightScan = Math.floor(time * 2);
      const sources = new Map();
      for (const d of drops) {
        const l = itemLight(d.id),
          x = Math.floor(d.x),
          y = Math.floor(d.y),
          z = Math.floor(d.z);
        if (
          !l ||
          !this.world.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)
        )
          continue;
        const k = `${x},${y},${z}`;
        if (!sources.has(k) || sources.get(k)[3] < l)
          sources.set(k, [x, y, z, l]);
      }
      const old = this.itemLightCells || new Map();
      this.world.itemLightSources = [...sources.values()];
      for (const [k, p] of new Map([...old, ...sources]))
        if ((old.get(k)?.[3] || 0) !== (sources.get(k)?.[3] || 0)) {
          this.world.meshRevision++;
          dirtyLightRegion(this.world, p[0], p[2]);
        }
      this.itemLightCells = sources;
    }
    const ground = new Set();
    for (const d of drops) {
      if (
        Math.hypot(d.x - this.camera.position.x, d.z - this.camera.position.z) >
        Math.min(
          128,
          (this.settings.renderDistance * 16 + 12) *
            (this.settings.droppedItemDistance ??
              this.settings.entityDistance ??
              1),
        )
      )
        continue;
      ground.add(d.uid);
      let mesh = this.dropMeshes.get(d.uid);
      if (!mesh) {
        mesh = createDroppedModel(d.id, this.atlas);
        mesh.traverse((o) => {
          if (o.isMesh) {
            const glow = itemLight(d.id);
            for (const mat of Array.isArray(o.material)
              ? o.material
              : [o.material])
              if (glow && mat.emissive) {
                mat.emissive.set("#ffffff");
                mat.emissiveMap = mat.map;
                mat.emissiveIntensity = (glow / 15) * 0.7;
              }
            o.castShadow = this.settings.shadows && this.settings.entityShadows;
            o.receiveShadow = true;
          }
        });
        this.scene.add(mesh);
        this.dropMeshes.set(d.uid, mesh);
      }
      const animateDrop = this.settings.droppedItemAnimation !== false;
      mesh.position.set(
        d.x,
        d.y + 0.2 + (animateDrop ? Math.sin(time * 3) * 0.05 : 0),
        d.z,
      );
      if (mesh.userData.flatCutout)
        mesh.quaternion.copy(this.camera.quaternion);
      else mesh.rotation.y = animateDrop ? time : 0;
      animateMagic(mesh, time, this.settings.particles !== "minimal");
    }
    for (const [id, m] of this.dropMeshes)
      if (!ground.has(id)) {
        this.disposeObject(m);
        this.dropMeshes.delete(id);
      }
  }
  syncProjectiles(projectiles) {
    const live = new Set();
    for (const q of [...projectiles, ...(this.world?.embeddedArrows || [])]) {
      if (
        q.stuck &&
        Math.hypot(q.x - this.camera.position.x, q.z - this.camera.position.z) >
          Math.min(128, this.settings.renderDistance * 16 + 12)
      )
        continue;
      live.add(q.id);
      let model = this.projectileMeshes.get(q.id);
      if (!model) {
        model = new THREE.Group();
        if (q.fireball) {
          const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.28, 1),
            new THREE.MeshBasicMaterial({
              color: q.reflected ? "#94efff" : "#ff9b39",
            }),
          );
          const halo = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.39, 0),
            new THREE.MeshBasicMaterial({
              color: "#ffcf73",
              wireframe: true,
              transparent: true,
              opacity: 0.65,
            }),
          );
          model.add(core, halo);
          model.userData.fireball = core;
        } else if (!q.arcane && !q.orbBullet) {
          model.add(createArrowModel());
        } else {
          const shaft = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.035, 0.55),
            new THREE.MeshLambertMaterial({
              color: q.orbBullet ? "#ffe595" : q.arcane ? "#79ebf8" : "#a58a5f",
              emissive: q.orbBullet
                ? "#da7b23"
                : q.arcane
                  ? "#286882"
                  : "#000000",
            }),
          );
          model.add(shaft);
          const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.06, 0.14, 4),
            new THREE.MeshLambertMaterial({
              color: q.arcane ? "#d8faff" : "#c4c8c4",
            }),
          );
          tip.rotation.x = -Math.PI / 2;
          tip.position.z = -0.32;
          model.add(tip);
        }
        this.scene.add(model);
        this.projectileMeshes.set(q.id, model);
      }
      if (model.userData.fireball) {
        model.userData.fireball.material.color.set(
          q.reflected ? "#94efff" : "#ff9b39",
        );
        model.rotation.y += 0.05;
      }
      model.position.set(q.x, q.y, q.z);
      const direction = q.stuck ? q.direction : { x: q.vx, y: q.vy, z: q.vz };
      model.lookAt(q.x + direction.x, q.y + direction.y, q.z + direction.z);
      model.rotateY(Math.PI);
    }
    for (const [id, m] of this.projectileMeshes)
      if (!live.has(id)) {
        this.disposeObject(m);
        this.projectileMeshes.delete(id);
      }
  }
  guardianWave(e, radius = 6) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({
        color: "#94eaf3",
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(e.x, e.y + 0.12, e.z);
    this.scene.add(m);
    this.effects.push({
      m,
      v: new THREE.Vector3(),
      life: 0.5,
      pulse: true,
      grow: radius / 0.5,
    });
    if (this.settings.particles !== "minimal") this.arcane?.burst(e, 24);
  }
  explosionEffect(e) {
    this.guardianWave(e, 3);
    this.breakParticles(
      Math.floor(e.x),
      Math.floor(e.y),
      Math.floor(e.z),
      B.dirt,
    );
  }
  breakParticles(x, y, z, id) {
    const color = BLOCKS[id].color;
    for (let i = 0; i < particleCount(this.settings, 7); i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.09, 0.09),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.scene.add(m);
      this.effects.push({
        m,
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 3,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.6,
      });
    }
  }
  disposeObject(object, remove = true) {
    if (remove) this.scene.remove(object);
    object.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) {
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          if (!material.userData.sharedMap) material.map?.dispose();
          material.dispose();
        }
      }
    });
  }
  draw({
    player,
    cameraMode = 0,
    equipment = [],
    time = 6000,
    playing = false,
    elapsed = 0,
    mining = 0,
    moving = false,
    underwater = false,
    animating = true,
    game = null,
  }) {
    const frameDt = Math.min(
      0.1,
      Math.max(0, this.lastTime ? elapsed - this.lastTime : 0.016),
    );
    // Recoil ages in both F5 views, rather than flashing again on return.
    this.worldAnimations.update(game, frameDt, elapsed);
    this.aquaticVisuals.update(game, elapsed);
    this.pistolKick = Math.max(
      0,
      (this.pistolKick || 0) - (animating ? frameDt : 0),
    );
    this.tricksterVisual.update(
      animating ? frameDt : 0,
      playing,
      this.settings,
    );
    const weather = this.weatherVisual.update(
      this.world,
      player,
      animating ? frameDt : 0,
      elapsed,
      playing,
    );
    this.weatherDark =
      (this.weatherDark || 0) +
      (weather.intensity - (this.weatherDark || 0)) *
        (1 - Math.exp(-3 * frameDt));
    this.updateHorizonMask(player.x, player.z);
    this.arcane?.update(
      this.world,
      player,
      this.heldId,
      elapsed,
      animating ? frameDt : 0,
      playing,
      this.settings.particles,
    );
    animateMagic(this.heldMesh, elapsed, this.settings.particles !== "minimal");
    animateMagic(
      this.playerModel,
      elapsed,
      this.settings.particles !== "minimal",
    );
    this.fluidTime.value = elapsed;
    this.fluidFancy.value =
      this.settings.fancyGraphics !== false &&
      this.settings.animatedTextures !== false
        ? 1
        : 0;
    const lighting = daylightAt(time),
      { phase } = lighting,
      light = lighting.daylight;
    this.hemi.intensity =
      0.13 + (this.settings.brightness ?? 0.5) * 0.22 + light * 0.75;
    this.hemi.groundColor
      .set("#62664d")
      .lerp(new THREE.Color("#292d46"), 1 - light);
    this.sun.intensity = lighting.sun + lighting.moon;
    const sky = new THREE.Color("#101a34").lerp(
      new THREE.Color("#87b8e2"),
      light,
    );
    sky.lerp(new THREE.Color("#dc9679"), lighting.warmth * 0.6);
    const cinder = this.world?.dimension === "cinderwild";
    if (cinder) {
      const biome = this.world.terrain(player.x, player.z).biome;
      sky.set(
        {
          ash_wastes: "#4e4655",
          emberwood: "#4c283e",
          basalt_ridges: "#342c44",
          sulfur_basin: "#654432",
          bloodlands: "#602326",
          soul_vale: "#293747",
        }[biome] || "#48212d",
      );
      this.hemi.intensity = 1.25;
      this.hemi.color.set("#f4ac7a");
      this.hemi.groundColor.set("#654044");
      this.sun.color.set("#f8a45f");
      this.sun.intensity = 1.6;
    } else {
      this.hemi.color.set("#a0b5e5").lerp(new THREE.Color("#e3f0fa"), light);
      this.sun.color.set(light > 0.5 ? "#fff4db" : "#acbfea");
      if (light > 0.5)
        this.sun.color.lerp(new THREE.Color("#ffb276"), lighting.warmth * 0.65);
    }
    this.sunOrb.visible = this.moonOrb.visible =
      !cinder && this.settings.sunMoon !== false;
    this.clouds.visible = !cinder && this.settings.clouds !== false;
    if (!cinder) {
      sky.lerp(new THREE.Color("#687888"), this.weatherDark * 0.68);
      this.sun.intensity *= 1 - this.weatherDark * 0.7;
      this.hemi.intensity *= 1 - this.weatherDark * 0.22;
      if (this.settings.lightningFlashes !== false && weather.flash > 0) {
        sky.lerp(new THREE.Color("#c6d7e4"), weather.flash * 0.18);
        this.hemi.intensity += weather.flash * 0.22;
      }
    }
    const caveTarget = playing ? caveExposure(this.world, player) : 0;
    this.caveShade =
      (this.caveShade || 0) +
      (caveTarget - (this.caveShade || 0)) * (1 - Math.exp(-3 * frameDt));
    sky.lerp(new THREE.Color("#101318"), this.caveShade);
    this.hemi.intensity *= 1 - this.caveShade * 0.55;
    this.sun.intensity *= 1 - this.caveShade * 0.9;
    if (player.effects?.conduit_power && underwater)
      this.hemi.intensity = Math.max(1.15, this.hemi.intensity);
    if (this.caveShade > 0.6)
      this.sunOrb.visible = this.moonOrb.visible = this.clouds.visible = false;
    if (underwater) {
      const biome = this.world.terrain(player.x, player.z).biome;
      sky.set(
        biome.includes("warm")
          ? "#247e93"
          : biome.includes("frozen")
            ? "#304e7c"
            : biome.includes("cold")
              ? "#355e86"
              : "#315f79",
      );
    }
    this.standVisuals?.atmosphere(sky, player, elapsed);
    this.scene.background.copy(sky);
    this.fog.color.copy(sky);
    this.scene.fog =
      this.settings.fog !== false || underwater ? this.fog : null;
    this.starField.visible =
      this.settings.stars !== false && this.caveShade < 0.6;
    this.starField.material.opacity = cinder ? 0 : lighting.stars * 0.8;
    const distance = this.settings.renderDistance * 16;
    this.fog.near = underwater ? 2 : distance * (0.83 - this.weatherDark * 0.3);
    this.fog.far = underwater
      ? player.effects?.conduit_power
        ? 48
        : 24
      : distance * (1.12 - this.weatherDark * 0.3);
    if (this.standVisuals?.trialFade > 0.01 && !underwater) {
      this.scene.fog = this.fog;
      this.fog.near = Math.min(this.fog.near, 7);
      this.fog.far = Math.min(
        this.fog.far,
        48 - this.standVisuals.trialFade * 26,
      );
    }
    if (!underwater) {
      this.fog.near += (4 - this.fog.near) * this.caveShade;
      this.fog.far +=
        (Math.max(18, Math.min(56, distance * 0.92)) - this.fog.far) *
        this.caveShade;
    }
    this.camera.far = Math.max(500, distance * 2 + 350);
    if (this.settings.fancyGraphics !== false) {
      this.lastLights = Math.floor(elapsed * 2);
      const carried =
        (this.settings.localLightCount ?? 4) > 0 ? itemLight(this.heldId) : 0;
      const near = carried
        ? [{ x: player.x - 0.5, y: player.y + 0.15, z: player.z - 0.5 }]
        : [];
      this.localLights.forEach((l, i) => {
        l.intensity = near[i] ? 5 : 0;
        l.visible = !!near[i];
        if (near[i])
          l.position.set(near[i].x + 0.5, near[i].y + 0.85, near[i].z + 0.5);
      });
    }
    if (this.settings.fancyGraphics === false)
      this.localLights.forEach((l) => {
        l.intensity = 0;
        l.visible = false;
      });
    for (let i = 0; i < this.localLights.length; i++)
      if (this.localLights[i].visible)
        this.localLights[i].intensity =
          (this.settings.localLightCount ?? 4) * 1.25 +
          (this.settings.lightFlicker === false
            ? 0
            : Math.sin(elapsed * 7 + i * 2.1) * 0.12 +
              Math.sin(elapsed * 11 + i) * 0.06);
    this.sun.position.set(
      player.x + Math.cos(phase) * 80 * (lighting.altitude >= 0 ? 1 : -1),
      player.y + Math.max(12, Math.abs(Math.sin(phase)) * 100),
      player.z + 30,
    );
    this.sun.target.position.set(player.x, player.y, player.z);
    this.sun.target.updateMatrixWorld();
    if (playing) {
      const crouch = player.crouching ? 0.27 : 0,
        bob =
          this.settings.viewBobbing !== false && moving && player.onGround
            ? Math.sin(elapsed * 10) * 0.035
            : 0;
      this.camera.position.set(
        player.x,
        player.y + playerEye(player) + bob,
        player.z,
      );
      this.camera.rotation.set(
        player.pitch,
        player.yaw,
        this.settings.damageTilt !== false
          ? Math.sin(Math.max(0, player.hurt || 0) * Math.PI * 2) * 0.055
          : 0,
      );
      const palmTrial = player.standData?.trial;
      if (
        animating &&
        this.settings.damageTilt !== false &&
        palmTrial?.phase === "trial" &&
        palmTrial.phenomenon === 1 &&
        palmTrial.elapsed - (palmTrial.signalTick || 0) < 20
      ) {
        this.camera.position.y += Math.sin(elapsed * 37) * 0.025;
        this.camera.rotation.z += Math.sin(elapsed * 31) * 0.012;
      }
      if (cameraMode) {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
          this.camera.quaternion,
        );
        const eye = this.camera.position.clone(),
          side = cameraMode === 1 ? -1 : 1;
        const desired = direction.multiplyScalar(side);
        let distance = 4;
        // Swept corner rays reserve space for the near plane beside walls/roofs.
        for (const ox of [-0.14, 0.14])
          for (const oy of [-0.14, 0.14]) {
            const origin = { x: eye.x + ox, y: eye.y + oy, z: eye.z };
            const hit = this.world.raycast(origin, desired, 4.2, true);
            if (hit && BLOCKS[hit.id]?.solid)
              distance = Math.min(
                distance,
                Math.max(0.12, hit.distance - 0.25),
              );
          }
        this.cameraDistance = distance;
        this.camera.position.copy(eye).addScaledVector(desired, distance);
        if (cameraMode === 2) this.camera.lookAt(eye);
      }
      const transformedModel = this.standVisuals?.dinos.get("local")?.model;
      if (transformedModel)
        transformedModel.visible =
          !!cameraMode && this.cameraDistance > 1.1 && player.health > 0;
      if (cameraMode) {
        const signature = JSON.stringify([
          this.settings.skin,
          equipment.map((s) => s?.id),
          this.heldId,
          this.appliedPack,
        ]);
        if (signature !== this.playerSignature) {
          const previousPlayerModel = this.playerModel;
          if (this.playerModel) this.disposeObject(this.playerModel);
          this.playerModel = createPlayerModel(
            this.settings.skin,
            equipment,
            this.heldId,
            this.atlas,
          );
          inheritPlayerMotion(previousPlayerModel, this.playerModel);
          this.scene.add(this.playerModel);
          this.playerShadow = undefined;
          this.playerSignature = signature;
        }
        this.playerModel.visible =
          !!cameraMode &&
          this.cameraDistance > 0.6 &&
          !player.standData?.transformed;
        this.playerModel.position.set(player.x, player.y, player.z);
        this.playerModel.rotation.y = player.yaw;
        if (
          this.playerShadow !==
          (this.settings.shadows && this.settings.entityShadows)
        )
          this.playerModel.traverse((m) => {
            if (m.isMesh) {
              m.castShadow =
                !!this.settings.shadows && !!this.settings.entityShadows;
              m.receiveShadow = true;
            }
          });
        this.playerSwing = Math.max(
          0,
          (this.playerSwing || 0) - (animating ? frameDt : 0),
        );
        this.playerShadow =
          this.settings.shadows && this.settings.entityShadows;
        animatePlayerModel(
          this.playerModel,
          player,
          animating ? frameDt : 0,
          moving,
          mining > 0
            ? 0.5 + 0.5 * Math.sin(elapsed * 13)
            : Math.sin((this.playerSwing / 0.32) * Math.PI),
          this.animator.action?.kind || (mining > 0 ? "mine" : "attack"),
          this.pistolKick,
          this.settings.particles !== "minimal",
          this.animator.action ||
            (mining > 0
              ? {
                  kind: "mine",
                  age: (this.animator.miningPhase || 0) % 1,
                  duration: 1,
                }
              : null),
          {
            time: elapsed,
            tickCount: game?.tickCount,
            tridentCharge: game?.tridentCharge,
            held: game?.inventory.held,
          },
        );
        if (player.riptide?.ticks > 0)
          this.playerModel.rotation.z =
            ((20 - player.riptide.ticks) / 20) * Math.PI * 6;
        else this.playerModel.rotation.z = 0;
        if (player.boatId || player.horseId) {
          this.playerModel.userData.legs.forEach(
            (leg) => (leg.rotation.x = 1.3),
          );
          this.playerModel.userData.rig.position.y = -0.45;
        }
        this.animator.step(animating ? frameDt : 0, player, {
          moving,
          mining: mining > 0,
          tool: ITEMS[this.heldId]?.tool,
          itemId: this.heldId,
          bobbing: this.settings.viewBobbing !== false,
        });
      } else if (this.playerModel) this.playerModel.visible = false;
      const fov =
        (player.spyglassUntil > elapsed ? 20 : 0) ||
        this.settings.FOV +
          (player.sprinting && this.settings.dynamicFOV !== false ? 7 : 0) +
          (this.settings.dynamicFOV !== false
            ? this.tricksterVisual.boost * 7
            : 0);
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-9 * frameDt));
      this.camera.updateProjectionMatrix();
    }
    if (!playing && this.playerModel) this.playerModel.visible = false;
    positionCelestials(
      this.celestialSky,
      this.sunOrb,
      this.moonOrb,
      this.camera,
      phase,
    );
    this.clouds.update(
      this.world,
      this.camera,
      frameDt,
      weather,
      lighting,
      sky,
      this.standVisuals?.trialFade || 0,
      animating,
    );
    this.gl.info.reset();
    this.gl.autoClear = true;
    this.gl.render(this.scene, this.camera);
    if (player.standData?.transformed) {
      this.handRig.skin.color.set("#58a2a6");
      this.leftHandRig.skin.color.set("#58a2a6");
    }
    if (playing && !cameraMode) {
      const pose = this.animator.step(animating ? frameDt : 0, player, {
        moving,
        mining: mining > 0,
        tool: ITEMS[this.heldId]?.tool,
        itemId: this.heldId,
        bobbing: this.settings.viewBobbing !== false,
      });
      const nearWall =
        this.outline.visible && this.targetDistance < 0.9
          ? (0.9 - this.targetDistance) / 0.9
          : 0;
      const itemOnly = !!this.heldId;
      const carryX = itemOnly ? heldMountX(this.handCamera, -0.68) : 0.37;
      this.handGroup.position.set(
        carryX + pose.x,
        HAND_REST_Y +
          pose.y -
          nearWall * 0.18 +
          (itemOnly ? ITEM_REST_OFFSET.y : 0),
        -0.72 + pose.z + (itemOnly ? ITEM_REST_OFFSET.z : 0),
      );
      this.handGroup.rotation.set(pose.rx, pose.ry, pose.rz);
      const kick = pistolRecoil(this.pistolKick).kick;
      const pistols = this.heldId === "matthew_dual_pistols";
      if (pistols) {
        const right = this.pistolHand ? kick : 0,
          left = this.pistolHand ? 0 : kick;
        const draw = this.animator.equip;
        this.pistolStyle =
          (this.pistolStyle || 0) +
          ((player.tricksterDash ? 1 : 0) - (this.pistolStyle || 0)) *
            (1 - Math.exp(-18 * (animating ? frameDt : 0)));
        const carry = this.animator.sprint,
          style = this.pistolStyle;
        this.handGroup.position.x += carry * 0.035 + style * 0.06;
        this.handGroup.position.y += right * 0.025 - style * 0.045;
        this.handGroup.position.z += right * 0.07;
        this.handGroup.rotation.x +=
          right * 0.24 - draw * 0.65 - carry * 0.24 - style * 0.2;
        this.handGroup.rotation.y +=
          0.08 + draw * 0.38 + carry * 0.1 + style * 0.12;
        this.handGroup.rotation.z += right * 0.035 + draw * 0.32;
        this.leftHandRig.root.position.set(
          -carryX - pose.x - carry * 0.035 - style * 0.06,
          HAND_REST_Y +
            pose.y -
            nearWall * 0.18 +
            left * 0.025 -
            style * 0.045 +
            ITEM_REST_OFFSET.y,
          -0.72 + pose.z + left * 0.07 + ITEM_REST_OFFSET.z,
        );
        this.leftHandRig.root.rotation.set(
          pose.rx + left * 0.24 - draw * 0.75 - carry * 0.24 - style * 0.2,
          -pose.ry - 0.08 - draw * 0.38 - carry * 0.1 - style * 0.12,
          -pose.rz - left * 0.035 - draw * 0.32,
        );
        animatePistolModel(
          this.heldMesh,
          this.pistolHand === 1 ? this.pistolKick : 0,
          this.settings.particles !== "minimal",
        );
        animatePistolModel(
          this.leftPistol,
          this.pistolHand === 1 ? 0 : this.pistolKick,
          this.settings.particles !== "minimal",
        );
      }
      if (!pistols) {
        const swim = this.animator.swim || 0,
          phase = this.animator.swimPhase || 0;
        this.leftPistol.visible = false;
        this.leftHandRig.root.visible = !this.heldId && swim > 0.02;
        this.leftHandRig.root.position.set(
          -0.37 - Math.sin(phase) * swim * 0.045,
          HAND_REST_Y - 0.07 + Math.cos(phase * 2) * swim * 0.026,
          -0.72 - Math.sin(phase) * swim * 0.08,
        );
        this.leftHandRig.root.rotation.set(
          Math.sin(phase) * swim * 0.16,
          0.1 + Math.cos(phase) * swim * 0.12,
          -0.12 + Math.sin(phase) * swim * 0.1,
        );
      }
      if (itemOnly && customItemMotion(this.heldId))
        this.handGroup.rotation.z += heldRestRoll(this.heldId);
      animateEditionWeapon(
        this.heldMesh,
        player,
        elapsed,
        game?.inventory.held,
      );
      updateHandRig(this.handRig);
      if (this.leftHandRig.root.visible) updateHandRig(this.leftHandRig);
      if (
        this.heldId &&
        (!customItemMotion(this.heldId) || (isWeapon(this.heldId) && !pistols))
      ) {
        mountJavaItem(
          this.handRig,
          this.heldId,
          pose,
          this.handCamera,
          player,
          elapsed,
          game,
        );
      } else if (this.heldId) {
        anchorHeldItem(this.handRig, this.handCamera, 1.28);
        if (pistols) anchorHeldItem(this.leftHandRig, this.handCamera, 1.28);
      }
      if (this.heldMesh)
        this.heldMesh.visible = !(
          this.heldId === "spyglass" && player.spyglassUntil > elapsed
        );
      if (player.riptide?.ticks > 0) {
        const phase = (20 - player.riptide.ticks) / 20;
        this.handGroup.rotation.z += Math.sin(phase * Math.PI * 6) * 0.45;
        this.handGroup.position.z -= Math.sin(phase * Math.PI) * 0.13;
        updateHandRig(this.handRig);
      }
      this.slash.visible =
        pose.trail > 0 && this.settings.particles !== "minimal";
      this.slash.material.opacity =
        pose.trail * (this.heldId === "devin_sword" ? 0.24 : 0.16);
      this.slash.material.color.set(
        this.heldId === "devin_sword" ? "#91f6fa" : "#f9edd0",
      );
      this.gl.autoClear = false;
      this.gl.clearDepth();
      this.gl.render(this.handScene, this.handCamera);
      this.gl.autoClear = true;
    }
    const dt = Math.min(0.05, this.lastTime ? elapsed - this.lastTime : 0.016);
    this.lastTime = elapsed;
    this.effects = this.effects.filter((e) => {
      e.life -= dt;
      if (e.life <= 0) {
        this.disposeObject(e.m);
        return false;
      }
      if (e.pulse) {
        e.m.scale.addScalar(dt * (e.grow || 13 / 0.6));
        e.m.material.opacity = Math.max(0, e.life / 0.6) * 0.8;
      } else e.v.y -= 9 * dt;
      e.m.position.addScaledVector(e.v, dt);
      return true;
    });
  }
}
