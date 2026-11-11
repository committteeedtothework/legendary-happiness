import * as THREE from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
const scratch = new THREE.Vector3(),
  matrix = new THREE.Matrix4();
// Build a convex outline once at equip. Sprite alpha participates, so clear
// texture padding cannot masquerade as a handle reaching the viewport edge.
export function cacheItemSilhouette(rig) {
  const points = [],
    unique = new Set();
  rig.root.updateMatrixWorld(true);
  const inverse = rig.wrist.matrixWorld.clone().invert();
  const add = (p) => {
    const key = p
      .toArray()
      .map((n) => Math.round(n * 1e6))
      .join(",");
    if (!unique.has(key)) {
      unique.add(key);
      points.push(p.clone());
    }
  };
  rig.wrist.traverseVisible((mesh) => {
    if (
      !mesh.geometry ||
      mesh.material?.transparent ||
      mesh.userData.magicGlint !== undefined
    )
      return;
    matrix.multiplyMatrices(inverse, mesh.matrixWorld);
    const image = mesh.material?.map?.image;
    let alphaUsed = false;
    if (
      mesh.geometry.type === "PlaneGeometry" &&
      mesh.material.alphaTest &&
      image?.getContext
    ) {
      const { width, height } = image;
      const pixels = image
        .getContext("2d")
        .getImageData(0, 0, width, height).data;
      const size = mesh.geometry.parameters;
      // Column endpoints alone contain the complete lower/upper convex outline.
      for (let x = 0; x < width; x++) {
        let top = height,
          bottom = -1;
        for (let y = 0; y < height; y++)
          if (pixels[(y * width + x) * 4 + 3] >= 128) {
            top = Math.min(top, y);
            bottom = y;
          }
        if (bottom < 0) continue;
        alphaUsed = true;
        for (const px of [x, x + 1])
          for (const py of [top, bottom + 1])
            add(
              scratch
                .set(
                  (px / width - 0.5) * size.width,
                  (0.5 - py / height) * size.height,
                  0,
                )
                .applyMatrix4(matrix),
            );
      }
    }
    if (!alphaUsed) {
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++)
        add(scratch.fromBufferAttribute(position, i).applyMatrix4(matrix));
    }
  });
  // True 3D convex support points bound frame work; coplanar sprites stay planar.
  let hullPoints = points;
  if (points.length >= 4) {
    let plane;
    for (let i = 2; i < points.length && !plane; i++) {
      const p = new THREE.Plane().setFromCoplanarPoints(
        points[0],
        points[1],
        points[i],
      );
      if (p.normal.lengthSq() > 0.5) plane = p;
    }
    if (
      plane &&
      points.some((p) => Math.abs(plane.distanceToPoint(p)) > 1e-6)
    ) {
      const hull = new ConvexHull().setFromPoints(points),
        set = new Set();
      hullPoints = [];
      for (const face of hull.faces) {
        let e = face.edge;
        do {
          const p = e.head().point;
          if (!set.has(p)) {
            set.add(p);
            hullPoints.push(p);
          }
          e = e.next;
        } while (e !== face.edge);
      }
    }
  }
  rig.itemSilhouette = hullPoints;
}
const BOTTOM = -1.035;
export function anchorHeldItem(rig, camera, horizontalLimit = 0.94) {
  if (rig.armVisuals.visible || !rig.itemSilhouette?.length) return;
  rig.root.updateMatrixWorld(true);
  camera.updateMatrixWorld();
  matrix.multiplyMatrices(camera.matrixWorldInverse, rig.wrist.matrixWorld);
  const f = camera.projectionMatrix.elements[5],
    fx = camera.projectionMatrix.elements[0];
  // Keep the actual object inside the horizontal viewport too. Otherwise its
  // lowest corner can be off-screen after a resize while the visible part
  // floats above the bottom. No arm geometry or placeholder enters this fit.
  let left = -Infinity,
    right = Infinity;
  for (const p of rig.itemSilhouette) {
    scratch.copy(p).applyMatrix4(matrix);
    if (scratch.z < 0) {
      left = Math.max(left, (-horizontalLimit * -scratch.z) / fx - scratch.x);
      right = Math.min(right, (horizontalLimit * -scratch.z) / fx - scratch.x);
    }
  }
  const horizontal =
    Number.isFinite(left) && Number.isFinite(right)
      ? left <= right
        ? Math.max(left, Math.min(right, 0))
        : (left + right) / 2
      : 0;
  let shift = -Infinity;
  for (const p of rig.itemSilhouette) {
    scratch.copy(p).applyMatrix4(matrix);
    if (scratch.z < 0)
      shift = Math.max(shift, (BOTTOM * -scratch.z) / f - scratch.y);
  }
  // Equip retains its rotation/depth motion, but never lowers the visible
  // object out of frame. Use and swing pivot around this same bottom edge.
  rig.itemBottomShift = Number.isFinite(shift) ? shift : 0;
  rig.itemSideShift = horizontal;
  if (!Number.isFinite(shift) || (shift === 0 && horizontal === 0)) return;
  scratch.set(horizontal, shift, 0).applyQuaternion(camera.quaternion);
  rig.root.position.add(scratch);
  rig.viewBounds.translate(scratch);
  rig.root.updateMatrixWorld(true);
}
