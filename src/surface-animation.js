import { B, BLOCKS, ATLAS_COLS as C, ATLAS_ROWS as R } from "./data.js";
// Tile-local procedural animation never scrolls into wool or neighboring UVs.
// No canvas upload, remesh or per-fragment texture lookup is added.
export function injectSurfaceAnimation(shader, clock, enabled) {
  shader.uniforms.endSurfaceTime = clock;
  shader.uniforms.endSurfaceEnabled = enabled;
  shader.fragmentShader =
    "uniform float endSurfaceTime;uniform float endSurfaceEnabled;\n" +
    shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
 #ifdef USE_MAP
 float endTile=floor(vMapUv.x*${C}.0)+(${R - 1}.0-floor(vMapUv.y*${R}.0))*${C}.0;
 vec2 endPixel=floor(fract(vMapUv*vec2(${C}.0,${R}.0))*16.0);
 float endFrame=floor(endSurfaceTime*8.0);
 if(endSurfaceEnabled>0.5){
  if(endTile>=${B.water * 3}.0&&endTile<${(B.water + 1) * 3}.0){
   float wave=sin(endPixel.x*.65+sin(endPixel.y*.5+endFrame*.18)*1.4+endFrame*.22)*sin(endPixel.y*.55-endFrame*.15);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.48,.65),.12)+wave*.035;
  }
  if(endTile>=${B.lava * 3}.0&&endTile<${(B.lava + 1) * 3}.0){
   vec2 q=endPixel*.4+vec2(sin(endFrame*.07),cos(endFrame*.09));
   float molten=sin(q.x+sin(q.y+endFrame*.12))*cos(q.y-sin(q.x-endFrame*.1));
   diffuseColor.rgb=mix(vec3(.65,.14,.015),vec3(1.0,.69,.12),smoothstep(-.8,.8,molten));diffuseColor.a=1.0;
  }
  if(endTile>=${B.fire * 3}.0&&endTile<${(B.fire + 1) * 3}.0){
   float h=endPixel.y/16.0,flame=.6+.2*sin(endPixel.x*.7+endFrame*.6)+.15*sin(endPixel.x*1.4-endFrame*.4);
   diffuseColor.rgb=mix(vec3(1.0,.92,.35),vec3(1.0,.25,.025),h);diffuseColor.a=step(h,flame);
  }
  if((endTile>=${BLOCKS[B.end_portal].artTile}.0&&endTile<${BLOCKS[B.end_gateway].artTile + 3}.0)){
   float star=step(.985,fract(sin(dot(endPixel,vec2(12.9898,78.233)))*43758.5453));
   diffuseColor.rgb=vec3(.035,.018,.07)+star*(.5+.4*sin(endSurfaceTime*1.2+endPixel.x))*vec3(.6,.3,.9);diffuseColor.a=1.0;
  }
 }
 #endif`,
    );
}
