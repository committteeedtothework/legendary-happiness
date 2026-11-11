// Geometry-only tests use a drawing stub. Browser tests verify real pixels.
export function mockCanvas() {
  const before = globalThis.document;
  globalThis.document = {
    createElement() {
      const c = {
        width: 16,
        height: 16,
        toDataURL: () => "data:image/png;base64,",
      };
      const context = new Proxy(
        {
          canvas: c,
          createImageData: (w, h) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
          getImageData: (x, y, w, h) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
        },
        {
          get(o, k) {
            return k in o ? o[k] : () => {};
          },
        },
      );
      c.getContext = () => context;
      return c;
    },
  };
  return () => {
    globalThis.document = before;
  };
}
