import { Multiplayer } from "../src/multiplayer.js";
import { World } from "../src/world.js";
import { B, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { UI } from "../src/ui.js";
import { dropItem } from "../src/simulation.js";
export function fixture() {
  const world = new World("Co-op authority");
  for (let x = -5; x < 12; x++)
    for (let z = -8; z < 12; z++) world.set(x, 199, z, B.stone);
  const game = {
    world,
    active: true,
    id: "test",
    mode: "survival",
    dimension: "overworld",
    time: 14000,
    tickCount: 1,
    elapsed: 1,
    difficulty: "normal",
    spawn: { x: 0.5, y: 200, z: 4.5 },
    player: createPlayer({ x: 0.5, y: 200, z: 4.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    settings: { particles: "minimal" },
    chat: { announce() {} },
    renderer: { breakParticles() {}, pulseEffect() {} },
    save: async () => {},
    snapshot() {
      return {
        mode: this.mode,
        player: this.player,
        inventory: this.inventory.export(),
        coopPlayers: this.multiplayer.exportPlayers(),
      };
    },
    damage(n) {
      this.player.health = Math.max(0, this.player.health - n);
    },
    breakBlock(t) {
      this.world.set(t.x, t.y, t.z, B.air);
      dropItem(this, makeStack("log"), t.x + 0.5, t.y + 0.5, t.z + 0.5, 0);
    },
  };
  game.ui = Object.assign(Object.create(UI.prototype), {
    game,
    updateHotbar() {},
    updateHUD() {},
  });
  const session = (game.multiplayer = new Multiplayer(game));
  session.connected = true;
  session.id = "host";
  session.players = [{ id: "host", name: "Owner" }];
  session.send = (data) => {
    session.sent.push(structuredClone(data));
    return true;
  };
  session.sent = [];
  session.addPeer({ id: "guest", name: "Friend One" });
  const peer = session.peers.get("guest");
  Object.assign(peer.player, {
    x: 2.5,
    y: 200,
    z: 4.5,
    onGround: true,
    yaw: 0,
    pitch: 0,
  });
  peer.context.player = peer.player;
  return { game, session, peer };
}
