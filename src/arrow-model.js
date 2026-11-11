import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export function createArrowModel() {
  const root = new THREE.Group(),
    parts = [];
  const box = (size, at, color) => {
    const g = new THREE.BoxGeometry(...size);
    g.translate(...at);
    const c = new THREE.Color(color),
      colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(g);
  };
  box([0.024, 0.024, 0.54], [0, 0, 0], "#b3945f");
  box([0.04, 0.04, 0.08], [0, 0, -0.3], "#bfc8c5");
  box([0.022, 0.022, 0.055], [0, 0, -0.36], "#e4e7d5");
  box([0.12, 0.012, 0.13], [0, 0, 0.18], "#e5dcc1");
  box([0.012, 0.12, 0.13], [0, 0, 0.18], "#e5dcc1");
  const geometry = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  geometry.computeBoundingBox();
  root.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    ),
  );
  root.userData = {
    arrowModel: true,
    tip: new THREE.Vector3(0, 0, -0.3875),
    nock: new THREE.Vector3(0, 0, 0.27),
  };
  return root;
}
const axis = new THREE.Vector3(0, 0, -1),
  inverse = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  local = new THREE.Vector3(),
  nock = new THREE.Vector3();
export function alignNockedArrow(model, direction) {
  const arrow = model?.userData.nockedArrow;
  if (!arrow) return;
  const stage = model.userData.drawStage || 0;
  arrow.visible = stage > 0;
  if (!stage) return;
  model.updateWorldMatrix(true, true);
  const frame = model.userData.drawMeshes[stage];
  const p = frame.userData.stringNock;
  nock.copy(p);
  frame.localToWorld(nock);
  inverse.copy(model.matrixWorld).invert();
  nock.applyMatrix4(inverse);
  model.getWorldQuaternion(q).invert();
  local.copy(direction).applyQuaternion(q).normalize();
  arrow.quaternion.setFromUnitVectors(axis, local);
  arrow.position
    .copy(nock)
    .sub(local.copy(arrow.userData.nock).applyQuaternion(arrow.quaternion));
  arrow.updateWorldMatrix(true, true);
}
