import {clearBoxCamera} from "./titan-collision.js";
import {titanBoulderBounds} from "./titan-landscape.js";
import { titanWorldPoint, titanLocalPoint } from "./titan-space.js";
import { sonicLength } from "./titan-metrics.js";
import {
  point,
  closestSegment,
  distance,
  titanBodyRegions,
} from "./titan-contact.js";
function segmentGapSq(p,q,a,b){
 const u={x:q.x-p.x,y:q.y-p.y,z:q.z-p.z},v={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},w={x:p.x-a.x,y:p.y-a.y,z:p.z-a.z};
 const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),uw=dot(u,w),vw=dot(v,w),den=uu*vv-uv*uv;
 let x=den>1e-12?Math.max(0,Math.min(1,(uv*vw-vv*uw)/den)):0,y=vv>1e-12?Math.max(0,Math.min(1,(uv*x+vw)/vv)):0;
 x=uu>1e-12?Math.max(0,Math.min(1,(uv*y-uw)/uu)):0;y=vv>1e-12?Math.max(0,Math.min(1,(uv*x+vw)/vv)):0;
 return (w.x+u.x*x-v.x*y)**2+(w.y+u.y*x-v.y*y)**2+(w.z+u.z*x-v.z*y)**2;
}
function blocked(regions,focus,camera){
 for(const r of regions){
  if(!r.axes){if(segmentGapSq(focus,camera,r.a,r.b)<(r.r+0.6)**2)return true;continue;}
  const f=titanLocalPoint(null,focus,{x:r.center.x,z:r.center.z,yaw:r.yaw||0}),c=titanLocalPoint(null,camera,{x:r.center.x,z:r.center.z,yaw:r.yaw||0});
  const a=[f.x/(r.axes.x+0.6),(focus.y-r.center.y)/(r.axes.y+0.6),f.z/(r.axes.z+0.6)],b=[c.x/(r.axes.x+0.6),(camera.y-r.center.y)/(r.axes.y+0.6),c.z/(r.axes.z+0.6)],d=b.map((v,i)=>v-a[i]);
  const t=Math.max(0,Math.min(1,-a.reduce((n,v,i)=>n+v*d[i],0)/(d.reduce((n,v)=>n+v*v,0)||1)));
  if(a.reduce((n,v,i)=>n+(v+d[i]*t)**2,0)<1)return true;
 }return false;
}

export function titanCameraBlocked(s, camera) {
  return blocked(
    titanBodyRegions(s),
    point(s.avatar.x, s.avatar.y + sonicLength(s, 1.9), s.avatar.z),
    camera,
  );
}
export function clearTitanCamera(s, camera, clearance) {
  const p = s.avatar,
    focus = point(p.x, p.y + sonicLength(s, 1.9), p.z),
    regions = titanBodyRegions(s);
  if(s.titan!=="wyvern")camera=clearBoxCamera(camera,focus,titanBoulderBounds());
  if (!blocked(regions, focus, camera)) return { ...camera };
  const center = titanWorldPoint(s, { x: 0, y: 0, z: -7.5 }),
    angle = Math.atan2(p.x - center.x, p.z - center.z),
    target = Math.atan2(camera.x - center.x, camera.z - center.z),
    delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle)),
    radius = Math.max(
      clearance + 8,
      Math.hypot(p.x - center.x, p.z - center.z) + 14,
    ),
    preferred = Math.max(-0.95, Math.min(0.95, delta));
  for (const offset of [preferred, -preferred, 0, 0.55, -0.55]) {
    const candidate = point(
      center.x + Math.sin(angle + offset) * radius,
      Math.max(2.5, camera.y, p.y + 4),
      center.z + Math.cos(angle + offset) * radius,
    );
    if (!blocked(regions, focus, candidate)) return candidate;
  }
  // Last resort: shorten the boom from Sonic's side of the obstruction.
  let last = point(focus.x, focus.y + 1.5, focus.z);
  for (let i = 1; i <= 16; i++) {
    const u = i / 16,
      candidate = point(
        focus.x + (camera.x - focus.x) * u,
        focus.y + (camera.y - focus.y) * u,
        focus.z + (camera.z - focus.z) * u,
      );
    if (blocked(regions, focus, candidate)) break;
    last = candidate;
  }
  if (
    Math.hypot(last.x - (s.boss?.x || 0), last.z - (s.boss?.z || 0)) >=
    clearance
  )
    return last;
  // A transient attacking limb may cover the focus itself. Keep the camera
  // outside the giant rather than pulling it inside the mantle with Sonic.
  return point(
    center.x + Math.sin(angle + preferred) * radius,
    Math.max(2.5, camera.y, p.y + 4),
    center.z + Math.cos(angle + preferred) * radius,
  );
}
