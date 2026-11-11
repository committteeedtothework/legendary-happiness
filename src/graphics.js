// Every exposed setting is consumed by the renderer, mesher or frame scheduler.
export const VIDEO_GROUPS = [
  [
    "Display & performance",
    "Resolution and view distance have the largest performance cost.",
    [
      ["graphics", "Resolution scale", 1, 5, 1],
      ["renderDistance", "Render distance", 2, 24, 1],
      [
        "frameLimit",
        "Max Framerate",
        [
          [0, "Unlimited"],
          [30, "30 FPS"],
          [60, "60 FPS"],
          [120, "120 FPS"],
          [144, "144 FPS"],
        ],
      ],
      ["entityDistance", "Entity Distance", 0.5, 1.5, 0.25],
      [
        "maxPixelRatio",
        "High-DPI Limit",
        [
          [1, "1×"],
          [1.5, "1.5×"],
          [2, "2×"],
        ],
      ],
      [
        "menuFrameLimit",
        "Menu Framerate",
        [
          [15, "15 FPS"],
          [30, "30 FPS"],
          [60, "60 FPS"],
          [0, "Match gameplay"],
        ],
      ],
      ["droppedItemDistance", "Dropped Item Distance", 0.25, 1.5, 0.25],
      ["blockEntityDistance", "Animated Block Distance", 16, 128, 16],
      [
        "distantDetail",
        "Distant Terrain Detail",
        [
          [8, "Fast"],
          [4, "Balanced"],
          [2, "Detailed"],
        ],
      ],
      [
        "particles",
        "Particles",
        [
          ["all", "All"],
          ["decreased", "Decreased"],
          ["minimal", "Minimal"],
        ],
      ],
      ["distantTerrain", "Extended Terrain"],
      ["showFPS", "Show FPS"],
    ],
  ],
  [
    "Lighting",
    "Smooth Lighting shades block corners. Sun Shadows is an optional local shadow map; Entity Shadows casts creature shadows when it is enabled.",
    [
      ["ambientOcclusion", "Smooth Lighting / AO"],
      ["shadows", "Sun Shadows"],
      ["entityShadows", "Entity Shadows"],
      [
        "shadowResolution",
        "Shadow Resolution",
        [
          [512, "512 — Fast"],
          [1024, "1024 — Balanced"],
          [2048, "2048 — Detailed"],
        ],
      ],
      [
        "shadowDistance",
        "Shadow Coverage",
        [
          [32, "32 blocks"],
          [64, "64 blocks"],
          [96, "96 blocks"],
        ],
      ],
      [
        "shadowFilter",
        "Shadow Filtering",
        [
          ["hard", "Hard — Fast"],
          ["soft", "Soft"],
        ],
      ],
      [
        "localLightCount",
        "Carried Item Light",
        [
          [0, "Off"],
          [2, "Soft"],
          [4, "Bright"],
        ],
      ],
      ["lightFlicker", "Light Flicker"],
      ["brightness", "Brightness", 0, 1, 0.05],
    ],
  ],
  [
    "World detail",
    "Texture packs change artwork without changing your world or menus. Mipmaps reduce distant texture shimmer.",
    [
      [
        "texturePack",
        "Texture Pack",
        [
          ["renewed", "Renewed — sculpted pixel art"],
          ["soft", "Soft — v1.0 artwork"],
          ["classic", "Classic — v0.5 artwork"],
          ["supplied", "Supplied Assets — Minecraft textures"],
        ],
      ],
      ["mipmapLevels", "Mipmap Levels", 0, 4, 1],
      [
        "anisotropy",
        "Anisotropic Filtering",
        [
          [1, "1× — Fast"],
          [2, "2×"],
          [4, "4×"],
          [8, "8×"],
          [16, "16×"],
        ],
      ],
      ["biomeColors", "Biome Colors"],
      ["biomeBlend", "Biome Blend", 0, 4, 1],
      ["fancyGraphics", "Fancy Graphics"],
      ["clouds", "Clouds"],
      ["cloudHeight", "Cloud Height", 96, 256, 16],
      ["stars", "Stars"],
      ["animatedTextures", "Animated Textures"],
      ["entityAnimations", "Creature Animations"],
      ["droppedItemAnimation", "Dropped Item Animation"],
      ["sunMoon", "Sun & Moon"],
      ["weatherEffects", "Rain, Snow & Hail"],
      ["lightningFlashes", "Lightning Flashes"],
      ["fog", "Distance Fog"],
    ],
  ],
  [
    "Camera",
    "View Bobbing controls camera and hand movement while walking. Combat animations remain active.",
    [
      ["viewBobbing", "View Bobbing"],
      ["dynamicFOV", "FOV Effects"],
      ["damageTilt", "Damage Tilt"],
    ],
  ],
];
export const VIDEO_CHOICES = Object.fromEntries(
  VIDEO_GROUPS.flatMap((g) => g[2])
    .filter((f) => Array.isArray(f[2]))
    .map((f) => [f[0], f[2]]),
);
export function frameDue(now, last, limit) {
  return !limit || last === undefined || now - last >= 1000 / limit - 0.5;
}
export function effectiveFrameLimit(settings, screen) {
  const game = settings.frameLimit || 0,
    menu = settings.menuFrameLimit ?? 30;
  if (screen === "play" || !menu) return game;
  return game ? Math.min(game, menu) : menu;
}
// Presets touch only visual preferences, never worlds, audio, controls or skins.
export const GRAPHICS_PRESETS = {
  fast: {
    graphics: 1,
    renderDistance: 6,
    maxPixelRatio: 1,
    frameLimit: 60,
    menuFrameLimit: 15,
    entityDistance: 0.75,
    droppedItemDistance: 0.5,
    blockEntityDistance: 32,
    distantDetail: 8,
    particles: "minimal",
    shadows: false,
    shadowResolution: 512,
    shadowDistance: 32,
    shadowFilter: "hard",
    localLightCount: 0,
    lightFlicker: false,
    anisotropy: 1,
    clouds: false,
    ambientOcclusion: false,
    mipmapLevels: 2,
  },
  balanced: {
    graphics: 3,
    renderDistance: 8,
    maxPixelRatio: 1.5,
    frameLimit: 60,
    menuFrameLimit: 30,
    entityDistance: 1,
    droppedItemDistance: 0.75,
    blockEntityDistance: 64,
    distantDetail: 4,
    particles: "decreased",
    shadows: false,
    shadowResolution: 1024,
    shadowDistance: 64,
    shadowFilter: "soft",
    localLightCount: 2,
    lightFlicker: true,
    anisotropy: 4,
    clouds: true,
    ambientOcclusion: true,
    mipmapLevels: 4,
  },
  detailed: {
    graphics: 4,
    renderDistance: 16,
    maxPixelRatio: 2,
    frameLimit: 0,
    menuFrameLimit: 30,
    entityDistance: 1.5,
    droppedItemDistance: 1.5,
    blockEntityDistance: 128,
    distantDetail: 2,
    particles: "all",
    shadows: true,
    shadowResolution: 2048,
    shadowDistance: 96,
    shadowFilter: "soft",
    localLightCount: 4,
    lightFlicker: true,
    anisotropy: 8,
    clouds: true,
    ambientOcclusion: true,
    mipmapLevels: 4,
  },
};
export function applyGraphicsPreset(settings, name) {
  const preset = GRAPHICS_PRESETS[name];
  if (!preset) return false;
  Object.assign(settings, preset, {
    fancyGraphics: true,
    distantTerrain: true,
  });
  return true;
}
export function easeAngle(current, target, amount) {
  return (
    current +
    Math.atan2(Math.sin(target - current), Math.cos(target - current)) * amount
  );
}
export function particleCount(settings, normal) {
  return settings.particles === "minimal"
    ? 0
    : settings.particles === "decreased"
      ? Math.ceil(normal / 3)
      : normal;
}
