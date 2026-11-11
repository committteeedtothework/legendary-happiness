import * as THREE from "three";
// Six isolated face rectangles, measured in source pixels. UV crops let rigid
// elbow sections share a continuous arm texture without stretching/repetition.
export function faceTexture([w, h, d], paint, metadata = {}) {
  const widths = [d, d, w, w, w, w],
    width = widths.reduce((a, b) => a + b, 0),
    height = Math.max(h, d),
    data = new Uint8Array(width * height * 4),
    rects = [];
  let offset = 0;
  widths.forEach((fw, face) => {
    const fh = face === 2 || face === 3 ? d : h;
    rects.push([offset, 0, fw, fh]);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const hex = paint(face, x, y, fw, fh);
        if (!hex) continue;
        const n = parseInt(hex.slice(1), 16),
          i = ((height - 1 - y) * width + offset + x) * 4;
        data.set([n >> 16, (n >> 8) & 255, n & 255, 255], i);
      }
    offset += fw;
  });
  const map = new THREE.DataTexture(data, width, height);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.needsUpdate = true;
  map.userData = { ...metadata, rects, dimensions: [w, h, d] };
  return map;
}
export function faceBoxGeometry(size, texture, range) {
  const geometry = new THREE.BoxGeometry(...size),
    uv = geometry.attributes.uv,
    { width, height } = texture.image;
  texture.userData.rects.forEach(([x, y, w, h], face) => {
    const crop = range && ![2, 3].includes(face) ? range : [0, h];
    for (let i = face * 4; i < face * 4 + 4; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      uv.setXY(
        i,
        (x + 0.01 + u * (w - 0.02)) / width,
        1 -
          (y + crop[0] + 0.01 + (1 - v) * (crop[1] - crop[0] - 0.02)) / height,
      );
    }
  });
  return geometry;
}
export function pixelShade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  return (
    "#" +
    [n >> 16, (n >> 8) & 255, n & 255]
      .map((x) =>
        Math.min(255, Math.round(x * factor))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
