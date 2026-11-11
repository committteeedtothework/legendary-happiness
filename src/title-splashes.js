// Pick a fresh line whenever the title opens, without repeating the last one.
export const TITLE_SPLASHES = Object.freeze([
  "Devin is a bald c**k",
  "Matthew's a hunk",
  "Just two guys with a big dream",
  "The Devin Sword is worth the fight!",
  "Two pistols. One legendary adventure.",
  "Cinderworld is calling!",
  "The Guardians aren't giving up!",
  "Never trust a quiet cave...",
  "The Watcher saw you first!",
  "A boat, an ocean, a new adventure!",
  "Build a home before the sun goes down!",
  "Your next adventure starts with a block!",
  "Mind the creeper behind you!",
  "Dirt armor: better than a brave face!",
  "Even heroes start with wooden tools!",
  "The village golem has your back!",
  "Bring a torch. Bring a friend.",
  "Big loot. Bigger trouble.",
  "Keep your diamonds close!",
  "One more chunk, then bedtime!",
  "Storm coming? Better build a roof!",
  "Craft a little. Explore a lot.",
  "Your world. Your wonderfully bad ideas.",
  "Adventure looks good on you!",
]);

export function nextTitleSplash(previous) {
  const candidates = TITLE_SPLASHES.filter((line) => line !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
