// ============================================================================
// Simulation: Movement, Missions, Alliances, and Feedback
// Notes:
// - All movement scales by dt().
// - Obstacle proximity dampening reduces jitter near barriers.
// - Personal space + gentle avoidance reduces bunching.
// - Stuck detection with a small perpendicular nudge.
// - Food-seeking prioritized: higher speed + no dampening while eating.
// - Wander reworked: vertical half-step to border, then horizontal half-step, repeat.
// - Alliances use stable color keys; allied legacies are protected.
// - Preserves existing behavior and APIs.
// ============================================================================

// ===== Config (safe to tweak) =================================================
const tileSize = 10;

const AVOID_RADIUS = 2;             // was 10; slightly less "polite" to avoid over-steer
const SLIDE_CHECK_EPS = 0.0001;     // numerical guard
const OBSTACLE_NEAR_DIST = 12;      // start damping speed near barriers
const OBSTACLE_DAMP_MIN = 0.65;     // was 0.5; less harsh overall
const STUCK_DIST_EPS = 0.3;         // "not moving" distance threshold
const STUCK_TIME_LIMIT = 0.6;       // seconds before applying nudge
const NUDGE_SPEED = 40;             // speed for unstick nudge
const NUDGE_TIME = 0.15;            // seconds to apply nudge

// Per-mission speed multipliers (relative to animalSpeed)
const SPEED_MULT = {
  eat: 58.5,
  attack: 87.35,
  flee: 67.2,
  patrol: 57.75,
  roam: 57.8,
  explore: 57.5,
  default: 57.75,
};

// Wander pattern tuning
const WANDER_MARGIN = 10;           // keep wander targets inside the pen by this margin
const WANDER_HALF_RATIO = 0.5;      // go halfway toward the chosen border
const WANDER_ARRIVE_EPS = 2;        // consider arrived if within this distance (px)
const WANDER_MIN_STEP = 8;          // ensure each leg moves at least this much (px)

// ===== Helpers ================================================================

function snapToGrid(pos) {
  return vec2(
    Math.round(pos.x / tileSize) * tileSize,
    Math.round(pos.y / tileSize) * tileSize
  );
}

function pickGridDirection() {
  const dirs = [vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1)];
  return dirs[Math.floor(rand(0, dirs.length))].scale(tileSize);
}

function randomDirection() {
  const v = vec2(rand(-4, 4), rand(-4, 4));
  return v.len() < SLIDE_CHECK_EPS ? vec2(1, 0) : v.unit();
}

function findClosest(list, fromPos) {
  if (!list || list.length === 0) return null;
  let best = list[0];
  let bestD = fromPos.dist(best.pos);
  for (let i = 1; i < list.length; i++) {
    const d = fromPos.dist(list[i].pos);
    if (d < bestD) { best = list[i]; bestD = d; }
  }
  return best;
}

function distanceToNearestBarrier(p, w, h) {
  // Simple nearest-distance estimation by scanning barriers
  let minD = Infinity;
  for (const b of get("barrier")) {
    const bx = b.pos.x, by = b.pos.y;
    const bw = b.width || 10, bh = b.height || 10;

    // Axis-aligned rectangular distance
    const dx = Math.max(bx - (p.x + w), 0, p.x - (bx + bw));
    const dy = Math.max(by - (p.y + h), 0, p.y - (by + bh));
    const d = Math.hypot(dx, dy);
    if (d < minD) minD = d;
  }
  return minD;
}

// ===== Color utils (scaling + stable alliance keys) ==========================

function colorToRGB(c) {
  if (!c) return { r: 255, g: 255, b: 255 };

  // Kaboom rgb() object: { r, g, b }
  if (typeof c === "object" && "r" in c && "g" in c && "b" in c) {
    return { r: Number(c.r) || 0, g: Number(c.g) || 0, b: Number(c.b) || 0 };
  }

  // Array-like: [r, g, b]
  if (Array.isArray(c)) {
    return { r: Number(c[0]) || 0, g: Number(c[1]) || 0, b: Number(c[2]) || 0 };
  }

  // Hex string
  if (typeof c === "string") {
    let s = c.trim();
    if (s.startsWith("#")) s = s.slice(1);
    if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
    const v = parseInt(s.slice(0, 6), 16);
    if (!Number.isNaN(v)) {
      return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    }
  }

  return { r: 255, g: 255, b: 255 };
}

