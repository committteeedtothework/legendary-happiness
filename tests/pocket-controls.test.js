import test from "node:test";
import assert from "node:assert/strict";
import {pocketConfig, pocketStick, pocketDpad, pocketWorldMoves} from "../src/pocket-controls-data.js";
test("mobile control settings validate stored values and preserve independent layout choices", () => {
  assert.deepEqual(pocketConfig({layout:"bad",size:100,sprint:false,floating:true}),
    {layout:"joystick",size:1.3,sprint:false,toggleCrouch:true,floating:true,leftHanded:false});
  assert.equal(pocketConfig({layout:"dpad",size:-1}).size,0.85);
  assert.deepEqual(pocketConfig(null),pocketConfig());
});
test("mobile stick separates walk from beyond-edge sprint, cancels on return, and bounds diagonals", () => {
  assert.deepEqual(pocketStick(1,1,50), {x:0,y:0,sprint:false});
  assert.equal(pocketStick(0,-49,50).sprint,false);
  assert.equal(pocketStick(0,-60,50).sprint,true);
  assert.equal(pocketStick(0,-60,50,false).sprint,false);
  const v=pocketStick(100,-100,50);
  assert.ok(Math.abs(Math.hypot(v.x,v.y)-1)<1e-10);
  assert.equal(v.sprint,false);
  assert.deepEqual(pocketDpad(0,0,60),{x:0,y:0});
  assert.deepEqual(pocketDpad(0,-55,60),{x:0,y:-1});
  const diagonal=pocketDpad(50,-50,60);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-10);
});
test("mobile moves retain weapon abilities and configured Stand bindings without changing combat", () => {
  const g={inventory:{held:{id:"matthew_dual_pistols"}},player:{},settings:{standKeys:{info:"KeyU",light:"KeyY"}}};
  assert.deepEqual(pocketWorldMoves(g),[["weapon","Air Trick"],["stand:KeyU","Stand"]]);
  g.inventory.held.id="devin_sword";g.player.standData={id:"test"};
  assert.deepEqual(pocketWorldMoves(g),[["weapon","Seeker"],["stand:KeyU","Stand"],["stand:KeyY","light"]]);
  g.inventory.held=null;
  assert.equal(pocketWorldMoves(g).some(([id])=>id==="weapon"),false);
});
