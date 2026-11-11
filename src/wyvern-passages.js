import {wyvernRoutePoint,WYVERN_ROUTE_LENGTH} from './wyvern-route.js';
import {wyvernGround} from './wyvern-space.js';
let cache;
export function wyvernPassages(){
 if(cache)return cache;
 const boxes=[],arches=[];
 for(const [i,u] of [0.19,0.43,0.69,0.86].entries()){
  const q=wyvernRoutePoint(WYVERN_ROUTE_LENGTH*u),height=wyvernGround(q.x,q.z)+420,span=i%2?720:660;
  const place=(x,y,z,w,h,d)=>{const c=Math.cos(q.yaw),a=Math.sin(q.yaw);const b={x:q.x+x*c+z*a,y,z:q.z+z*c-x*a,w,h,d,yaw:q.yaw};boxes.push(b);return b;};
  const foot=wyvernGround(q.x,q.z)-15;
  place(-span/2,(height+foot)/2,0,75,height-foot,110);place(span/2,(height+foot)/2,0,75,height-foot,110);
  place(0,height+28,0,span+100,56,110);
  // Recessed stone shoulders create an eroded arch silhouette, with the same
  // oriented boxes providing physical roof and pier collision.
  place(-span/2+45,height-28,0,80,56,110);place(span/2-45,height-28,0,80,56,110);
  arches.push({distance:WYVERN_ROUTE_LENGTH*u,x:q.x,z:q.z,y:height,yaw:q.yaw});
 }
 return cache={boxes,arches};
}