function colorKey(c) {
  const { r, g, b } = colorToRGB(c);
  return `${Math.round(r)}|${Math.round(g)}|${Math.round(b)}`;
}

// Safe color multiply that accepts kaboom color/array/hex
function scaleColor(c, mult = 1) {
  const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const { r, g, b } = colorToRGB(c);
  return rgb(clamp255(r * mult), clamp255(g * mult), clamp255(b * mult));
}

// Provide a tolerant colorsMatch if the project doesn't define one.
if (typeof globalThis.colorsMatch !== "function") {
  globalThis.colorsMatch = function(c1, c2) {
    const a = colorToRGB(c1), b = colorToRGB(c2);
    return a.r === b.r && a.g === b.g && a.b === b.b;
  };
}

// ===== Visual Feedback ========================================================

function showDamage(a) {
  add([
    text("💥", { size: 16 }),
    pos(a.pos.x, a.pos.y - 10),
    color(255, 0, 0),
    anchor("center"),
    lifespan(0.6, { fade: 0.4 }),
    move(UP, 20),
  ]);
}

function showAlliance(a, b) {
  for (const animal of [a, b]) {
    add([
      text("🤝", { size: 16 }),
      pos(animal.pos.x, animal.pos.y - 12),
      color(0, 200, 255),
      anchor("center"),
      lifespan(1, { fade: 0.5 }),
      move(UP, 10),
    ]);
  }
}

function showBirth(a) {
  add([
    text("🐣", { size: 16 }),
    pos(a.pos.x, a.pos.y - 10),
    anchor("center"),
    lifespan(1, { fade: 0.5 }),
    move(UP, 10),
  ]);
}

// ===== Alliances (stable keys + allied checks) ===============================

// Internal map: "r|g|b" -> Set("r|g|b")
const __alliances = new Map();

function areAlliedColors(c1, c2) {
  const k1 = colorKey(c1), k2 = colorKey(c2);
  const set = __alliances.get(k1);
  return !!(set && set.has(k2));
}

function findClosestEnemy(a) {
  const enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
  if (enemies.length === 0) return null;
  return enemies.reduce(
    (closest, o) => (a.pos.dist(o.pos) < a.pos.dist(closest.pos) ? o : closest),
    enemies[0]
  );
}

// Keep your existing trait gating
function traitsCompatible(a, b) {
  const mainDiff = 0.1;
  const greedDiff = Math.abs(a.greed - b.greed);
  const territorialDiff = Math.abs(a.territorial - b.territorial);
  const curiosityDiff = Math.abs(a.curiosity - b.curiosity);
  return greedDiff <= mainDiff && territorialDiff <= mainDiff && curiosityDiff <= mainDiff;
}

// Upgraded: still populates the old familyAlliances object, but also
// stores stable string keys so we can reliably check alliance later.
function formAlliance(familyA, familyB) {
  // Stable map for runtime checks
  const kA = colorKey(familyA);
  const kB = colorKey(familyB);
  if (!__alliances.has(kA)) __alliances.set(kA, new Set());
  if (!__alliances.has(kB)) __alliances.set(kB, new Set());
  __alliances.get(kA).add(kB);
  __alliances.get(kB).add(kA);

  // Mirror into external store if you're using it elsewhere
  if (typeof familyAlliances === "object" && familyAlliances !== null) {
    familyAlliances[kA] = familyAlliances[kA] || [];
    familyAlliances[kB] = familyAlliances[kB] || [];
    if (!familyAlliances[kA].includes(kB)) familyAlliances[kA].push(kB);
    if (!familyAlliances[kB].includes(kA)) familyAlliances[kB].push(kA);
  }
}

function maybeFormAlliance(a) {
  const potentialAllies = get("animal").filter(o =>
    o !== a && !areRelatives(a, o) && a.pos.dist(o.pos) < 180
  );
  for (const o of potentialAllies) {
    if (traitsCompatible(a, o)) {
      formAlliance(a.familyColor, o.familyColor);
      addNews(`${a.firstName}'s family allied with ${o.firstName}'s family!`);
      showAlliance(a, o);
    }
  }
}

