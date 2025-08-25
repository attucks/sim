// ui.js — robust UI bootstrap that works in non-module setups

(() => {
  const BUILD_VERSION = "4.04";

  // Run after DOM is ready
  whenDomReady(() => {
    // Wait until Kaboom helpers exist before starting UI
    waitFor(() => typeof window.get === "function" &&
                   typeof window.add === "function" &&
                   typeof window.text === "function", initUI);
  });

  function initUI() {
    // Build label (once)
    safeAdd(() => add([
      text(`Build: ${BUILD_VERSION}`, { size: 12 }),
      pos(10, 580),
      fixed(),
      z(1000),
    ]));

    // Pause button (once)
    let pauseLabel = null;
    safeAdd(() => {
      pauseLabel = add([
        text(window.isPaused ? "▶️ Play" : "⏸️ Pause", { size: 16 }),
        pos(20, 10),
        area(),
        z(1000),
        "pauseBtn",
      ]);
    });

    if (typeof onClick === "function") {
      onClick("pauseBtn", () => {
        window.isPaused = !window.isPaused;
        if (pauseLabel) pauseLabel.text = window.isPaused ? "▶️ Play" : "⏸️ Pause";
      });

      // Click to spawn food inside pen
      onClick(() => {
        if (!reqsReady("mousePos", "penX", "penY", "penWidth", "penHeight", "spawnFoodAt")) return;
        const m = mousePos();
        if (isInsidePen(m)) spawnFoodAt(m.x, m.y);
      });
    }

    ensureStatsContainer();

    // Render immediately, then every second
    safeUpdateStatsUI();
    const uiTimer = setInterval(safeUpdateStatsUI, 1000);

    // Barrier place/remove (B / X)
    if (typeof onKeyPress === "function") {
      onKeyPress("b", () => {
        if (!reqsReady("mousePos", "penX", "penY", "penWidth", "penHeight", "get", "add", "Rect", "vec2", "anchor", "area", "pos", "text")) return;
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
        if (!reqsReady("mousePos", "get", "destroy")) return;
        const m = mousePos();
        const b = get("barrier").find(b => b.pos && b.pos.dist(m) < 10);
        if (b) destroy(b);
      });
    }

    // Auto food spawn (tick-gated)
    let foodTimer = 0;
    if (typeof onUpdate === "function") {
      onUpdate(() => {
        if (!reqsReady("dt")) return;

        // If these aren’t defined yet, no-op rather than crash
        const tick = (typeof window.simTick === "number") ? window.simTick : 0;
        const skip = (typeof window.simSkipFrames === "number") ? window.simSkipFrames : 1;
        if (tick % skip !== 0) return;
        if (window.isPaused) return;

        foodTimer += dt();
        if (typeof window.spawnFoodInterval === "number" &&
            typeof window.spawnFood === "function" &&
            foodTimer >= window.spawnFoodInterval) {
          spawnFood();
          foodTimer = 0;
        }
      });
    }

    // Clean up on hot-reload (optional)
    window.__uiCleanup = () => clearInterval(uiTimer);
  }

  /* --------------------------- Helpers --------------------------- */

  function safeUpdateStatsUI() {
    try {
      updateStatsUI();
    } catch (e) {
      console.warn("[UI] updateStatsUI skipped:", e?.message || e);
    }
  }

  function updateStatsUI() {
    // Guards — if Kaboom not ready yet, render placeholder.
    const statsEl = document.getElementById("stats");
    if (!statsEl) return;

    // If get("animal") not ready, show a note
    if (typeof get !== "function") {
      statsEl.innerHTML = noteBox("Waiting for game scene…");
      return;
    }

    const animals = get("animal") || [];
    let html = "";

    // ALIVE
    html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:12px;">`;
    html += `<thead><tr style="background-color:darkgreen;">`;
    html += `<th>#</th><th>Name</th><th>Parent</th><th>Kids</th><th>HP</th><th>Hun</th><th>Brv</th><th>Grd</th><th>Cur</th><th>Ter</th><th>Kills</th><th>Victims</th>`;
    html += `</tr></thead><tbody>`;

    animals.forEach((a, i) => {
      const name = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "(unnamed)";
      const parent = a.parentName || "None";
      const kids = a.offspring?.length ?? 0;

      const kills = a.stats?.kills ?? 0;
      const victimsArr = Array.isArray(a.victims) ? a.victims : [];
      const victimsText = victimsArr.length ? escapeHtml(victimsArr.join(", ")) : "-";

      const hp = Math.max(0, Math.floor(a.health ?? 0));
      const hunger = (a.hunger ?? 0).toFixed(1);
      const brv = Math.round((a.bravery ?? 0) * 10);
      const grd = Math.round((a.greed ?? 0) * 10);
      const cur = Math.round((a.curiosity ?? 0) * 10);
      const ter = Math.round((a.territorial ?? 0) * 10);

      html += `<tr>`;
      html += `<td>${i + 1}</td>`;
      html += `<td>${escapeHtml(name)}</td>`;
      html += `<td>${escapeHtml(parent)}</td>`;
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

    // DEAD / ANCESTORS
    const dead = Array.isArray(window.ancestorStats) ? window.ancestorStats : [];
    html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">`;
    html += `<thead><tr style="background-color:darkred;">`;
    html += `<th>#</th><th>Name</th><th>Parent</th><th>Kids</th><th>Life</th><th>Kills</th><th>Foods</th><th>Victims</th><th>Magic</th>`;
    html += `</tr></thead><tbody>`;

    dead.forEach((a, i) => {
      const victimsText = Array.isArray(a.victims) && a.victims.length ? escapeHtml(a.victims.join(", ")) : "-";
      html += `<tr>`;
      html += `<td>${i + 1}</td>`;
      html += `<td>${escapeHtml(a.name || "")}</td>`;
      html += `<td>${escapeHtml(a.parent || "None")}</td>`;
      html += `<td>${a.offspring?.length ?? "-"}</td>`;
      html += `<td>${a.lifetime ?? "-"}</td>`;
      html += `<td>${a.kills ?? 0}</td>`;
      html += `<td>${a.foods ?? 0}</td>`;
      html += `<td>${victimsText}</td>`;
      html += `<td>${typeof a.magic === "number" ? a.magic.toFixed(1) : "-"}</td>`;
      html += `</tr>`;
    });

    html += `</tbody></table>`;

    statsEl.innerHTML = html;
  }

  function ensureStatsContainer() {
    // If you already have <div id="stats"></div> in HTML, this does nothing.
    if (!document.getElementById("stats")) {
      if (!document.body) return; // DOM not ready yet (shouldn’t happen due to whenDomReady)
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
    return typeof penX === "number" && typeof penY === "number" &&
           typeof penWidth === "number" && typeof penHeight === "number" &&
           p.x > penX && p.x < penX + penWidth && p.y > penY && p.y < penY + penHeight;
  }

  function snap10(n) { return Math.floor(n / 10) * 10; }

  function familyColorToCSS(color) {
    if (!color) return "white";
    return `rgb(${color.r ?? 255}, ${color.g ?? 255}, ${color.b ?? 255})`;
  }

  // Utilities

  function whenDomReady(cb) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(cb, 0);
    } else {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    }
  }

  function waitFor(testFn, cb, tries = 200, intervalMs = 50) {
    const id = setInterval(() => {
      let ok = false;
      try { ok = !!testFn(); } catch (_) {}
      if (ok) { clearInterval(id); cb(); }
      else if (--tries <= 0) { clearInterval(id); console.warn("[UI] Waited but prerequisites never appeared."); }
    }, intervalMs);
  }

  function safeAdd(fn) {
    try { fn(); } catch (e) { console.warn("[UI] add() failed (will continue):", e?.message || e); }
  }

  function reqsReady(...names) {
    return names.every(n => typeof window[n] !== "undefined");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function noteBox(msg) {
    return `<div style="padding:6px;border:1px dashed #777;background:#111;">${escapeHtml(msg)}</div>`;
  }
})();
