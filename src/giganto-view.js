import {titanTargetContact} from "./titan-targeting.js";
import {SonicTraversalFX} from "./sonic-traversal-fx.js";
import { SonicJumpBall } from "./sonic-jump-ball.js";
import { titanEmeraldPoint } from "./titan-metrics.js";
import { TitanTechniqueFX } from "./titan-technique-fx.js";
import {
  TitanCombatFlare,
  makeTitanEnergyCrescent,
  makeTitanEnergyMaterial,
} from "./titan-combat-flare.js";
import {
  flowTitanShot,
  titanShotKey,
  titanCameraLens,
} from "./titan-shot-flow.js";
import { updateTitanSurfaceFiltering } from "./titan-landscape.js";
import { GrassCyloopView } from "./titan-grass-cyloop-view.js";
import { TITAN_POWER_SCALE } from "./titan-balance.js";
import { TitanDetonation } from "./titan-detonation.js";
import { endingState } from "./titan-ending.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { TITAN_RETURN } from "./titan-return.js";
import { cinemaEase } from "./titan-finale.js";
import { TitanFinaleView } from "./titan-finale-view.js";
import { makeTitanRuins } from "./titan-ruins.js";
import { TitanImpactFX } from "./titan-impact-fx.js";
import { TitanAtmosphereView } from "./titan-atmosphere.js";
import {
  TitanTransformationView,
  titanTransformation,
  sonicSuper,
} from "./titan-transformation.js";
import { TitanGroundFX } from "./titan-ground-fx.js";
import {
  arenaUnitScale,
  sonicLength,
  withArenaMetres,
} from "./titan-metrics.js";
import { titanPulse } from "./titan-tactics.js";
import { createTitanDeformingArmor } from "./titan-climb-rig.js";
import { titanSweepHand } from "./titan-sweep.js";
import { titanShotOrigin } from "./titan-shot.js";
import { TitanContactAO, arenaAOEnabled } from "./titan-ao.js";
import {
  getTitanClimbSurface,
  installTitanClimbSurface,
  extractTitanClimbSurface,
} from "./titan-climb-surface.js";
import {
  armorMode,
  armorAttached,
  makeArmorGuide,
  armorFocus,
  armorUp,
  clearArmorCamera,
} from "./titan-climb.js";
import { titanWorldVector } from "./titan-space.js";
import {
  TITAN_COUNTER,
  TITAN_FINALE,
  titanCinematicShot,
} from "./titan-cinematics.js";
import { titanWorldPoint, titanPose } from "./titan-space.js";
import { clearTitanCamera } from "./titan-camera.js";
import { titanMoveShot, titanCameraTransport } from "./titan-move-camera.js";
import { titanDorsalRay, titanDorsalState } from "./titan-dorsal.js";
import { arenaQuality } from "./titan-settings.js";
import { advanceTitanTrails } from "./titan-trails.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { TITAN_CYLOOP } from "./titan-cyloop.js";
import { updateTitanCyloopMesh } from "./titan-cyloop-view.js";
import { TitanAbilityProjectiles } from "./titan-ability-projectiles.js";
import {
  nearestTitanSurface,
  titanArmPath,
  titanAttackSide,
  titanStompWave,
} from "./titan-contact.js";
import {
  makeTitanLandscape,
  updateTitanLandscape,
  disposeTitanLandscape,
} from "./titan-landscape.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  prepareTitanModels,
  importedRig,
  updateImportedSonic,
  updateImportedGiganto,
  disposeImportedRig,
} from "./titan-imports.js";
import * as T from "three";
import {
  makeSonic,
  makeGiganto,
  poseSonic,
  poseGiganto,
  makeTitanArena,
  makeEmerald,
  disposeTitanObject,
} from "./giganto-models.js";
import {
  TITAN_ROUTE,
  TITAN_EMERALD,
  TITAN_CHEST,
} from "./giganto-simulation.js";
// Conservative mantle clearance. The wider new shoulders need more room than
// the old cylindrical torso, both before and after camera smoothing.
export function titanCameraClearance(y) {
  return y >= 60 && y < 88 ? 38 : y >= 40 && y < 60 ? 30 : 21;
}
const distanceSquared = (a, b) => a.distanceToSquared(b);