// ===== Targeting (kept for compatibility) ====================================

function findTarget(a) {
  const foods = get("food");
  const others = get("animal").filter(x => x !== a && x.alive);

  let closestFood = null, foodDist = Infinity;
  let closestPrey = null, preyDist = Infinity;

  for (const f of foods) {
    const dist = a.pos.dist(f.pos);
    if (dist < foodDist) {
      closestFood = f;
      foodDist = dist;
    }
  }

  for (const o of others) {
    if (areRelatives(a, o)) continue;
    const dist = a.pos.dist(o.pos);
    if (dist < preyDist) {
      closestPrey = o;
      preyDist = dist;
    }
  }

  if (closestFood && (!closestPrey || foodDist < preyDist)) {
    a.target = closestFood;
  } else if (closestPrey) {
    a.target = closestPrey;
    closestPrey.mode = "flee";
    closestPrey.target = a;
  } else {
    a.target = null;
  }
}

// ===== Wander logic (vertical half-step then horizontal half-step) ============

function clampToPen(x, y) {
  const left  = penX + WANDER_MARGIN;
  const right = penX + penWidth - WANDER_MARGIN;
  const top   = penY + WANDER_MARGIN;
  const bot   = penY + penHeight - WANDER_MARGIN;
  return vec2(
    clamp(x, left, right),
    clamp(y, top, bot),
  );
}

function pickHalfwayTargetVertical(a) {
  const topY = penY + WANDER_MARGIN;
  const botY = penY + penHeight - WANDER_MARGIN;
  const goUp = rand(1) < 0.5;
  const borderY = goUp ? topY : botY;

  let targetY = a.pos.y + (borderY - a.pos.y) * WANDER_HALF_RATIO;
  // ensure minimum progress
  if (Math.abs(targetY - a.pos.y) < WANDER_MIN_STEP) {
    targetY = a.pos.y + Math.sign(borderY - a.pos.y) * WANDER_MIN_STEP;
  }
  const p = clampToPen(a.pos.x, targetY);
  return vec2(p.x, p.y);
}

function pickHalfwayTargetHorizontal(a) {
  const leftX = penX + WANDER_MARGIN;
  const rightX = penX + penWidth - WANDER_MARGIN;
  const goLeft = rand(1) < 0.5;
  const borderX = goLeft ? leftX : rightX;

  let targetX = a.pos.x + (borderX - a.pos.x) * WANDER_HALF_RATIO;
  if (Math.abs(targetX - a.pos.x) < WANDER_MIN_STEP) {
    targetX = a.pos.x + Math.sign(borderX - a.pos.x) * WANDER_MIN_STEP;
  }
  const p = clampToPen(targetX, a.pos.y);
  return vec2(p.x, p.y);
}

function ensureWanderTarget(a) {
  if (!a._wanderAxis) a._wanderAxis = "vertical"; // first leg is vertical
  if (!a._wanderTarget) {
    a._wanderTarget =
      a._wanderAxis === "vertical"
        ? pickHalfwayTargetVertical(a)
        : pickHalfwayTargetHorizontal(a);
  }
}

function advanceWanderIfArrived(a) {
  if (!a._wanderTarget) return;
  if (a.pos.dist(a._wanderTarget) <= WANDER_ARRIVE_EPS) {
    // flip axis and pick the next leg on next frame
    a._wanderAxis = (a._wanderAxis === "vertical") ? "horizontal" : "vertical";
    a._wanderTarget = null;
  }
}

// ===== Movement Core ==========================================================

/**
 * tryMove(a, dirVec, baseSpeed, opts)
 * opts.ignoreDampening = true to bypass obstacle speed damping (used when eating)
 */
