// Arc-length sampled canyon route. Both scenery and pursuit use these points.
const keys=[[0,0],[-300,-380],[-820,-490],[-1200,-1040],[-1710,-760],[-2230,-1030],[-2070,-1510],[-2470,-1880],[-1900,-2380],[-1280,-2080],[-820,-2500],[-270,-2050],[410,-2180],[650,-1560],[1230,-1270],[900,-820],[1240,-250],[650,310],[180,120]];
const cat=(a,b,c,d,t)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
function exact(t) {
 const n=keys.length,f=((t%n)+n)%n,j=Math.floor(f),u=f-j;
 const a=keys[(j+n-1)%n],b=keys[j],c=keys[(j+1)%n],d=keys[(j+2)%n];
 const derivative=k=>0.5*((-a[k]+c[k])+2*(2*a[k]-5*b[k]+4*c[k]-d[k])*u+3*(-a[k]+3*b[k]-3*c[k]+d[k])*u*u);
 return {x:cat(a[0],b[0],c[0],d[0],u),z:cat(a[1],b[1],c[1],d[1],u),yaw:Math.atan2(-derivative(0),-derivative(1))};
}
const samples=[];let length=0;
for(let i=0;i<=keys.length*24;i++) {
 const f=(i/24)%keys.length,j=Math.floor(f),u=f-j,n=keys.length;
 const a=keys[(j+n-1)%n],b=keys[j],c=keys[(j+1)%n],d=keys[(j+2)%n];
 const p={x:cat(a[0],b[0],c[0],d[0],u),z:cat(a[1],b[1],c[1],d[1],u)};
 if(samples.length)length+=Math.hypot(p.x-samples.at(-1).x,p.z-samples.at(-1).z);
 samples.push({...p,t:i/24,distance:length});
}
export const WYVERN_ROUTE_LENGTH=length;
export const WYVERN_ROUTE=samples;
export function wyvernRoutePoint(distance) {
 const d=((distance%length)+length)%length;let lo=0,hi=samples.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].distance<=d)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],u=(d-a.distance)/Math.max(0.001,b.distance-a.distance);
 const q=exact(a.t+(b.t-a.t)*u),phase=d/length*Math.PI*2;return {...q,rise:30*Math.sin(phase*3)+15*Math.sin(phase*5),bend:Math.atan2(Math.sin(exact(a.t+(b.t-a.t)*u+0.03).yaw-q.yaw),Math.cos(exact(a.t+(b.t-a.t)*u+0.03).yaw-q.yaw))};
}
export function wyvernRouteDistance(x,z) {
 let best=Infinity;
 for(let i=0;i<samples.length-1;i+=2){const a=samples[i],b=samples[Math.min(i+2,samples.length-1)],dx=b.x-a.x,dz=b.z-a.z;
 const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
 best=Math.min(best,(x-a.x-dx*t)**2+(z-a.z-dz*t)**2);}
 return Math.sqrt(best);
}
