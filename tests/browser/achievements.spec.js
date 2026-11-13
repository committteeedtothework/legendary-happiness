import {test,expect} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";
const out=process.env.DCSMCRAFT_ACHIEVEMENT_ARTIFACTS || "test-results/achievements";mkdirSync(out,{recursive:true});
test.use({hasTouch:true});
async function start(page) {
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem("dcsmcraft-settings",JSON.stringify({graphics:1,renderDistance:2,distantTerrain:false,volume:0,musicEnabled:false,ambientSounds:false,frameLimit:30})));
 await page.goto("/");await page.waitForFunction(()=>window.dcsmcraft?.initialized);
 await page.locator('[data-action=create]').click();await page.locator('[name=seed]').fill('Wildflower');await page.locator('[name=mode][value=survival]').check();await page.locator('[data-action=start-world]').click();await page.waitForFunction(()=>dcsmcraft.running);
 await page.evaluate(()=>{dcsmcraft.pause();dcsmcraft.entities=[];});await page.waitForFunction(()=>!document.pointerLockElement);return errors;
}
test("achievements unlock through real craft and furnace transactions, save/reload, export, death and world isolation",async({page})=>{
 test.setTimeout(180000);const errors=await start(page);
 await page.evaluate(()=>dcsmcraft.openInventory("personal"));
 expect(await page.evaluate(()=>!!dcsmcraft.player.achievements.unlocked.taking_inventory)).toBe(true);
 await page.evaluate(async()=>{const g=dcsmcraft,{makeStack}=await import('/src/data.js');g.inventory.craft=[makeStack('planks'),makeStack('planks'),makeStack('planks'),makeStack('planks'),...Array(5).fill(null)];g.ui.refreshInventory();});
 await page.locator('.output-slot').click();
 expect(await page.evaluate(()=>!!dcsmcraft.player.achievements.unlocked.benchmaking)).toBe(true);
 await page.evaluate(async()=>{const g=dcsmcraft,{makeStack}=await import('/src/data.js');g.closeCraft();g.ui.openInventory('furnace',{type:'furnace',slots:[null,null,makeStack('iron_ingot')],xp:0},null);});
 await page.locator('[data-ref=container][data-index="2"]').click();
 expect(await page.evaluate(()=>!!dcsmcraft.player.achievements.unlocked.acquire_hardware)).toBe(true);
 await page.evaluate(async()=>{const g=dcsmcraft;g.closeCraft();g.pause();await g.save();});
 await expect(page.locator('#achievement-toast')).toBeHidden();
 await page.evaluate(()=>dcsmcraft.resume());
 await expect(page.locator('#achievement-toast')).toBeVisible();
 await expect(page.locator('#achievement-toast strong')).toHaveText('Taking Inventory');
 await page.screenshot({path:out+'/achievement-unlock.png'});
 await page.evaluate(()=>dcsmcraft.pause());await page.waitForFunction(()=>!document.pointerLockElement);
 await page.locator('[data-action=achievements]').click();await expect(page.locator('.achievement-card')).toHaveCount(71);
 await expect(page.locator('[data-achievement=benchmaking]')).toHaveClass(/unlocked/);await page.screenshot({path:out+'/achievements-desktop.png'});
 await page.locator('#achievement-search').fill('pistols');await expect(page.locator('.achievement-card')).toHaveCount(2);
 await page.locator('#achievement-search').fill('');await page.locator('[data-ach-filter=unlocked]').click();await expect(page.locator('.achievement-card.locked')).toHaveCount(0);
 const original=await page.evaluate(()=>({id:dcsmcraft.id,ledger:dcsmcraft.player.achievements}));
 await page.reload();await page.waitForFunction(()=>window.dcsmcraft?.initialized);await page.evaluate(async id=>{await dcsmcraft.loadWorld(id);dcsmcraft.pause();},original.id);
 expect(await page.evaluate(()=>dcsmcraft.player.achievements.unlocked.benchmaking)).toBe(original.ledger.unlocked.benchmaking);
 await page.evaluate(()=>{const g=dcsmcraft;g.player.health=0;g.respawn();g.pause();});expect(await page.evaluate(()=>!!dcsmcraft.player.achievements.unlocked.acquire_hardware)).toBe(true);
 await page.evaluate(async()=>{const g=dcsmcraft;const data=g.snapshot();window.__achievementBackup=JSON.parse(JSON.stringify(data));await g.save();});
 expect(await page.evaluate(()=>__achievementBackup.player.achievements.unlocked.benchmaking)).toBeTruthy();
 await page.evaluate(async()=>{await dcsmcraft.newWorld({name:'Separate world',seed:'Wildflower',mode:'survival',difficulty:'normal'});dcsmcraft.pause();});
 expect(await page.evaluate(()=>Object.keys(dcsmcraft.player.achievements?.unlocked || {}).length)).toBe(0);
 expect(errors).toEqual([]);writeFileSync(out+'/progression-report.json',JSON.stringify({savedId:original.id,unlocked:Object.keys(original.ledger.unlocked),errors},null,2));
});
test("older saves backfill inventory and proven Titan victories without fabricating crafting history",async({page})=>{
 test.setTimeout(150000);const errors=await start(page);
 const id=await page.evaluate(async()=>{const g=dcsmcraft,{makeStack}=await import('/src/data.js');const data=g.snapshot();delete data.player.achievements;data.inventory.slots[0]=makeStack('diamond');data.giganto.ledger=['old-giganto-win'];data.giganto.wyvern.ledger=['old-wyvern-win'];await g.store.save(data);return data.id;});
 await page.evaluate(async id=>{await dcsmcraft.loadWorld(id);dcsmcraft.pause();dcsmcraft.ui.achievements();},id);
 await expect(page.locator('[data-achievement=both_titans]')).toHaveClass(/unlocked/);
 await expect(page.locator('[data-achievement=benchmaking]')).toHaveClass(/locked/);
 // Owned items are observed during active play, then remain after moving away.
 await page.evaluate(()=>dcsmcraft.resume());await page.waitForFunction(()=>dcsmcraft.player.achievements?.unlocked.diamonds);await page.evaluate(()=>dcsmcraft.pause());
 expect(await page.evaluate(()=>dcsmcraft.inventory.slots[0].id)).toBe('diamond');expect(errors).toEqual([]);
});
test("achievement categories, search, touch layout and controller back remain usable at phone resolution",async({page})=>{
 test.setTimeout(150000);const errors=await start(page);
 await page.evaluate(()=>{window.pad={id:'Xbox Wireless Controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});});
 await page.locator('[data-action=achievements]').focus();
 await page.evaluate(()=>{pad.buttons[0]={pressed:true,value:1};dcsmcraft.controller.frame(1/30);pad.buttons[0]={pressed:false,value:0};dcsmcraft.controller.frame(1/30);});
 await expect(page.locator('.achievement-window')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-ach-category=titans]').tap();await expect(page.locator('.achievement-card')).toHaveCount(12);
 await page.screenshot({path:out+'/achievements-phone.png'});
 expect(await page.evaluate(()=>document.querySelector('.achievement-window').getBoundingClientRect().right<=innerWidth)).toBe(true);
 await page.evaluate(()=>{const g=dcsmcraft;for(let i=0;i<12;i++)g.controller.menu({buttons:{},move:{x:0,y:0},look:{x:0,y:1}},()=>false,1/30);});
 expect(await page.locator('.achievement-grid').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 await page.locator('#achievement-search').fill('cyloop');await expect(page.locator('.achievement-card')).toHaveCount(1);
 await page.evaluate(()=>dcsmcraft.controller.cancel());await expect(page.locator('[data-action=achievements]')).toBeVisible();
 expect(await page.evaluate(()=>dcsmcraft.running)).toBe(false);expect(errors).toEqual([]);
});
