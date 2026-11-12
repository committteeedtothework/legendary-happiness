import {titanTargetContact} from "./titan-targeting.js";
import {titanMoveShot,titanCameraTransport} from "./titan-move-camera.js";
import {ribbonMeshData} from "./wyvern-platforms.js";
import {SonicTraversalFX} from "./sonic-traversal-fx.js";
import {wyvernRoutePoint} from "./wyvern-route.js";
import {wyvernPassages} from "./wyvern-passages.js";
import { wyvernQtePose, wyvernShotOffset } from "./wyvern-counter-view.js";
import { SonicJumpBall } from "./sonic-jump-ball.js";
import { stabilizeTitanShadow } from "./titan-shadow.js";
import * as T from "three";
import { WyvernSpeedFX } from "./wyvern-speed-fx.js";
import { WyvernMissiles } from "./wyvern-missiles.js";
import { wyvernFlick, disposeWyvernFlick } from "./wyvern-flick.js";
import { WYVERN_LIMITS, wyvernScenerySafe, clearWyvernTerrainCamera, wyvernSceneryData, clearWyvernSceneryCamera } from "./wyvern-world.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import {
  prepareWyvernModels,
  makeWyvernRig,
  animateWyvern,
} from "./wyvern-model.js";
import {
  importedRig,
  updateImportedSonic,
  disposeImportedRig,
} from "./titan-imports.js";
import {
  TitanTransformationView,
  makeChaosEmerald,
  sonicSuper,
} from "./titan-transformation.js";
import { TitanImpactFX } from "./titan-impact-fx.js";
import { GrassCyloopView } from "./titan-grass-cyloop-view.js";
import { TitanCombatFlare } from "./titan-combat-flare.js";
import { titanPortal, animateTitanPortal, makeTitanCyloopGeometry } from "./giganto-view.js";
import { updateTitanCyloopMesh } from "./titan-cyloop-view.js";
import { clearTitanCamera } from "./titan-camera.js";
import { TitanTechniqueFX } from "./titan-technique-fx.js";
import { TitanAbilityProjectiles } from "./titan-ability-projectiles.js";
import { arenaQuality } from "./titan-settings.js";
import {
  clamp,
  ease,
  WYVERN_TOWER,
  WYVERN_REST_LIFT,
  WYVERN_APPROACH,
  WYVERN_SCALE,
  TOWER,
  runwayPoint,
  wyvernGround,
  wyvernBattleRing,
  W_HEAD,
  WYVERN_RAIL_LENGTH,
  WYVERN_RING_SPACING,
} from "./wyvern-space.js";
import { WYVERN_GAPS, WYVERN_HAZARDS, wyvernParryWindow } from "./wyvern-simulation.js";
import {
  WYVERN_CINEMA,
  wyvernFlightFrame,
  wyvernMissilePoint,
} from "./wyvern-choreography.js";
import { WyvernEnvironment, wyvernCoast } from "./wyvern-environment.js";
import { fractal } from "./random.js";
const v = (p) => new T.Vector3(p.x, p.y, p.z),
  up = new T.Vector3(0, 0, 1);
