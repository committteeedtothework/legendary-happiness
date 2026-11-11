import * as T from "three";
import { titanSceneryHeight } from "./titan-landscape.js";
// Distant, original modular ruins. No decorative collider enters the combat disk.
export function makeTitanRuins(arena) {
  const root = new T.Group(),
    dummy = new T.Object3D();
  root.name = "Outer colonnades";
  const rock = arena.userData.cliffs.material;
  const mat = new T.MeshStandardMaterial({
    map: rock.map,
    normalMap: rock.normalMap,
    color: "#a6afa8",
    roughness: 0.91,
    metalness: 0.03,
  });
  const stones = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat, 160);
  let count = 0;
  const block = (x, y, z, w, h, d, angle) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    stones.setMatrixAt(count++, dummy.matrix);
  };
  for (let i = 0; i < 8; i++) {
    const a = i * 2.399963 + 0.4,
      r = 220 + (i % 3) * 23,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r,
      y = titanSceneryHeight(x, z),
      height = 13 + (i % 4) * 3;
    for (const side of [-1, 1]) {
      const off = side * 9;
      block(
        x + Math.cos(a) * off,
        y + height * 0.5,
        z - Math.sin(a) * off,
        3,
        height,
        3,
        a,
      );
    }
    for (let j = 0; j < 10; j++) {
      if ((i + j) % 13 === 0) continue;
      const theta = (j / 9) * Math.PI,
        off = Math.cos(theta) * 9,
        yy = Math.sin(theta) * 8;
      dummy.position.set(
        x + Math.cos(a) * off,
        y + height + yy,
        z - Math.sin(a) * off,
      );
      dummy.rotation.set(0, a, theta - Math.PI / 2);
      dummy.scale.set(3.4, 2.1, 3.4);
      dummy.updateMatrix();
      stones.setMatrixAt(count++, dummy.matrix);
    }
    for (let j = 0; j < 5; j++)
      block(
        x + Math.sin(i * 7 + j) * 16,
        y + 0.8,
        z + Math.cos(i * 3 + j) * 13,
        2.4,
        0.9,
        1.4,
        a + j,
      );
  }
  stones.count = count;
  stones.castShadow = stones.receiveShadow = true;
  root.add(stones);
  root.userData.draws = 1;
  root.userData.instances = count;
  return root;
}
