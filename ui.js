// ui.js — single-pass UI wiring for stats, build label, pause, food/barriers
// Assumes these globals/functions already exist elsewhere in your project:
//   isPaused, simTick, simSkipFrames, spawnFoodInterval, spawnFood, spawnFoodAt
//   penX, penY, penWidth, penHeight
//   ancestorStats (array you push into on death)
//   get("animal"), onClick, onKeyPress, onUpdate, mousePos, add, text, pos, fixed, area, z, color, destroy, Rect, vec2, anchor, rand, dt

const BUILD_VERSION = "4.03";

export function initUI() {
  // --- Build label (one-time) ---
  add([
    text(`Build: ${BUILD_VERSION}`, { size: 12 }),
    pos(10, 580),
    fixed(),
    z(1000),
  ]);

  // --- Pause button (one-time) ---
  const pauseLabel = add([
    text(isPaused ? "▶️ Play" : "⏸️ Pause", { size: 16 }),
    pos(20, 10),
    area(),
    color(255, 255, 255),
    z(1000),
    "pauseBtn",
  ]);

  onClick("pauseBtn", () => {
    isPaused = !isPaused;
    pauseLabel.text = isPaused ? "▶️ Play" : "⏸️ Pause";
  });

  // --- Ensure #stats exists (once) ---
  ensureStatsContainer();

  // --- Stats UI refresh (once per second) ---
  // Use a single interval, not inside onUpdate.
  setInterval(updateStatsUI, 1000);
  // Do an immediate paint so UI shows up right away.
  updateStatsUI();

  // --- Mouse click: spawn food inside pen ---
  onClick(() => {
    const m = mousePos();
    if (isInsidePen(m)) {
      spawnFoodAt(m.x, m.y);
    }
  });

  // --- Barrier place/remove (B/X) ---
  onKeyPress("b", () => {
    const m = mousePos();
    if (!isInsidePen(m)) return;

    const sx = snap10(m.x - penX) + penX;
    const sy = snap10(m.y - penY) + penY;

    const exists = get("barrier").find(b =>
      Math.abs(b.pos.x - sx) < 1 && Math.abs(b.pos.y - sy) < 1
    );

    if (!exists) {
      add([
        text("🌳", { size: 18 }),
        pos(sx, sy),
        anchor("center"),
        area({ shape: new Rect(vec2(0), 18, 18) }),
        "barrier",
        { isNLB: true },
      ]);
    }
  });

  onKeyPress("x", () => {
    const m = mousePos();
    const b = get("barrier").find(b => b.pos && b.pos.dist(m) < 10);
    if (b) destroy(b);
  });

  // --- Food auto-spawn timer (tick-gated) ---
  let foodTimer = 0;
  onUpdate(() => {
    // respect simSkipFrames, but do not add UI here
    if (simTick % simSkipFrames !== 0) return;
    if (isPaused) return;

    foodTimer += dt();
    if (foodTimer >= spawnFoodInterval) {
      spawnFood();
      foodTimer = 0;
    }
  });
}

/* ============================= Helpers ============================= */

function ensureStatsContainer() {
  if (!document.getElementById("stats")) {
    const wrap = document.createElement("div");
    wrap.id = "stats";
    wrap.style.position = "absolute";
    wrap.style.right = "8px";
    wrap.style.bottom = "8px";
    wrap.style.width = "420px";
    wrap.style.maxHeight = "60vh";
    wrap.style.overflow = "auto";
    wrap.style.fontFamily = "monospace";
    wrap.style.fontSize = "12px";
    wrap.style.background = "rgba(0,0,0,0.5)";
    wrap.style.color = "#fff";
    wrap.style.padding = "6px";
    wrap.style.border = "1px solid #2a2a2a";
    wrap.style.borderRadius = "6px";
    document.body.appendChild(wrap);
  }
}

function isInsidePen(p) {
  return p.x > penX && p.x < penX + penWidth && p.y > penY && p.y < penY + penHeight;
}

function snap10(n) { return Math.floor(n / 10) * 10; }

function familyColorToCSS(color) {
  if (!color) return "white";
  return `rgb(${color.r ?? 255}, ${color.g ?? 255}, ${color.b ?? 255})`;
}

function updateStatsUI() {
  const animals = get("animal"); // live objects in scene

  // Build ALIVE table
  let html = "";
  html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:12px;">`;
  html += `<thead><tr style="background-color:darkgreen;">`;
  html += `<th>#</th><th>Name</th><th>Parent</th><th>Kids</th><th>HP</th><th>Hun</th><th>Brv</th><th>Grd</th><th>Cur</th><th>Ter</th><th>Kills</th><th>Victims</th>`;
  html += `</tr></thead><tbody>`;

  animals.forEach((a, i) => {
    const name = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
    const parent = a.parentName || "None";
    const kids = a.offspring?.length ?? 0;

    // ensure fields exist so UI never breaks
    const kills = a.stats?.kills ?? 0;
    const foods = a.stats?.foods ?? 0; // not shown in alive table but kept handy
    const victimsArr = Array.isArray(a.victims) ? a.victims : [];
    const victimsText = victimsArr.length ? victimsArr.join(", ") : "-";

    const hp = Math.max(0, Math.floor(a.health ?? 0));
    const hunger = (a.hunger ?? 0).toFixed(1);

    const brv = Math.round((a.bravery ?? 0) * 10);
    const grd = Math.round((a.greed ?? 0) * 10);
    const cur = Math.round((a.curiosity ?? 0) * 10);
    const ter = Math.round((a.territorial ?? 0) * 10);

    html += `<tr>`;
    html += `<td>${i + 1}</td>`;
    html += `<td style="color:${familyColorToCSS(a.familyColor)}">${name}</td>`;
    html += `<td>${parent}</td>`;
    html += `<td>${kids || "-"}</td>`;
    html += `<td>${hp}</td>`;
    html += `<td>${hunger}</td>`;
    html += `<td>${brv}</td>`;
    html += `<td>${grd}</td>`;
    html += `<td>${cur}</td>`;
    html += `<td>${ter}</td>`;
    html += `<td>${kills}</td>`;
    html += `<td>${victimsText}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  // Build DEAD / ANCESTORS table from snapshot array
  html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">`;
  html += `<thead><tr style="background-color:darkred;">`;
  html += `<th>#</th><th>Name</th><th>Parent</th><th>Kids</th><th>Life</th><th>Kills</th><th>Foods</th><th>Victims</th><th>Magic</th>`;
  html += `</tr></thead><tbody>`;

  (ancestorStats ?? []).forEach((a, i) => {
    const victimsText = a.victims?.length ? a.victims.join(", ") : "-";
    html += `<tr>`;
    html += `<td>${i + 1}</td>`;
    html += `<td>${a.name || ""}</td>`;
    html += `<td>${a.parent || "None"}</td>`;
    html += `<td>${a.offspring?.length ?? "-"}</td>`;
    html += `<td>${a.lifetime ?? "-"}</td>`;
    html += `<td>${a.kills ?? 0}</td>`;
    html += `<td>${a.foods ?? 0}</td>`;
    html += `<td>${victimsText}</td>`;
    html += `<td>${typeof a.magic === "number" ? a.magic.toFixed(1) : "-"}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  document.getElementById("stats").innerHTML = html;
}
