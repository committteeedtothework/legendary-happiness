const smooth = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
// A bounded tangent field along the spine. Local angles are differences of
// adjacent tangents, so 28 joints never accumulate into a corkscrew.
export function wyvernTailAngles(index, count, time, stage = "combat", stageTime = 0) {
  const tangent = i => {
    if (i < 0) return {yaw:0,roll:0};
    const u=(i+1)/count, phase=time*0.95-u*3.2;
    const thrown=["wyvern-slam","wyvern-counter","wyvern-hold","wyvern-launch"].includes(stage)
      ? Math.sin(Math.PI*smooth(stageTime/6))*0.16 : 0;
    return {yaw:Math.sin(phase)*0.19*u,
      roll:Math.sin(phase*0.8)*0.055*u + thrown*u*u};
  };
  const a=tangent(index), b=tangent(index-1);
  return {yaw:a.yaw-b.yaw,roll:a.roll-b.roll};
}
export function wyvernThrowPose(stageTime, duration=6) {
  const u=smooth(stageTime/duration);
  return {yaw:Math.PI*2*u,roll:Math.sin(u*Math.PI*2)*0.24,
    drop:Math.sin(u*Math.PI)*12};
}
// Canonical joints measured from the supplied rig after its existing uniform
// normalization. The same tangent field drives visible skin and body capsules.
export function wyvernSpinePoints(s) {
  const points=[],count=28,length=8.15;
  const time=Number.isFinite(s.time)?s.time:0;
  let p={x:0,y:-2.23,z:-20.27},yaw=0,roll=0;
  for(let i=0;i<count;i++) {
    points.push({...p});
    const a=wyvernTailAngles(i,count,time,s.stage,s.stageTime);
    yaw+=a.yaw;roll+=a.roll;
    p={x:p.x-Math.sin(yaw)*Math.cos(roll)*length,
      y:p.y+Math.sin(roll)*length,z:p.z-Math.cos(yaw)*Math.cos(roll)*length};
  }
  return points;
}
