import {readFileSync} from "node:fs";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/addons/libs/meshopt_decoder.module.js";
globalThis.self ||= globalThis;
globalThis.ProgressEvent ||= class {constructor(type,values){Object.assign(this,values);}};
let cache;
export function wyvernRigFixture() {
  return cache ||= (async()=>{
    const b=readFileSync(new URL("../../public/models/wyvern/wyvern.glb",import.meta.url));
    const length=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+length)),binary=b.subarray(28+length);
    g.images=[];g.textures=[];
    for (const m of g.materials) {
      for (const key of Object.keys(m)) if(key.endsWith("Texture")) delete m[key];
      for (const key of Object.keys(m.pbrMetallicRoughness||{})) if(key.endsWith("Texture")) delete m.pbrMetallicRoughness[key];
    }
    g.buffers=[{byteLength:binary.length,uri:"data:application/octet-stream;base64,"+binary.toString("base64")}];
    const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
    return loader.parseAsync(JSON.stringify(g),"");
  })();
}
