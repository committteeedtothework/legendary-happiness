import {
  titanCanopy,
  titanLeafAtlas,
  titanTreeBranches,
} from "./titan-foliage-shapes.js";
import { arenaUnitScale } from "./titan-metrics.js";
import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import { TITAN_RING_TRAILS } from "./giganto-simulation.js";
const clamp = T.MathUtils.clamp;
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, y) {
  const a = Math.floor(x),
    b = Math.floor(y),
    u = x - a,
    v = y - b,
    s = u * u * (3 - 2 * u),
    t = v * v * (3 - 2 * v);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(hash(a, b), hash(a + 1, b), s),
    T.MathUtils.lerp(hash(a, b + 1), hash(a + 1, b + 1), s),
    t,
  );
}
function fbm(x, y) {
  return (
    noise(x, y) * 0.56 +
    noise(x * 2.03, y * 2.03) * 0.27 +
    noise(x * 4.07, y * 4.07) * 0.12 +
    noise(x * 8.1, y * 8.1) * 0.05
  );
}
function surface(kind, size = 512) {
  const color = new Uint8Array(size * size * 4),
    normal = new Uint8Array(size * size * 4),
    heights = new Float32Array(size * size);
  const palette =
    kind === "rock"
      ? [
          [65, 67, 62],
          [166, 166, 151],
        ]
      : kind === "soil"
        ? [
            [67, 61, 44],
            [157, 143, 103],
          ]
        : [
            [28, 58, 20],
            [126, 151, 62],
          ];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const p = (x + y * size) * 4,
        fine = hash(x + 17, y + 41),
        u = x / (size - 1),
        v = y / (size - 1),
        su = u * u * (3 - 2 * u),
        sv = v * v * (3 - 2 * v),
        n = T.MathUtils.lerp(
          T.MathUtils.lerp(
            fbm(x / 25, y / 25),
            fbm((x - size + 1) / 25, y / 25),
            su,
          ),
          T.MathUtils.lerp(
            fbm(x / 25, (y - size + 1) / 25),
            fbm((x - size + 1) / 25, (y - size + 1) / 25),
            su,
          ),
          sv,
        ),
        f = clamp(
          n * 0.94 +
            fine * 0.06 +
            (kind === "rock" ? Math.sin(y * 0.15 + n * 8) * 0.08 : 0),
          0,
          1,
        );
      heights[x + y * size] =
        kind === "rock" ? n * 0.8 + fine * 0.2 : n * 0.3 + fine * 0.7;
      const fissure =
          kind === "rock"
            ? Math.max(
                0,
                1 - Math.abs(Math.sin((y / size) * 90 + n * 16)) / 0.1,
              ) * 0.18
            : 0,
        lichen = kind === "rock" && n > 0.63 && fine > 0.6 ? 0.16 : 0;
      for (let c = 0; c < 3; c++)
        color[p + c] =
          (palette[0][c] + (palette[1][c] - palette[0][c]) * f) *
            (1 - fissure) +
          (c === 1 ? lichen * 30 : lichen * 9);
      color[p + 3] = 255;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const h = (a, b) =>
          heights[((a + size) % size) + ((b + size) % size) * size],
        nx = (h(x - 1, y) - h(x + 1, y)) * 1.2,
        ny = (h(x, y - 1) - h(x, y + 1)) * 1.2,
        l = Math.hypot(nx, ny, 1),
        i = (x + y * size) * 4;
      normal.set(
        [
          ((nx / l) * 0.5 + 0.5) * 255,
          ((ny / l) * 0.5 + 0.5) * 255,
          ((1 / l) * 0.5 + 0.5) * 255,
          255,
        ],
        i,
      );
    }
  const make = (data, srgb) => {
    const tex = new T.DataTexture(data, size, size);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.magFilter = T.LinearFilter;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  const maps = { map: make(color, true), normalMap: make(normal, false) };
  for (const [role, tex] of Object.entries(maps))
    Object.assign(tex.userData, { titanSurface: kind, titanRole: role });
  return maps;
}
export function titanSceneryHeight(x, z) {
  if (Math.hypot(x, z) <= 195) return 0;
  const rr = Math.hypot(x, z),
    a = Math.atan2(x, z),
    inner = 195 + noise(Math.sin(a) * 3 + 8, Math.cos(a) * 3 + 8) * 39;
  const u = clamp((rr - inner) / 285, 0, 1),
    smooth = (v) => {
      v = clamp(v, 0, 1);
      return v * v * (3 - 2 * v);
    },
    valley =
      1 -
      Math.pow(Math.max(0, Math.cos(a - 1.3)), 16) * 0.68 -
      Math.pow(Math.max(0, Math.cos(a + 1.7)), 20) * 0.4,
    ridge = 58 + fbm(x / 105 + 19, z / 105 + 8) * 90,
    terrace =
      u +
      (noise(x / 77 + 14, z / 77 + 3) - 0.5) * 0.16 +
      Math.sin(a * 9 + noise(x / 120, z / 120) * 3) * 0.025,
    shoulders =
      smooth((terrace - 0.025) / 0.085) * 25 +
      smooth((terrace - 0.16) / 0.07) * 24 +
      smooth((terrace - 0.29) / 0.055) * 24 +
      smooth((u - 0.4) / 0.35) * ridge,
    strata =
      (Math.sin(u * 42 + noise(x / 55, z / 55) * 4) * 2.2 +
        (fbm(x / 36, z / 36) - 0.5) * 14) *
      Math.sin(u * Math.PI);
  return Math.max(0, (shoulders + strata) * valley);
}
const rimHeight = titanSceneryHeight;
let boulderBounds;
export function titanBoulderBounds(){
 if(boulderBounds)return boulderBounds;
 return boulderBounds=Array.from({length:110},(_,i)=>{const a=i*2.399963,r=i<35?179+hash(i,12)*6:235+hash(i,12)*135,k=3+hash(i,5)*8;
  const x=Math.sin(a)*r,z=Math.cos(a)*r;
  // Conservative oriented bounds for the authored, rotated eroded rocks.
  return {x,z,y:rimHeight(x,z)+k*0.3,w:k*2.6,h:k*2.3,d:k*(0.8+hash(i,7))*2.5,yaw:a};
 });
}
export function makeTitanLandscape(route, quality = 2) {
  const root = new T.Group();
  root.name = "Kronos-inspired highland basin";
  const textures = [],
    materials = [],
    anim = [];
  function material(kind, repeat = 1) {
    const maps = surface(kind);
    for (const tex of Object.values(maps)) {
      tex.repeat.set(repeat, repeat);
      textures.push(tex);
    }
    const m = new T.MeshStandardMaterial({
      ...maps,
      roughness: kind === "rock" ? 0.91 : 1,
      envMapIntensity: kind === "rock" ? 0.85 : 0.6,
      normalScale: new T.Vector2(
        kind === "grass" ? 0.12 : 0.35,
        kind === "grass" ? 0.12 : 0.35,
      ),
    });
    materials.push(m);
    return m;
  }
  const grassMat = material("grass", 30),
    rockMat = material("rock", 12),
    stoneMat = material("rock", 1.2),
    soilMat = material("soil", 45);
  stoneMat.normalScale.set(0.14, 0.14);
  const floorGeo = new T.PlaneGeometry(420, 420, 92, 92);
  floorGeo.rotateX(-Math.PI / 2);
  const fc = [],
    fp = floorGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const n = fbm(fp.getX(i) / 27 + 30, fp.getZ(i) / 27 + 30),
      v = 0.75 + n * 0.5;
    fc.push(v * 0.97, v, v * 0.92);
  }
  floorGeo.setAttribute("color", new T.Float32BufferAttribute(fc, 3));
  grassMat.vertexColors = true;
  // Macro color breaks up close tiling while the PBR normal map supplies detail.
  grassMat.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 basinWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n basinWorld=(modelMatrix*vec4(transformed,1.)).xyz;",
    );
    shader.fragmentShader =
      "varying vec3 basinWorld;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float patches=sin(basinWorld.x*.034+sin(basinWorld.z*.028)*2.)*sin(basinWorld.z*.046+basinWorld.x*.011);
      float path=exp(-pow((basinWorld.x-sin(basinWorld.z*.026)*18.-28.)/5.,2.))*.42;
      diffuseColor.rgb*=mix(vec3(.77,.87,.69),vec3(1.12,1.04,.86),patches*.5+.5);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.16,.105),path);`,
    );
  };

  const floor = new T.Mesh(floorGeo, grassMat);
  floor.receiveShadow = true;
  root.add(floor);
  // Continuous, densely tessellated cliff strata; the entire walkable floor
  // remains flat and clear. Relief starts beyond the simulation's 175 m limit.
  const angular = 256,
    layers = 42,
    positions = [],
    uv = [],
    colors = [],
    indices = [];
  for (let r = 0; r <= layers; r++)
    for (let i = 0; i <= angular; i++) {
      const a = (i / angular) * Math.PI * 2,
        t = r / layers,
        rr = 190 + Math.pow(t, 1.18) * 295,
        x = Math.sin(a) * rr,
        z = Math.cos(a) * rr,
        y = rimHeight(x, z),
        f = fbm(x / 120 + 10, z / 120 + 10);
      positions.push(x, y - 1, z);
      uv.push((i / angular) * 4, t * 3);
      const moss = clamp((Math.abs(Math.cos(t * 4 + a * 3)) - 0.55) * 2, 0, 1),
        shade = 0.62 + f * 0.38;
      colors.push(shade * (1 - moss * 0.18), shade, shade * (1 - moss * 0.28));
      if (r < layers && i < angular) {
        const k = r * (angular + 1) + i;
        indices.push(
          k,
          k + angular + 1,
          k + 1,
          k + 1,
          k + angular + 1,
          k + angular + 2,
        );
      }
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const cliffMat = rockMat.clone();
  cliffMat.color.set("#a1a493");
  cliffMat.vertexColors = true;
  cliffMat.side = T.DoubleSide;
  cliffMat.normalScale.set(0.42, 0.42);
  cliffMat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 cliffWorld;varying vec3 cliffNormal;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n cliffWorld=(modelMatrix*vec4(transformed,1.)).xyz;cliffNormal=normalize(mat3(modelMatrix)*objectNormal);",
    );
    shader.uniforms.basinGrass = { value: grassMat.map };
    shader.fragmentShader =
      "uniform sampler2D basinGrass;varying vec3 cliffWorld;varying vec3 cliffNormal;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
      vec3 w=pow(abs(cliffNormal),vec3(4.));w/=max(.001,w.x+w.y+w.z);
      vec3 stone=texture2D(map,cliffWorld.yz*.17).rgb*w.x+texture2D(map,cliffWorld.xz*.17).rgb*w.y+texture2D(map,cliffWorld.xy*.17).rgb*w.z;
      float grassMask=smoothstep(.78,.97,cliffNormal.y);
      float variation=.85+.15*sin(cliffWorld.x*.035+sin(cliffWorld.z*.04));
      vec3 turf=texture2D(basinGrass,cliffWorld.xz*.08).rgb*vec3(1.08,1.12,.92)*variation;
      diffuseColor.rgb*=mix(stone,turf,grassMask*.94);
    #endif`,
    );
  };
  materials.push(cliffMat);
  const cliffs = new T.Mesh(geo, cliffMat);
  cliffs.receiveShadow = true;
  root.add(cliffs);
  // Distant reflective ribbon is scenery outside movement bounds.
  const riverGeo = new T.PlaneGeometry(13, 360, 1, 48);
  riverGeo.rotateX(-Math.PI / 2);
  const rv = riverGeo.attributes.position;
  for (let i = 0; i < rv.count; i++) {
    rv.setX(i, rv.getX(i) + 205 + Math.sin(rv.getZ(i) * 0.021) * 7);
    rv.setY(i, rimHeight(rv.getX(i), rv.getZ(i)) + 0.09);
  }
  riverGeo.computeVertexNormals();
  const river = new T.Mesh(
    riverGeo,
    new T.MeshStandardMaterial({
      color: "#587b82",
      roughness: 0.22,
      metalness: 0.45,
      transparent: true,
      opacity: 0.72,
    }),
  );
  const waterData = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const a = (x / 128) * Math.PI * 2,
        b = (y / 128) * Math.PI * 2,
        nx = Math.sin(a * 4 + b * 3) * 0.12,
        nz = Math.cos(b * 5 - a * 2) * 0.12,
        l = Math.hypot(nx, nz, 1),
        i = (x + y * 128) * 4;
      waterData.set(
        [
          ((nx / l) * 0.5 + 0.5) * 255,
          ((nz / l) * 0.5 + 0.5) * 255,
          ((1 / l) * 0.5 + 0.5) * 255,
          255,
        ],
        i,
      );
    }
  const waterNormal = new T.DataTexture(waterData, 128, 128);
  waterNormal.wrapS = waterNormal.wrapT = T.RepeatWrapping;
  waterNormal.repeat.set(3, 30);
  waterNormal.needsUpdate = true;
  waterNormal.magFilter = T.LinearFilter;
  waterNormal.minFilter = T.LinearFilter;
  textures.push(waterNormal);
  river.material.normalMap = waterNormal;
  river.material.normalScale = new T.Vector2(0.45, 0.45);
  river.material.envMapIntensity = 1.2;
  river.position.x = 0;
  root.add(river);
  materials.push(river.material);
  // Smooth eroded boulders are batched. Their silhouette avoids regular cones
  // and pyramids; none obstructs the playable floor or aerial body boundary.
  const boulderSource = new T.IcosahedronGeometry(1, 2),
    bp = boulderSource.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i),
      y = bp.getY(i),
      z = bp.getZ(i),
      k = 0.85 + fbm(x * 2 + 2, z * 2 + 7) * 0.3;
    bp.setXYZ(i, x * k, y * (0.8 + noise(x + 3, z + 8) * 0.3), z * k);
  }
  boulderSource.deleteAttribute("normal");
  const boulderGeo = mergeVertices(boulderSource);
  boulderGeo.computeVertexNormals();
  boulderSource.dispose();
  const boulders = new T.InstancedMesh(boulderGeo, stoneMat, 110),
    dummy = new T.Object3D();
  for (let i = 0; i < 110; i++) {
    const a = i * 2.399963,
      rr = i < 35 ? 179 + hash(i, 12) * 6 : 235 + hash(i, 12) * 135,
      k = 3 + hash(i, 5) * 8;
    dummy.position.set(
      Math.sin(a) * rr,
      rimHeight(Math.sin(a) * rr, Math.cos(a) * rr) + k * 0.3,
      Math.cos(a) * rr,
    );
    dummy.rotation.set(hash(i, 8), a, hash(i, 1));
    dummy.scale.set(k, k * 0.8, k * (0.8 + hash(i, 7)));
    dummy.updateMatrix();
    boulders.setMatrixAt(i, dummy.matrix);
  }
  boulders.receiveShadow = true;
  root.add(boulders);
  const debris = new T.InstancedMesh(boulderGeo, stoneMat, 28);
  debris.frustumCulled = false;
  root.add(debris);
  // Open branch structures and cutout leaf sprays replace solid crowns.
  const leaves = titanLeafAtlas();
  textures.push(leaves);
  const trunks = new T.InstancedMesh(titanTreeBranches(), soilMat, 260),
    crowns = new T.InstancedMesh(
      titanCanopy(12, 8),
      new T.MeshStandardMaterial({
        map: leaves,
        color: "#8ca95d",
        envMapIntensity: 0.12,
        alphaTest: 0.34,
        // The shared browser renderer has no MSAA; coverage would leave halos.
        alphaToCoverage: false,
        vertexColors: true,
        side: T.DoubleSide,
        roughness: 1,
      }),
      1040,
    );
  materials.push(crowns.material);
  for (let i = 0; i < 260; i++) {
    const a = i * 2.399963,
      cluster = i % 13,
      centre = cluster * 2.399963,
      r = 222 + hash(cluster, 17) * 139,
      rr = Math.sqrt(hash(i, 21)) * 24,
      x = Math.sin(centre) * r + Math.sin(a) * rr,
      z = Math.cos(centre) * r + Math.cos(a) * rr,
      h = 6 + hash(i, 3) * 9;
    dummy.position.set(x, rimHeight(x, z) + h * 0.5, z);
    dummy.rotation.set(0, a, 0);
    dummy.scale.set(h * (0.8 + hash(i, 19) * 0.35), h, h);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 4; j++) {
      dummy.position.set(
        x + Math.sin(j * 2.4 + a) * h * 0.14,
        rimHeight(x, z) + h * 0.62 + j * h * 0.1,
        z + Math.cos(j * 2.4 + a) * h * 0.14,
      );
      dummy.scale.set(h * 0.21, h * 0.22, h * 0.19);
      dummy.rotation.set(0.2 * j, a + j, 0.14);
      dummy.updateMatrix();
      crowns.setMatrixAt(i * 4 + j, dummy.matrix);
      const shade = 0.8 + hash(i, j) * 0.35;
      crowns.setColorAt(i * 4 + j, new T.Color(shade, shade, shade));
    }
  }
  crowns.material.onBeforeCompile = (shader) => {
    shader.uniforms.titanWind = { value: root.userData.windTime || 0 };
    anim.push(shader.uniforms.titanWind);
    shader.vertexShader = "uniform float titanWind;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n transformed.x+=sin(titanWind*.65+instanceMatrix[3].x*.07+position.y)*.022; transformed.z+=sin(titanWind*.47+instanceMatrix[3].z*.08)*.016;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_fragment>",
      "#include <lights_physical_fragment>\n material.specularColor*=.08;",
    );
  };
  crowns.userData.titanAO = false;
  crowns.name = "Highland leaf sprays";
  trunks.name = "Highland branch structures";
  trunks.castShadow = trunks.receiveShadow = true;
  crowns.receiveShadow = true;
  root.add(trunks, crowns);
  const shrubs = new T.InstancedMesh(crowns.geometry, crowns.material, 420);
  shrubs.name = "Highland scrub";
  shrubs.userData.titanAO = false;
  shrubs.receiveShadow = true;
  for (let i = 0; i < 420; i++) {
    const a = i * 2.399963,
      rr = 184 + hash(i, 31) * 205,
      x = Math.sin(a) * rr,
      z = Math.cos(a) * rr,
      h = 0.8 + hash(i, 43) * 1.7;
    dummy.position.set(x, rimHeight(x, z) + h * 0.45, z);
    dummy.rotation.set(0, a, 0);
    dummy.scale.set(h, h * 0.65, h);
    dummy.updateMatrix();
    shrubs.setMatrixAt(i, dummy.matrix);
    shrubs.setColorAt(
      i,
      new T.Color().setHSL(
        0.22 + hash(i, 9) * 0.06,
        0.34,
        0.54 + hash(i, 12) * 0.16,
      ),
    );
  }
  root.add(shrubs);
  const blade = new T.BufferGeometry(),
    bladePositions = [],
    bladeIndices = [];
  for (let side = 0; side < 3; side++) {
    const points = [
        [-0.045, 0, 0],
        [0.045, 0, 0],
        [-0.025, 0.3, 0.04],
        [0.025, 0.3, 0.04],
        [0.025, 0.56, 0.105],
      ],
      offset = side * 5;
    for (const p of points)
      bladePositions.push(
        p[0] * Math.cos(side * 2.399) + p[2] * Math.sin(side * 2.399),
        p[1] * (0.8 + side * 0.1),
        p[2] * Math.cos(side * 2.399) - p[0] * Math.sin(side * 2.399),
      );
    bladeIndices.push(
      offset,
      offset + 1,
      offset + 2,
      offset + 2,
      offset + 1,
      offset + 3,
      offset + 2,
      offset + 3,
      offset + 4,
    );
  }
  blade.setAttribute(
    "position",
    new T.Float32BufferAttribute(bladePositions, 3),
  );
  blade.setIndex(bladeIndices);
  blade.computeVertexNormals();
  const bladeMat = new T.MeshStandardMaterial({
    color: "#506936",
    side: T.DoubleSide,
    roughness: 1,
  });
  materials.push(bladeMat);
  bladeMat.onBeforeCompile = (shader) => {
    shader.uniforms.titanWind = { value: root.userData.windTime || 0 };
    anim.push(shader.uniforms.titanWind);
    shader.vertexShader =
      "uniform float titanWind; varying float bladeHeight;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n bladeHeight=clamp(position.y,0.,1.); transformed.x += (sin(titanWind*1.7+instanceMatrix[3].x*.17+instanceMatrix[3].z*.1)+sin(titanWind*3.1+instanceMatrix[3].z*.3)*.28)*position.y*position.y*.12;",
    );
    shader.fragmentShader =
      "varying float bladeHeight;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n diffuseColor.rgb*=mix(vec3(.58,.67,.48),vec3(1.2,1.24,.91),bladeHeight);",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "outgoingLight+=diffuseColor.rgb*.12*bladeHeight;\n#include <opaque_fragment>",
    );
  };
  const blades = new T.InstancedMesh(blade, bladeMat, 14000);
  blades.frustumCulled = false;
  blades.userData.titanAO = false;
  for (let i = 0; i < 14000; i++) {
    const a = i * 2.399963,
      rr = Math.sqrt(hash(i, 61)) * 173;
    dummy.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr);
    dummy.rotation.set(0, i * 1.234, 0);
    dummy.scale.setScalar(0.6 + hash(i, 71));
    dummy.updateMatrix();
    blades.setMatrixAt(i, dummy.matrix);
    blades.setColorAt(
      i,
      new T.Color().setHSL(
        0.22 + hash(i, 2) * 0.07,
        0.3,
        0.34 + hash(i, 3) * 0.13,
      ),
    );
  }
  root.add(blades);
  const slopeGrass = new T.InstancedMesh(blade, bladeMat, 9000);
  slopeGrass.name = "Highland meadow tufts";
  slopeGrass.userData.titanAO = false;
  for (let i = 0; i < 9000; i++) {
    const a = i * 2.399963,
      rr = 196 + hash(i, 81) * 230,
      x = Math.sin(a) * rr,
      z = Math.cos(a) * rr;
    const slope = Math.hypot(
      rimHeight(x + 1, z) - rimHeight(x - 1, z),
      rimHeight(x, z + 1) - rimHeight(x, z - 1),
    );
    dummy.position.set(x, rimHeight(x, z) + 0.03, z);
    dummy.rotation.set(0, a, 0);
    dummy.scale.setScalar(slope < 1.4 ? 0.85 + hash(i, 9) * 1.2 : 0);
    dummy.updateMatrix();
    slopeGrass.setMatrixAt(i, dummy.matrix);
    slopeGrass.setColorAt(
      i,
      new T.Color().setHSL(
        0.23 + hash(i, 7) * 0.035,
        0.35,
        0.48 + hash(i, 14) * 0.12,
      ),
    );
  }
  root.add(slopeGrass);
  const stones = [];
  for (const p of route.slice(1)) {
    const g = new T.BoxGeometry(p.w, 1.5, p.w, 2, 1, 2);
    g.translate(p.x, p.y - 0.75, p.z);
    stones.push(g);
  }
  const platforms = new T.Mesh(mergeGeometries(stones), stoneMat);
  stones.forEach((g) => g.dispose());
  platforms.receiveShadow = true;
  root.add(platforms);
  const rings = [];
  for (const p of route) {
    const m = new T.Mesh(
      new T.TorusGeometry(2.5, 0.055, 6, 48),
      new T.MeshBasicMaterial({
        color: "#abc9bc",
        transparent: true,
        opacity: 0.55,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, p.y + 0.08, p.z);
    root.add(m);
    rings.push(m);
    materials.push(m.material);
  }
  const ringMesh = new T.InstancedMesh(
    new T.TorusGeometry(0.48, 0.12, 6, 12),
    new T.MeshStandardMaterial({
      color: "#f6ca58",
      metalness: 0.8,
      roughness: 0.22,
      emissive: "#513b0b",
      emissiveIntensity: 0.5,
    }),
    TITAN_RING_TRAILS.length * 10,
  );
  root.add(ringMesh);
  materials.push(ringMesh.material);
  ringMesh.frustumCulled = false;
  // Broken colonnades and arches sit beyond all traversal/camera bounds.
  // Batched stone pieces reinforce scale without adding hidden collisions.
  const ruinPieces = [];
  const weatherStone = (g, seed) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        k = noise(x * 0.4 + seed, z * 0.4 + seed);
      p.setXYZ(
        i,
        x + Math.sin(y * 0.9 + z * 0.7 + seed) * 0.16,
        y + k * 0.18,
        z + Math.cos(y * 0.8 + x * 0.5 + seed) * 0.16,
      );
    }
    g.computeVertexNormals();
    return g;
  };
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.399963,
      rr = 205 + hash(i, 91) * 32,
      cx = Math.sin(angle) * rr,
      cz = Math.cos(angle) * rr;
    for (let j = -1; j <= 1; j++) {
      const h = 14 + hash(i, j + 31) * 16;
      const piece = weatherStone(new T.BoxGeometry(3.5, h, 4.5, 2, 7, 2), i);
      piece.translate(
        cx + j * 9 * Math.cos(angle),
        rimHeight(cx, cz) + h / 2,
        cz - j * 9 * Math.sin(angle),
      );
      ruinPieces.push(piece);
      if (j < 1) {
        const beam = weatherStone(
          new T.BoxGeometry(11, 3.5, 5, 4, 2, 2),
          i + 7,
        );
        beam.rotateY(angle);
        beam.translate(
          cx + (j + 0.5) * 9 * Math.cos(angle),
          rimHeight(cx, cz) + h + 1.5,
          cz - (j + 0.5) * 9 * Math.sin(angle),
        );
        ruinPieces.push(beam);
      }
    }
  }
  // Distinct distant landmarks: weathered shafts and incomplete stone rings.
  // All relief stays outside the traversal/camera boundary.
  for (let i = 0; i < 3; i++) {
    const a = 1.45 + i * 2.05,
      r = 318 + i * 24;
    const x = Math.sin(a) * r,
      z = Math.cos(a) * r,
      y = rimHeight(x, z),
      h = 34 + i * 9;
    const shaft = weatherStone(
      new T.CylinderGeometry(1.4, 3.2, h, 7, 12),
      140 + i,
    );
    shaft.translate(x, y + h * 0.5, z);
    ruinPieces.push(shaft);
    for (let j = 0; j < 3; j++) {
      const ring = weatherStone(
        new T.TorusGeometry(
          6 + j * 0.9,
          0.65,
          5,
          40,
          Math.PI * (1.45 + j * 0.12),
        ),
        170 + i * 8 + j,
      );
      ring.rotateY(a + j * 0.7);
      ring.rotateZ(j * 0.7 + a);
      ring.translate(x, y + h * (0.28 + j * 0.22), z);
      ruinPieces.push(ring);
    }
    for (let j = 0; j < 3; j++) {
      const spire = weatherStone(
        new T.BoxGeometry(0.8, 8 + j * 3, 1.1, 1, 4, 1),
        200 + j + i * 3,
      );
      spire.translate(x + (j - 1) * 1.3, y + h + 3 + j, z);
      ruinPieces.push(spire);
    }
  }
  const ruins = new T.Mesh(mergeGeometries(ruinPieces), stoneMat);
  ruinPieces.forEach((q) => q.dispose());
  ruins.castShadow = ruins.receiveShadow = true;
  root.add(ruins);
  const mountainPositions = [],
    mountainIndices = [],
    sectors = 192,
    rows = 12;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= sectors; i++) {
      const angle = (i / sectors) * Math.PI * 2,
        rr = 480 + (j / rows) * 900,
        peaks = Math.pow(
          0.5 + 0.5 * Math.sin(angle * 7 + Math.sin(angle * 3) * 1.4),
          2,
        ),
        height =
          50 +
          Math.sin((j / rows) * Math.PI) * (70 + peaks * 190) +
          fbm(Math.sin(angle) * 5 + j * 0.08, Math.cos(angle) * 5 + j * 0.08) *
            65;
      mountainPositions.push(
        Math.sin(angle) * rr,
        height,
        Math.cos(angle) * rr,
      );
      if (j < rows && i < sectors) {
        const k = j * (sectors + 1) + i;
        mountainIndices.push(
          k,
          k + sectors + 1,
          k + 1,
          k + 1,
          k + sectors + 1,
          k + sectors + 2,
        );
      }
    }
  const mountainGeo = new T.BufferGeometry();
  mountainGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(mountainPositions, 3),
  );
  mountainGeo.setIndex(mountainIndices);
  mountainGeo.computeVertexNormals();
  const farMat = new T.MeshStandardMaterial({
    color: "#5c625d",
    roughness: 1,
    side: T.DoubleSide,
  });
  materials.push(farMat);
  const mountains = new T.Mesh(mountainGeo, farMat);
  root.add(mountains);
  const groundShock = new T.Mesh(
    new T.RingGeometry(1, 1.018, 96),
    new T.MeshBasicMaterial({
      color: "#7dcfe0",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  groundShock.rotation.x = -Math.PI / 2;
  groundShock.position.y = 0.04;
  root.add(groundShock);
  materials.push(groundShock.material);
  const glow = new T.Mesh(
    new T.CircleGeometry(8, 40),
    new T.MeshBasicMaterial({
      color: "#1b2116",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.018;
  root.add(glow);
  materials.push(glow.material);
  root.userData = {
    floor,
    cliffs,
    mountains,
    crowns,
    trunks,
    shrubs,
    slopeGrass,
    boulders,
    river,
    platforms,
    groundShock,
    ruins,
    rings,
    ringMesh,
    debris,
    blades,
    textures,
    materials,
    anim,
    quality,
  };
  updateTitanLandscape(
    root,
    {
      stage: "intro",
      ringPickups: [],
      time: 0,
      avatar: { y: 0 },
      config: { particles: true },
    },
    0,
  );
  return root;
}
export function updateTitanSurfaceFiltering(root, hardwareMax, quality) {
  const u = root.userData,
    level = Math.max(
      1,
      Math.min(hardwareMax, quality >= 3 ? 8 : quality >= 2 ? 4 : 1),
    );
  if (u.surfaceFiltering === level) return;
  u.surfaceFiltering = level;
  for (const tex of u.textures)
    if (tex.userData.titanSurface && tex.anisotropy !== level) {
      tex.anisotropy = level;
      tex.needsUpdate = true;
    }
}
export function updateTitanLandscape(root, s, dt) {
  const u = root.userData,
    t = s.time || 0,
    dummy = new T.Object3D(),
    picked = new Set(s.ringPickups || []);
  u.windTime = t;
  for (const tex of u.textures)
    if (tex.userData.titanSurface) {
      const repeat = (tex.userData.metreRepeat ||= tex.repeat.clone()),
        scale = arenaUnitScale(s) / 1.6;
      tex.repeat.set(repeat.x * scale, repeat.y * scale);
    }
  for (const uniform of u.anim) uniform.value = t;
  const pulse =
    s.stage === "phase"
      ? s.stageTime
      : s.stage === "finale"
        ? Math.max(0, s.stageTime - 3.5)
        : -1;
  u.groundShock.visible = pulse >= 0 && pulse < 3 && s.config.particles;
  if (u.groundShock.visible) {
    u.groundShock.scale.setScalar(20 + pulse * 48);
    u.groundShock.material.opacity = 0.35 * (1 - pulse / 3);
  }

  const detail = s.config.sceneryDetail || "auto",
    quality =
      s.config.graphicsQuality === "low"
        ? 1
        : s.config.graphicsQuality === "high"
          ? 3
          : s.config.graphicsQuality === "balanced"
            ? 2
            : u.quality;
  u.crownLow ||= u.crowns.geometry;
  u.crowns.geometry =
    quality >= 3 ? (u.crownHigh ||= titanCanopy(24, 16)) : u.crownLow;
  u.shrubs.geometry = u.crowns.geometry;
  const high = quality >= 3;
  if (!u.lowSurfaceImages)
    u.lowSurfaceImages = new Map(
      u.textures
        .filter((t) => t.userData.titanSurface)
        .map((t) => [t, t.image]),
    );
  if (high && !u.highSurfaceImages) {
    u.highSurfaceImages = new Map();
    for (const kind of ["rock", "soil", "grass"]) {
      const maps = surface(kind, 1024);
      for (const tex of u.lowSurfaceImages.keys())
        if (tex.userData.titanSurface === kind)
          u.highSurfaceImages.set(tex, maps[tex.userData.titanRole].image);
      maps.map.dispose();
      maps.normalMap.dispose();
    }
  }
  if (high !== !!u.surfaceHigh) {
    for (const [tex, image] of high
      ? u.highSurfaceImages
      : u.lowSurfaceImages) {
      tex.dispose();
      tex.image = image;
      tex.needsUpdate = true;
    }
    u.surfaceHigh = high;
  }
  u.blades.visible = s.avatar.y < 90 && detail !== "off";
  u.blades.count =
    detail === "high"
      ? 14000
      : detail === "low"
        ? 3200
        : quality >= 3
          ? 14000
          : quality >= 2
            ? 8500
            : 3200;
  u.crowns.visible = u.trunks.visible = detail !== "off";
  u.shrubs.visible = u.slopeGrass.visible = detail !== "off";
  const reduced = detail === "low" || (detail === "auto" && quality === 1);
  u.crowns.count = reduced ? 600 : 1040;
  u.trunks.count = reduced ? 150 : 260;
  u.shrubs.count = reduced ? 140 : 420;
  u.slopeGrass.count = reduced
    ? 2200
    : quality >= 3 || detail === "high"
      ? 9000
      : 4500;
  u.river.material.color.set(s.phase === 2 ? "#344f65" : "#5b8b99");
  u.river.material.normalMap.offset.y = -t * 0.013;
  u.river.material.roughness = 0.26 + Math.sin(t * 0.45) * 0.025;
  u.ringMesh.visible = ["intro", "traversal"].includes(s.stage);
  if (u.ringMesh.visible) {
    for (const r of TITAN_RING_TRAILS)
      for (let i = 0; i < 10; i++) {
        dummy.position.set(
          r.x + (i - 4.5) * 0.64,
          r.y + Math.sin(i * 0.6 + t * 2) * 0.12,
          r.z + Math.sin(i * 0.6) * 0.6,
        );
        dummy.rotation.set(0, t * 1.4 + i * 0.11, 0);
        dummy.scale.setScalar(picked.has(r.id) ? 0 : 1);
        dummy.updateMatrix();
        u.ringMesh.setMatrixAt(r.id * 10 + i, dummy.matrix);
      }
  }
  u.ringMesh.instanceMatrix.needsUpdate = true;
  u.debris.visible = s.config.particles && s.phase === 2;
  for (let i = 0; i < 28; i++) {
    const a = i * 2.399963 + t * 0.012,
      rr = 146 + hash(i, 29) * 15,
      k = 2 + hash(i, 72) * 5;
    dummy.position.set(
      Math.sin(a) * rr,
      40 + hash(i, 14) * 95 + Math.sin(t * 0.25 + i) * 3,
      Math.cos(a) * rr,
    );
    dummy.rotation.set(t * 0.08 + i, a, t * 0.1);
    dummy.scale.set(k, k * 0.7, k * 0.9);
    dummy.updateMatrix();
    u.debris.setMatrixAt(i, dummy.matrix);
  }
  u.debris.instanceMatrix.needsUpdate = true;
}
export function disposeTitanLandscape(root) {
  root.userData.crownLow?.dispose();
  root.userData.crownHigh?.dispose();
  for (const tex of root.userData.textures || []) tex.dispose();
}
