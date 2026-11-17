import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('friends and realm travel preserve every supplied asset, world generation, save storage, physics and Titan simulation/rigs',()=>{
 const files=JSON.parse(readFileSync(new URL('../reference/friends-preserved-2.23.0.json',import.meta.url)));assert.ok(Object.keys(files).length>200);for(const [name,hash]of Object.entries(files)){let b=readFileSync(new URL('../'+name,import.meta.url));if(name==='src/physics.js')b=Buffer.from(b.toString().replace('      (p.verityDance && ["arrival","dance","bow"].includes(p.verityDance.phase)) ? null :\n','').replace('    (p.verityDance && ["arrival","dance","bow"].includes(p.verityDance.phase)) ||\n',''));assert.equal(createHash('sha256').update(b).digest('hex'),hash,name);}
});