function joinRibbon(points,width,gaps=[]){
 const data=ribbonMeshData(points,width,gaps),g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));g.computeVertexNormals();return g;
}
function sandTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d"),
    image = ctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256,
      y = Math.floor(i / 256),
      n = (((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1) + 1) % 1,
      r = Math.sin(y * 0.25 + Math.sin(x * 0.03) * 3) * 4 + n * 12;
    image.data.set([174 + r, 139 + r * 0.8, 91 + r * 0.6, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(70, 70);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  for (let i = 0; i < 14; i++) {
    const x = 30 + ((i * 43) % 190),
      y = 40 + Math.sin(i * 2.4) * 20,
      g = ctx.createRadialGradient(x, y, 2, x, y, 30 + (i % 3) * 8);
    g.addColorStop(0, "rgba(255,246,231,.48)");
    g.addColorStop(1, "rgba(255,250,245,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export class WyvernView {
  constructor(game) {
    this.game = game;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#9ec7de");
    this.scene.fog = new T.FogExp2("#d9bf95", 0.0009);
    this.camera = new T.PerspectiveCamera(67, 1, 0.12, 6500);
    this.camera.position.set(115, 105, 220);
    this.speedFX = new WyvernSpeedFX(this.camera);
    this.look = new T.Vector3(0, 55, 0);
    this.hemi = new T.HemisphereLight("#d3edff", "#815c3c", 1.7);
    this.scene.add(this.hemi);
    this.light = new T.DirectionalLight("#fff1d0", 3.5);
    this.light.position.set(-140, 230, 100);
    this.light.target.position.set(0, 40, 0);
    this.scene.add(this.light, this.light.target);
    Object.assign(this.light.shadow.camera, {
      left: -340,
      right: 340,
      top: 340,
      bottom: -340,
      near: 1,
      far: 1000,
    });
    this.light.shadow.camera.updateProjectionMatrix();
    this.light.shadow.bias = -0.00012;
    this.light.shadow.normalBias = 0.055;
    this.rim = new T.DirectionalLight("#88c8fa", 1.1);
    this.rim.position.set(100, 50, -150);
    this.scene.add(this.rim, this.rim.target);
    this.pmrem = new T.PMREMGenerator(game.renderer.gl);
    const room = new RoomEnvironment();
    this.env = this.pmrem.fromScene(room, 0.05);
    room.dispose();
    this.scene.environment = this.env.texture;
    this.land = new T.Group();
    this.land.userData.wyvernEnvironment = true;
    this.scene.add(this.land);
    this.makeLandscape();
    this.environment = new WyvernEnvironment(this.scene);
    const stone=new T.MeshStandardMaterial({color:'#a9987d',map:this.rockTexture,roughness:0.92,metalness:0.03});
    stone.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 passageWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec4 pw=vec4(position,1.0);\n#ifdef USE_INSTANCING\npw=instanceMatrix*pw;\n#endif\npassageWorld=(modelMatrix*pw).xyz;');
      shader.fragmentShader='varying vec3 passageWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb*=mix(vec3(0.72),vec3(1.14),sin(passageWorld.y*0.18+sin(passageWorld.x*0.04))*0.5+0.5);');
    };
    this.passages=new T.InstancedMesh(new T.BoxGeometry(1,1,1,3,3,3),stone,wyvernPassages().boxes.length);
    const archDummy=new T.Object3D();wyvernPassages().boxes.forEach((b,i)=>{archDummy.position.set(b.x,b.y,b.z);archDummy.rotation.y=b.yaw;archDummy.scale.set(b.w,b.h,b.d);archDummy.updateMatrix();this.passages.setMatrixAt(i,archDummy.matrix);});
    this.passages.userData.wyvernEnvironment=true;this.passages.castShadow=this.passages.receiveShadow=true;this.scene.add(this.passages);

    this.tower = new T.Group();
    this.scene.add(this.tower);
    const mat = new T.MeshStandardMaterial({
      color: "#484b50",
      roughness: 0.72,
      metalness: 0.28,
    });
    const core = new T.Mesh(new T.CylinderGeometry(22, 32, TOWER.height, 16), mat);
    core.position.set(TOWER.x, TOWER.height/2, TOWER.z);
    core.castShadow = core.receiveShadow = true;
    this.tower.add(core);
    const ribs=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat,64),rib=new T.Object3D();
    for(let j=0;j<8;j++)for(let i=0;i<8;i++){const angle=j*Math.PI/4,u=i/7,radius=29-8*u;rib.position.set(TOWER.x+Math.sin(angle)*radius,12+i*24.5,TOWER.z+Math.cos(angle)*radius);rib.rotation.y=angle;rib.scale.set(6,25,8);rib.updateMatrix();ribs.setMatrixAt(j*8+i,rib.matrix);}ribs.castShadow=ribs.receiveShadow=true;this.tower.add(ribs);

    const ramp = new T.Mesh(
      joinRibbon(WYVERN_TOWER, TOWER.width*2),
      new T.MeshStandardMaterial({
        color: "#59616a",
        roughness: 0.68,
        side: T.DoubleSide,
      }),
    );
    ramp.receiveShadow = ramp.castShadow = true;
    this.tower.add(ramp);
    const cap = new T.Mesh(new T.CylinderGeometry(49,46,4,48,1,false,Math.PI/2+0.13,Math.PI*2-0.26), mat);
    cap.position.set(TOWER.x, TOWER.height-2, TOWER.z);
    cap.castShadow = cap.receiveShadow = true;
    this.tower.add(cap);
    for (let i = 0; i < 5; i++) {
      const ring = new T.Mesh(
        new T.TorusGeometry(31 - i * 1.7, 0.15, 5, 48),
        new T.MeshBasicMaterial({
          color: i % 2 ? "#c94462" : "#65d4e8",
          toneMapped: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(TOWER.x, 20 + i * 38, TOWER.z);
      this.tower.add(ring);
    }
    const railPoints = Array.from(
      { length: WYVERN_RAIL_LENGTH / 2 + 1 },
      (_, i) => ({
        ...runwayPoint(i * 2),
        t: i * 2,
      }),
    );
    this.runway = new T.Mesh(
      joinRibbon(
        railPoints,
        18,
        WYVERN_GAPS.map((t) => [t, t + 15]),
      ),
      new T.MeshStandardMaterial({
        color: "#902c4d",
        emissive: "#e62058",
        emissiveIntensity: 0.65,
        roughness: 0.4,
        metalness: 0.2,
        side: T.DoubleSide,
      }),
    );
    this.scene.add(this.runway);
    this.bars = [];
    for (const t of WYVERN_GAPS) {
      const q = runwayPoint(t - 7),
        bar = new T.Group();
      const b = new T.Mesh(
        new T.CylinderGeometry(0.28, 0.28, 14, 8),
        new T.MeshBasicMaterial({ color: "#ff5977", toneMapped: false }),
      );
      b.rotation.z = Math.PI / 2;
      bar.add(b);
      const ring = new T.Mesh(new T.TorusGeometry(4, 0.11, 5, 32), b.material);
      bar.add(ring);
      bar.position.copy(v(q)).add(new T.Vector3(0, 5, 0));
      this.scene.add(bar);
      this.bars.push(bar);
    }
    this.hazards = WYVERN_HAZARDS.map((h) => {
      const m = new T.Mesh(
        new T.IcosahedronGeometry(1.1, 1),
        new T.MeshStandardMaterial({
          color: "#ff6694",
          emissive: "#ef225b",
          emissiveIntensity: 2,
        }),
      );
      m.position
        .copy(v(runwayPoint(h.t, h.lane)))
        .add(new T.Vector3(0, 1.5, 0));
      this.scene.add(m);
      return m;
    });
    this.rings = [];
    const ringGeo = new T.TorusGeometry(0.65, 0.16, 6, 20),
      ringMat = new T.MeshStandardMaterial({
        color: "#ffce3b",
        emissive: "#875100",
        emissiveIntensity: 0.25,
        metalness: 0.68,
        roughness: 0.25,
      });
    const addRing = (id, p) => {
      const m = new T.Mesh(ringGeo, ringMat);
      m.position.copy(v(p)).add(new T.Vector3(0, 1.4, 0));
      m.userData.id = id;
      this.scene.add(m);
      this.rings.push(m);
    };
    WYVERN_APPROACH.forEach((p,i)=>addRing('field:'+(100+i),p));
    for (let i = 0; i < WYVERN_TOWER.length; i += 8)
      addRing("tower:" + i, WYVERN_TOWER[i]);
    for (let i = 1; i <= 13; i++)
      addRing("rail:" + i, runwayPoint(i * WYVERN_RING_SPACING, (i % 3) - 1));
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        x = -20 + Math.sin(a) * 22,
        z = 65 + Math.cos(a) * 22;
      addRing("field:" + i, { x, y: wyvernGround(x, z), z });
    }
    this.battleRings = Array.from({ length: 3 }, () => {
      const m = new T.Mesh(ringGeo, ringMat);
      this.scene.add(m);
      return m;
    });
    this.emerald = makeChaosEmerald("#24d79b");
    this.emerald.position.set(0,66+WYVERN_REST_LIFT+9*WYVERN_SCALE,0);
    this.scene.add(this.emerald);
    this.returnGate = titanPortal();
    this.returnGate.visible = false;
    this.scene.add(this.returnGate);
    this.impacts = new TitanImpactFX(this.scene);
    this.flare = new TitanCombatFlare(this.scene);
    this.grass = new GrassCyloopView(this.scene);
    this.techniqueFX = new TitanTechniqueFX(this.scene);
    this.abilityProjectiles = new TitanAbilityProjectiles(this.scene);
    this.cyloop = new T.Mesh(makeTitanCyloopGeometry(),new T.MeshBasicMaterial({color:"#43cfff",transparent:true,opacity:0.7,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false}));
    this.cyloopHistory = {};
    this.scene.add(this.cyloop);
    this.jumpBall = new SonicJumpBall(this.scene);this.traversalFX=new SonicTraversalFX(this.scene);
    this.transformation = new TitanTransformationView(this.scene);
    this.missiles = new WyvernMissiles(this.scene);
    this.projectilePool = this.missiles.meshes[0];
    this.missileTrails = new T.InstancedMesh(
      new T.BoxGeometry(0.12, 0.12, 1),
      new T.MeshBasicMaterial({
        color: "#ff325f",
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
      128,
    );
    this.missileTrails.frustumCulled = false;
    this.missileTrails.count = 0;
    this.scene.add(this.missileTrails);
    this.energyPool = new T.InstancedMesh(
      new T.TorusGeometry(1, 0.12, 5, 24),
      new T.MeshBasicMaterial({
        color: "#7fddff",
        transparent: true,
        opacity: 0.85,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      12,
    );
    this.energyPool.frustumCulled = false;
    this.scene.add(this.energyPool);
    this.lasers = Array.from({ length: 4 }, () => {
      const g = new T.Group(),
        m = new T.MeshBasicMaterial({
          color: "#f73d66",
          transparent: true,
          opacity: 0.7,
          blending: T.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        });
      g.add(new T.Mesh(new T.TorusGeometry(12, 0.25, 6, 64), m));
      const face = new T.Mesh(new T.CircleGeometry(12, 48), m.clone());
      face.material.opacity = 0.055;
      g.add(face);
      this.scene.add(g);
      return g;
    });
    this.aura = new T.Mesh(
      new T.SphereGeometry(2.5, 20, 12),
      new T.MeshBasicMaterial({
        color: "#ffe579",
        transparent: true,
        opacity: 0.06,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.scene.add(this.aura);
    this.particles = [];
    this.particlePool = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshBasicMaterial({
        color: "#ffe8a6",
        transparent: true,
        opacity: 0.8,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      192,
    );
    this.particlePool.frustumCulled = false;
    this.scene.add(this.particlePool);
    this.dummy = new T.Object3D();
    this.assetsReady = false;
    this.ready = prepareWyvernModels()
      .then(({ sonic, gltf }) => {
        if (this.disposed) return;
        this.sonic = importedRig(sonic);
        this.boss = makeWyvernRig(gltf);
        this.scene.add(this.sonic, this.boss);
        // Physics remains in the moving flight frame. Characters, effects and
        // camera share its exact transform; the coastline stays world-anchored.
        this.flightRoot = new T.Group();
        this.flightRoot.name = "Wyvern flight frame";
        for (const child of [...this.scene.children])
          if (
            !child.userData.wyvernEnvironment &&
            !child.isLight &&
            child !== this.light.target &&
            child !== this.rim.target
          )
            this.flightRoot.add(child);
        this.flightRoot.add(this.camera);
        this.scene.add(this.flightRoot);
        this.assetsReady = true;
      })
      .catch((e) => {
        this.assetError = e.message;
        console.error("Wyvern assets", e);
      });
  }
  makeLandscape() {
    const sand = sandTexture();
    this.sandTexture = sand;
    const material = new T.MeshStandardMaterial({
      map: sand,
      color: "#d5b487",
      roughness: 0.96,
      vertexColors:true,
    });
    this.ground = [];
    for (const segments of [64, 128]) {
      const g = new T.PlaneGeometry(WYVERN_LIMITS.mapSize, WYVERN_LIMITS.mapSize, segments, segments);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = p.getZ(i);
        p.setY(i, wyvernGround(x,z));
      }
      const colors=[];
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i),height=p.getY(i),slope=Math.abs(wyvernGround(x+50,z)-height)+Math.abs(wyvernGround(x,z+50)-height);
        const rock=clamp((slope-12)/60,0,1);colors.push(1-rock*0.5,1-rock*0.48,1-rock*0.43);
      }
      g.setAttribute("color",new T.Float32BufferAttribute(colors,3));
      g.computeVertexNormals();
      const m = new T.Mesh(g, material);
      m.receiveShadow = true;
      this.land.add(m);
      this.ground.push(m);
    }
    const strataCanvas = document.createElement("canvas");
    strataCanvas.width = strataCanvas.height = 256;
    const ctx = strataCanvas.getContext("2d"),
      pixels = ctx.createImageData(256, 256);
    for (let i = 0; i < 65536; i++) {
      const x = i % 256,
        y = i >> 8,
        n = fractal(x / 22, y / 28, 641),
        crack =
          Math.max(0, 1 - Math.abs(Math.sin(y * 0.23 + n * 9)) / 0.1) * 0.22;
      pixels.data.set(
        [
          (64 + n * 78) * (1 - crack),
          (63 + n * 74) * (1 - crack),
          (59 + n * 69) * (1 - crack),
          255,
        ],
        i * 4,
      );
    }
    ctx.putImageData(pixels, 0, 0);
    this.rockTexture = new T.CanvasTexture(strataCanvas);
    this.rockTexture.colorSpace = T.SRGBColorSpace;
    this.rockTexture.wrapS = this.rockTexture.wrapT = T.RepeatWrapping;
    this.rockTexture.repeat.set(3, 4);
    this.terrainRockQuality={value:1};
    material.bumpMap=sand;material.bumpScale=0.3;
    material.onBeforeCompile=shader=>{
      shader.uniforms.wyvernRock={value:this.rockTexture};shader.uniforms.wyvernRockQuality=this.terrainRockQuality;
      shader.vertexShader="varying vec3 wyvernTerrainPosition;varying vec3 wyvernTerrainNormal;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nwyvernTerrainPosition=(modelMatrix*vec4(position,1.)).xyz;wyvernTerrainNormal=normalize(mat3(modelMatrix)*normal);");
      shader.fragmentShader="uniform sampler2D wyvernRock;uniform float wyvernRockQuality;varying vec3 wyvernTerrainPosition;varying vec3 wyvernTerrainNormal;\n"+shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
        if(wyvernRockQuality>.5){
          vec3 n=abs(normalize(wyvernTerrainNormal));vec3 w=pow(n,vec3(4.));w/=max(.0001,w.x+w.y+w.z);
          vec3 rock=texture2D(wyvernRock,wyvernTerrainPosition.zy*.025).rgb*w.x+texture2D(wyvernRock,wyvernTerrainPosition.xz*.025).rgb*w.y+texture2D(wyvernRock,wyvernTerrainPosition.xy*.025).rgb*w.z;
          float wall=smoothstep(.03,.20,1.-n.y);diffuseColor.rgb=mix(diffuseColor.rgb,rock*vec3(.9,.88,.83),wall*.92);
        }`);
    };
    material.customProgramCacheKey=()=>"wyvern-canyon-strata-v1";material.needsUpdate=true;

    const rockMat = new T.MeshStandardMaterial({
        map: this.rockTexture,
        bumpMap: this.rockTexture,
        bumpScale: 0.22,
        roughness: 0.91,
      }),
      rockGeo = new T.CylinderGeometry(0.72, 1.15, 1, 20, 16);
    const positions = rockGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i),
        r =
          1 +
          Math.sin(y * 31) * 0.055 +
          Math.sin(Math.atan2(z, x) * 3 + y * 4) * 0.14 +
          Math.sin(Math.atan2(z, x) * 7 - y * 3) * 0.11;
      positions.setX(i, x * r);
      positions.setZ(i, z * r);
      positions.setY(
        i,
        y + Math.max(0, y) * Math.sin(Math.atan2(z, x) * 5) * 0.12,
      );
    }
    rockGeo.computeVertexNormals();
    this.rocks = new T.InstancedMesh(rockGeo, rockMat, 110);
    const d = new T.Object3D();
    for (const [i,o] of wyvernSceneryData().rocks.entries()) {
      d.position.set(o.x,o.y,o.z);d.rotation.set(o.rx,o.yaw,o.rz);d.scale.set(o.sx,o.h,o.sz);
      if(!o.active)d.scale.setScalar(0);d.updateMatrix();this.rocks.setMatrixAt(i,d.matrix);
    }
    this.rocks.castShadow = this.rocks.receiveShadow = true;
    this.land.add(this.rocks);
    const pillarMat = new T.MeshStandardMaterial({
      color: "#535b60",
      roughness: 0.72,
      metalness: 0.3,
    });
    this.ruins = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), pillarMat, 36);
    for (const [i,o] of wyvernSceneryData().ruins.entries()) {
      d.position.set(o.x,o.y,o.z);d.rotation.set(o.rx,o.yaw,o.rz);d.scale.set(o.sx,o.h,o.sz);
      if(!o.active)d.scale.setScalar(0);d.updateMatrix();this.ruins.setMatrixAt(i,d.matrix);
    }
    this.ruins.castShadow = this.ruins.receiveShadow = true;
    this.land.add(this.ruins);
    this.cloudTexture = cloudTexture();
    this.clouds = [];
    for (let i = 0; i < 18; i++) {
      const m = new T.Mesh(
        new T.PlaneGeometry(190 + (i % 3) * 90, 80 + (i % 4) * 25),
        new T.MeshBasicMaterial({
          map: this.cloudTexture,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          side: T.DoubleSide,
          toneMapped: false,
        }),
      );
      const a = i * 2.4;
      m.position.set(
        Math.sin(a) * (450 + i * 15),
        220 + (i % 5) * 38,
        Math.cos(a) * (450 + i * 15),
      );
      m.userData.origin = m.position.clone();
      m.userData.wyvernEnvironment = true;
      this.scene.add(m);
      this.clouds.push(m);
    }
  }
  event(e, s) {
    const contact = e.type === "counter-impact" ? { ...e, type: "counter" } : e;
    this.impacts.event(contact, s);
    this.flare.event?.(contact, s);
    if (
      [
        "hit",
        "parry",
        "counter",
        "qte-win",
        "wyvern-explosion",
        "impact",
        "counter-impact",
      ].includes(e.type)
    ) {
      const p = e.point || s.avatar,
        count =
          e.type === "wyvern-explosion" ? 150 : e.type === "parry" ? 22 : 12;
      for (let i = 0; i < count; i++) {
        const a = i * 2.399963,
          fast = e.type === "wyvern-explosion" ? 30 : 8;
        this.particles.push({
          x: p.x,
          y: p.y,
          z: p.z,
          vx: Math.sin(a) * fast,
          vy: Math.cos(i * 1.7) * fast + 3,
          vz: Math.cos(a) * fast,
          life: e.type === "wyvern-explosion" ? 2.5 : 0.55,
          initial: e.type === "wyvern-explosion" ? 2.5 : 0.55,
          size: e.type === "wyvern-explosion" ? 2 : 0.16,
        });
      }
      this.particles = this.particles.slice(-192);
      this.shake = Math.max(
        this.shake || 0,
        e.type === "wyvern-explosion" ? 1 : e.type === "impact" ? 0.6 : 0.15,
      );
    }
  }
  draw(s, dt) {
    if (!this.assetsReady || this.disposed) return;
    const gl = this.game.renderer.gl,
      p = s.avatar,
      w = s.wyvern,
      quality = arenaQuality(s.config, this.game.settings);
    this.speedFX.update(s,quality);
    this.terrainRockQuality.value=quality>=2?1:0;
    const frame = wyvernFlightFrame(s);
    this.flightRoot.position.set(frame.x, frame.y, frame.z);
    this.flightRoot.rotation.y = frame.yaw;
    this.flightRoot.updateMatrixWorld(true);
    this.environment.update(s, this);
    const worldHead = this.flightRoot.localToWorld(new T.Vector3(0, 66, 0));
    this.light.position.copy(worldHead).add(new T.Vector3(-140, 230, 100));
    this.light.target.position.copy(worldHead);
    this.rim.position.copy(worldHead).add(new T.Vector3(100, 50, -150));
    this.rim.target.position.copy(worldHead);
    this.heading = ((((p.yaw * 180) / Math.PI) % 360) + 360) % 360;
    const visual =
      s.stage === "transform"
        ? { ...s, stageTime: (s.stageTime * 6) / WYVERN_CINEMA.transform }
        : s;
    const pose =
      s.stage.startsWith("wyvern-") || s.stage === "finale"
        ? {
            ...s,
            stage: "combat",
            action: s.qte
              ? (s.qte.kind==="timing"?"parry":"idle")
              : ["wyvern-slam", "wyvern-counter", "wyvern-hold"].includes(
                    s.stage,
                  )
                ? "counter"
                : "homing",
            qte:s.qte?.kind==="timing" ? null : s.qte,
            parryHeld:s.qte?.kind==="timing",
            actionTime: 0.5,
          }
        : { ...visual, parryHeld:s.parryHeld && !w.parryUsed && s.parryAge<wyvernParryWindow(s) };
    updateImportedSonic(this.sonic, pose, dt * (w.timeScale || 1));
    this.jumpBall.update(s,this.sonic,dt);this.traversalFX.update(s);
    wyvernFlick(this.sonic,s);
    animateWyvern(this.boss, s, dt * (w.timeScale || 1));
    wyvernQtePose(this.sonic,this.boss,s);
    this.transformation.update(visual, this.sonic);
    this.grass.update(s);
    this.techniqueFX.update(s);
    updateTitanCyloopMesh(this.cyloop,this.cyloopHistory,s);
    this.impacts.update(s);
    this.flare.update(s, quality);
    this.aura.visible = sonicSuper(visual) && s.config.particles;
    this.aura.position.copy(this.sonic.position).add(new T.Vector3(0, 1.7, 0));
    this.aura.scale.setScalar(1 + Math.sin(s.time * 8) * 0.03);
    this.emerald.visible = !s.emerald && w.section === "emerald";
    this.emerald.rotation.y = s.time;
    this.emerald.position.y = 66+WYVERN_REST_LIFT+9*WYVERN_SCALE + Math.sin(s.time * 2) * 0.18;
    this.runway.visible = !s.emerald;
    this.tower.visible = s.stage === "intro" || s.stage === "traversal";
    this.bars.forEach((b, i) => {
      b.visible = !s.emerald;
      b.rotation.z = s.time * 2 + i;
    });
    this.hazards.forEach((h, i) => {
      h.visible = !s.emerald && !w.hitHazards.includes(i);
      h.rotation.y = s.time * 2;
    });
    for (const m of this.rings) {
      m.visible = !s.emerald && !w.ringIds.includes(m.userData.id);
      m.rotation.y = s.time * 1.8;
    }
    this.battleRings.forEach((m, i) => {
      const q = wyvernBattleRing(s, i);
      m.visible = s.stage === "combat" && !w.ringIds.includes(q.id);
      m.position.set(q.x, q.y, q.z);
      m.rotation.y = s.time * 2;
    });
    this.ground[0].visible = quality < 2;
    this.ground[1].visible = quality >= 2;
    this.rocks.count = 110;
    this.ruins.count = 36;
    const skyTime = w.flightTime || 0;
    this.clouds.forEach((m, i) => {
      m.visible = s.config.atmosphere !== false && i < (quality < 2 ? 8 : 18);
      m.position.copy(m.userData.origin);
      m.position.x += Math.sin(skyTime * 0.015 + i) * 30;
      this.camera.getWorldQuaternion(m.quaternion);
    });
    this.land.rotation.y = 0;
    let desired, focus;
    if (s.stage === "intro") {
      const a = ease(s.stageTime / WYVERN_CINEMA.intro);
      desired = new T.Vector3(320-a*150,230-a*85,520-a*190);
      focus = new T.Vector3(-110+a*40,95-a*5,0);
    } else if (s.stage === "traversal" && w.section === "runway") {
      desired=v(p).add(new T.Vector3(Math.sin(p.yaw)*11+2,4.5+Math.sin(p.pitch)*7,Math.cos(p.yaw)*11));
      focus=v(p).add(new T.Vector3(0,2,0));
    } else if (s.stage === "transform") {
      const a = ease(s.stageTime / WYVERN_CINEMA.transform),
        r = 8 + Math.sin(a * Math.PI) * 4;
      desired = v(p).add(
        new T.Vector3(Math.sin(a * 3) * r, 3 + a * 2, Math.cos(a * 3) * r),
      );
      focus = v(p).add(new T.Vector3(0, 1.8, 0));
    } else if (s.stage === "phase") {
      const a = ease(s.stageTime / WYVERN_CINEMA.phase);
      desired = wyvernShotOffset(s,110,100,150-a*130);
      focus = new T.Vector3(0, 65, -25);
    } else if (["wyvern-slam", "wyvern-counter"].includes(s.stage)) {
      const a = ease(s.stageTime / WYVERN_CINEMA.counter),
        orbit = s.stageTime * 1.05;
      desired = v(p).add(
        wyvernShotOffset(s,
          Math.sin(orbit) * 22,
          9 + Math.sin(a * Math.PI) * 12,
          Math.cos(orbit) * 22,
        ),
      );
      focus = v(p).lerp(wyvernShotOffset(s,0,66,-12), 0.35);
    } else if (s.stage === "wyvern-launch") {
      const a = ease(s.stageTime / WYVERN_CINEMA.launch);
      desired = wyvernShotOffset(s,75 - a * 25, 95 + a * 18, 120 - a * 30);
      focus = v(p).lerp(wyvernShotOffset(s,0,76,-14), 0.4);
    } else if (s.qte) {
      const push=ease(Math.min(1,s.stageTime/2.2)),arc=Math.sin(s.stageTime*0.35)*0.18;
      const mouth=["wyvern-mouth","wyvern-missile"].includes(s.stage);
      desired=v(p).add(wyvernShotOffset(s,(mouth?10:18)*(1-push*0.22)+arc*5,mouth?4:10,(mouth?23:34)*(1-push*0.2)));
      focus=v(p).add(new T.Vector3(0,1.9,0)).lerp(new T.Vector3(0,66,0),mouth?0.08:0.16);
    } else if (s.stage === "finale") {
      const a = ease(s.stageTime / WYVERN_CINEMA.finale);
      desired = wyvernShotOffset(s,30+a*45,78+a*12,60+a*50);
      focus = new T.Vector3(0, 66, -10);
    } else {
      const moveShot=titanMoveShot(s),back=s.emerald?12:20,cp=Math.cos(p.pitch);
      desired=moveShot?v(moveShot.position):v(p).add(new T.Vector3(Math.sin(p.yaw)*back*cp+Math.cos(p.yaw)*2.4,3.8+Math.sin(p.pitch)*back,Math.cos(p.yaw)*back*cp-Math.sin(p.yaw)*2.4));
      focus=moveShot?v(moveShot.target):v(p).add(new T.Vector3(0,1.9,0));
      if(s.emerald&&s.lock&&!s.won){const hit=v(titanTargetContact(s).point);focus.lerp(hit,Math.min(0.08,0.65/Math.max(0.001,focus.distanceTo(hit))));}
    }
    this.cameraFollow ||= {};
    const transport=titanCameraTransport(this.cameraFollow,s);
    if(this.lastDrawn){this.camera.position.add(transport);this.look.add(transport);}
    const flickWeight = s.stage === "combat" && !s.strike && s.config.cinematicCamera !== false
      ? ease((w.flickAge || 0) / 0.08) * (1-ease(((w.flickAge ?? 1)-0.3)/0.22)) : 0;
    if (flickWeight > 0) {
      desired.lerp(v(p).add(new T.Vector3(Math.sin(p.yaw)*9+4,3.8,Math.cos(p.yaw)*9)),flickWeight);
      focus.lerp(v(p).add(new T.Vector3(0,2.1,0)),flickWeight*0.8);
    }
    if (s.emerald) desired.copy(v(clearTitanCamera(s,desired,15)));
    desired.copy(v(clearWyvernTerrainCamera(s,desired,{x:p.x,y:p.y+1.9,z:p.z})));
    desired.copy(v(clearWyvernSceneryCamera(s,desired,{x:p.x,y:p.y+1.9,z:p.z})));
    const a = dt > 0 ? 1 - Math.exp(-dt * 9) : this.lastDrawn ? 0 : 1;
    this.camera.position.lerp(desired, a);
    if (s.emerald) this.camera.position.copy(v(clearTitanCamera(s,this.camera.position,15)));
    this.camera.position.copy(v(clearWyvernTerrainCamera(s,this.camera.position,{x:p.x,y:p.y+1.9,z:p.z})));
    this.camera.position.copy(v(clearWyvernSceneryCamera(s,this.camera.position,{x:p.x,y:p.y+1.9,z:p.z})));
    this.look.lerp(focus, a);
    this.shake = Math.max(0, (this.shake || 0) - dt * 3);
    if (this.shake && s.config.cameraShake) {
      this.camera.position.x +=
        Math.sin(s.time * 90) * this.shake * s.config.cameraShake * 0.1;
    }
    this.camera.position.copy(v(clearWyvernTerrainCamera(s,this.camera.position,{x:p.x,y:p.y+1.9,z:p.z})));
    this.camera.position.copy(v(clearWyvernSceneryCamera(s,this.camera.position,{x:p.x,y:p.y+1.9,z:p.z})));
    if(s.emerald)this.camera.position.copy(v(clearTitanCamera(s,this.camera.position,15)));
    this.camera.lookAt(this.flightRoot.localToWorld(this.look.clone()));
    if(s.stage==='combat'&&s.config.cinematicCamera!==false){const turn=wyvernRoutePoint(w.routeDistance||0).bend||0;this.camera.rotateZ(clamp(turn*0.35,-0.035,0.035));}
    this.camera.aspect =
      Math.max(1, gl.domElement.clientWidth) /
      Math.max(1, gl.domElement.clientHeight);
    const speedFov=s.stage === "combat" ? (s.boosting ? 10 : 5) : s.stage === "traversal" && w.section === "runway" ? (s.boosting ? 12 : 6) : 0;
    this.speedFov=(this.speedFov || 0)+(speedFov-(this.speedFov || 0))*(1-Math.exp(-Math.max(0,dt)*5));
    this.camera.fov = (s.config.cameraFov || 67) + this.speedFov - flickWeight * 8;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.environment.placeSky(this.camera.getWorldPosition(new T.Vector3()));
    this.lastDrawn = true;
    const target = this.flightRoot
      .localToWorld(v(titanTargetContact(s).point))
      .project(this.camera);
    this.targetScreen = {
      x: target.x * 0.5 + 0.5,
      y: -target.y * 0.5 + 0.5,
      visible:
        Math.abs(target.x) < 1 &&
        Math.abs(target.y) < 1 &&
        target.z > 0 &&
        target.z < 1,
    };
    this.damageScreen = this.targetScreen;
    const d = this.dummy,
      missiles = [];
    for (const m of w.missiles) {
      if(!m.reflected && m.age>=m.eta)continue;
      const ahead = wyvernMissilePoint({
          ...m,
          age: Math.min(m.eta, m.age + 0.015),
        }),
        behind = wyvernMissilePoint({ ...m, age: Math.max(0, m.age - 0.015) });
      missiles.push({
        ...wyvernMissilePoint(m),
        dir: v(ahead).sub(v(behind)).normalize(),
      });
    }
    if (
      ["wyvern-volley", "wyvern-barrage", "wyvern-missile", "finale"].includes(
        s.stage,
      )
    )
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 + s.time * 0.3,
          r = (s.stage === "finale" ? Math.max(0, 22 - s.stageTime * 3) : 22)*WYVERN_SCALE;
        missiles.push({
          x: p.x + Math.cos(angle) * r,
          y: p.y + 4 + Math.sin(angle) * r * 0.5,
          z: p.z + Math.sin(angle) * r,
          dir: new T.Vector3(-Math.cos(angle), 0, -Math.sin(angle)),
        });
      }
    this.missiles.update(missiles,s.time);
    let trailCount = 0;
    if (s.config.particles)
      for (const m of w.missiles) {
        for (let j = 0; j < (quality < 2 ? 4 : 8) && trailCount < 128; j++) {
          const age = m.age - j * 0.045;
          if (age < 0.03) continue;
          const a = wyvernMissilePoint({ ...m, age: Math.max(0, age - 0.045) }),
            b = wyvernMissilePoint({ ...m, age });
          const delta = v(b).sub(v(a)),
            length = delta.length();
          if (length < 0.0001) continue;
          d.position.copy(v(a).add(v(b)).multiplyScalar(0.5));
          d.quaternion.setFromUnitVectors(up, delta.normalize());
          d.scale.set(1, 1, length);
          d.updateMatrix();
          this.missileTrails.setMatrixAt(trailCount++, d.matrix);
        }
      }
    this.missileTrails.count = trailCount;
    this.missileTrails.instanceMatrix.needsUpdate = true;
    this.energyPool.count = Math.min(12, s.projectiles.length);
    this.energyPool.material.color.set(
      sonicSuper(visual) ? "#ffe28a" : "#7fddff",
    );
    s.projectiles.slice(0, 12).forEach((q, i) => {
      d.position.set(q.x, q.y, q.z);
      d.quaternion.setFromUnitVectors(
        up,
        new T.Vector3(q.vx, q.vy, q.vz).normalize(),
      );
      d.scale.setScalar(q.kind === "shot" ? 1 : 2.3);
      d.updateMatrix();
      this.energyPool.setMatrixAt(i, d.matrix);
    });
    this.energyPool.instanceMatrix.needsUpdate = true;
    this.energyPool.visible = false;
    this.abilityProjectiles.update(s);
    this.lasers.forEach((g, i) => {
      const l = w.lasers[i];
      g.visible = !!l || s.stage === "phase";
      if (s.stage === "phase") {
        const spine = this.boss.userData.tail,
          a = spine[Math.min(spine.length - 2, i * 5)],
          b = spine[Math.min(spine.length - 1, i * 5 + 2)];
        if (a && b) {
          const start = this.flightRoot.worldToLocal(
              a.getWorldPosition(new T.Vector3()),
            ),
            end = this.flightRoot.worldToLocal(
              b.getWorldPosition(new T.Vector3()),
            );
          g.position.copy(start);
          g.quaternion.setFromUnitVectors(up, end.sub(start).normalize());
        }
        g.scale.setScalar(ease(s.stageTime / 5) * (1 + i * 0.22));
      }
      if (l) {
        g.quaternion.identity();
        g.position.set(l.x, l.y, 8 + (Math.max(0, l.age - 1.1) / 2.1) * 112);
        g.scale.setScalar(0.5 + ease(l.age / 0.7) * 0.5);
      }
    });
    this.particles = this.particles.filter((q) => {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      return q.life > 0;
    });
    this.particlePool.count = s.config.particles
      ? Math.min(quality < 2 ? 64 : 192, this.particles.length)
      : 0;
    (this.particlePool.count
      ? this.particles.slice(-this.particlePool.count)
      : []
    ).forEach((q, i) => {
      d.position.set(q.x, q.y, q.z);
      d.quaternion.identity();
      d.scale.setScalar((q.size * q.life) / q.initial);
      d.updateMatrix();
      this.particlePool.setMatrixAt(i, d.matrix);
    });
    this.particlePool.instanceMatrix.needsUpdate = true;
    this.returnGate.visible = s.stage === "victory" && !!s.returnPortal;
    if (this.returnGate.visible) {
      const q = s.returnPortal;
      this.returnGate.position.set(q.x, q.y - 1.8, q.z);
      this.returnGate.rotation.y = Math.atan2(q.nx, q.nz);
      animateTitanPortal(
        this.returnGate,
        s.time,
        s.config.particles,
        s.config.lighting,
      );
    }
    if (this.returnGate.visible) {
      const projected = this.flightRoot
        .localToWorld(v(s.returnPortal))
        .project(this.camera);
      this.returnScreen = {
        x: projected.x * 0.5 + 0.5,
        y: -projected.y * 0.5 + 0.5,
        visible:
          Math.abs(projected.x) < 1 &&
          Math.abs(projected.y) < 1 &&
          projected.z > 0 &&
          projected.z < 1,
      };
    } else this.returnScreen = null;
    const old = {
      target: gl.getRenderTarget(),
      tone: gl.toneMapping,
      exposure: gl.toneMappingExposure,
      shadow: gl.shadowMap.enabled,
      shadowType: gl.shadowMap.type,
      auto: gl.autoClear,
    };
    try {
      gl.setRenderTarget(null);
      gl.autoClear = true;
      gl.toneMapping = T.ACESFilmicToneMapping;
      gl.toneMappingExposure = s.config.exposure || 1.05;
      gl.shadowMap.enabled = s.config.shadowQuality !== "off" && quality > 1;
      this.light.castShadow = gl.shadowMap.enabled;
      gl.shadowMap.type=T.PCFSoftShadowMap;
      const size =
        quality >= 3 && s.config.shadowQuality === "high" ? Math.min(4096,gl.capabilities.maxTextureSize) : s.config.shadowQuality === "low" ? 1024 : 2048;
      stabilizeTitanShadow(this.light,worldHead,new T.Vector3(-140,230,100),size);
      if (this.shadowSize !== size) {
        this.light.shadow.map?.dispose();
        this.light.shadow.map = null;
        this.light.shadow.mapSize.set(size, size);
        this.shadowSize = size;
      }
      if (s.config.postProcessing && quality > 1) {
        const w = gl.domElement.width,
          h = gl.domElement.height,
          scale = s.config.renderScale || 1,
          key = [w, h, scale, s.config.antialiasing].join(":");
        if (!this.composer || key !== this.postKey) {
          this.composer?.dispose();
          this.bloom?.dispose();
          this.aa?.dispose();
          this.composer = new EffectComposer(
            gl,
            new T.WebGLRenderTarget(
              Math.max(1, (w * scale) | 0),
              Math.max(1, (h * scale) | 0),
              { type: T.HalfFloatType },
            ),
          );
          this.composer.setPixelRatio(1);
          this.composer.setSize(
            Math.max(1, (w * scale) | 0),
            Math.max(1, (h * scale) | 0),
          );
          this.composer.addPass(new RenderPass(this.scene, this.camera));
          this.bloom = new UnrealBloomPass(
            new T.Vector2(w * scale, h * scale),
            0.2,
            0.4,
            1,
          );
          this.composer.addPass(this.bloom);
          if (s.config.antialiasing) {
            this.aa = new SMAAPass();
            this.composer.addPass(this.aa);
          }
          this.composer.addPass(new OutputPass());
          this.postKey = key;
        }
        this.bloom.strength = s.config.bloomIntensity ?? 0.26;
        this.composer.render(dt);
      } else gl.render(this.scene, this.camera);
    } finally {
      gl.setRenderTarget(old.target);
      gl.toneMapping = old.tone;
      gl.toneMappingExposure = old.exposure;
      gl.shadowMap.enabled = old.shadow;
      gl.shadowMap.type = old.shadowType;
      gl.autoClear = old.auto;
    }
  }
  dispose() {
    this.disposed = true;
    this.jumpBall?.dispose();this.traversalFX?.dispose();
    disposeWyvernFlick(this.sonic);
    this.sonic && disposeImportedRig(this.sonic);
    this.boss?.userData.mixer.stopAllAction();
    this.boss?.traverse((o) => o.skeleton?.boneTexture?.dispose());
    this.composer?.dispose();
    this.bloom?.dispose();
    this.aa?.dispose();
    this.env?.dispose();
    this.pmrem?.dispose();
    this.light.shadow.map?.dispose();
    this.sandTexture?.dispose();
    this.cloudTexture?.dispose();
    this.rockTexture?.dispose();
    const geometries = new Set(),
      materials = new Set();
    this.scene.traverse((o) => {
      if (o === this.sonic || this.sonic?.getObjectById(o.id)) return;
      if (o.geometry && !o.geometry.userData.wyvernShared)
        geometries.add(o.geometry);
      for (const m of Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [])
        materials.add(m);
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    this.scene.clear();
  }
}
