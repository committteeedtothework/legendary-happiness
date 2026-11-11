import * as T from "three";
import { TITAN_CYLOOP } from "./titan-cyloop.js";
const zAxis=new T.Vector3(0,0,1), xAxis=new T.Vector3(1,0,0);
const turn=new T.Quaternion().setFromAxisAngle(xAxis,-Math.PI/2);
export function updateTitanCyloopMesh(mesh, history, s) {
  if (history.owner !== s || history.attempt !== (s.attempt||0) || s.time<history.lastTime) {
    history.orbit=null;history.seen=-100;history.elapsed=0;
  }
  history.owner=s;history.attempt=s.attempt||0;history.lastTime=s.time;
  if (s.strike?.orbit) Object.assign(history,{orbit:s.strike.orbit,elapsed:s.strike.elapsed,seen:s.time});
  const {orbit,elapsed=0,seen=-100}=history;
  const fade=Math.max(0,1-(s.time-seen)/0.65);
  mesh.visible=!!orbit && fade>0 && s.config.particles && ["combat","phase"].includes(s.stage);
  if (!orbit) return;
  const progress=Math.max(0,Math.min(1,(elapsed-TITAN_CYLOOP.approach)/TITAN_CYLOOP.orbit));
  mesh.geometry.setDrawRange(0,Math.floor(progress*mesh.geometry.index.count/3)*3);
  mesh.scale.setScalar((orbit.radius || TITAN_CYLOOP.radius)/TITAN_CYLOOP.radius);
  if (orbit.plane === "xy") {
    mesh.quaternion.setFromAxisAngle(zAxis,Math.PI/2-orbit.angle).multiply(turn);
    mesh.position.set(orbit.center.x,orbit.center.y+1.8,orbit.center.z);
  } else {
    mesh.rotation.set(0,orbit.angle-Math.PI/2,0);
    mesh.position.set(orbit.center.x,orbit.height+1.6,orbit.center.z);
  }
  mesh.material.color.set(progress>=1 ? "#ff83dc" : "#43cfff");
  mesh.material.opacity=0.7*fade;
}