function tryMove(a, dirVec, baseSpeed, opts = {}) {
  const { ignoreDampening = false } = opts;
  const dtv = dt();
  if (!dtv) return;

  // Normalize input direction; handle zero vector
  const dir = (dirVec && dirVec.len() > SLIDE_CHECK_EPS) ? dirVec.unit() : vec2(0, 0);
  if (dir.len() <= SLIDE_CHECK_EPS) return;

  // Obstacle proximity speed dampening (unless disabled)
  let speed = baseSpeed;
  if (!ignoreDampening) {
    const nearBarrierDist = distanceToNearestBarrier(a.pos, a.width, a.height);
    const damp =
      isFinite(nearBarrierDist) && nearBarrierDist < OBSTACLE_NEAR_DIST
        ? Math.max(OBSTACLE_DAMP_MIN, nearBarrierDist / OBSTACLE_NEAR_DIST)
        : 1.0;
    speed *= damp;
  }

  const moveStep = dir.scale(speed * dtv);
  const nextPos = a.pos.add(moveStep);

  // Barrier intersection test (AABB)
  const blocked = get("barrier").some(b => {
    const bPos = b.pos;
    const bW = b.width || 10;
    const bH = b.height || 10;
    return (
      nextPos.x < bPos.x + bW &&
      nextPos.x + a.width > bPos.x &&
      nextPos.y < bPos.y + bH &&
      nextPos.y + a.height > bPos.y
    );
  });

  if (!blocked) {
    // Personal space avoidance
    const buddy = get("animal").find(o =>
      o !== a && o.alive && o.pos.dist(nextPos) < AVOID_RADIUS
    );

    if (buddy) {
      const avoidVec = a.pos.sub(buddy.pos).unit();
      const avoidStep = avoidVec.scale(speed * 0.5 * dtv);
      a.move(avoidStep);
    } else {
      a.move(moveStep);
    }
  } else {
    // Slide X then Y if fully blocked
    const slideX = vec2(moveStep.x, 0);
    const tryX = a.pos.add(slideX);
    const blockedX = get("barrier").some(b => {
      const p = b.pos;
      const w = b.width || 10, h = b.height || 10;
      return (
        tryX.x < p.x + w &&
        tryX.x + a.width > p.x &&
        a.pos.y < p.y + h &&
        a.pos.y + a.height > p.y
      );
    });

    if (!blockedX && Math.abs(slideX.x) > SLIDE_CHECK_EPS) {
      a.move(slideX);
      return;
    }

    const slideY = vec2(0, moveStep.y);
    const tryY = a.pos.add(slideY);
    const blockedY = get("barrier").some(b => {
      const p = b.pos;
      const w = b.width || 10, h = b.height || 10;
      return (
        a.pos.x < p.x + w &&
        a.pos.x + a.width > p.x &&
        tryY.y < p.y + h &&
        a.pos.y + a.height > p.y
      );
    });

    if (!blockedY && Math.abs(slideY.y) > SLIDE_CHECK_EPS) {
      a.move(slideY);
      return;
    }

    // No slide possible → stop this frame
    return;
  }
}

// ===== Missions ===============================================================

function decideMission(a) {
  // 1) Emergency Flee
  if (a.health < 30) {
    a.mission = { type: "flee", target: findClosestEnemy(a), timer: 0 };
    return;
  }

  // 2) Eat if hungry
  if (a.hunger > (3 - a.greed)) {
    const foods = get("food");
    const food = (foods.length > 0)
      ? foods.reduce((closest, f) =>
          a.pos.dist(f.pos) < a.pos.dist(closest.pos) ? f : closest
        )
      : null;
    if (food) {
      a.mission = { type: "eat", target: food, timer: 0 };
      return;
    }
  }

  // 3) Defend nearby legacy
  if (get("legacy").length > 0 && a.enemies && a.enemies.length > 0) {
    const enemyNearLegacy = a.enemies.find(e =>
      get("legacy").some(l =>
        colorsMatch(l.familyColor, a.familyColor) && l.pos.dist(e.pos) < 60
      )
    );
    if (enemyNearLegacy) {
      a.mission = { type: "defend", target: enemyNearLegacy, timer: 0 };
      return;
    }
  }

  // 4) Patrol own legacy (territorial)
  if (a.territorial > 0.5 && get("legacy").length > 0 && rand(1) < 0.4) {
    const myLegacy = findClosest(
      get("legacy").filter(l => colorsMatch(l.familyColor, a.familyColor)),
      a.pos
    );
    if (myLegacy) {
      a.mission = { type: "patrol", target: myLegacy, timer: 0 };
      return;
    }
  }

  // 5) Roam with pack (allies nearby)
  if (a.allies && a.allies.length > 0 && rand(1) < 0.3) {
    const packMate = a.allies[Math.floor(rand(0, a.allies.length))];
    if (packMate) {
      a.mission = { type: "roam", target: packMate, timer: 0 };
      return;
    }
  }

  // 6) Attack enemy if available
  if (a.enemies && a.enemies.length > 0) {
    const nearEnemy = a.enemies.find(e => a.pos.dist(e.pos) < 180);
    if (nearEnemy && rand(1) < 0.7) {
      a.mission = { type: "attack", target: nearEnemy, timer: 0 };
      return;
    }
  }

  // 7) Place new legacy (territorial/old enough)
  if (
    a.stats.lifetime > goldAge &&
    a.stats.lifetime - (a.lastLegacyTime || 0) > 30 &&
    rand(1) < (a.territorial + a.legacyDesire) / 2
  ) {
    a.mission = { type: "legacy", target: null, timer: 0 };
    return;
  }

  // 8) Curious exploration
  if (a.curiosity > 0.5 && rand(1) < 0.6) {
    a.mission = { type: "explore", target: null, timer: 0 };
    return;
  }

  // 9) Fallback explore
  a.mission = { type: "explore", target: null, timer: 0 };
}

