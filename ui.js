onUpdate(() => {

add([
    text(`Build: 4.1`, { size: 12 }),
    pos(10, 580), // Bottom-left corner, adjust if needed
   // layer("ui"),
    fixed(),
]);


function familyColorToCSS(color) {
  if (!color) return "white";
  return `rgb(${color.r ?? 255}, ${color.g ?? 255}, ${color.b ?? 255})`;
}
function updateStatsUI() {
  let html = "";

  // --- ALIVE TABLE ---
  html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">`;
  html += `<thead><tr style="background-color: darkgreen;">`;
  html += `<th>#</th><th>Name</th><th>Parent</th><th>Kids</th><th>HP</th><th>Hunger</th><th>Brv</th><th>Grd</th><th>Cur</th><th>Terr</th><th>Victims</th>`;
  html += `</tr></thead><tbody>`;

  animalsStats.forEach((a, i) => {
    html += `<tr>`;
    html += `<td>${i + 1}</td>`;
    html += `<td>${a.firstName} ${(a.lastName || "")}</td>`;
    html += `<td>${a.parentName || "None"}</td>`;
    html += `<td>${(a.offspring && a.offspring.length) ? a.offspring.length : "-"}</td>`;
    html += `<td>${Math.floor(a.health)}</td>`;
    html += `<td>${a.hunger.toFixed(1)}</td>`;
    html += `<td>${(a.bravery * 10).toFixed(0)}</td>`;
    html += `<td>${(a.greed * 10).toFixed(0)}</td>`;
    html += `<td>${(a.curiosity * 10).toFixed(0)}</td>`;
    html += `<td>${(a.territorial * 10).toFixed(0)}</td>`;
    html += `<td>${(a.victims && a.victims.length) ? a.victims.length : "-"}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  // --- DEAD (ANCESTORS) TABLE ---
  html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse; width: 100%;">`;
  html += `<thead><tr style="background-color: darkred;">`;
  html += `<th>#</th><th>Name</th><th>Parent</th><th>Kids</th><th>Life</th><th>Kills</th><th>Foods</th><th>Victims</th><th>Magic</th>`;
  html += `</tr></thead><tbody>`;

  ancestorStats.forEach((a, i) => {
    html += `<tr>`;
    html += `<td>${i + 1}</td>`;
    html += `<td>${a.name || ""}</td>`;
    html += `<td>${a.parent || "None"}</td>`;
    html += `<td>${(a.offspring && a.offspring.length) ? a.offspring.length : "-"}</td>`;
    html += `<td>${a.lifetime ?? "-"}</td>`;
    html += `<td>${a.kills ?? "-"}</td>`;
    html += `<td>${a.foods ?? "-"}</td>`;
    html += `<td>${(a.victims && a.victims.length) ? a.victims.length : "-"}</td>`;
    html += `<td>${(typeof a.magic === "number" ? a.magic.toFixed(1) : "-")}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  // --- FINAL: Inject into page
  document.getElementById("stats").innerHTML = html;
}






setInterval(updateStatsUI, 10000); // update every second
})

const pauseLabel = add([
  text(isPaused ? "▶️ Play" : "⏸️ Pause", { size: 16 }),
  pos(20, 10),
  area(),
  color(255, 255, 255),
  z(100),
  "pauseBtn",
]);

