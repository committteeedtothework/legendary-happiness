import {TOWER,WYVERN_TOWER,WYVERN_RAIL_LENGTH,WYVERN_GAPS,runwayPoint,wyvernGround} from './wyvern-space.js';
const CELL=8,EPS=1e-5;
export function ribbonMeshData(points,width,gaps=[],kind='road',depth=0.28){
 const positions=[],uvs=[],surfaces=[];
 const face=(a,b,c)=>{for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);uvs.push(p.u??0,p.v??0);}};
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1];if(gaps.some(([lo,hi])=>a.t>=lo&&a.t<hi))continue;
  const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz);if(n<1e-8)continue;
  const x=dz/n*width/2,z=-dx/n*width/2;
  const q=[{x:a.x+x,y:a.y,z:a.z+z,t:a.t??i,u:0,v:i/10},{x:a.x-x,y:a.y,z:a.z-z,t:a.t??i,u:1,v:i/10},{x:b.x+x,y:b.y,z:b.z+z,t:b.t??i+1,u:0,v:(i+1)/10},{x:b.x-x,y:b.y,z:b.z-z,t:b.t??i+1,u:1,v:(i+1)/10}];
  const bottom=q.map(p=>({...p,y:p.y-depth}));
  for(const ids of [[0,1,2],[2,1,3]]){const [a,b,c]=ids.map(j=>q[j]);surfaces.push({a,b,c,kind,depth});face(a,b,c);face(...[...ids].reverse().map(j=>bottom[j]));}
  for(const [a,b] of [[0,2],[3,1],[1,0],[2,3]]){face(q[a],bottom[a],q[b]);face(q[b],bottom[a],bottom[b]);}
 }
 return {positions,uvs,surfaces};
}
function cap(radius,y,count,start=0,length=Math.PI*2,depth=0){
 const out=[];
 for(let i=0;i<count;i++){
  const a=start+i/count*length,b=start+(i+1)/count*length;
  out.push({a:{x:TOWER.x,y,z:TOWER.z},b:{x:TOWER.x+Math.sin(b)*radius,y,z:TOWER.z+Math.cos(b)*radius},c:{x:TOWER.x+Math.sin(a)*radius,y,z:TOWER.z+Math.cos(a)*radius},kind:'tower',depth});
 }return out;
}
let cached;
export function wyvernPlatforms(){
 if(cached)return cached;
 const road=Array.from({length:WYVERN_RAIL_LENGTH/2+1},(_,i)=>({...runwayPoint(i*2),t:i*2}));
 const triangles=[...ribbonMeshData(WYVERN_TOWER,TOWER.width*2,[],'tower').surfaces,...ribbonMeshData(road,18,WYVERN_GAPS.map(t=>[t,t+15])).surfaces,...cap(49,TOWER.height,48,Math.PI/2+0.13,Math.PI*2-0.26,4),...cap(22,TOWER.height,16)];
 const cells=new Map();
 for(const t of triangles){
  const x1=Math.min(t.a.x,t.b.x,t.c.x),x2=Math.max(t.a.x,t.b.x,t.c.x),z1=Math.min(t.a.z,t.b.z,t.c.z),z2=Math.max(t.a.z,t.b.z,t.c.z);
  for(let x=Math.floor(x1/CELL);x<=Math.floor(x2/CELL);x++)for(let z=Math.floor(z1/CELL);z<=Math.floor(z2/CELL);z++){const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);}
 }
 return cached={triangles,cells};
}
export function platformHeight(t,x,z){
 const ax=t.b.x-t.a.x,az=t.b.z-t.a.z,bx=t.c.x-t.a.x,bz=t.c.z-t.a.z,den=ax*bz-bx*az;
 if(Math.abs(den)<1e-9)return null;
 const dx=x-t.a.x,dz=z-t.a.z,u=(dx*bz-bx*dz)/den,v=(ax*dz-dx*az)/den;
 if(u < -EPS || v < -EPS || u+v>1+EPS)return null;
 return {y:t.a.y+(t.b.y-t.a.y)*u+(t.c.y-t.a.y)*v,t:(t.a.t??0)+((t.b.t??0)-(t.a.t??0))*u+((t.c.t??0)-(t.a.t??0))*v,kind:t.kind,depth:t.depth};
}
export function platformCandidates(x,z){return wyvernPlatforms().cells.get(Math.floor(x/CELL)+':'+Math.floor(z/CELL))||[];}
// The same triangles draw and support each floor. Substeps sweep fast falls,
// stomps and dashes; separate head tests make each slab solid from below.
export function resolveWyvernPlatforms(p,from){
 const dx=p.x-from.x,dy=p.y-from.y,dz=p.z-from.z,count=Math.min(256,Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/0.35)));
 p.x=from.x;p.y=from.y;p.z=from.z;let support=null,sx=dx/count,sy=dy/count,sz=dz/count;
 for(let i=0;i<count;i++){
  const old={x:p.x,y:p.y,z:p.z,onGround:!!p.onGround};p.x+=sx;p.y+=sy;p.z+=sz;
  let floor=null,ceiling=Infinity,overlap=false;
  for(const tri of platformCandidates(p.x,p.z)){
   const q=platformHeight(tri,p.x,p.z);if(!q)continue;
   if(p.vy<=0 && p.y<=q.y+(old.onGround?0.8:0.051) && old.y>=q.y-(old.onGround?1.8:0.015) && (!floor||q.y>floor.y))floor=q;
   const underside=q.y-q.depth;
   if(q.depth>0&&p.y<q.y-0.001&&p.y+3.7>underside+0.001)overlap=true;
   if(q.depth>0&&p.vy>0&&old.y+3.7<=underside+0.01&&p.y+3.7>=underside)ceiling=Math.min(ceiling,underside);
  }
  p.onGround=false;
  if(floor){p.y=floor.y+0.05;p.vy=0;sy=0;p.onGround=true;support=floor;}
  else if(Number.isFinite(ceiling)){p.y=ceiling-3.705;p.vy=0;sy=0;}
  else if(overlap){
   let wasInside=false;
   for(const tri of platformCandidates(old.x,old.z)){const q=platformHeight(tri,old.x,old.z);if(q&&q.depth>0&&old.y<q.y-0.001&&old.y+3.7>q.y-q.depth+0.001){wasInside=true;break;}}
   if(!wasInside){p.x=old.x;p.z=old.z;p.vx=p.vz=0;sx=sz=0;}
  }
  const terrain=wyvernGround(p.x,p.z);
  if(p.y<=terrain+0.05&&p.vy<=0){p.y=terrain+0.05;p.vy=0;sy=0;p.onGround=true;support={kind:'terrain',y:terrain};}
 }
 return p.onGround?support:null;
}
