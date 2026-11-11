import {runwayPoint,WYVERN_RAIL_LENGTH} from './wyvern-space.js';
let points;
export function ribbonSurface(p,hint=0){
 points ||= Array.from({length:WYVERN_RAIL_LENGTH/2+1},(_,i)=>({...runwayPoint(i*2),t:i*2}));
 const start=Math.max(0,Math.floor((hint-120)/2)),end=Math.min(points.length-1,Math.ceil((hint+160)/2));let best;
 for(let i=start;i<end;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(l||1)));
  const q={x:a.x+dx*u,y:a.y+(b.y-a.y)*u,z:a.z+dz*u,t:a.t+2*u},d=Math.hypot(p.x-q.x,p.z-q.z),score=d*d+(p.y-q.y)**2*0.25;
  if(!best||score<best.score)best={...q,distance:d,score};
 }return best;
}
