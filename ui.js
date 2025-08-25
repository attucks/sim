// ----- Better UI: controls + sortable, sticky, compact tables with bars -----

(() => {
  const BUILD_VERSION = "4.05";
  let sortKeyAlive = "kills";
  let sortDirAlive = -1; // 1 = asc, -1 = desc
  let sortKeyDead = "kills";
  let sortDirDead = -1;
  let nameFilter = "";

  // Boot after DOM + Kaboom are ready
  whenDomReady(() => {
    waitFor(() => typeof get === "function", initBetterUI);
  });

  function initBetterUI() {
    // Build label
    safeAdd(() => add([ text(`Build: ${BUILD_VERSION}`, { size: 12 }), pos(10, 580), fixed(), z(1000) ]));

    // Controls + stats container
    ensureStatsShell();
    wireControls();

    // First paint + schedule
    renderUI();
    setInterval(renderUI, 800); // modest cadence to reduce churn
  }

  // ---------- Render ----------
  function renderUI() {
    const statsEl = document.getElementById("stats");
    if (!statsEl) return;

    const animals = (typeof get === "function") ? (get("animal") || []) : [];

    // Filter + sort alive
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

    // Dead rows from snapshot
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
      ${styleTag()}
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

    document.getElementById("stats-body").innerHTML = html;

    // Click handlers: sort + victims toggles
    delegate(document.getElementById("stats-body"), "click", "[data-sort]", onHeaderSort);
    delegate(document.getElementById("stats-body"), "click", ".victims-toggle", e => {
      const row = e.target.closest("tr");
      const details = row?.querySelector(".victims-detail");
      if (details) details.classList.toggle("open");
    });
  }

  // ---------- Row renderers ----------
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
        <td>
          ${victimsCell(r.victims)}
        </td>
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

  // ---------- UI bits ----------
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

  // ---------- Sorting / events ----------
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

  function wireControls() {
    const root = document.getElementById("stats");
    // delegate input event for filter (works across re-renders)
    root.addEventListener("input", (e) => {
      if (e.target && e.target.id === "stats-filter") {
        nameFilter = e.target.value || "";
        renderUI();
      }
    });
  }

  // ---------- Shell / styles ----------
  function ensureStatsShell() {
    if (document.getElementById("stats")) return;

    const wrap = document.createElement("div");
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

    const body = document.createElement("div");
    body.id = "stats-body";
    body.style.overflow = "auto";
    body.style.maxHeight = "calc(65vh - 0px)";
    wrap.appendChild(body);
    document.body.appendChild(wrap);
  }

  function styleTag() {
    return `
      <style>
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
        #stats thead tr:nth-child(2) th { top: 0; } /* fallback if control bar absent */
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
        }
        #stats .victims-detail.open { display:block; }
        #stats tbody tr:hover { background: rgba(255,255,255,0.04); }
      </style>
    `;
  }

  // ---------- Utils ----------
  function familyToCSS(c) {
    return `rgb(${c?.r ?? 255}, ${c?.g ?? 255}, ${c?.b ?? 255})`;
  }

  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function delegate(root, type, selector, handler) {
    if (!root) return;
    root.addEventListener(type, (e) => {
      const t = e.target.closest(selector);
      if (t && root.contains(t)) handler(e);
    });
  }

  function whenDomReady(cb) {
    if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(cb, 0);
    else document.addEventListener("DOMContentLoaded", cb, { once: true });
  }

  function waitFor(test, cb, tries = 200, ms = 50) {
    const id = setInterval(() => {
      let ok = false;
      try { ok = !!test(); } catch(e) {}
      if (ok) { clearInterval(id); cb(); }
      else if (--tries <= 0) clearInterval(id);
    }, ms);
  }

  function safeAdd(fn) { try { fn(); } catch(_) {} }
})();
