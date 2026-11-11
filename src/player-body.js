export const playerHeight = (p) =>
  p.standData?.transformed ? 1.25 : p.swimming ? 0.6 : p.crouching ? 1.5 : 1.8;
export const playerEye = (p) =>
  p.standData?.transformed ? 1.1 : p.swimming ? 0.4 : p.crouching ? 1.35 : 1.62;
