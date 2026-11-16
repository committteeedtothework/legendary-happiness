import { worldInteractionSnapshot } from "./world-interactions.js";
export function sendRealmFrames(m, now, { cleanPose, poseFor }) {
  const owner = m.game;
  if (now >= (m.nextPrivate || 0)) {
    m.nextPrivate = now + 100;
    for (const p of m.peers.values()) m.sendPrivate(p);
  }
  if (now >= (m.nextState || 0)) {
    m.nextState = now + 250;
    m.realmEdits ||= new WeakMap();
    for (const dim of new Set(
      [...m.peers.values()].map((p) => p.dimension || owner.dimension),
    )) {
      const g = m.sharedRealm.contextFor(dim);
      let old = m.realmEdits.get(g.world);
      if (!old) {
        old = new Map();
        m.realmEdits.set(g.world, old);
      }
      const edits = [];
      for (const [key, id] of g.world.edits)
        if (old.get(key) !== id) {
          edits.push([key, id]);
          old.set(key, id);
        }
      const state = {
        dimension: dim,
        difficulty: owner.difficulty,
        titans: m.arena.publicRecords(),
        edits,
        time: owner.time,
        tickCount: owner.tickCount,
        worldTick: g.world.tick,
        blockTimers: g.world.blockTimers,
        aquatic: g.world.aquatic,
        palm: g.world.palm || null,
        protectedAreas: g.world.protectedAreas || [],
        endgame: g.world.endgame,
        rules: owner.rules,
        standProjectiles: g.standProjectiles || [],
        weather: g.world.weather,
        relicClaimed: g.world.relicClaimed,
        blockVisuals: worldInteractionSnapshot(g),
        entities: g.entities,
        drops: g.drops,
        hostileProjectiles: g.hostileProjectiles || [],
        embeddedArrows: g.world.embeddedArrows || [],
        settlements: g.world.settlements,
        pistolTraces: g.pistolTraces || [],
        seekers: (g.seekers || []).map((q) => ({ x: q.x, y: q.y, z: q.z })),
      };
      for (const p of m.peers.values())
        if ((p.dimension || owner.dimension) === dim)
          m.send({
            type: "state",
            to: p.id,
            state: { ...state, realmEpoch: p.realmEpoch },
          });
    }
  }
  if (now >= (m.nextPoses || 0)) {
    m.nextPoses = now + 100;
    const players = [
      {
        id: m.id,
        name: m.players.find((p) => p.id === m.id)?.name || "Host",
        ...cleanPose(poseFor(owner)),
      },
      ...[...m.peers.values()].map((p) => ({
        id: p.id,
        name: p.name,
        ...cleanPose({
          ...p.player,
          dimension: p.dimension,
          visualAction: p.visualAction
            ? {
                ...p.visualAction,
                age: Math.max(0, owner.elapsed - p.visualAction.started),
              }
            : null,
          skin: p.skin,
          held: p.inventory.held?.id,
          equipment: p.inventory.equipment.map((s) => s?.id),
        }),
      })),
    ];
    m.send({ type: "poses", players });
    m.remotePoses = players;
  }
}
