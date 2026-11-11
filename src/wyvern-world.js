import {wyvernPassages} from "./wyvern-passages.js";
import {constrainBoxes,clearBoxCamera} from "./titan-collision.js";
import { wyvernGround, runwayPoint, TOWER } from "./wyvern-space.js";
import { wyvernRouteDistance } from "./wyvern-route.js";
import { wyvernFlightFrame } from "./wyvern-choreography.js";
export const WYVERN_LIMITS = Object.freeze({groundRadius:700,flightRadius:1500,minY:-600,maxY:800,mapSize:6400});
export function wyvernWorldPoint(s,p) {
  const f=wyvernFlightFrame(s),c=Math.cos(f.yaw),a=Math.sin(f.yaw);
  return {x:f.x+p.x*c+p.z*a,y:f.y+p.y,z:f.z+p.z*c-p.x*a};
}
export function wyvernFloor(s,p) {
  const q=wyvernWorldPoint(s,p),f=wyvernFlightFrame(s);
  return wyvernGround(q.x,q.z)-f.y;
}
// Scenery never occupies the playable field, elevated chase ribbon or the
// giant's swept flight corridor. These are placements, not invisible walls.
export function wyvernScenerySafe(x,z,radius=70) {
  if (Math.hypot(x,z)<550+radius) return false;
  if (wyvernRouteDistance(x,z)<340+radius) return false;
  for(let t=0;t<=2400;t+=16) {
    const p=runwayPoint(t);
    if(Math.hypot(x-p.x,z-p.z)<radius+35)return false;
  }
  return true;
}
export function clearWyvernTerrainCamera(s,camera,focus) {
  const q={...camera};
  // Lift the complete boom, including its interpolated path, above the same
  // terrain function used to build both LOD meshes.
  for(let i=1;i<=24;i++) {
    const u=i/24,p={x:focus.x+(q.x-focus.x)*u,y:focus.y+(q.y-focus.y)*u,z:focus.z+(q.z-focus.z)*u};
    const floor=wyvernFloor(s,p)+1.3;
    if(p.y<floor)q.y+=(floor-p.y)/u;
  }
  if (!s.emerald) {
    let safe={...focus};
    for(let i=1;i<=48;i++) {
      const u=i/48,p={x:focus.x+(q.x-focus.x)*u,y:focus.y+(q.y-focus.y)*u,z:focus.z+(q.z-focus.z)*u};
      const radius=36-10*Math.max(0,Math.min(1,p.y/TOWER.height))+0.8;
      if(p.y<TOWER.height&&Math.hypot(p.x-TOWER.x,p.z-TOWER.z)<radius)return safe;
      safe=p;
    }
  }
  return q;
}

export function wyvernLocalPoint(frame,p) {
 const x=p.x-frame.x,z=p.z-frame.z,c=Math.cos(frame.yaw),a=Math.sin(frame.yaw);
 return {x:x*c-z*a,y:p.y-frame.y,z:z*c+x*a};
}
export function advectWyvernAvatar(p,oldFrame,newFrame) {
 const c=Math.cos(oldFrame.yaw),a=Math.sin(oldFrame.yaw),world={x:oldFrame.x+p.x*c+p.z*a,y:oldFrame.y+p.y,z:oldFrame.z+p.z*c-p.x*a};
 const q=wyvernLocalPoint(newFrame,world),turn=oldFrame.yaw-newFrame.yaw;
 const vx=p.vx*Math.cos(turn)+p.vz*Math.sin(turn),vz=p.vz*Math.cos(turn)-p.vx*Math.sin(turn);
 Object.assign(p,q,{vx,vz});
}

let obstacleCache;
export function wyvernSceneryData(){
 if(obstacleCache)return obstacleCache;
 const rocks=Array.from({length:110},(_,i)=>{const yaw=i*2.399963,r=540+(i%13)*170,h=40+(i%7)*12,x=Math.sin(yaw)*r,z=Math.cos(yaw)*r;
  return {x,z,y:h*0.5+wyvernGround(x,z)-3,h,sx:25+(i%6)*7,sz:32+(i%5)*8,yaw,rx:Math.sin(i)*0.035,rz:Math.cos(i)*0.04,active:wyvernScenerySafe(x,z,85),kind:'rock'};});
 const ruins=Array.from({length:36},(_,i)=>{const yaw=i*2.7,r=540+(i%9)*180,x=Math.sin(yaw)*r,z=Math.cos(yaw)*r;
  return {x,z,y:7+(i%4)*4+wyvernGround(x,z),h:15+(i%4)*8,sx:5,sz:5,yaw,rx:0,rz:0.05*(i%3),active:wyvernScenerySafe(x,z,10),kind:'ruin'};});
 obstacleCache={rocks,ruins,active:[...rocks,...ruins].filter(o=>o.active)};return obstacleCache;
}
export function constrainWyvernScenery(s,p){
 const frame=wyvernFlightFrame(s),world=wyvernWorldPoint(s,p);
 for(let pass=0;pass<3;pass++)for(const o of wyvernSceneryData().active){
  const extent=o.kind==='rock'?1.5:0.75,rx=o.sx*extent+1.1,rz=o.sz*extent+1.1,top=o.y+o.h/2+4,bottom=o.y-o.h/2-4;
  if(world.y>top || world.y+3.6<bottom || Math.abs(world.x-o.x)>rx+rz || Math.abs(world.z-o.z)>rx+rz)continue;
  const c=Math.cos(o.yaw),a=Math.sin(o.yaw),dx=world.x-o.x,dz=world.z-o.z;
  let x=dx*c-dz*a,z=dz*c+dx*a,len=Math.hypot(x/rx,z/rz);
  if(len>=1)continue;
  if(world.y>top-2.5){world.y=top+0.15;continue;}
  if(len<1e-5){x=rx;z=0;len=1;}else{x/=len;z/=len;}
  world.x=o.x+x*c+z*a;world.z=o.z+z*c-x*a;
 }
 constrainBoxes(world,wyvernPassages().boxes);
 Object.assign(p,wyvernLocalPoint(frame,world));
}
function sceneryAt(p,padding=1){
 for(const o of wyvernSceneryData().active){
  const extent=o.kind==='rock'?1.5:0.75,rx=o.sx*extent+padding,rz=o.sz*extent+padding;
  if(p.y<o.y-o.h/2-4-padding || p.y>o.y+o.h/2+4+padding || Math.abs(p.x-o.x)>rx+rz || Math.abs(p.z-o.z)>rx+rz)continue;
  const c=Math.cos(o.yaw),a=Math.sin(o.yaw),dx=p.x-o.x,dz=p.z-o.z;
  if(((dx*c-dz*a)/rx)**2+((dz*c+dx*a)/rz)**2<1)return true;
 }
 return false;
}
export function clearWyvernSceneryCamera(s,camera,focus){
 let safe={...focus};
 for(let i=1;i<=48;i++){const u=i/48,p={x:focus.x+(camera.x-focus.x)*u,y:focus.y+(camera.y-focus.y)*u,z:focus.z+(camera.z-focus.z)*u};
  if(sceneryAt(wyvernWorldPoint(s,p),0.6))return safe;safe=p;
 }
 const worldFocus=wyvernWorldPoint(s,focus),worldCamera=wyvernWorldPoint(s,camera);
 const boxes=[...wyvernPassages().boxes];
 if(!s.emerald)boxes.push({x:TOWER.x,y:TOWER.height-2,z:TOWER.z,w:98,h:4,d:98,yaw:0});
 return wyvernLocalPoint(wyvernFlightFrame(s),clearBoxCamera(worldCamera,worldFocus,boxes));
}
