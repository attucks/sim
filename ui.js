onUpdate(() => {
  destroyAll("statText");

  let aliveInfo = "ALIVE\n #  Name     Parent   Kids         L  K  F  D  M  Victims\n";
  animalsStats.forEach((a, i) => {
    aliveInfo += `${(i + 1).toString().padStart(2, ' ')}  ${(a.firstName + " " + (a.lastName || "")).padEnd(8, ' ')} ${(a.parentName || "None").padEnd(7, ' ')} ${(a.offspring.length ? a.offspring.join(",") : "-").padEnd(10, ' ')} ${a.stats.lifetime.toFixed(0).padStart(2, ' ')} ${a.stats.kids.toString().padStart(2, ' ')} ${a.stats.foods.toString().padStart(2, ' ')} ${a.stats.kills.toString().padStart(2, ' ')} ${computeMagicNumber(a).toFixed(1).padStart(4, ' ')}  ${(a.victims.length ? a.victims.join(",") : "-")}\n`;
  });

  let deadInfo = "ANCESTORS\n #  Name     Parent   Kids         L  K  F  D  M  Victims\n";
  ancestorStats.forEach((a, i) => {
    deadInfo += `${(i + 1).toString().padStart(2, ' ')}  ${(a.name || "").padEnd(8, ' ')} ${(a.parent || "None").padEnd(7, ' ')} ${(a.offspring.length ? a.offspring.join(",") : "-").padEnd(10, ' ')} ${a.lifetime.toString().padStart(2, ' ')} ${a.kids.toString().padStart(2, ' ')} ${a.foods.toString().padStart(2, ' ')} ${a.kills.toString().padStart(2, ' ')} ${a.magic.toString().padStart(4, ' ')}  ${(a.victims.length ? a.victims.join(",") : "-")}\n`;
  });

  add([text(aliveInfo, { size: 12 }), pos(penX + penWidth + 10, penY), color(255, 255, 255), "statText"]);
  add([text(deadInfo, { size: 12 }), pos(penX + penWidth + 10, penY + 300), color(180, 180, 180), "statText"]);
add([
  text(newsFeed.join("\n"), { size: 10 }),
  pos(penX, penY + penHeight + 10), // ✅ start right below the bottom of the pen
  color(255, 255, 0),
  "statText",
]);

});
add([
    text(`Build: ${buildTime}`, { size: 12 }),
    pos(10, 580), // Bottom-left corner, adjust if needed
   // layer("ui"),
    fixed(),
]);
