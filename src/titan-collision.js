import {constrainTitanBody,titanBodyRegions} from './titan-contact.js';
import {sonicLength} from './titan-metrics.js';
// Sweep the actual displacement. Accumulate contact correction rather than
// repeatedly interpolating from the starting point through the same wall.
export function sweepTitanMotion(s,from,project){
 const p=s.avatar,to={x:p.x,y:p.y,z:p.z},dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
 const count=Math.min(192,Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/sonicLength(s,0.8))));
 const regions=titanBodyRegions(s);
 p.x=from.x;p.y=from.y;p.z=from.z;
 for(let i=0;i<count;i++){p.x+=dx/count;p.y+=dy/count;p.z+=dz/count;if(project)project(p,regions);else constrainTitanBody(p,s,regions);}
}
export function boxContact(p,box,radius=0.9,height=3.7){
 const c=Math.cos(box.yaw||0),a=Math.sin(box.yaw||0),dx=p.x-box.x,dz=p.z-box.z;
 const x=dx*c-dz*a,z=dz*c+dx*a,y=p.y+height/2-box.y;
 const ext={x:box.w/2+radius,y:box.h/2+height/2,z:box.d/2+radius};
 if(Math.abs(x)>=ext.x||Math.abs(z)>=ext.z||Math.abs(y)>=ext.y)return null;
 const depths=[ext.x-Math.abs(x),ext.y-Math.abs(y),ext.z-Math.abs(z)],axis=depths.indexOf(Math.min(...depths));
 const v={x:0,y:0,z:0},k=['x','y','z'][axis];v[k]=((k==='x'?x:k==='y'?y:z)>=0?1:-1)*(depths[axis]+0.001);
 return {x:v.x*c+v.z*a,y:v.y,z:v.z*c-v.x*a};
}
export function constrainBoxes(p,boxes,radius=0.9,height=3.7,floor=-Infinity){
 for(let pass=0;pass<3;pass++)for(const b of boxes){let q=boxContact(p,b,radius,height);if(!q)continue;
  if(q.y<0&&p.y+q.y<floor){
    const c=Math.cos(b.yaw||0),a=Math.sin(b.yaw||0),dx=p.x-b.x,dz=p.z-b.z,x=dx*c-dz*a,z=dz*c+dx*a;
    const px=b.w/2+radius-Math.abs(x)+0.001,pz=b.d/2+radius-Math.abs(z)+0.001;
    const ux=px<pz?(x>=0?px:-px):0,uz=px<pz?0:(z>=0?pz:-pz);
    q={x:ux*c+uz*a,y:0,z:uz*c-ux*a};
  }p.x+=q.x;p.y+=q.y;p.z+=q.z;
  const n=Math.hypot(q.x,q.y,q.z),dot=(p.vx||0)*q.x+(p.vy||0)*q.y+(p.vz||0)*q.z;
  if(dot<0&&n>0){p.vx-=q.x*dot/(n*n);p.vy-=q.y*dot/(n*n);p.vz-=q.z*dot/(n*n);}
  if(q.y>0)p.onGround=true;
 }
 if(p.y<floor){p.y=floor;p.vy=Math.max(0,p.vy||0);p.onGround=p.vy===0;}
}
export function clearBoxCamera(camera,focus,boxes){
 const dx=camera.x-focus.x,dy=camera.y-focus.y,dz=camera.z-focus.z;let safe=1;
 for(const b of boxes){const c=Math.cos(b.yaw||0),a=Math.sin(b.yaw||0),x=focus.x-b.x,z=focus.z-b.z;
  const origin=[x*c-z*a,focus.y-b.y,z*c+x*a],dir=[dx*c-dz*a,dy,dz*c+dx*a],half=[b.w/2+0.6,b.h/2+0.6,b.d/2+0.6];let lo=0,hi=safe;
  for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-9){if(Math.abs(origin[i])>half[i]){lo=2;break;}}else{let u=(-half[i]-origin[i])/dir[i],v=(half[i]-origin[i])/dir[i];if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)break;}}
  if(lo<=hi&&lo>=0&&lo<safe)safe=Math.max(0,lo-0.015);
 }return{x:focus.x+dx*safe,y:focus.y+dy*safe,z:focus.z+dz*safe};
}
