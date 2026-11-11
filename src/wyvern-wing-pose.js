import * as T from "three";
import {wyvernTailAngles} from "./wyvern-posture.js";
import {WYVERN_WING_DATA} from './wyvern-wing-data.js';
export function wyvernClipState(s){
 const w=s.wyvern;
 const name=s.stage==='finale'?'defeat':['wyvern-slam','wyvern-counter','wyvern-launch','wyvern-hold'].includes(s.stage)?'tail_slam':s.stage==='phase'?'roar':['wyvern-mouth','wyvern-missile'].includes(s.stage)?'bite':w.open>0?'stagger':w.mode==='bite'?'bite':w.mode==='claws'?(w.slash%2?'claw_right':'claw_left'):w.missiles.length?'missile_launch':'flight';
 const d=WYVERN_WING_DATA.clips[name].duration;
 let time=(s.time||0)%d;
 if(w.mode==='claws')time=Math.max(0,Math.min(1,1-w.timer/(w.slash?0.95:1.45)))*d*0.5;
 else if(['wyvern-mouth','wyvern-missile'].includes(s.stage))time=Math.min(d,1.2);
 else if(s.stage==='phase')time=Math.min(d,s.stageTime*3.8/20);
 else if(s.stage==='finale')time=Math.min(d,s.stageTime);
 else if(['wyvern-slam','wyvern-counter','wyvern-launch','wyvern-hold'].includes(s.stage))time=s.stageTime%d;
 return {name,time};
}
const matrix=new T.Matrix4(),local=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),delta=new T.Quaternion(),vertex=new T.Vector3();
export function wyvernWingPoints(s){
 const {name,time}=wyvernClipState(s),clip=WYVERN_WING_DATA.clips[name],f=Math.min(clip.frames.length-1,time/clip.duration*(clip.frames.length-1)),i=Math.floor(f),u=f-i,a=clip.frames[i],b=clip.frames[Math.min(i+1,clip.frames.length-1)];
 const offset=WYVERN_WING_DATA.names.length*3,mix=i=>a[i]+(b[i]-a[i])*u;
 position.set(mix(offset),mix(offset+1),mix(offset+2));rotation.set(mix(offset+3),mix(offset+4),mix(offset+5),mix(offset+6)).normalize();scale.set(mix(offset+7),mix(offset+8),mix(offset+9));matrix.compose(position,rotation,scale);
 WYVERN_WING_DATA.rest.forEach((r,j)=>{const p=wyvernTailAngles(j,28,s.time||0,s.stage,s.stageTime);position.fromArray(r.position);rotation.fromArray(r.quaternion);delta.setFromEuler(new T.Euler(0,p.yaw,p.roll));rotation.multiply(delta);scale.fromArray(r.scale);local.compose(position,rotation,scale);matrix.multiply(local);});
 return WYVERN_WING_DATA.names.map((name,j)=>{vertex.set(mix(j*3),mix(j*3+1),mix(j*3+2)).applyMatrix4(matrix);return {name,x:vertex.x,y:vertex.y,z:vertex.z};});
}
