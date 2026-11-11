// Original block lettering for the DCSMCRAFT name. No reference logo/font asset.
const glyphs = {
  D: ["11110", "11011", "11001", "11001", "11001", "11011", "11110"],
  C: ["01111", "11000", "11000", "11000", "11000", "11000", "01111"],
  S: ["01111", "11000", "11000", "01110", "00011", "00011", "11110"],
  M: ["11011", "11111", "11111", "11011", "11011", "11011", "11011"],
  R: ["11110", "11011", "11011", "11110", "11100", "11010", "11011"],
  A: ["01110", "11011", "11011", "11111", "11011", "11011", "11011"],
  F: ["11111", "11000", "11000", "11110", "11000", "11000", "11000"],
  T: ["11111", "01110", "01110", "01110", "01110", "01110", "01110"],
};
export function menuLogo() {
  const word = "DCSMCRAFT";
  let paths = "",
    grain = "",
    shine = "";
  for (let i = 0; i < word.length; i++)
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++)
        if (glyphs[word[i]][y][x] === "1") {
          const px = 8 + (i * 6 + x) * 8,
            py = 8 + y * 10;
          paths += `M${px} ${py}h8v10h-8z`;
          if ((i * 13 + x * 7 + y * 3) % 7 === 0)
            grain += `M${px + 2} ${py + 3}h3v2h-3z`;
          if (!y || glyphs[word[i]][y - 1][x] !== "1")
            shine += `M${px} ${py}h8v2h-8z`;
        }
  return `<svg class="dcsm-logo" viewBox="0 0 452 96" role="img" aria-label="DCSMCRAFT" shape-rendering="crispEdges"><g transform="skewX(-3)"><path d="${paths}" fill="#171717" stroke="#171717" stroke-width="7" transform="translate(5 9)"/><path d="${paths}" fill="#494949" transform="translate(3 6)"/><path d="${paths}" fill="#242424" stroke="#242424" stroke-width="3"/><path d="${paths}" fill="#adadad"/><path d="${shine}" fill="#e7e7e7"/><path d="${grain}" fill="#858585"/></g></svg>`;
}
