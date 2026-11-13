import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_BY_ID } from "../src/achievement-data.js";
import { achievementState, restoreAchievements, recordAchievement, scanAchievements, pollAchievements, recordTitanAchievement, preserveAchievements, restoreTitanAchievements, syncAchievements } from "../src/achievements.js";
import { B, ITEMS, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { UI } from "../src/ui.js";
import { createPlayer } from "../src/physics.js";
import { pack, unpack } from "../src/storage.js";
import { peerContext, peerSave, respawnPeer } from "../src/coop-survival.js";
import { tradeWithVillager } from "../src/ecology.js";
const fixture = (mode="survival") => ({active:true,mode,player:createPlayer({x:0,y:200,z:0}),inventory:new Inventory(),multiplayer:{isGuest:false},audio:{tone(){}},ui:{unlocks:[],achievementUnlocked(e){this.unlocks.push(e.id);},updateHotbar(){}}});
const unlocked=(g,id)=>!!achievementState(g.player).unlocked[id];
test("all 71 achievements have real icons, valid item requirements, unique IDs and reachable event routes",()=>{
 assert.equal(ACHIEVEMENTS.length,71);assert.equal(ACHIEVEMENT_BY_ID.size,71);
 const events=new Set(["inventory","inventory-open","craft","smelt-take","plant","place","enchant","hostile-kill","sleep","trade","biome","dimension","aquatic","claim","pulse","stand-awaken","stand-level","titan-stage","titan-emerald","titan-transform","titan-parry","titan-perfect","titan-hit","titan-ring","titan-victory","end-event","end-crystal"]);
 for(const e of ACHIEVEMENTS){assert(ITEMS[e.icon],e.id);assert(ACHIEVEMENT_CATEGORIES.some(([id])=>id===e.category));assert(e.description&&e.target>0);for(const r of e.rules){assert(events.has(r.event),r.event);for(const id of r.items||[])assert(ITEMS[id],id);}}
});
test("legacy saves start empty, safe owned goals backfill, event history is never invented",()=>{
 const g=fixture();g.inventory.add(makeStack("log"));g.inventory.add(makeStack("iron_ingot"));scanAchievements(g);
 assert(unlocked(g,"getting_wood"));assert(!unlocked(g,"acquire_hardware"));assert(!unlocked(g,"benchmaking"));scanAchievements(g);assert.equal(g.ui.unlocks.filter(x=>x==="getting_wood").length,1);
});
test("all carried slots, worn armor and cursor count without needing to re-acquire old equipment",()=>{
 const g=fixture();["helmet","chestplate","leggings","boots"].forEach((id,i)=>g.inventory.equipment[i]=makeStack("diamond_"+id));g.inventory.cursor=makeStack("diamond");g.inventory.offhand[0]=makeStack("obsidian");scanAchievements(g);
 for(const id of ["diamond_armor","diamonds","ice_bucket"])assert(unlocked(g,id));g.inventory.equipment[0]=null;scanAchievements(g);assert(unlocked(g,"diamond_armor"));
});
test("Creative catalog inventory cannot unlock Survival ownership/crafting; genuine relic claims and Titan goals remain available",()=>{
 const g=fixture("creative");for(const id of ["log","diamond","devin_sword","matthew_dual_pistols"])g.inventory.add(makeStack(id));scanAchievements(g);recordAchievement(g,"craft",{item:"crafting_table"});assert.deepEqual(g.ui.unlocks,[]);
 recordAchievement(g,"claim",{item:"devin_sword"});assert(unlocked(g,"devin_sword"));assert(!unlocked(g,"matthew_pistols"));recordTitanAchievement(g,{id:"a"},{type:"parry",perfect:true,eventId:"a:1"});assert(unlocked(g,"perfect_parry"));
});
test("crafting only commits after the existing inventory transaction succeeds, including craft-all rollback",()=>{
 const g=fixture(),ui={game:g,craftSize:2,invType:"personal",refreshInventory(){}};
 g.inventory.craft=[makeStack("planks"),makeStack("planks"),makeStack("planks"),makeStack("planks"),...Array(5).fill(null)];UI.prototype.craft.call(ui);assert(unlocked(g,"benchmaking"));
 const full=fixture();full.inventory.slots.fill(makeStack("stone",64));full.inventory.craft=[makeStack("planks"),makeStack("planks"),makeStack("planks"),makeStack("planks"),...Array(5).fill(null)];
 UI.prototype.craft.call({...ui,game:full},true);assert(!unlocked(full,"benchmaking"));assert.equal(full.inventory.craft[0].count,1);assert.equal(full.inventory.cursor,null);
 const fail=fixture();UI.prototype.craft.call({...ui,game:fail});assert(!unlocked(fail,"benchmaking"));
});
test("MOAR Tools counts five distinct actual recipes, not repeated crafting or inventory shuffling",()=>{
 const g=fixture();for(let i=0;i<9;i++)recordAchievement(g,"craft",{item:"wooden_pickaxe"});assert.equal(achievementState(g.player).progress.moar_tools,1);
 for(const item of ["wooden_axe","wooden_shovel","wooden_hoe","wooden_sword"])recordAchievement(g,"craft",{item});assert(unlocked(g,"moar_tools"));
});
const furnaceUI=g=>({game:g,invType:"furnace",container:{slots:[null,null,makeStack("iron_ingot",3)],xp:0},refreshInventory(){},dragVisited:new Set()});
const slot={dataset:{ref:"container",index:"2"}};
test("furnace achievement requires actual output collection; full bags and incompatible cursors do not count",()=>{
 const g=fixture(),ui=furnaceUI(g);g.inventory.slots.fill(makeStack("stone",64));UI.prototype.slotClick.call(ui,slot,{button:0,shiftKey:true});assert(!unlocked(g,"acquire_hardware"));assert.equal(ui.container.slots[2].count,3);
 g.inventory.cursor=makeStack("diamond");UI.prototype.slotClick.call(ui,slot,{button:0});assert(!unlocked(g,"acquire_hardware"));
 g.inventory.cursor=null;UI.prototype.slotClick.call(ui,slot,{button:2});assert(unlocked(g,"acquire_hardware"));assert.equal(g.inventory.cursor.count,2);assert.equal(ui.container.slots[2].count,1);
 UI.prototype.slotClick.call(ui,slot,{button:0});assert.equal(g.ui.unlocks.filter(x=>x==="acquire_hardware").length,1);
});
test("failed trades do not award success and ordinary possession never awards Enchanter",()=>{
 const g=fixture();assert(!tradeWithVillager(g,null,0).ok);assert(!unlocked(g,"what_a_deal"));g.inventory.add({...makeStack("iron_sword"),enchantments:{sharpness:1}});scanAchievements(g);assert(!unlocked(g,"enchanter"));
 recordAchievement(g,"enchant");assert(unlocked(g,"enchanter"));
});
test("counters clamp to goals and only distinct biomes advance exploration",()=>{
 const g=fixture();for(let i=0;i<100;i++)recordAchievement(g,"biome",{key:"meadow"});assert.equal(achievementState(g.player).progress.trailblazer,1);
 for(const key of ["woodland","jungle","desert","alpine"])recordAchievement(g,"biome",{key});assert(unlocked(g,"trailblazer"));recordAchievement(g,"place",{count:-100});assert(!achievementState(g.player).progress.builder);recordAchievement(g,"place",{count:1e12});assert.equal(achievementState(g.player).progress.builder,128);
});
test("Title screens, dead players and guests cannot manufacture authoritative progress",()=>{
 for(const change of [g=>g.active=false,g=>g.player.health=0,g=>g.multiplayer.isGuest=true]){const g=fixture();change(g);recordAchievement(g,"claim",{item:"devin_sword"});assert(!unlocked(g,"devin_sword"));}
});
test("progress survives atomic envelopes, death player replacement, and repeated serialization without duplicate notifications",()=>{
 const g=fixture();recordAchievement(g,"place",{count:27});recordAchievement(g,"craft",{item:"crafting_table"});const data=unpack(pack({player:g.player}));const next=preserveAchievements(data.player,createPlayer({x:5,y:201,z:7}));assert.equal(next.x,5);assert.equal(achievementState(next).progress.builder,27);assert(achievementState(next).unlocked.benchmaking);
 const restored=fixture();restored.player=next;recordAchievement(restored,"craft",{item:"crafting_table"});assert.deepEqual(restored.ui.unlocks,[]);
});
test("arena restoration carries current progress instead of the stale entry snapshot, preserving other player fields",()=>{
 const g=fixture();const entry=structuredClone(g.player);recordTitanAchievement(g,{titan:"giganto",won:true},{type:"stage",stage:"victory",eventId:"g:v"});const p=preserveAchievements(g.player,structuredClone(entry));assert(achievementState(p).unlocked.giganto_victory);assert.equal(p.health,entry.health);assert.equal(p.x,entry.x);assert.equal(entry.achievements,undefined);
});
test("malformed saved ledgers are bounded and unknown entries cannot inject unlocks",()=>{
 const s=restoreAchievements({unlocked:{diamonds:1,evil:2,suit_up:-3},progress:{builder:1e100,evil:Infinity},seen:{trailblazer:[...Array(999).fill("meadow"),"<script>",null,12]}});
 assert.deepEqual(Object.keys(s.unlocked),["diamonds"]);assert.equal(s.progress.builder,128);assert.deepEqual(s.seen.trailblazer,["meadow"]);assert.equal(restoreAchievements(null).version,1);assert.equal(restoreAchievements([]).version,1);
});
test("replayed Titan event IDs count once; failed/zero-damage attacks do not unlock contact goals",()=>{
 const g=fixture("creative"),s={titan:"wyvern",won:false};const ring={type:"ring",count:5,eventId:"w:1"};recordTitanAchievement(g,s,ring);recordTitanAchievement(g,s,ring);assert.equal(achievementState(g.player).progress.ring_collector,5);
 recordTitanAchievement(g,s,{type:"attack-start",kind:"homing",eventId:"w:2"});recordTitanAchievement(g,s,{type:"hit",amount:0,kind:"homing",eventId:"w:3"});assert(!unlocked(g,"titan_homing"));recordTitanAchievement(g,s,{type:"hit",amount:14,kind:"homing",eventId:"w:4"});assert(unlocked(g,"titan_homing"));
 recordTitanAchievement(g,s,{type:"stage",stage:"victory",eventId:"w:5"});assert(!unlocked(g,"wyvern_victory"));s.won=true;recordTitanAchievement(g,s,{type:"stage",stage:"victory",eventId:"w:6"});assert(unlocked(g,"wyvern_victory"));
 recordTitanAchievement(g,{titan:"giganto",won:true},{type:"stage",stage:"victory",eventId:"g:6"});assert(unlocked(g,"both_titans"));assert.equal(achievementState(g.player).progress.both_titans,2);
});
test("Cyloop checks real damage contact and perfect parry requires its timing flag",()=>{
 const g=fixture();recordTitanAchievement(g,{},{type:"parry",eventId:"g:1"});assert(unlocked(g,"titan_parry"));assert(!unlocked(g,"perfect_parry"));recordTitanAchievement(g,{},{type:"hit",amount:50,kind:"loop",eventId:"g:2"});assert(unlocked(g,"titan_cyloop"));
});
test("existing Titan victory ledgers backfill both bosses but failures and merely entered arenas do not",()=>{
 const g=fixture();restoreTitanAchievements(g,{used:["a"],session:{stage:"defeat",won:false},wyvern:{ledger:[]}});assert(!unlocked(g,"giganto_victory"));restoreTitanAchievements(g,{ledger:["g:old"],wyvern:{ledger:["w:old"]}});assert(unlocked(g,"both_titans"));
});
test("co-op progress belongs to the authoritative peer, persists on resume and survives peer respawn",()=>{
 const host=fixture();host.settings={};host.world={findSpawn:()=>({x:0,y:200,z:0}),solid:()=>false};host.entities=[];host.drops=[];host.renderer={};host.save=()=>Promise.resolve();
 const session={game:host,occupants:()=>[]};const peer={player:createPlayer({x:0,y:200,z:0}),inventory:new Inventory(),spawn:{x:0,y:200,z:0}};peer.context=peerContext(session,peer);
 recordAchievement(peer.context,"craft",{item:"crafting_table"});assert(unlocked(peer.context,"benchmaking"));assert(!unlocked(host,"benchmaking"));assert(peerSave(peer).player.achievements.unlocked.benchmaking);
 peer.player.health=0;respawnPeer(session,peer);assert(peer.player.achievements.unlocked.benchmaking);assert(!unlocked(host,"benchmaking"));
});
test("authoritative guest synchronization notifies only newly unlocked entries and an initial welcome stays silent",()=>{
 const source=fixture();recordAchievement(source,"craft",{item:"crafting_table"});const guest=fixture();guest.multiplayer.isGuest=true;syncAchievements(guest,source.player.achievements,true);assert.deepEqual(guest.ui.unlocks,[]);recordAchievement(source,"hostile-kill");syncAchievements(guest,source.player.achievements);syncAchievements(guest,source.player.achievements);assert.deepEqual(guest.ui.unlocks,["monster_hunter"]);
});
test("achievement observation is bounded to two scans per second and does not run while paused or in a Titan simulation",()=>{
 const g=fixture();g.running=true;let samples=0;g.world={terrain:()=>{samples++;return {biome:"meadow"};}};
 for(let i=0;i<120;i++)pollAchievements(g,1/60);assert(samples>=3&&samples<=4,samples);g.running=false;for(let i=0;i<120;i++)pollAchievements(g,1/60);const paused=samples;g.running=true;g.giganto={active:true};pollAchievements(g,1);assert.equal(samples,paused);
});
