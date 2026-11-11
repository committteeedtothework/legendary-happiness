import {World} from '../src/world.js';
import {B} from '../src/data.js';
import {fluid} from '../src/block-dynamics.js';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const results=[];
for(const [dimension,type]of [['overworld','water'],['overworld','lava'],['cinderwild','lava']]){
 const w=new World('Fluid benchmark',{},dimension);
 for(let x=4;x<=26;x++)for(let z=-11;z<=11;z++)w.set(x,199,z,B.stone);
 const chunks=w.chunks.size,times=[];let peakQueue=0,writes=0,peakWrites=0;
 const set=w.set.bind(w);w.set=(...args)=>{const changed=set(...args);if(changed)writes++;return changed;};
 w.set(15,205,0,B[type]);
 for(let i=0;i<480;i++){writes=0;const t=performance.now();w.simulate();times.push(performance.now()-t);peakQueue=Math.max(peakQueue,w.fluidQueue.size);peakWrites=Math.max(peakWrites,writes);}
 const cells=[...w.edits.values()].filter(id=>fluid(id)?.type===type).length;
 assert.ok(cells>20);assert.equal(w.chunks.size,chunks);
 w.set(15,205,0,B.air);
 for(let i=0;i<480;i++)w.simulate();
 assert.equal([...w.edits.values()].filter(id=>fluid(id)?.type===type).length,0);assert.equal(w.fluidQueue.size,0);
 const sorted=times.sort((a,b)=>a-b);results.push({dimension,type,activeFluidCells:cells,initialRawChunks:chunks,finalRawChunks:w.chunks.size,peakQueue,peakBlockWritesPerTick:peakWrites,p50TickMs:+sorted[240].toFixed(4),p95TickMs:+sorted[456].toFixed(4),drainsToZero:true,pendingAfterDrain:w.pending.length});
}
console.log(JSON.stringify({scope:'CPU-only fixed 480-tick spread/480-tick drain fixtures on Linux while software-rendered browser regressions run. Not FPS or a cross-device performance claim.',queueBudgetPerTick:400,results},null,2));
