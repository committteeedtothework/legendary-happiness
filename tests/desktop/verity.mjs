import {_electron} from 'playwright';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {B} from '../../src/data.js';

const out=process.env.DCSMCRAFT_DESKTOP_ARTIFACTS||'test-results/desktop-verity';mkdirSync(out,{recursive:true});
const profile=mkdtempSync(join(tmpdir(),'dcsmcraft-verity-native-')),errors=[],external=[];
const app=await _electron.launch({executablePath:resolve('dist/electron/linux-unpacked/electron'),args:['--no-sandbox','--disable-background-networking','--proxy-server=http://127.0.0.1:9','--ozone-platform=headless','--use-angle=swiftshader','--enable-unsafe-swiftshader'],env:{...process.env,DCSMCRAFT_USER_DATA:profile,XDG_CACHE_HOME:profile+'/cache'},timeout:30000});
try{
 const page=await app.firstWindow();await page.setViewportSize({width:1280,height:800});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:|^wss?:/.test(r.url()))external.push(r.url());});
 await page.waitForFunction(()=>window.dcsmcraft?.initialized,null,{timeout:60000});
 await page.evaluate(()=>{Object.assign(dcsmcraft.settings,{graphics:1,renderDistance:2,frameLimit:20,volume:.2,musicVolume:.5,musicEnabled:true,ambientSounds:false,verityMusic:'supplied'});dcsmcraft.renderer.applyGraphics();});
 await page.locator('[data-action=create]').click();await page.locator('[name=difficulty]').selectOption('peaceful');await page.locator('[data-action=start-world]').click();await page.waitForFunction(()=>dcsmcraft.active);
 await page.waitForTimeout(400);
 const world=await page.evaluate(B=>{
  const g=dcsmcraft;g.entities=[];g.drops=[];g.time=6000;
  for(let x=-12;x<=12;x++)for(let z=-12;z<=12;z++){g.world.set(x,149,z,B.grass);for(let y=150;y<157;y++)g.world.set(x,y,z,B.air);}
  Object.assign(g.player,{x:.5,y:150,z:3.5,yaw:0,pitch:0,vx:0,vy:0,vz:0,onGround:true,health:20,fallStart:150});g.rules.doMobSpawning=true;
  g.world.settlements['lord-verity']={version:1,next:0,visits:0};return g.id;
 },B);

 await page.waitForFunction(()=>dcsmcraft.player.verityDance?.phase==='dance',null,{timeout:10000});
 console.log('Native state',await page.evaluate(()=>({dimension:dcsmcraft.dimension,active:dcsmcraft.active,giganto:dcsmcraft.giganto.active,model:!!dcsmcraft.renderer.verityVisuals.model,loading:dcsmcraft.renderer.verityVisuals.loading,error:dcsmcraft.renderer.verityVisuals.error,record:dcsmcraft.renderer.verityVisuals.record,worldRecord:dcsmcraft.world.settlements['lord-verity']})));
 await page.waitForFunction(()=>dcsmcraft.renderer.verityVisuals.model,null,{timeout:10000});
 await page.waitForFunction(()=>dcsmcraft.verity.music.buffered&&dcsmcraft.verity.music.media&&!dcsmcraft.verity.music.media.paused);
 assert.equal(await page.evaluate(()=>dcsmcraft.verity.music.media.offset),0);
 await page.waitForTimeout(400);await page.screenshot({path:out+'/native-lord-verity.png',timeout:90000});
 const before=await page.evaluate(()=>({x:dcsmcraft.player.x,y:dcsmcraft.player.y,z:dcsmcraft.player.z,id:dcsmcraft.player.verityDance.id,camera:dcsmcraft.cameraMode,clip:dcsmcraft.renderer.verityVisuals.clip}));assert.equal(before.clip,'VerityDance');
 await page.evaluate(()=>{const g=dcsmcraft;g.world.settlements['lord-verity'].active.age=80;g.player.verityDance.time=77.6;g.pause();});await page.locator('[data-action=quit]').click();await page.waitForFunction(()=>!dcsmcraft.active&&dcsmcraft.ui.screen==='title');
 assert.equal(await page.evaluate(()=>dcsmcraft.renderer.verityVisuals.root.visible),false);
 await page.evaluate(id=>dcsmcraft.loadWorld(id),world);await page.waitForFunction(()=>dcsmcraft.active&&dcsmcraft.player.verityDance?.phase==='dance');
 assert.equal(await page.evaluate(()=>dcsmcraft.player.verityDance.id),before.id);
 await page.waitForFunction(()=>dcsmcraft.verity.music.media&&!dcsmcraft.verity.music.media.paused);
 assert.ok(await page.evaluate(()=>dcsmcraft.verity.music.media.offset>=80));
 await page.evaluate(()=>{dcsmcraft.world.settlements['lord-verity'].active.age=2.4+256*60/112-.1;});
 await page.waitForFunction(()=>!dcsmcraft.player.verityDance&&dcsmcraft.verity.music.state==='idle',null,{timeout:45000});
 const after=await page.evaluate(()=>({x:dcsmcraft.player.x,y:dcsmcraft.player.y,z:dcsmcraft.player.z,camera:dcsmcraft.cameraMode,music:dcsmcraft.verity.music.state}));
 assert.equal(after.x,before.x);assert.equal(after.z,before.z);assert.equal(after.camera,before.camera);assert.equal(after.music,'idle');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(out+'/verity-native.json',JSON.stringify({runtime:'Electron 45.3.0 '+process.platform,nativeWindowsExecutionTested:false,networkBlocked:true,saveAndResumeDuringEncounter:true,suppliedAudioDecodedOffline:true,freshSongOffset:0,restoredSongOffsetAtLeast:80,stagedEnding:true,before,after,errors,external},null,2));
 console.log('Packaged Lord Verity asset, dance, mid-encounter save/reload, camera/control restoration and offline cleanup passed.');
}catch(error){
 const page=await app.firstWindow();
 try{const state=await page.evaluate(()=>({running:dcsmcraft.running,screen:dcsmcraft.ui.screen,player:dcsmcraft.player,record:dcsmcraft.world.settlements?.['lord-verity'],tick:dcsmcraft.world.tick,modelError:dcsmcraft.renderer.verityVisuals.error,errors:[]}));writeFileSync(out+'/failure.json',JSON.stringify({message:error.message,state,errors,external},null,2));await page.screenshot({path:out+'/failure.png',timeout:30000});}catch{}
 throw error;
}finally{await app.close();}