// ===== Main Update ============================================================

onUpdate("animal", (a) => {
  if (isPaused || !a.alive) return;
  if (simTick % simSkipFrames !== 0) return;

  // Periodic scans (allies/enemies) + hungry re-target
  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 0.5) { // scan a bit more often than before
    a.allies = get("animal").filter(o => o !== a && areRelatives(a, o) && o.alive);
    a.enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);

    // If hungry, aggressively retarget nearest food mid-mission
    if (a.hunger > (3 - a.greed)) {
      const foods = get("food");
      if (foods.length) {
        const nearestFood = foods.reduce(
          (c, f) => (a.pos.dist(f.pos) < a.pos.dist(c.pos) ? f : c),
          foods[0]
        );
        a.mission = { type: "eat", target: nearestFood, timer: 0 };
      }
    }

    a.scanTimer = 0;
  }

  // Lifetime + Hunger
  a.stats.lifetime += dt();
  a.hunger += dt() * hungerRate;

  if (a.hunger > starvationThreshold) {
    a.hungerTime += dt();
    if (a.hungerTime > starvationTimeLimit) {
      return killAnimal(a, "starvation");
    }
  } else {
    a.hungerTime = 0;
  }

  // Mission system
  a.mission = a.mission || { type: "none", target: null, timer: 0 };
  a.mission.timer += dt();

  if (!a.mission.type || a.mission.timer > 10 || (a.mission.target && !a.mission.target.exists)) {
    decideMission(a);
  }

  // === Movement by mission ===================================================
  switch (a.mission.type) {
    case "eat": {
      if (a.mission.target) {
        const s = animalSpeed * (SPEED_MULT.eat ?? 1);
        // ignore dampening so they don't crawl along walls chasing food
        tryMove(a, a.mission.target.pos.sub(a.pos), s, { ignoreDampening: true });
      }
      break;
    }

    case "attack": {
      if (a.mission.target) {
        const s = animalSpeed * (SPEED_MULT.attack ?? 1);
        tryMove(a, a.mission.target.pos.sub(a.pos), s);
      }
      break;
    }

    case "flee": {
      if (a.mission.target) {
        const s = animalSpeed * (SPEED_MULT.flee ?? 1);
        tryMove(a, a.pos.sub(a.mission.target.pos), s);
      }
      break;
    }

    case "legacy": {
      if (!a.hasJustPlacedLegacy) {
        leaveLegacyBlock(a);
        a.lastLegacyTime = a.stats.lifetime;
        a.hasJustPlacedLegacy = true;
      }
      a.mission.type = "none";
      break;
    }

    case "defend": {
      if (a.mission.target) {
        const s = animalSpeed * (SPEED_MULT.attack ?? 1);
        tryMove(a, a.mission.target.pos.sub(a.pos), s);
      }
      break;
    }

    case "patrol": {
      if (a.mission.target) {
        const s = animalSpeed * (SPEED_MULT.patrol ?? 1);
        tryMove(a, a.mission.target.pos.sub(a.pos), s);
      }
      break;
    }

    case "roam": {
      if (a.mission.target) {
        const s = animalSpeed * (SPEED_MULT.roam ?? 1);
        tryMove(a, a.mission.target.pos.sub(a.pos), s);
      }
      break;
    }

    case "explore": {
      // New wander pattern: vertical half-step → horizontal half-step → repeat
      ensureWanderTarget(a);
      const s = animalSpeed * (SPEED_MULT.explore ?? 1);
      if (a._wanderTarget) {
        // If already at/near target, advance to next leg before moving
        if (a.pos.dist(a._wanderTarget) <= WANDER_ARRIVE_EPS) {
          advanceWanderIfArrived(a);
          ensureWanderTarget(a);
        }
        if (a._wanderTarget) {
          tryMove(a, a._wanderTarget.sub(a.pos), s);
          // Check again after moving; if arrived, flip for next frame
          advanceWanderIfArrived(a);
        }
      }
      break;
    }

    default: {
      // Default also uses the wander pattern
      ensureWanderTarget(a);
      const s = animalSpeed * (SPEED_MULT.default ?? 1);
      if (a._wanderTarget) {
        if (a.pos.dist(a._wanderTarget) <= WANDER_ARRIVE_EPS) {
          advanceWanderIfArrived(a);
          ensureWanderTarget(a);
        }
        if (a._wanderTarget) {
          tryMove(a, a._wanderTarget.sub(a.pos), s);
          advanceWanderIfArrived(a);
        }
      }
    }
  }

  // === Attack logic ==========================================================
