export function hasMovement(keys) {
  return (
    Number(keys.has("KeyW")) !== Number(keys.has("KeyS")) ||
    Number(keys.has("KeyA")) !== Number(keys.has("KeyD"))
  );
}

// Transient input state: never stored in a world save.
export class SprintInput {
  constructor() {
    this.reset();
  }
  reset() {
    this.latched = false;
    this.lastForwardTick = -Infinity;
  }
  pressForward(tick) {
    const gap = tick - this.lastForwardTick;
    if (this.latched || (gap >= 0 && gap < 7)) {
      this.latched = true;
      // Consume the gesture so stopping and pressing W once cannot restart it.
      this.lastForwardTick = -Infinity;
    } else this.lastForwardTick = tick;
  }
  stop() {
    this.latched = false;
  }
}
