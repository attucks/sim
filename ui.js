// ui.js — robust, self-booting UI (no modules required)
// Requires Kaboom globals when ready: get, add, text, pos, fixed, z, area, onClick, onKeyPress, onUpdate, destroy, Rect, vec2, anchor, dt, mousePos
// Also expects these globals from your sim: isPaused, simTick, simSkipFrames, spawnFoodInterval, spawnFood, spawnFoodAt, penX, penY, penWidth, penHeight, ancestorStats

(() => {
  const BUILD_VERSION = "4.09";
  let sortKeyAlive = "kills";
  let sortDirAlive = -1; // 1 = asc, -1 = desc
  let sortKeyDead = "kills";
  let sortDirDead = -1;
  let nameFilter = "";

  // Boot after DOM, then wait for Kaboom helpers
  whenDomReady(() => {
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

    // Ensure stats container & styles
    ensureStatsShell();                // creates #stats or augments it with #stats-body
    injectStyles(styleCSSString());    // inject CSS into <head> (idempotent)

    // First paint + schedule refresh (light cadence)
    renderUI();
    const uiTimer = setInterval(renderUI, 800);

    // Cleanup handle if you hot-reload
    window.__uiCleanup = () => clearInterval(uiTimer);
  }

  /* --------------------------- Rendering --------------------------- */

  function renderUI() {
    const target = document.getElementById("stats-body") || document.getElementById("stats");
    if (!target) return;

    const animals = (typeof get === "function") ? (get("animal") || []) : [];

    // Alive view model
    let aliveRows = animals.map(a => ({
      name: `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "(unnamed)",
      parent: a.parentName || "None",
      kids: a.offspring?.length ?? 0,
      hp: Math.max(0, Math.floor(a.health ?? 0)),
      hunger: +(a.hunger ?? 0),
      brv: Math.round((a.bravery ?? 0) * 10),
      grd: Math.round((a.greed ?? 0) * 10),
      cur: Math.round((a.curiosity ?? 0) * 10),
      ter: Math.round((a.territorial ?? 0) * 10),
      kills: a.stats?.kills ?? 0,
      foods: a.stats?.foods ?? 0,
      victims: Array.isArray(a.victims) ? a.victims.slice() : [],
      familyColor: a.familyColor || null,
    }));

    if (nameFilter) {
      const q = nameFilter.toLowerCase();
      aliveRows = aliveRows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.parent.toLowerCase().includes(q)
      );
    }
    aliveRows.sort(byKey(sortKeyAlive, sortDirAlive));

    // Dead / Ancestors
    const deadSource = Array.isArray(window.ancestorStats) ? window.ancestorStats : [];
    let deadRows = deadSource.map(a => ({
      name: a.name || "",
      parent: a.parent || "None",
      kids: a.offspring?.length ?? 0,
      life: a.lifetime ?? "-",
      kills: a.kills ?? 0,
      foods: a.foods ?? 0,
      victims: Array.isArray(a.victims) ? a.victims.slice() : [],
      magic: (typeof a.magic === "number") ? a.magic : null,
    }));

    if (nameFilter) {
      const q = nameFilter.toLowerCase();
      deadRows = deadRows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.parent.toLowerCase().includes(q)
      );
    }
    deadRows.sort(byKey(sortKeyDead, sortDirDead));

    // Build HTML
    const html = `
      ${controlsBar()}
      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr>
              ${th("alive", "#")}
              ${th("alive", "Name", "name")}
              ${th("alive", "Parent", "parent")}
              ${th("alive", "Kids", "kids")}
              ${th("alive", "HP", "hp")}
              ${th("alive", "Hun", "hunger")}
              ${th("alive", "Brv", "brv")}
              ${th("alive", "Grd", "grd")}
              ${th("alive", "Cur", "cur")}
              ${th("alive", "Ter", "ter")}
              ${th("alive", "Kills", "kills")}
              ${th("alive", "Victims")}
            </tr>
          </thead>
          <tbody>
            ${aliveRows.map((r, i) => trAlive(r, i)).join("")}
          </tbody>
        </table>
      </div>

      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr>
              ${th("dead", "#")}
              ${th("dead", "Name", "name")}
              ${th("dead", "Parent", "parent")}
              ${th("dead", "Kids", "kids")}
              ${th("dead", "Life", "life")}
              ${th("dead", "Kills", "kills")}
              ${th("dead", "Foods", "foods")}
              ${th("dead", "Victims")}
              ${th("dead", "Magic", "magic")}
            </tr>
          </thead>
          <tbody>
            ${deadRows.map((r, i) => trDead(r, i)).join("")}
          </tbody>
        </table>
      </div>
    `;

    target.innerHTML = html;

    // Wire interactions on the rendered DOM
    delegate(target, "click", "[data-sort]", onHeaderSort);
    delegate(target, "input", "#stats-filter", (e) => {
      nameFilter = e.target.value || "";
      renderUI();
    });
    delegate(target, "click", ".victims-toggle", (e) => {
      const row = e.target.closest("tr");
      const details = row?.querySelector(".victims-detail");
      if (details) details.classList.toggle("open");
    });
  }

  /* --------------------------- Row renderers --------------------------- */

  function trAlive(r, i) {
    const colorDot = r.familyColor
      ? `<span class="dot" style="background:${familyToCSS(r.familyColor)}"></span>`
      : `<span class="dot"></span>`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${colorDot}${esc(r.name)}</td>
        <td>${esc(r.parent)}</td>
        <td class="num">${r.kids || "-"}</td>
        <td class="bar">${bar(r.hp, 100, r.hp + "%")}</td>
        <td class="bar">${bar(r.hunger, 100, r.hunger.toFixed(1))}</td>
        <td class="num">${r.brv}</td>
        <td class="num">${r.grd}</td>
        <td class="num">${r.cur}</td>
        <td class="num">${r.ter}</td>
        <td class="num">${r.kills}</td>
        <td>${victimsCell(r.victims)}</td>
      </tr>
    `;
  }

  function trDead(r, i) {
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.parent)}</td>
        <td class="num">${r.kids || "-"}</td>
        <td class="num">${esc(r.life)}</td>
        <td class="num">${r.kills}</td>
        <td class="num">${r.foods}</td>
        <td>${victimsCell(r.victims)}</td>
        <td class="num">${r.magic == null ? "-" : r.magic.toFixed(1)}</td>
      </tr>
    `;
  }

  /* --------------------------- UI bits --------------------------- */

  function victimsCell(list) {
    if (!list || list.length === 0) return "-";
    const preview = esc(list.slice(0, 3).join(", "));
    const more = list.length > 3 ? ` +${list.length - 3}` : "";
    const full = esc(list.join(", "));
    return `
      <div class="victims">
        <button class="victims-toggle" title="Show all victims">${preview}${more}</button>
        <div class="victims-detail">${full}</div>
      </div>
    `;
  }

  function bar(val, max, label) {
    const pct = Math.max(0, Math.min(100, (val / max) * 100));
    return `
      <div class="meter" title="${esc(label)}">
        <span style="width:${pct.toFixed(1)}%"></span>
        <i>${esc(label)}</i>
      </div>
    `;
  }

  function controlsBar() {
    const dirA = sortDirAlive > 0 ? "↑" : "↓";
    const dirD = sortDirDead > 0 ? "↑" : "↓";
    return `
      <div class="controls">
        <input id="stats-filter" placeholder="Filter by name/parent…" value="${esc(nameFilter)}" />
        <div class="sort-pill">Alive sort: <b>${esc(sortKeyAlive)}</b> ${dirA}</div>
        <div class="sort-pill">Dead sort: <b>${esc(sortKeyDead)}</b> ${dirD}</div>
      </div>
    `;
  }

  function th(scope, label, key) {
    if (!key) return `<th>${esc(label)}</th>`;
    const active = (scope === "alive" ? sortKeyAlive : sortKeyDead) === key ? ' class="active"' : "";
    return `<th${active} data-sort="${scope}:${key}">${esc(label)}</th>`;
  }

  function onHeaderSort(e) {
    const val = e.target.getAttribute("data-sort"); // "alive:kills"
    if (!val) return;
    const [scope, key] = val.split(":");
    if (scope === "alive") {
      if (sortKeyAlive === key) sortDirAlive *= -1;
      else { sortKeyAlive = key; sortDirAlive = -1; }
    } else {
      if (sortKeyDead === key) sortDirDead *= -1;
      else { sortKeyDead = key; sortDirDead = -1; }
    }
    renderUI();
  }

  /* --------------------------- Shell / styles --------------------------- */

  function ensureStatsShell() {
    let wrap = document.getElementById("stats");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "stats";
      wrap.style.position = "absolute";
      wrap.style.right = "8px";
      wrap.style.bottom = "8px";
      wrap.style.width = "480px";
      wrap.style.maxHeight = "65vh";
      wrap.style.overflow = "hidden";
      wrap.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      wrap.style.fontSize = "12px";
      wrap.style.background = "rgba(0,0,0,0.6)";
      wrap.style.color = "#fff";
      wrap.style.padding = "6px";
      wrap.style.border = "1px solid #2a2a2a";
      wrap.style.borderRadius = "8px";
      document.body.appendChild(wrap);
    }
    if (!document.getElementById("stats-body")) {
      const body = document.createElement("div");
      body.id = "stats-body";
      body.style.overflow = "auto";
      body.style.maxHeight = "65vh";
      wrap.appendChild(body);
    }
  }

  function injectStyles(cssStr) {
    const id = "stats-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = cssStr;
    document.head.appendChild(el);
  }

  function styleCSSString() {
    return `
      #stats .controls {
        display:flex; gap:8px; align-items:center; margin-bottom:6px;
        position: sticky; top: 0; background: rgba(0,0,0,0.7); padding: 6px; z-index: 2;
        border-bottom: 1px solid #333;
      }
      #stats .controls input {
        flex:1; min-width: 0; padding:4px 6px; background:#111; color:#fff; border:1px solid #333; border-radius:4px;
      }
      #stats .sort-pill {
        font-size:11px; background:#1e293b; padding:2px 6px; border-radius:999px; white-space:nowrap;
        border:1px solid #334155;
      }
      #stats .tbl-wrap { margin-bottom: 10px; }
      #stats table.grid {
        width: 100%; border-collapse: collapse; table-layout: fixed;
      }
      #stats thead th {
        position: sticky; top: 36px; /* below control bar */
        background: #064e3b; color:#fff; z-index:1; cursor: default;
        padding: 4px; border-bottom:1px solid #0a3c2d;
      }
      #stats thead th.active { text-decoration: underline; }
      #stats tbody td {
        padding: 3px 4px; border-bottom: 1px solid #223; word-wrap: break-word;
      }
      #stats td.num { text-align: right; }
      #stats td.bar { min-width: 90px; }
      #stats .dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:#555; margin-right:6px; vertical-align:middle; }
      #stats .meter { position:relative; height: 12px; background:#0b1220; border:1px solid #223; border-radius:3px; overflow:hidden; }
      #stats .meter > span { display:block; height:100%; background:#22c55e; }
      #stats .meter > i { position:absolute; left:4px; top:50%; transform:translateY(-50%); font-style:normal; font-size:10px; color:#d1d5db; pointer-events:none; }
      #stats .victims { display:block; }
      #stats .victims-toggle {
        background:transparent; color:#a5b4fc; border:0; padding:0; cursor:pointer; text-decoration:underline;
      }
      #stats .victims-detail {
        display:none; margin-top:3px; font-size:11px; color:#e5e7eb;
        background:#0b0f1a; border:1px solid #223; border-radius:4px; padding:4px;
        max-height: 120px; overflow: auto; white-space: normal; word-break: break-word;
      }
      #stats .victims-detail.open { display:block; }
      #stats tbody tr:hover { background: rgba(255,255,255,0.04); }
    `;
  }

  /* --------------------------- Utilities --------------------------- */

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
      else if (--tries <= 0) { clearInterval(id); console.warn("[UI] prerequisites never appeared."); }
    }, intervalMs);
  }

  function safeAdd(fn) {
    try { fn(); } catch (e) { console.warn("[UI] add() failed (continuing):", e?.message || e); }
  }

  function reqsReady(...names) {
    return names.every(n => typeof window[n] !== "undefined");
  }

  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function familyToCSS(c) {
    return `rgb(${c?.r ?? 255}, ${c?.g ?? 255}, ${c?.b ?? 255})`;
  }

  function isInsidePen(p) {
    return typeof penX === "number" && typeof penY === "number" &&
           typeof penWidth === "number" && typeof penHeight === "number" &&
           p.x > penX && p.x < penX + penWidth && p.y > penY && p.y < penHeight + penY;
  }

  function snap10(n) { return Math.floor(n / 10) * 10; }

  function delegate(root, type, selector, handler) {
    if (!root) return;
    root.addEventListener(type, (e) => {
      const t = e.target.closest(selector);
      if (t && root.contains(t)) handler(e);
    });
  }

  function byKey(key, dir) {
    return (a, b) => {
      const av = a[key];
      const bv = b[key];
      const an = typeof av === "string" ? av.toLowerCase() : av;
      const bn = typeof bv === "string" ? bv.toLowerCase() : bv;
      if (an < bn) return -1 * dir;
      if (an > bn) return  1 * dir;
      return 0;
    };
  }
})();