// ensure helpers exist somewhere near your init
function ensureStats(animal) {
  if (!animal.stats) animal.stats = { kills: 0, foods: 0 };
  if (!Array.isArray(animal.victims)) animal.victims = [];
}
function fullName(a) { return `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(); }

a.attackTimer = (a.attackTimer || 0) + dt();

if (a.mission?.type === "attack" && a.mission.target) {
  const t = a.mission.target;

  // target may have died earlier this frame
  if (!t.alive) {
    a.mission = { type: "none", target: null, timer: 0 };
    return;
  }

  // close enough to hit?
  if (a.pos.dist(t.pos) < 5) {
    if (a.attackTimer >= a.attackCooldown) {
      a.attackTimer = 0;

      if (rand(1) > 0.1) {
        const damage = Math.floor(rand(5, 100));
        t.health = Math.max(0, (t.health ?? 0) - damage);
        showDamage(t);
        addNews?.(`${fullName(a)} hits ${t.firstName} for ${damage} damage!`);

        if (t.health <= 0 && t.alive !== false) {
          // credit killer before calling killAnimal
          ensureStats(a);
          const victimName = fullName(t);
          a.stats.kills++;
          a.victims.push(victimName);
          t.killedBy = fullName(a);

          addNews?.(`${fullName(a)} defeated ${t.firstName}! (Kills: ${a.stats.kills})`);

          // call killAnimal with context if supported, else fallback to reason string
          try {
            killAnimal(t, { cause: "defeated", killer: a });
          } catch {
            killAnimal(t, "defeated");
          }

          a.mission = { type: "none", target: null, timer: 0 };
        }
      } else {
        addNews?.(`${fullName(a)} missed ${a.mission.target.firstName}!`);
      }
    }
  }
}


  // === Color feedback ========================================================
  const colorMultiplier =
    (a.mission.type === "explore") ? 1.0 :
    (a.mission.type === "eat") ? 1.1 :
    (a.mission.type === "attack") ? 1.3 :
    (a.mission.type === "flee") ? 0.7 :
    1.0;
  a.color = scaleColor(a.familyColor, colorMultiplier);

  // === Badge for gold age ====================================================
  if (a.stats.lifetime > goldAge && !a.hasBadge) {
    a.badge = add([
      rect(5, 5),
      pos(a.pos.x, a.pos.y - 8),
      color(a.familyColor),
      area(),
      "badge",
    ]);
    a.hasBadge = true;
  }
  if (a.badge) {
    a.badge.pos = vec2(a.pos.x, a.pos.y - 8);
  }

  // === Repel logic (barriers, legacies, corpses) =============================
  a.repelTimer = (a.repelTimer || 0) + dt();
  if (a.repelTimer > 0.5) {
    for (const b of [...get("barrier"), ...get("legacy")]) {
      const dist = a.pos.dist(b.pos);
      if (dist < barrierRepelDistance) {
        const away = a.pos.sub(b.pos).unit();
        tryMove(a, away, 20);
      }
      // Prevent stomping allied legacies
      if (
        dist < 20 &&
        b.isLegacy &&
        !colorsMatch(a.familyColor, b.familyColor) &&
        !areAlliedColors(a.familyColor, b.familyColor)
      ) {
        if (rand(1) < a.territorial * 0.3) {
          destroy(b);
        }
      }
    }
    for (const c of get("corpse")) {
      if (a.pos.dist(c.pos) < corpseRepelDistance) {
        const away = a.pos.sub(c.pos).unit();
        tryMove(a, away, 20);
      }
    }
    a.repelTimer = 0;
  }

  // === Help family ===========================================================
  a.helpTimer = (a.helpTimer || 0) + dt();
  if (a.helpTimer > 1) {
    if (a.allies) {
      for (const o of a.allies) {
        if (o.mode === "flee" && o.target && !areRelatives(a, o.target)) {
          a.mission = { type: "attack", target: o.target, timer: 0 };
          break;
        }
      }
    }
    a.helpTimer = 0;
  }

  // === Birth logic ===========================================================
  if (a.hunger < 1) {
    a.satedTime += dt();
    if (a.satedTime > birthingTime) {
      a.readyToBirth = true;
    }
  } else {
    a.satedTime = 0;
  }

  if (a.readyToBirth && a.hunger > birthingHungerThreshold) {
    if (get("animal").length < maxPopulation) {
      const cx = a.pos.x + rand(-20, 20);
      const cy = a.pos.y + rand(-20, 20);
      const child = spawnAnimal(cx, cy, a);
      showBirth(child);
      a.readyToBirth = false;
      a.birthTimer = 0;
    } else {
      a.birthTimer = 0;
    }
  }

  // === Border clamp ==========================================================
  const boundsMargin = 5;
  if (a.pos.x < penX + boundsMargin) a.pos.x = penX + boundsMargin;
  if (a.pos.x > penX + penWidth - boundsMargin) a.pos.x = penX + penWidth - boundsMargin;
  if (a.pos.y < penY + boundsMargin) a.pos.y = penY + boundsMargin;
  if (a.pos.y > penY + penHeight - boundsMargin) a.pos.y = penY + penHeight - boundsMargin;

  // === Alliances =============================================================
  a.allianceTimer = (a.allianceTimer || 0) + dt();
  if (a.allianceTimer > 5) {
    maybeFormAlliance(a);
    a.allianceTimer = 0;
  }

  // === Stuck detection & unstick nudge ======================================
  const prev = a._prevPos || a.pos.clone();
  const moved = a.pos.dist(prev);

  a._stuckTimer = (a._stuckTimer || 0) + dt();
  if (moved > STUCK_DIST_EPS) {
    a._stuckTimer = 0;
  }

  if (a._stuckTimer > STUCK_TIME_LIMIT) {
    a._stuckTimer = 0;
    const v =
      a.mission && a.mission.target
        ? a.mission.type === "flee"
          ? a.pos.sub(a.mission.target.pos)
          : a.mission.target.pos ? a.mission.target.pos.sub(a.pos) : randomDirection()
        : randomDirection();

    // Perpendicular nudge: rotate 90 degrees
    const perp = vec2(-v.y, v.x).unit();
    const endTime = (a._nudgeUntil || 0) + NUDGE_TIME;
    a._nudgeUntil = time() + NUDGE_TIME;

    if (time() < endTime) {
      tryMove(a, perp, NUDGE_SPEED);
    }

    // Reset wander leg to avoid getting stuck oscillating
    a._wanderTarget = null;
  }

  a._prevPos = a.pos.clone();
});
