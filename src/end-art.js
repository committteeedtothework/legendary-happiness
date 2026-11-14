import { B, BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { hash } from "./random.js";
export function paintEndAtlas(canvas) {
  const c = canvas.getContext("2d");
  for (const id of [
    B.end_stone,
    B.end_stone_bricks,
    B.purpur_block,
    B.end_portal_frame,
    B.end_portal_frame_filled,
    B.end_portal,
    B.end_exit,
    B.end_gateway,
    B.chorus_plant,
    B.chorus_flower,
    B.dragon_egg,
    B.end_rod,
  ])
    for (let face = 0; face < 3; face++) {
      const tile = BLOCKS[id].artTile + face,
        ox = (tile % ATLAS_COLS) * 16,
        oy = Math.floor(tile / ATLAS_COLS) * 16;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const n = hash(x, y, id, 37);
          let color = "#dddca8";
          if (id === B.end_stone || id === B.end_stone_bricks) {
            const pit = (x * 7 + y * 3) % 23 < 3;
            color = pit ? "#aeb180" : n > 0.6 ? "#ecebbb" : "#d5d7a1";
            if (
              id === B.end_stone_bricks &&
              (y % 8 === 0 || (x + (y > 8 ? 8 : 0)) % 16 === 0)
            )
              color = "#999e72";
          } else if (id === B.purpur_block)
            color =
              x % 8 === 0 || y % 8 === 0
                ? "#84648e"
                : n > 0.5
                  ? "#b48dba"
                  : "#a17caa";
          else if (
            [B.end_portal_frame, B.end_portal_frame_filled].includes(id)
          ) {
            color =
              x < 2 || x > 13 || y < 2 || y > 13
                ? "#d9d5a7"
                : n > 0.5
                  ? "#52736d"
                  : "#355952";
            if (face === 0 && id === B.end_portal_frame_filled) {
              const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
              if (d < 29) color = d < 7 ? "#121a1d" : "#a3cf70";
            }
          } else if ([B.end_portal, B.end_exit, B.end_gateway].includes(id))
            color = n > 0.965 ? "#bd8fdf" : n > 0.85 ? "#341b52" : "#100d1c";
          else if (id === B.chorus_plant)
            color =
              x < 2 || x > 13 ? "#c0a2be" : n > 0.5 ? "#76567c" : "#57405f";
          else if (id === B.chorus_flower)
            color = x % 7 === 0 || y % 7 === 0 ? "#93749d" : "#d3b5d6";
          else if(id===B.end_rod)color=y<2||y>13?"#aaa6b0":"#fff5df";
          else color = n > 0.75 ? "#493452" : "#1e1529";
          c.fillStyle = color;
          c.fillRect(ox + x, oy + y, 1, 1);
        }
    }
}
export function paintEndItem(c, id) {
  if (
    ![
      "elytra",
      "shulker_shell",
      "ender_pearl",
      "eye_of_ender",
      "chorus_fruit",
      "end_crystal",
      "dragoon_trophy",
    ].includes(id)
  )
    return false;
  c.clearRect(0, 0, 32, 32);
  const circle = (r, color) => {
    c.fillStyle = color;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        if ((x - 15.5) ** 2 + (y - 15.5) ** 2 < r * r) c.fillRect(x, y, 1, 1);
  };
  if(id==="elytra"){
    for(const sign of[-1,1]){c.fillStyle="#655d7b";c.beginPath();c.moveTo(16,5);c.lineTo(16+sign*12,9);c.lineTo(16+sign*9,28);c.lineTo(16+sign*2,20);c.closePath();c.fill();c.fillStyle="#b3a9c7";c.fillRect(sign<0?7:18,9,5,13);}return true;
  }
  if(id==="shulker_shell"){c.fillStyle="#8c5e98";c.fillRect(4,10,24,16);c.fillStyle="#bd91ca";c.fillRect(4,6,24,8);c.fillStyle="#63476d";c.fillRect(6,22,20,4);return true;}
  if (id === "ender_pearl" || id === "eye_of_ender") {
    circle(12, "#102c35");
    circle(10, id === "ender_pearl" ? "#237e7c" : "#a6d273");
    circle(6, id === "ender_pearl" ? "#185155" : "#3b785f");
    if (id === "eye_of_ender") {
      c.fillStyle = "#101823";
      c.fillRect(14, 8, 4, 16);
    }
    c.fillStyle = "#b8f2db";
    c.fillRect(9, 8, 4, 3);
  } else if (id === "chorus_fruit") {
    circle(10, "#a879ae");
    c.fillStyle = "#dbc4df";
    c.fillRect(11, 7, 9, 5);
    c.fillStyle = "#514258";
    c.fillRect(15, 3, 3, 6);
  } else if (id === "end_crystal") {
    c.strokeStyle = "#e9c9f6";
    c.lineWidth = 2;
    c.strokeRect(5, 5, 22, 22);
    c.save();
    c.translate(16, 16);
    c.rotate(Math.PI / 4);
    c.fillStyle = "#e970dc";
    c.fillRect(-6, -6, 12, 12);
    c.restore();
  } else {
    c.fillStyle = "#c8a459";
    c.fillRect(6, 25, 20, 4);
    c.fillRect(14, 17, 4, 8);
    c.fillStyle = "#34273d";
    c.fillRect(7, 6, 18, 13);
    c.fillStyle = "#ef9cf2";
    c.fillRect(9, 10, 4, 3);
    c.fillRect(19, 10, 4, 3);
  }
  return true;
}