export function makeTitanCyloopGeometry() {
  const geometry = new T.TorusGeometry(
      TITAN_CYLOOP.radius,
      0.3,
      6,
      128,
    ).rotateX(-Math.PI / 2),
    old = geometry.index.array,
    indices = [];
  // TorusGeometry stores whole revolutions per tube face. Reorder by angle so
  // drawRange grows one contiguous arc behind Sonic rather than showing a
  // complete thin ring after only a fraction of the revolution.
  for (let angle = 0; angle < 128; angle++)
    for (let face = 0; face < 6; face++) {
      const offset = (face * 128 + angle) * 6;
      for (let k = 0; k < 6; k++) indices.push(old[offset + k]);
    }
  geometry.setIndex(indices);
  return geometry;
}
export class TitanView {
  constructor(game) {
    this.game = game;
    this.scene = new T.Scene();
    this.returnGate = titanPortal();
    this.returnGate.name = "Overworld return portal";
    this.returnGate.visible = false;
    this.scene.add(this.returnGate);
    this.scene.background = new T.Color("#86afc2");
    this.scene.fog = new T.FogExp2("#a5bcc6", 0.00135);
    this.camera = new T.PerspectiveCamera(67, 1, 0.15, 1600);
    this.hemi = new T.HemisphereLight("#c2dced", "#344326", 0.95);
    this.scene.add(this.hemi);
    this.light = new T.DirectionalLight("#fff0d1", 4.1);
    const rim = new T.DirectionalLight("#b0d9fa", 1.35);
    rim.position.set(-85, 100, -70);
    this.scene.add(rim);
    this.light.position.set(75, 165, 90);
    this.light.target.position.set(0, 44, -5);
    this.scene.add(this.light.target);
    this.light.castShadow = !!game.settings.shadows;
    this.light.shadow.mapSize.set(1024, 1024);
    Object.assign(this.light.shadow.camera, {
      left: -155,
      right: 155,
      top: 155,
      bottom: -155,
      near: 1,
      far: 350,
    });
    this.light.shadow.camera.updateProjectionMatrix();
    this.light.shadow.bias = -0.00012;
    this.light.shadow.normalBias = 0.045;
    this.light.shadow.radius = 2;
    this.scene.add(this.light);
    this.arena = makeTitanLandscape(
      TITAN_ROUTE,
      arenaQuality(game.giganto?.session?.config || {}, game.settings),
    );
    this.scene.add(this.arena);
    this.ruins = makeTitanRuins(this.arena);
    this.scene.add(this.ruins);
    this.impacts = new TitanImpactFX(this.scene);
    this.finale = new TitanFinaleView(this.scene);
    this.jumpBall = new SonicJumpBall(this.scene);this.traversalFX=new SonicTraversalFX(this.scene);
    this.sonic = makeSonic();
    this.boss = makeGiganto();
    this.emerald = makeEmerald();
    this.emerald.position.set(
      TITAN_EMERALD.x,
      TITAN_EMERALD.y,
      TITAN_EMERALD.z,
    );
    this.scene.add(this.sonic, this.boss, this.emerald);
    // Layered additive glow and a bounded, animated corona replace the opaque
    // wire sphere. Original shader; no postprocessing/fullscreen bloom required.
    const glowMat = new T.ShaderMaterial({
      uniforms: {
        intensity: { value: 0.8 },
        auraTime: { value: 0 },
        auraColor: { value: new T.Color().setRGB(1, 0.79, 0.12) },
      },
      vertexShader: `varying vec3 normalW; varying vec3 viewW;varying vec3 auraP;
        void main(){auraP=position;vec4 p=modelViewMatrix*vec4(position,1.); normalW=normalize(normalMatrix*normal);viewW=-p.xyz;gl_Position=projectionMatrix*p;}`,
      fragmentShader: `varying vec3 normalW; varying vec3 viewW;varying vec3 auraP;uniform float intensity;uniform float auraTime;uniform vec3 auraColor;
        float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+1.),f.x),f.y),f.z);}
        void main(){float edge=pow(1.-abs(dot(normalize(normalW),normalize(viewW))),1.7);vec3 p=auraP*3.+vec3(0,-auraTime*.8,0);float n=noise3(p)*.65+noise3(p*2.1)*.35;float w=smoothstep(.28,.76,n);
        gl_FragColor=vec4(auraColor*(1.2+w),edge*(.035+w*.22)*intensity);}`,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
    });
    this.aura = new T.Mesh(new T.SphereGeometry(1, 24, 16), glowMat);
    this.aura.scale.set(1.25, 2.3, 1.25);
    this.scene.add(this.aura);
    this.corona = new T.InstancedMesh(
      new T.CylinderGeometry(0.012, 0.022, 0.8, 5),
      new T.MeshBasicMaterial({
        color: "#ffe86d",
        transparent: true,
        opacity: 0.28,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
      48,
    );
    this.corona.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.corona.frustumCulled = false;
    this.scene.add(this.corona);
    this.superLight = new T.PointLight("#ffdd57", 0, 18, 2);
    this.scene.add(this.superLight);
    this.sky = new T.Mesh(
      new T.SphereGeometry(1250, 64, 32),
      new T.ShaderMaterial({
        uniforms: {
          storm: { value: 0 },
          skyTime: { value: 0 },
          atmosphere: { value: 1 },
          skyTop: { value: new T.Color("#2064ad") },
          skyHorizon: { value: new T.Color("#c4dde6") },
          daylight: { value: 1 },
          sunDirection: { value: new T.Vector3(0.4, 0.8, 0.46).normalize() },
        },
        side: T.BackSide,
        depthWrite: false,
        vertexShader: `varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec3 dir;uniform float storm;uniform float skyTime;uniform float atmosphere;uniform vec3 skyTop;uniform vec3 skyHorizon;uniform vec3 sunDirection;uniform float daylight;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        float cloud(vec2 p){return noise(p)*.52+noise(p*2.07)*.27+noise(p*4.15)*.14+noise(p*8.3)*.07;}
        void main(){vec3 d=normalize(dir);float h=smoothstep(-.06,.85,d.y);
          vec3 c=mix(skyHorizon,skyTop,h);
          vec2 uv=d.xz/max(.12,d.y)*2.2+vec2(skyTime*.006,skyTime*.002);
          float n=cloud(uv),coverage=smoothstep(.48-storm*.1,.68,n)*smoothstep(.03,.2,d.y)*atmosphere;
          float edge=clamp((cloud(uv+vec2(-.07,.04))-n)*6.+.72,0.,1.);
          vec3 lit=mix(vec3(.055,.085,.15),mix(vec3(.63,.74,.82),vec3(1.,.98,.9),edge),daylight);
          c=mix(c,lit,coverage*.88);
          float sun=pow(max(0.,dot(d,sunDirection)),160.);
          c+=vec3(1.,.84,.6)*sun*1.3*daylight;
          c=mix(c,c*vec3(.65,.74,.86),storm*.35);gl_FragColor=vec4(c,1.);}`,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.userData.titanAO = false;
    this.scene.add(this.sky);
    this.atmosphere = new TitanAtmosphereView(
      this.scene,
      this.light,
      this.hemi,
      this.sky,
    );
    this.transformation = new TitanTransformationView(this.scene);
    this.beam = new T.Mesh(
      new T.CylinderGeometry(2.6, 2.6, 1, 10),
      new T.MeshBasicMaterial({
        color: "#ff687b",
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.beam.material.dispose();
    const beamColor = new T.Color("#b9e9ff");
    this.beam.material = new T.ShaderMaterial({
      uniforms: { beamTime: { value: 0 }, beamColor: { value: beamColor } },
      vertexShader: `varying vec2 beamUV;varying vec3 beamN;varying vec3 beamV;void main(){beamUV=uv;vec4 p=modelViewMatrix*vec4(position,1.);beamN=normalMatrix*normal;beamV=-p.xyz;gl_Position=projectionMatrix*p;}`,
      fragmentShader: `varying vec2 beamUV;varying vec3 beamN;varying vec3 beamV;uniform float beamTime;uniform vec3 beamColor;void main(){float edge=pow(1.-abs(dot(normalize(beamN),normalize(beamV))),2.);float streak=pow(.5+.5*sin(beamUV.y*100.-beamTime*28.+beamUV.x*24.),6.);gl_FragColor=vec4(mix(beamColor,vec3(1.),streak*.4),.07+edge*.35+streak*.08);}`,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      toneMapped: false,
    });
    this.beam.material.color = beamColor;
    this.qteShield = new T.Mesh(
      new T.TorusGeometry(1, 0.055, 8, 80),
      new T.MeshBasicMaterial({
        color: "#8adfff",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.qteShield.userData.titanAO = false;
    this.scene.add(this.qteShield);
    this.qteLight = new T.PointLight("#91ddff", 0, 25, 2);
    this.scene.add(this.qteLight);
    this.scene.add(this.beam);
    this.climbPulse = new T.Mesh(
      new T.TorusGeometry(1, 0.035, 4, 36),
      new T.MeshBasicMaterial({
        color: "#f18082",
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.scene.add(this.climbPulse);
    // Three beams per dorsal emitter; the whole 30-ray fan is one draw call.
    this.backFan = new T.InstancedMesh(
      new T.CylinderGeometry(0.18, 0.18, 1, 5),
      new T.MeshBasicMaterial({
        color: "#ff3865",
        toneMapped: false,
        transparent: true,
        opacity: 0.82,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
      30,
    );
    this.backFan.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.backFan.frustumCulled = false;
    this.scene.add(this.backFan);
    this.rayDummy = new T.Object3D();
    this.up = new T.Vector3(0, 1, 0);
    this.emitterStart = new T.Vector3();
    this.emitterEnd = new T.Vector3();
    this.rayDelta = new T.Vector3();
    this.fx = new T.InstancedMesh(
      new T.PlaneGeometry(0.7, 0.7),
      new T.MeshBasicMaterial({
        color: new T.Color(1.8, 1.8, 1.8),
        map: this.makeParticleTexture(),
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
      96,
    );
    this.fx.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.fx.frustumCulled = false;
    this.scene.add(this.fx);
    this.fxData = [];
    for (let i = 0; i < 96; i++) this.fx.setColorAt(i, new T.Color("#fff1ad"));
    this.ripples = new T.InstancedMesh(
      new T.TorusGeometry(1, 0.018, 5, 64),
      new T.MeshBasicMaterial({
        color: "#bceeff",
        transparent: true,
        opacity: 0.65,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
      12,
    );
    this.ripples.frustumCulled = false;
    this.scene.add(this.ripples);
    this.rippleData = [];
    this.dummy = new T.Object3D();
    this.look = new T.Vector3();
    this.camReady = false;
    this.shotFlow = {};
    this.lastAction = "";
    this.cyloop = new T.Mesh(
      makeTitanCyloopGeometry(),
      new T.MeshBasicMaterial({
        color: "#167dff",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );

    this.cyloop.position.set(0, 57, TITAN_CYLOOP.centerZ);
    this.scene.add(this.cyloop);
    this.trailData = [];
    this.trailHistory = { segments: [] };
    this.trails = new T.InstancedMesh(
      new T.CylinderGeometry(0.05, 0.12, 1, 5),
      new T.MeshBasicMaterial({
        color: "#7feaff",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
      48,
    );
    this.trails.frustumCulled = false;
    this.scene.add(this.trails);
    this.grassCyloop = new GrassCyloopView(this.scene);
    this.characterRim = new T.DirectionalLight("#a1caff", 0.85);
    this.characterRim.position.set(-60, 100, -65);
    this.characterRim.layers.set(1);
    this.scene.add(this.characterRim);
    this.camera.layers.enable(1);
    this.combatFlare = new TitanCombatFlare(this.scene);
    this.techniqueFX = new TitanTechniqueFX(this.scene);
    this.abilityProjectiles = new TitanAbilityProjectiles(this.scene);
    this.fxColor = new T.Color();
    this.warning = new T.Mesh(
      new T.TorusGeometry(1, 0.025, 5, 64),
      new T.MeshBasicMaterial({
        color: "#ffbd66",
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.scene.add(this.warning);
    this.warningSecond = this.warning.clone();
    this.warningSecond.material = this.warning.material.clone();
    this.scene.add(this.warningSecond);
    this.sweepArcs = ["L", "R"].map(() => {
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.BufferAttribute(new Float32Array(13 * 3), 3),
      );
      const line = new T.Line(
        g,
        new T.LineBasicMaterial({
          color: "#ffb56d",
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        }),
      );
      line.frustumCulled = false;
      line.visible = false;
      this.scene.add(line);
      return line;
    });
    this.stompWave = new T.Mesh(
      new T.TorusGeometry(1, 0.025, 5, 96),
      new T.MeshBasicMaterial({
        color: "#9cefff",
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.stompWave.rotation.x = -Math.PI / 2;
    this.scene.add(this.stompWave);
    this.pulseWave = new T.Mesh(
      this.stompWave.geometry,
      this.stompWave.material.clone(),
    );
    this.pulseWave.rotation.x = -Math.PI / 2;
    this.pulseWave.userData.titanAO = false;
    this.scene.add(this.pulseWave);
    this.waves = new T.InstancedMesh(
      makeTitanEnergyCrescent(),
      makeTitanEnergyMaterial(),
      8,
    );
    this.homingSpheres = new T.InstancedMesh(
      new T.SphereGeometry(0.45, 10, 8),
      new T.MeshBasicMaterial({
        color: "#d5faff",
        transparent: true,
        opacity: 0.95,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
      8,
    );
    this.homingSpheres.frustumCulled = false;
    this.homingSpheres.count = 0;
    this.homingSpheres.visible = false;
    this.scene.add(this.homingSpheres);
    this.waves.frustumCulled = false;
    this.scene.add(this.waves);
    this.contactShadow = new T.Mesh(
      new T.CircleGeometry(1.5, 32),
      new T.MeshBasicMaterial({
        map: this.particleTexture,
        color: "#081326",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.contactShadow);
    this.armorBeacons = new T.InstancedMesh(
      new T.TorusGeometry(0.7, 0.04, 5, 24),
      new T.MeshBasicMaterial({
        color: "#ffdd73",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
      13,
    );
    this.armorBeacons.frustumCulled = false;
    this.armorBeacons.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.scene.add(this.armorBeacons);

    this.groundFX = new TitanGroundFX(
      this.scene,
      this.arena.userData.floor,
      this.particleTexture,
    );
    this.assetsReady = typeof document === "undefined";
    this.ready = this.assetsReady
      ? Promise.resolve(true)
      : prepareTitanModels()
          .then((assets) => {
            if (this.disposed) return false;
            disposeTitanObject(this.sonic);
            disposeTitanObject(this.boss);
            this.sonic = importedRig(assets[0]);
            this.boss = importedRig(assets[1]);
            this.scene.add(this.sonic, this.boss);
            if (!getTitanClimbSurface()?.deforming) {
              const surface = createTitanDeformingArmor(assets[1]);
              installTitanClimbSurface(surface);
            }
            this.climbSurface = getTitanClimbSurface();
            this.assetsReady = true;
            return true;
          })
          .catch((error) => {
            this.assetError = error.message;
            return false;
          });
  }
  makeParticleTexture() {
    const data = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const dx = (x - 15.5) / 15.5,
          dy = (y - 15.5) / 15.5,
          r = Math.hypot(dx, dy),
          i = (x + y * 32) * 4;
        data.set(
          [255, 255, 255, Math.max(0, Math.exp(-r * r * 7) * (1 - r) * 255)],
          i,
        );
      }
    const tex = new T.DataTexture(data, 32, 32);
    tex.magFilter = tex.minFilter = T.LinearFilter;
    tex.needsUpdate = true;
    this.particleTexture = tex;
    return tex;
  }
  event(e, s) {
    this.combatFlare.event(e, s);
    if (
      ["cinematic-cue", "transformation-cue"].includes(e.type) &&
      (e.age || 0) > 0.3
    )
      return;
    this.groundFX.event(e, s);
    if (e.type === "struggle") {
      this.ripple(
        {
          type: "parry",
          point: {
            x: s.avatar.x,
            y: s.avatar.y + sonicLength(s, 1.8),
            z: s.avatar.z,
          },
        },
        s,
      );
      this.shake = Math.max(this.shake || 0, 0.055);
    }
    if (
      e.type === "transformation-cue" &&
      ["absorb", "super"].includes(e.cue)
    ) {
      this.cinematicFlashUntil = s.time + 0.25;
      this.shake = Math.max(this.shake || 0, 0.25);
      this.ripple(
        {
          type: "emerald",
          point: {
            ...this.sonic.position,
            y: this.sonic.position.y + sonicLength(s, 1.8),
          },
        },
        s,
      );
    }
    const contactEvent = e.point
      ? e
      : ["parry", "impact", "counter"].includes(e.type)
        ? {
            ...e,
            point: { x: s.avatar.x, y: s.avatar.y + 1.8, z: s.avatar.z },
            normal: { x: 0, y: 0, z: 1 },
          }
        : e;
    this.impacts.event(contactEvent, s);
    if (e.type === "hit" && e.point)
      this.damageContact = { point: { ...e.point }, until: s.time + 0.4 };
    if (e.type === "cinematic-cue") {
      if ((e.age || 0) > 0.3) return;
      if (e.cue === "contact") {
        this.shake = Math.max(this.shake || 0, 0.45);
        this.cinematicFlashUntil = s.time + 0.13;
        this.ripple({ type: "counter", point: e.point, normal: e.normal }, s);
      }
      if (e.cue === "rupture") {
        this.shake = Math.max(this.shake || 0, 0.55);
        for (let n = 0; n < 64; n++) {
          const a = n * 2.4;
          this.fxData.push({
            ...titanWorldPoint(s, {
              x: Math.sin(a) * 8,
              y: 48 + (n % 20),
              z: Math.cos(a) * 8,
            }),
            vx: Math.sin(a) * 22,
            vy: 8 + (n % 11),
            vz: Math.cos(a) * 22,
            life: 2,
            size: 3,
            color: n % 3 ? "#8a9ba0" : "#ffde85",
          });
        }
        this.fxData = this.fxData.slice(-96);
      }
      if (e.cue === "launch")
        this.ripple({ type: "boom", point: { ...this.sonic.position } }, s);
    }
    if (e.type === "footstep")
      this.shake = Math.min(0.32, (this.shake || 0) + 0.16);
    this.ripple(e, s);
    if (e.type === "hit" && e.kind === "loop" && this.cyloopState) {
      this.cyloopState.elapsed = TITAN_CYLOOP.contact;
      this.cyloopState.seen = s.time;
    }
    if (e.type === "hit") {
      this.hitStop = Math.min(
        0.055,
        0.025 + (e.amount || 0) / (16000 * TITAN_POWER_SCALE),
      );
      this.reactionUntil = s.time + 0.18;
    }
    if (
      ["hit", "impact", "parry", "counter", "beam", "stage"].includes(e.type)
    ) {
      this.shake = Math.min(
        0.75,
        (this.shake || 0) +
          ({
            hit: Math.min(
              0.3,
              0.06 + (e.amount || 0) / (1800 * TITAN_POWER_SCALE),
            ),
            impact: Math.min(0.72, (e.swat ? 0.6 : 0.4) * (e.strength || 1)),
            parry: 0.28,
            counter: 0.6,
            beam: 0.3,
            stage: 0.45,
          }[e.type] || 0),
      );
      this.impactTime = 0.22;
    }
    if (
      [
        "hit",
        "parry",
        "counter",
        "boom",
        "shot",
        "rush",
        "loop",
        "emerald",
        "qte-win",
        "ring",
        "grass-cyloop",
        "stage",
        "impact",
      ].includes(e.type)
    )
      for (
        let n = 0;
        n <
        (e.type === "hit"
          ? Math.min(
              15,
              4 + Math.floor((e.amount || 0) / (40 * TITAN_POWER_SCALE)),
            )
          : 14);
        n++
      ) {
        if (this.fxData.length >= 96) this.fxData.shift();
        const p =
          e.point ||
          (e.type === "emerald"
            ? TITAN_EMERALD
            : ["ring", "grass-cyloop"].includes(e.type)
              ? {
                  x: e.x ?? s.avatar.x,
                  y: e.y ?? s.avatar.y,
                  z: e.z ?? s.avatar.z,
                }
              : ["hit", "counter", "boom"].includes(e.type)
                ? titanWorldPoint(s, TITAN_CHEST)
                : s.avatar);
        this.fxData.push({
          x: p.x,
          y: e.point ? p.y : p.y + 1.5,
          z: p.z,
          vx: Math.sin(n * 2.4) * 5 + (e.normal?.x || 0) * 9,
          vy: 2 + (n % 5) + (e.normal?.y || 0) * 7,
          vz: Math.cos(n * 2.4) * 5 + (e.normal?.z || 0) * 9,
          color:
            e.type === "grass-cyloop"
              ? "#91d86a"
              : ["parry", "counter", "rush", "loop", "qte-win"].includes(e.type)
                ? "#a7e9ff"
                : e.type === "hit"
                  ? "#fff3dd"
                  : "#ffe294",
          life: 0.7,
        });
      }
  }
  ripple(e, s) {
    const max = {
      hit: Math.min(8, 2 + (e.amount || 0) / 70),
      impact: e.swat ? 14 : 7,
      counter: 16,
      parry: 8,
      boom: 7,
      shot: 2.2,
      loop: 16,
      stage: 24,
      emerald: 12,
      footstep: 9,
    }[e.type];
    if (max)
      this.rippleData.push({
        normal: e.normal,
        x:
          e.point?.x ??
          (e.type === "hit" || e.type === "counter"
            ? titanWorldPoint(s, TITAN_CHEST).x
            : s.avatar.x),
        y:
          e.point?.y ??
          (e.type === "hit" || e.type === "counter"
            ? titanWorldPoint(s, TITAN_CHEST).y
            : s.avatar.y + 1.5),
        z:
          e.point?.z ??
          (e.type === "hit" || e.type === "counter"
            ? titanWorldPoint(s, TITAN_CHEST).z
            : s.avatar.z),
        life: 0.65,
        max,
      });
    this.rippleData = this.rippleData.slice(-12);
  }
  line(mesh, a, b, r = 1) {
    const d = new T.Vector3().subVectors(b, a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      d.clone().normalize(),
    );
    mesh.scale.set(r, d.length(), r);
  }
  draw(s, dt) {
    const g = this.game,
      c = this.camera,
      p = s.avatar,
      t = s.time,
      superForm = sonicSuper(s);
    if (!this.assetsReady) return;
    if (
      this.lastStage !== s.stage ||
      (this.lastAttempt ?? 0) !== (s.attempt || 0)
    ) {
      this.trailHistory = { segments: [] };
      this.previousSonic = null;
      this.fxData = [];
      this.exploded = false;
      this.cyloopState = null;
      this.hitStop = 0;
      this.lastStage = s.stage;
      this.lastAttempt = s.attempt || 0;
    }
    const freeze =
      (this.hitStop || 0) > 0 && s.stage === "combat" && !s.counterScene;
    this.hitStop = Math.max(0, (this.hitStop || 0) - dt);
    if (!freeze) {
      if (this.sonic.userData.imported) updateImportedSonic(this.sonic, s, dt);
      else poseSonic(this.sonic, s, dt);
    } else this.sonic.position.set(p.x, p.y + 0.12, p.z);
    this.jumpBall.update(s,this.sonic,dt);this.traversalFX.update(s);
    // Contact hit-stop must not drag planted feet with a moving world root.
    if (!freeze || s.boss?.walk) {
      if (this.boss.userData.imported) updateImportedGiganto(this.boss, s, dt);
      else poseGiganto(this.boss, s, dt);
    }
    this.boss.position.x = s.boss?.x || 0;
    this.boss.position.z = s.boss?.z || 0;
    this.boss.rotation.y = s.boss?.yaw || 0;
    for (const m of this.boss.userData.materials) {
      if (m.emissive) {
        m.userData.titanBaseEmissive ||= m.emissive.clone();
        m.emissive.copy(m.userData.titanBaseEmissive);
        if (this.reactionUntil > s.time)
          m.emissive.lerp(
            new T.Color("#c3d8e4"),
            (0.06 * (this.reactionUntil - s.time)) / 0.18,
          );
      }
    }
    this.boss.updateMatrixWorld(true);
    this.boss.visible = true;
    for (const m of this.boss.userData.materials) {
      m.transparent = false;
      m.opacity = 1;
    }
    this.finale.update(s, this.boss);
    this.detonation ||= new TitanDetonation(this.scene, this.boss);
    this.detonation.update(
      s,
      this.atmosphere.state,
      arenaQuality(s.config, g.settings),
    );
    this.boss.visible = endingState(s).rupture < 1;
    const gate = s.stage === "victory" && s.won ? s.returnPortal : null;
    this.returnGate.visible = !!gate;
    if (gate) {
      const size =
        sonicLength(s, 1.65) * cinemaEase(gate.age / TITAN_RETURN.open);
      this.returnGate.scale.setScalar(size);
      this.returnGate.rotation.y = Math.atan2(gate.nx, gate.nz);
      this.returnGate.position.set(gate.x, gate.y - 2 * size, gate.z);
      animateTitanPortal(
        this.returnGate,
        s.time,
        s.config.particles,
        s.config.lighting,
      );
    }
    updateTitanLandscape(this.arena, s, dt);
    updateTitanSurfaceFiltering(
      this.arena,
      g.renderer.gl.capabilities?.getMaxAnisotropy?.() || 1,
      arenaQuality(s.config, g.settings),
    );
    this.grassCyloop.update(s);
    this.impacts.update(s);
    this.combatFlare.update(s, arenaQuality(s.config, g.settings));
    this.techniqueFX.update(s);
    this.characterRim.intensity = s.config.lighting ? 0.85 : 0;
    if (!this.characterRimBound) {
      for (const rig of [this.sonic, this.boss])
        rig.traverse((o) => {
          if (o.isMesh) o.layers.enable(1);
        });
      this.characterRimBound = true;
    }
    this.scene.fog.density =
      s.config.atmosphere === false
        ? 0.00065
        : s.phase === 2
          ? 0.0016
          : 0.00095;
    const transform = titanTransformation(s.stageTime),
      metric = arenaUnitScale(s);
    this.emerald.visible =
      !s.emerald || (s.stage === "transform" && s.stageTime < 1.05);
    this.emerald.scale.setScalar(sonicLength(s, 0.8));
    this.emerald.rotation.y = t;
    this.emerald.position.copy(
      titanWorldPoint(s, titanEmeraldPoint(s, TITAN_EMERALD)),
    );
    this.emerald.position.y += Math.sin(t * 2) * 0.18;
    if (
      s.stage === "transform" &&
      transform.collect > 0 &&
      this.sonic.userData.bones?.handR
    ) {
      this.sonic.updateMatrixWorld(true);
      const hand = this.sonic.userData.bones.handR.getWorldPosition(
        new T.Vector3(),
      );
      this.emerald.position.lerp(hand, transform.collect);
    }
    this.transformation.update(s, this.sonic);
    this.aura.visible = superForm;
    this.aura.position.copy(this.sonic.position);
    this.aura.position.y += sonicLength(s, 1.8);
    this.aura.rotation.y = t * 0.3;
    this.aura.material.uniforms.auraTime.value = s.time;
    this.aura.material.uniforms.intensity.value =
      s.stage === "transform" ? 1.2 + Math.sin(s.stageTime * 10) * 0.4 : 0.85;
    this.aura.scale.set(1.3 / metric, 2.25 / metric, 1.3 / metric);
    this.superLight.position.copy(this.aura.position);
    this.superLight.intensity =
      superForm && s.config.lighting
        ? 5 +
          Math.max(
            0,
            Math.min(1, ((this.cinematicFlashUntil || 0) - s.time) / 0.13),
          ) *
            5
        : 0;
    this.aura.material.uniforms.auraColor.value.setRGB(1, 0.79, 0.12);
    this.corona.material.opacity = 0.08;
    this.corona.material.color.set("#ffe86d");
    this.corona.visible = superForm && s.config.particles;
    const ca = this.sonic.rotation.y;
    for (let n = 0; n < 48; n++) {
      const a = n * 2.399963 + t * (n % 2 ? 0.7 : -0.5),
        y = (((n % 12) / 12) * 4.4 - 2) / metric,
        radius = (1.1 + Math.sin(t * 7 + n * 3) * 0.14) / metric;
      this.dummy.position.set(
        this.sonic.position.x + Math.sin(a) * radius,
        this.sonic.position.y + 2 / metric + y,
        this.sonic.position.z + Math.cos(a) * radius,
      );
      this.dummy.rotation.set(Math.sin(a) * 0.6, ca, Math.cos(a) * 0.6);
      this.dummy.scale.set(
        0.8 / metric,
        (0.35 + (0.5 + 0.5 * Math.sin(t * 8 + n)) * 1.1) / metric,
        0.6 / metric,
      );
      this.dummy.updateMatrix();
      this.corona.setMatrixAt(n, this.dummy.matrix);
    }
    this.corona.instanceMatrix.needsUpdate = true;
    const climbing = ["intro", "traversal", "transform"].includes(s.stage);
    this.arena.userData.platforms.visible = climbing && !armorMode(s);
    this.armorBeacons.visible =
      armorMode(s) && ["intro", "traversal"].includes(s.stage);
    for (let i = 0; i < 13; i++) {
      const q = this.climbSurface?.guide?.[i];
      if (q) {
        const live = this.armorBeacons.visible
            ? this.climbSurface.contactOnRig?.(q, this.boss)
            : null,
          n = live?.normal || titanWorldVector(s, q.normal),
          point = live?.point || titanWorldPoint(s, q.point);
        this.dummy.position.set(
          point.x + n.x * 0.18,
          point.y + n.y * 0.18,
          point.z + n.z * 0.18,
        );
        this.dummy.quaternion.setFromUnitVectors(
          new T.Vector3(0, 0, 1),
          new T.Vector3(n.x, n.y, n.z),
        );
        this.dummy.scale.setScalar(
          i === s.route + 1 ? 1.3 + Math.sin(t * 3) * 0.1 : 1,
        );
        this.dummy.updateMatrix();
        this.armorBeacons.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.armorBeacons.instanceMatrix.needsUpdate = true;
    this.arena.userData.rings.forEach((m, n) => {
      m.visible = climbing && !armorMode(s);
      m.material.color.set(n <= s.route ? "#d8c58b" : "#a7cecf");
      m.scale.setScalar(n === s.route + 1 ? 1 + Math.sin(t * 3) * 0.08 : 1);
    });
    const pulsePhase = s.time % 6;
    this.climbPulse.visible =
      s.stage === "traversal" && pulsePhase > 3 && pulsePhase < 5;
    this.climbPulse.position.set(0, 55, -12);
    this.climbPulse.scale.setScalar(10 + Math.max(0, pulsePhase - 3) * 22);
    this.climbPulse.material.opacity =
      pulsePhase < 4 ? 0.25 : 0.65 * (5 - pulsePhase);
    const reflected =
      s.counterScene?.kind === "beam" &&
      s.counterScene.elapsed < TITAN_COUNTER.impact;
    this.beam.visible =
      !!reflected ||
      (s.attack === "beam" &&
        (s.qte ||
          s.attackTime >=
            1.8 * { easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty]));
    this.beam.material.color.set(reflected ? "#a4e8ff" : "#d8f7ff");
    this.beam.material.uniforms.beamTime.value = s.time;
    this.qteShield.visible = !!s.qte || !!s.counterScene;
    this.qteLight.intensity =
      this.qteShield.visible && s.config.lighting ? 24 : 0;
    this.qteShield.position
      .copy(this.sonic.position)
      .add(new T.Vector3(0, sonicLength(s, 1.8), 0));
    const shieldDirection = new T.Vector3(
      (s.boss?.x || 0) - p.x,
      80 - p.y,
      (s.boss?.z || 0) - p.z,
    ).normalize();
    this.qteShield.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      shieldDirection,
    );
    this.qteShield.scale.setScalar(
      sonicLength(s, 2.6) * (1 + Math.sin(s.time * 9) * 0.035),
    );
    this.qteLight.position.copy(this.qteShield.position);
    this.qteShield.material.opacity =
      0.4 + 0.35 * (s.qte ? s.qte.hits / s.qte.need : 1);

    if (this.beam.visible) {
      const mouth = this.boss.userData.jawSocket
          ? this.boss.userData.jawSocket.getWorldPosition(new T.Vector3())
          : new T.Vector3(0, -0.2, 3.5).applyMatrix4(
              this.boss.userData.bones.jaw.matrixWorld,
            ),
        end = reflected
          ? this.sonic.position.clone().add(new T.Vector3(0, 2, 0))
          : new T.Vector3(
              s.qte ? p.x : (s.attackAim?.x ?? p.x),
              (s.qte ? p.y : (s.attackAim?.y ?? p.y)) + 1,
              s.qte ? p.z : (s.attackAim?.z ?? p.z),
            );
      this.line(this.beam, mouth, end, reflected ? 0.35 : 0.55);
    }
    this.backFan.visible =
      s.phase === 2 && !["victory", "finale"].includes(s.stage);
    for (let n = 0; n < 30; n++) {
      const rod = this.boss.userData.rods[Math.floor(n / 3)],
        lane = n % 3;
      const socket = this.boss.userData.laserSockets?.[Math.floor(n / 3)];
      if (socket) socket.getWorldPosition(this.emitterStart);
      else this.emitterStart.set(0, 11.8, 0).applyMatrix4(rod.matrixWorld);
      // Behind the Titan: spectacular fan matches the existing dorsal hazard.
      // Every beam originates on an animated emitter, never floats in midair.
      const ray = titanDorsalRay(n, s);
      this.emitterEnd.set(ray.to.x, ray.to.y, ray.to.z);
      this.rayDelta.subVectors(this.emitterEnd, this.emitterStart);
      this.rayDummy.position
        .copy(this.emitterStart)
        .add(this.emitterEnd)
        .multiplyScalar(0.5);
      this.rayDummy.quaternion.setFromUnitVectors(
        this.up,
        this.rayDelta.clone().normalize(),
      );
      this.rayDummy.scale.set(1, this.rayDelta.length(), 1);
      this.rayDummy.updateMatrix();
      this.backFan.setMatrixAt(n, this.rayDummy.matrix);
    }
    this.backFan.instanceMatrix.needsUpdate = true;
    const dorsal = titanDorsalState(s);
    this.backFan.material.opacity = dorsal.active
      ? 0.82
      : dorsal.warning
        ? 0.3
        : 0.1;
    if (
      superForm &&
      s.config.particles &&
      this.fxData.length < 80 &&
      Math.floor(t * 18) !== this.sparkTick
    ) {
      this.sparkTick = Math.floor(t * 18);
      this.fxData.push({
        x: this.sonic.position.x + Math.sin(t * 7) * 1.2,
        y: this.sonic.position.y + 0.5 + ((t * 3) % 3),
        z: this.sonic.position.z + Math.cos(t * 9) * 1.2,
        vx: 0,
        vy: 1.7,
        vz: 0,
        life: 0.7,
        size: 1.2,
      });
    }
    this.fxData = this.fxData.filter((f) => (f.life -= dt) > 0);
    this.fx.count = s.config.particles ? Math.min(96, this.fxData.length) : 0;
    for (let n = 0; n < this.fx.count; n++) {
      const f = s.config.particles ? this.fxData[n] : null;
      if (f) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;
        this.dummy.position.set(f.x, f.y, f.z);
        this.dummy.scale.setScalar(f.life * (f.size || 1));
      } else this.dummy.scale.setScalar(0);
      this.dummy.quaternion.copy(c.quaternion);
      this.dummy.updateMatrix();
      this.fx.setMatrixAt(n, this.dummy.matrix);
      this.fx.setColorAt(n, this.fxColor.set(f?.color || "#ffe294"));
    }
    this.fx.instanceMatrix.needsUpdate = true;
    if (this.fx.instanceColor) this.fx.instanceColor.needsUpdate = true;
    this.rippleData = this.rippleData.filter((r) => (r.life -= dt) > 0);
    for (let i = 0; i < 12; i++) {
      const r = s.config.particles ? this.rippleData[i] : null;
      if (r) {
        this.dummy.position.set(r.x, r.y, r.z);
        if (r.normal)
          this.dummy.quaternion.setFromUnitVectors(
            new T.Vector3(0, 0, 1),
            new T.Vector3(r.normal.x, r.normal.y, r.normal.z),
          );
        else this.dummy.quaternion.copy(c.quaternion);
        this.dummy.scale.setScalar((1 - r.life / 0.65) * r.max + 0.2);
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.ripples.setMatrixAt(i, this.dummy.matrix);
    }
    this.ripples.instanceMatrix.needsUpdate = true;
    this.cyloopState ||= {};
    updateTitanCyloopMesh(this.cyloop,this.cyloopState,s);
    this.arena.userData.quality = arenaQuality(s.config, g.settings);
    this.contactShadow.visible =
      !arenaAOEnabled(
        s.config,
        arenaQuality(s.config, g.settings),
        g.renderer.gl.isWebGLRenderer &&
          g.renderer.gl.extensions?.has("EXT_color_buffer_float"),
      ) && p.y < 10;
    this.contactShadow.position.set(p.x, 0.025, p.z);
    this.contactShadow.scale.setScalar(1 + p.y * 0.08);
    this.contactShadow.material.opacity = 0.36 * Math.max(0, 1 - p.y / 10);
    this.trailData = advanceTitanTrails(
      this.trailHistory,
      this.previousSonic,
      this.sonic.position,
      s,
      dt,
    );
    this.previousSonic = {
      x: this.sonic.position.x,
      y: this.sonic.position.y,
      z: this.sonic.position.z,
    };
    this.trails.count = this.trailData.length;
    this.trails.visible = !superForm && this.trails.count > 0;
    for (let i = 0; i < this.trails.count; i++) {
      const q = s.config.particles ? this.trailData[i] : null;
      if (q) {
        const d = new T.Vector3(q.b.x - q.a.x, q.b.y - q.a.y, q.b.z - q.a.z);
        this.dummy.position.set(
          (q.a.x + q.b.x) * 0.5,
          (q.a.y + q.b.y) * 0.5,
          (q.a.z + q.b.z) * 0.5,
        );
        this.dummy.position.y += 1.4;
        this.dummy.quaternion.setFromUnitVectors(
          this.up,
          d.clone().normalize(),
        );
        this.dummy.scale.set(
          (q.life / 0.14) * 0.65,
          d.length(),
          (q.life / 0.14) * 0.65,
        );
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.trails.setMatrixAt(i, this.dummy.matrix);
    }
    this.trails.instanceMatrix.needsUpdate = true;
    this.warning.visible =
      s.stage === "combat" &&
      ["swing", "slap", "crunch", "swat", "sweep"].includes(s.attack);
    if (this.warning.visible) {
      const q = titanArmPath(s, titanAttackSide(s));
      this.warning.position.set(q.x, q.y, q.z);
      this.warning.scale.setScalar(8);
      this.warning.material.opacity = 0.12 + Math.sin(t * 8) * 0.04;
    }
    this.warningSecond.visible = false;
    this.sweepArcs.forEach((line) => (line.visible = false));
    if (s.stage === "combat" && s.attack === "sweep") {
      for (const [index, side] of ["L", "R"].entries()) {
        const w = titanSweepHand(s, side),
          marker = index ? this.warningSecond : this.warning,
          line = this.sweepArcs[index],
          q = titanArmPath(s, side);
        marker.visible = w.age < 0.6;
        marker.position.set(q.x, q.y, q.z);
        marker.scale.setScalar(6.5);
        marker.material.color.set(w.active ? "#ff6c55" : "#ffd18c");
        marker.material.opacity = w.active ? 0.22 : 0.09;
        line.visible = marker.visible && s.config.particles;
        line.material.color.copy(marker.material.color);
        const positions = line.geometry.attributes.position;
        for (let j = 0; j < 13; j++) {
          const p = titanArmPath(s, side, w.start + (j / 12) * 0.6);
          positions.setXYZ(j, p.x, p.y, p.z);
        }
        positions.needsUpdate = true;
      }
    } else this.warning.material.color.set("#ffbd66");
    const stomp = titanStompWave(s);
    this.stompWave.visible = s.stage === "combat" && s.attack === "stomp";
    const pulse = titanPulse(s);
    this.pulseWave.visible = s.stage === "combat" && s.attack === "pulse";
    if (this.pulseWave.visible) {
      this.pulseWave.position.set(
        pulse.center.x,
        pulse.center.y + sonicLength(s, 1.8),
        pulse.center.z,
      );
      this.pulseWave.scale.setScalar(
        pulse.active
          ? Math.max(0.2, pulse.radius)
          : 12 + Math.sin(s.time * 8) * 0.6,
      );
      this.pulseWave.material.color.set(pulse.active ? "#ffc4d0" : "#f3c46f");
      this.pulseWave.material.opacity = pulse.active ? 0.72 : 0.32;
    }
    if (this.stompWave.visible) {
      this.stompWave.position.set(stomp.center.x, 0.18, stomp.center.z);
      this.stompWave.scale.setScalar(
        stomp.active
          ? Math.max(0.1, stomp.radius)
          : 6 + Math.sin(s.time * 9) * 0.3,
      );
      this.stompWave.material.color.set(stomp.active ? "#a6edff" : "#ffb268");
      this.stompWave.material.opacity = stomp.active ? 0.65 : 0.3;
    }
    for (let i = 0; i < 8; i++) {
      const q = s.projectiles?.[i];
      if (q && q.kind !== "shot") {
        this.dummy.position.set(q.x, q.y, q.z);
        this.dummy.quaternion.setFromUnitVectors(
          new T.Vector3(0, 0, 1),
          new T.Vector3(q.vx, q.vy, q.vz).normalize(),
        );
        if (q.kind === "cross")
          this.dummy.rotateZ(q.contact === 1 ? Math.PI / 4 : -Math.PI / 4);
        if (q.kind === "cross") this.dummy.scale.set(3.8, 0.48, 1);
        else this.dummy.scale.setScalar(1.7);
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.waves.setMatrixAt(i, this.dummy.matrix);
    }
    this.waves.instanceMatrix.needsUpdate = true;
    const shots = s.projectiles
      .filter((q) => q.kind === "shot")
      .map((q) => ({ ...q, charge: 1 }));
    if (s.stage === "combat" && s.strike?.move === "shot") {
      for (let i = s.strike.next; i < 6; i++)
        shots.push({
          ...titanShotOrigin(s, i, Math.min(1, s.strike.elapsed / 0.36)),
          charge: Math.min(1, s.strike.elapsed / 0.36),
        });
    }
    this.homingSpheres.count = Math.min(8, shots.length);
    this.homingSpheres.visible = s.stage === "combat" && shots.length > 0;
    for (let i = 0; i < this.homingSpheres.count; i++) {
      const q = shots[i];
      this.dummy.position.set(q?.x || 0, q?.y || 0, q?.z || 0);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(q ? 0.4 + 0.6 * q.charge : 0);
      this.dummy.updateMatrix();
      this.homingSpheres.setMatrixAt(i, this.dummy.matrix);
    }
    this.homingSpheres.instanceMatrix.needsUpdate = true;
    this.waves.visible = false;
    this.homingSpheres.visible = false;
    this.abilityProjectiles.update(s);
    const b = titanPose(s),
      shot =
        s.stage === "victory" ||
        (s.config.cinematicCamera === false && !s.config.mandatoryCinematics)
          ? null
          : titanCinematicShot(s, this.sonic.position);
    const moveShot = shot ? null : titanMoveShot(s);
    const closeGameplay =
      ["combat","traversal","victory"].includes(s.stage) && !shot;
    this.cameraFollow ||= {};
    const transport = titanCameraTransport(this.cameraFollow, s);
    if (!shot && this.camReady) {
      c.position.add(transport);
      this.look.add(transport);
      if (this.shotFlow.transition) {
        for (const v of [
          this.shotFlow.transition.from.position,
          this.shotFlow.transition.from.target,
        ]) {
          v.x += transport.x;
          v.y += transport.y;
          v.z += transport.z;
        }
      }
    }
    let target = new T.Vector3(p.x, p.y + sonicLength(s, 2), p.z),
      desired = new T.Vector3();
    if (armorAttached(s)) {
      const focus = armorFocus(s),
        n = titanWorldVector(s, s.climb.normal),
        up = titanWorldVector(s, armorUp(s.climb)),
        right = new T.Vector3().crossVectors(
          new T.Vector3(n.x, n.y, n.z),
          new T.Vector3(up.x, up.y, up.z),
        );
      target.copy(focus);
      desired.set(
        p.x + n.x * 15 + right.x * Math.sin(p.yaw) * 6,
        p.y + n.y * 15 + 5,
        p.z + n.z * 15 + right.z * Math.sin(p.yaw) * 6,
      );
    } else if (shot) {
      target.copy(shot.target);
      desired.copy(shot.position);
    } else if (moveShot) {
      target.copy(moveShot.target);
      desired.copy(moveShot.position);
    } else if (s.strike?.move === "loop" && s.lock) {
      const centre = s.strike.orbit.center || { x: 0, z: TITAN_CYLOOP.centerZ },
        rx = p.x - centre.x,
        rz = p.z - centre.z;
      target.set(centre.x + rx * 0.72, p.y + 2, centre.z + rz * 0.72);
      desired.set(centre.x + rx * 1.42, p.y + 10, centre.z + rz * 1.42);
    } else if (superForm && s.lock) {
      const hit = titanTargetContact(s, {
          x: p.x,
          y: p.y + sonicLength(s, 1.8),
          z: p.z,
        }),
        surface = hit.point;
      const bossFocus = new T.Vector3(surface.x, surface.y, surface.z);
      target.lerp(
        bossFocus,
        closeGameplay
          ? Math.min(
              0.08,
              sonicLength(s, 0.65) /
                Math.max(0.001, target.distanceTo(bossFocus)),
            )
          : 0.2,
      );
      const cp = Math.cos(p.pitch),
        distance = hit.distance * metric,
        back =
          (12 + 3 * T.MathUtils.clamp((15 - distance) / 15, 0, 1)) / metric,
        shoulder = 2.4 / metric;
      desired.set(
        p.x + Math.sin(p.yaw) * back * cp + Math.cos(p.yaw) * shoulder,
        p.y + (3 + Math.sin(p.pitch) * back * metric) / metric,
        p.z + Math.cos(p.yaw) * back * cp - Math.sin(p.yaw) * shoulder,
      );
    } else {
      const d = (superForm ? 12 : s.stage === "traversal" ? 20 : 13) / metric,
        cp = Math.cos(p.pitch);
      desired.set(
        p.x + Math.sin(p.yaw) * d * cp,
        p.y +
          (s.stage === "traversal" ? 4 : 3) / metric +
          Math.sin(p.pitch) * d,
        p.z + Math.cos(p.yaw) * d * cp,
      );
    }
    const flow = flowTitanShot(
      this.shotFlow,
      titanShotKey(s, shot),
      s.time,
      { position: c.position, target: this.look, fov: c.fov },
      {
        position: desired,
        target,
        fov: shot?.fov ?? moveShot?.fov ?? (s.config.cameraFov || 67),
      },
    );
    desired.copy(flow.position);
    target.copy(flow.target);
    let approachWeight = 0;
    if (s.stage === "traversal" && !armorAttached(s)) {
      const dx = b.x - p.x,
        dz = b.z - p.z,
        d = Math.hypot(dx, dz) || 1,
        facing = (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / d,
        w =
          T.MathUtils.clamp((facing - 0.3) / 0.5, 0, 1) *
          T.MathUtils.clamp((d - 35) / 35, 0, 1) *
          T.MathUtils.clamp(1 - Math.abs(p.pitch) / 0.45, 0, 1);
      target.x += dx * 0.1 * w;
      target.z += dz * 0.1 * w;
      target.y += 8 * w;
      approachWeight = w;
    }
    if (armorAttached(s))
      desired.copy(clearArmorCamera(s, armorFocus(s), desired));
    desired.y = Math.max(2.5, desired.y);
    const r = Math.hypot(desired.x - b.x, desired.z - b.z);
    const desiredRadius = titanCameraClearance(desired.y);
    if (
      !closeGameplay &&
      !armorAttached(s) &&
      r < desiredRadius &&
      desired.y < 93
    ) {
      if (r < 0.001) desired.z = b.z + desiredRadius;
      else {
        desired.x = b.x + ((desired.x - b.x) * desiredRadius) / r;
        desired.z = b.z + ((desired.z - b.z) * desiredRadius) / r;
      }
    }
    if (this.camReady) {
      c.position.lerp(desired, 1 - Math.exp(-dt * 8));
      this.look.lerp(target, 1 - Math.exp(-dt * 9));
    } else {
      c.position.copy(desired);
      this.look.copy(target);
      this.camReady = true;
    }
    const cameraRadius = Math.hypot(c.position.x - b.x, c.position.z - b.z);
    const clearance = titanCameraClearance(c.position.y);
    if (
      !closeGameplay &&
      !armorAttached(s) &&
      c.position.y < 93 &&
      cameraRadius < clearance
    ) {
      if (cameraRadius < 0.001) c.position.z = b.z + clearance;
      else {
        c.position.x = b.x + ((c.position.x - b.x) * clearance) / cameraRadius;
        c.position.z = b.z + ((c.position.z - b.z) * clearance) / cameraRadius;
      }
    }
    c.position.y = Math.max(2.5, c.position.y);
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.8);
    if (this.shake > 0 && dt > 0) {
      const strength = (s.config.cameraShake ?? 0.35) / 0.35;
      c.position.x += Math.sin(t * 69) * this.shake * strength;
      c.position.y += Math.cos(t * 87) * this.shake * 0.5 * strength;
    }
    const movingBoost = Math.hypot(p.vx, p.vz) > 22;
    this.impactTime = Math.max(0, (this.impactTime || 0) - dt);
    const lens = titanCameraLens(
      this.lensFov ?? c.fov,
      shot || moveShot || this.shotFlow.transition
        ? flow.fov
        : movingBoost
          ? Math.min(103, (s.config.cameraFov || 67) + 9)
          : (s.config.cameraFov || 67) + approachWeight * 4,
      dt,
      s.stage === "combat" ? this.impactTime : 0,
    );
    this.lensFov = lens.base;
    c.fov = lens.fov;
    const safeRadius = titanCameraClearance(c.position.y),
      actualRadius = Math.hypot(c.position.x - b.x, c.position.z - b.z);
    if (
      !closeGameplay &&
      !armorAttached(s) &&
      c.position.y < 93 &&
      actualRadius < safeRadius
    ) {
      c.position.x =
        b.x +
        ((c.position.x - b.x) * safeRadius) / Math.max(0.001, actualRadius);
      c.position.z =
        b.z +
        ((c.position.z - b.z) * safeRadius) / Math.max(0.001, actualRadius);
    }
    if (["combat", "traversal"].includes(s.stage) && !armorAttached(s)) {
      const clear = clearTitanCamera(
        s,
        { x: c.position.x, y: c.position.y, z: c.position.z },
        titanCameraClearance(c.position.y),
      );
      c.position.set(clear.x, clear.y, clear.z);
    }
    if (armorAttached(s))
      c.position.copy(clearArmorCamera(s, armorFocus(s), c.position));
    c.lookAt(this.look);
    this.warning.quaternion.copy(c.quaternion);
    this.warningSecond.quaternion.copy(c.quaternion);
    this.heading =
      (T.MathUtils.radToDeg(
        Math.atan2(c.position.x - this.look.x, c.position.z - this.look.z),
      ) +
        360) %
      360;
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
    this.atmosphere.update(s, arenaQuality(s.config, g.settings), c);
    this.groundFX.update(s, c);
    this.sky.material.uniforms.skyTime.value = s.time;
    this.sky.material.uniforms.atmosphere.value =
      s.config.atmosphere === false ? 0 : 1;
    const surface = titanTargetContact(s, {
      x: p.x,
      y: p.y + sonicLength(s, 1.8),
      z: p.z,
    }).point;
    const marker = new T.Vector3(surface.x, surface.y, surface.z).project(c);
    this.returnScreen = null;
    if (gate) {
      const screen = new T.Vector3(
        gate.x,
        gate.y + sonicLength(s, 3.8),
        gate.z,
      ).project(c);
      this.returnScreen = {
        x: (screen.x + 1) / 2,
        y: (1 - screen.y) / 2,
        visible:
          screen.z > -1 &&
          screen.z < 1 &&
          Math.abs(screen.x) < 0.94 &&
          Math.abs(screen.y) < 0.9,
      };
    }
    this.targetScreen = {
      x: (marker.x + 1) * 0.5,
      y: (1 - marker.y) * 0.5,
      visible:
        marker.z > -1 &&
        marker.z < 1 &&
        Math.abs(marker.x) < 1 &&
        Math.abs(marker.y) < 1,
    };
    if (this.damageContact?.until > s.time) {
      const p = this.damageContact.point,
        screen = new T.Vector3(p.x, p.y, p.z).project(c);
      this.damageScreen = {
        x: T.MathUtils.clamp((screen.x + 1) / 2 + 0.04, 0.1, 0.9),
        y: T.MathUtils.clamp((1 - screen.y) / 2 - 0.03, 0.18, 0.76),
        visible: screen.z > -1 && screen.z < 1,
      };
    } else this.damageScreen = null;
    g.renderer.gl.info.reset();
    const gl = g.renderer.gl,
      oldMapping = gl.toneMapping,
      oldExposure = gl.toneMappingExposure,
      oldShadow = gl.shadowMap
        ? { enabled: gl.shadowMap.enabled, type: gl.shadowMap.type }
        : null;
    const shadows =
        s.config.shadowQuality !== "off" &&
        (s.config.shadowQuality !== "auto" || g.settings.shadows === true),
      resolution = s.config.shadowQuality === "high" ? 4096 : s.config.shadowQuality === "low" ? 1024 : 2048;
    this.light.castShadow = shadows;
    if (this.light.shadow.mapSize.x !== resolution) {
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
      this.light.shadow.mapSize.set(resolution, resolution);
    }
    if (gl.shadowMap) {
      gl.shadowMap.enabled = shadows;
      gl.shadowMap.type = T.PCFSoftShadowMap;
    }

    try {
      gl.toneMapping = T.ACESFilmicToneMapping;
      gl.toneMappingExposure = s.config.exposure ?? 1.05;
      if (gl.isWebGLRenderer && arenaQuality(s.config, g.settings) >= 2) {
        const epoch =
          s.config.liveReflections === false
            ? 0
            : Math.floor(
                s.time / (arenaQuality(s.config, g.settings) >= 3 ? 4 : 12),
              );
        if (!this.environmentTarget || this.environmentEpoch !== epoch) {
          this.pmrem ||= new T.PMREMGenerator(gl);
          if (!this.environmentScene) {
            this.environmentScene = new T.Scene();
            const sky = this.sky.clone(false);
            sky.position.set(0, 0, 0);
            this.environmentScene.add(sky);
          }
          const target = this.pmrem.fromScene(
            this.environmentScene,
            0,
            0.1,
            1800,
            { size: arenaQuality(s.config, g.settings) >= 3 ? 128 : 64 },
          );
          this.environmentTarget?.dispose();
          this.environmentTarget = target;
          this.scene.environment = target.texture;
          this.environmentEpoch = epoch;
        }
      }
      withArenaMetres(this.scene, c, this.light, s, () => {
        if (
          gl.isWebGLRenderer &&
          ((arenaQuality(s.config, g.settings) >= 2 &&
            s.config.postProcessing) ||
            s.config.renderScale < 1)
        ) {
          if (!this.composer) {
            this.composer = new EffectComposer(gl);
            this.composer.addPass(new RenderPass(this.scene, c));
            this.aoPass = new TitanContactAO(
              this.scene,
              c,
              s.config.ambientOcclusion === "high" ? "high" : "low",
            );
            this.composer.addPass(this.aoPass);
            this.bloom = new UnrealBloomPass(
              new T.Vector2(1, 1),
              0.3,
              0.35,
              1.05,
            );
            this.composer.addPass(this.bloom);
            this.speedBlur = new ShaderPass({
              uniforms: { tDiffuse: { value: null }, amount: { value: 0 } },
              vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
              fragmentShader: `uniform sampler2D tDiffuse;uniform float amount;varying vec2 vUv;
              void main(){vec2 d=(vUv-.5)*amount;vec4 c=texture2D(tDiffuse,vUv)*.5;
              c+=texture2D(tDiffuse,clamp(vUv-d,0.,1.))*.2;
              c+=texture2D(tDiffuse,clamp(vUv-d*2.,0.,1.))*.15;
              c+=texture2D(tDiffuse,clamp(vUv-d*3.,0.,1.))*.1;
              c+=texture2D(tDiffuse,clamp(vUv-d*4.,0.,1.))*.05;gl_FragColor=c;}`,
            });
            this.composer.addPass(this.speedBlur);
            this.smaa = new SMAAPass();
            this.composer.addPass(this.smaa);
            this.composer.addPass(new OutputPass());
          }
          const size = gl.getSize(new T.Vector2()),
            ratio = gl.getPixelRatio() * (s.config.renderScale ?? 1),
            key = [size.x, size.y, ratio, s.config.ambientOcclusion].join(",");
          const aoQuality =
            s.config.ambientOcclusion === "high" ? "high" : "low";
          if (this.aoPass.quality !== aoQuality) {
            this.aoPass.dispose();
            this.aoPass = new TitanContactAO(this.scene, c, aoQuality);
            this.composer.passes[1] = this.aoPass;
          }
          this.aoPass.enabled = arenaAOEnabled(
            s.config,
            arenaQuality(s.config, g.settings),
            gl.extensions.has("EXT_color_buffer_float"),
          );
          this.aoActive = this.aoPass.enabled;
          if (this.postSize !== key) {
            this.composer.setPixelRatio(ratio);
            this.composer.setSize(size.x, size.y);
            this.postSize = key;
          }
          this.smaa.enabled =
            s.config.postProcessing &&
            s.config.antialiasing !== false &&
            gl.extensions.has("EXT_color_buffer_float");
          this.bloom.enabled =
            s.config.postProcessing &&
            arenaQuality(s.config, g.settings) >= 2 &&
            (s.config.bloomIntensity ?? 0.26) > 0;
          this.bloom.strength =
            (s.config.bloomIntensity ?? 0.26) * (s.config.particles ? 1 : 0.5);
          this.speedBlur.enabled =
            s.config.postProcessing &&
            arenaQuality(s.config, g.settings) >= 2 &&
            !!s.config.motionBlur &&
            !!s.boosting &&
            s.stage === "combat";
          this.speedBlur.uniforms.amount.value = Math.min(
            0.012,
            Math.hypot(p.vx, p.vy, p.vz) / 4000,
          );
          this.composer.render(dt);
        } else {
          this.aoActive = false;
          gl.render(this.scene, c);
        }
      });
    } finally {
      gl.toneMapping = oldMapping;
      gl.toneMappingExposure = oldExposure;
      if (oldShadow) {
        gl.shadowMap.enabled = oldShadow.enabled;
        gl.shadowMap.type = oldShadow.type;
      }
    }
  }
  dispose() {
    this.jumpBall?.dispose();this.traversalFX?.dispose();
    this.finale?.dispose();
    this.disposed = true;
    disposeImportedRig(this.sonic);
    disposeImportedRig(this.boss);
    this.pmrem?.dispose();
    this.environmentTarget?.dispose();
    this.particleTexture?.dispose();
    disposeTitanLandscape(this.arena);
    if (this.composer) {
      for (const pass of this.composer.passes) pass.dispose?.();
      this.composer.dispose();
    }
    disposeTitanObject(this.scene);
    this.light.shadow.map?.dispose();
  }
}
export function titanPortal() {
  const group = new T.Group(),
    mat = new T.MeshBasicMaterial({ color: "#67e5dd" }),
    r = new T.Mesh(new T.TorusGeometry(1.65, 0.14, 6, 40), mat);
  r.position.y = 2;
  group.add(r);
  const inner = new T.Mesh(
    new T.CircleGeometry(1.5, 32),
    new T.MeshBasicMaterial({
      color: "#3347a5",
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    }),
  );
  inner.position.y = 2;
  group.add(inner);
  const ring = new T.Mesh(
    new T.TorusGeometry(1.38, 0.035, 4, 32),
    new T.MeshBasicMaterial({ color: "#ffe69c" }),
  );
  ring.position.y = 2;
  group.add(ring);
  for (let n = 0; n < 7; n++) {
    const gem = new T.Mesh(
      new T.OctahedronGeometry(0.17),
      new T.MeshBasicMaterial({
        color: [
          "#ef6567",
          "#91e7d9",
          "#af91e3",
          "#f7d86b",
          "#84adf0",
          "#ece8d8",
          "#8be090",
        ][n],
      }),
    );
    const a = (n / 7) * Math.PI * 2;
    gem.position.set(Math.sin(a) * 1.8, 2 + Math.cos(a) * 1.8, 0.05);
    group.add(gem);
  }
  const light = new T.PointLight("#62e6d8", 5, 10, 2);
  light.position.y = 2;
  group.add(light);
  const sparks = new T.InstancedMesh(
    new T.OctahedronGeometry(0.06),
    new T.MeshBasicMaterial({ color: "#b9ffec" }),
    16,
  );
  sparks.position.y = 2;
  sparks.frustumCulled = false;
  group.add(sparks);
  group.userData = { ring, inner, light, sparks };
  return group;
}

const portalDummy = new T.Object3D();
export function animateTitanPortal(group, time, particles, lighting) {
  group.userData.ring.rotation.z = time * 0.4;
  group.userData.inner.rotation.z = -time * 0.25;
  group.userData.light.visible = lighting;
  group.userData.sparks.visible = particles;
  for (let n = 0; n < 16; n++) {
    const a = time * 0.65 + (n / 16) * Math.PI * 2;
    portalDummy.position.set(
      Math.sin(a) * 1.9,
      Math.cos(a) * 1.9 + Math.sin(time * 2 + n) * 0.12,
      0.15 * Math.sin(a * 3),
    );
    portalDummy.scale.setScalar(0.7 + 0.5 * Math.sin(time * 3 + n));
    portalDummy.updateMatrix();
    group.userData.sparks.setMatrixAt(n, portalDummy.matrix);
  }
  group.userData.sparks.instanceMatrix.needsUpdate = true;
}
