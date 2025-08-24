// ============================================================================
// Simulation: Movement, Missions, Alliances, and Feedback
// Notes:
// - All movement now consistently scales by dt().
// - Added obstacle proximity dampening to reduce jitter at barriers.
// - Increased personal space + gentle avoidance to reduce bunching.
// - Added stuck detection with a small perpendicular nudge.
// - Preserves existing behavior and APIs.
// ============================================================================

// ===== Config (safe to tweak) =================================================
const tileSize = 10;

const AVOID_RADIUS = 10;            // Personal space radius (was ~6)
const SLIDE_CHECK_EPS = 0.0001;     // Numerical guard
const OBSTACLE_NEAR_DIST = 12;      // Start damping speed near barriers
const OBSTACLE_DAMP_MIN = 0.5;      // Minimum speed multiplier near obstacles
const STUCK_DIST_EPS = 0.3;         // "Not moving" distance threshold
const STUCK_TIME_LIMIT = 0.6;       // Seconds before applying nudge
const NUDGE_SPEED = 40;             // Speed for unstick nudge
const NUDGE_TIME = 0.15;            // Seconds to apply nudge

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
  const v = vec2(rand(-1, 1), rand(-1, 1));
  return v.len() < SLIDE_CHECK_EPS ? vec2(1, 0) : v.unit();
}

function distanceToNearestBarrier(p, w, h) {
  // Simple nearest distance estimation by scanning barriers
  // (fast enough for modest counts; upgrade to spatial hashing if needed)
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

// Replace the old scaleColor with this
function scaleColor(c, mult = 1) {
  function toRGB(x) {
    if (!x) return { r: 255, g: 255, b: 255 };

    // Kaboom rgb() object: { r, g, b }
    if (typeof x === "object" && "r" in x && "g" in x && "b" in x) {
      return { r: Number(x.r) || 0, g: Number(x.g) || 0, b: Number(x.b) || 0 };
    }

    // Array-like: [r, g, b]
    if (Array.isArray(x)) {
      return { r: Number(x[0]) || 0, g: Number(x[1]) || 0, b: Number(x[2]) || 0 };
    }

    // Hex string: "#RRGGBB" / "RRGGBB" / "#RGB"
    if (typeof x === "string") {
      let s = x.trim();
      if (s.startsWith("#")) s = s.slice(1);
      if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
      const v = parseInt(s.slice(0, 6), 16);
      if (!Number.isNaN(v)) {
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
      }
    }

    return { r: 255, g: 255, b: 255 };
  }

  const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const { r, g, b } = toRGB(c);
  return rgb(clamp255(r * mult), clamp255(g * mult), clamp255(b * mult));
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

// ===== Alliances =============================================================

function findClosestEnemy(a) {
  const enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
  if (enemies.length === 0) return null;
  return enemies.reduce(
    (closest, o) => (a.pos.dist(o.pos) < a.pos.dist(closest.pos) ? o : closest),
    enemies[0]
  );
}

function formAlliance(familyA, familyB) {
  if (!familyAlliances[familyA]) familyAlliances[familyA] = [];
  if (!familyAlliances[familyB]) familyAlliances[familyB] = [];
  if (!familyAlliances[familyA].includes(familyB)) familyAlliances[familyA].push(familyB);
  if (!familyAlliances[familyB].includes(familyA)) familyAlliances[familyB].push(familyA);
}

function traitsCompatible(a, b) {
  const greedDiff = Math.abs(a.greed - b.greed);
  const territorialDiff = Math.abs(a.territorial - b.territorial);
  const curiosityDiff = Math.abs(a.curiosity - b.curiosity);
  return greedDiff <= 0.4 && territorialDiff <= 0.5 && curiosityDiff <= 0.6;
}

function maybeFormAlliance(a) {
  const potentialAllies = get("animal").filter(o =>
    o !== a && !areRelatives(a, o) && a.pos.dist(o.pos) < 60
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

// ===== Movement Core ==========================================================

function tryMove(a, dirVec, baseSpeed) {
  const dtv = dt();
  if (!dtv) return;

  // Normalize input direction; handle zero vector
  const dir = (dirVec && dirVec.len() > SLIDE_CHECK_EPS) ? dirVec.unit() : vec2(0, 0);
  if (dir.len() <= SLIDE_CHECK_EPS) return;

  // Obstacle proximity speed dampening
  const nearBarrierDist = distanceToNearestBarrier(a.pos, a.width, a.height);
  const damp =
    isFinite(nearBarrierDist) && nearBarrierDist < OBSTACLE_NEAR_DIST
      ? Math.max(OBSTACLE_DAMP_MIN, nearBarrierDist / OBSTACLE_NEAR_DIST)
      : 1.0;

  const speed = baseSpeed * damp;
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

  // === Grid-based wandering (unchanged logic; dt-safe) =======================
  if (a.mode === "wander") {
    if (!a.targetPos || a.pos.dist(a.targetPos) < 0.5) {
      const newPos = a.pos.add(pickGridDirection());
      const clamped = vec2(
        clamp(newPos.x, penX + 10, penX + penWidth - 10),
        clamp(newPos.y, penY + 10, penY + penHeight - 10)
      );
      a.targetPos = snapToGrid(clamped);
    }

    if (a.targetPos) {
      const delta = a.targetPos.sub(a.pos);
      const step = delta.len() > SLIDE_CHECK_EPS
        ? delta.unit().scale(animalSpeed * dtv)
        : vec2(0, 0);

      if (step.len() > delta.len()) {
        a.pos = a.targetPos.clone();
        a.targetPos = null;
      } else {
        a.move(step);
      }
    }
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
    const nearEnemy = a.enemies.find(e => a.pos.dist(e.pos) < 80);
    if (nearEnemy && rand(1) < 0.5) {
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
    a.mission = { type: "explore", target: randomDirection(), timer: 0 };
    return;
  }

  // 9) Fallback explore
  a.mission = { type: "explore", target: randomDirection(), timer: 0 };
}

// ===== Main Update ============================================================

onUpdate("animal", (a) => {
  if (isPaused || !a.alive) return;
  if (simTick % simSkipFrames !== 0) return;

  // Periodic scans (allies/enemies)
  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 1) {
    a.allies = get("animal").filter(o => o !== a && areRelatives(a, o) && o.alive);
    a.enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
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
    case "eat":
      if (a.mission.target) tryMove(a, a.mission.target.pos.sub(a.pos), animalSpeed);
      break;

    case "attack":
      if (a.mission.target) tryMove(a, a.mission.target.pos.sub(a.pos), animalSpeed);
      break;

    case "flee":
      if (a.mission.target) tryMove(a, a.pos.sub(a.mission.target.pos), animalSpeed + 20);
      break;

    case "legacy":
      if (!a.hasJustPlacedLegacy) {
        leaveLegacyBlock(a);
        a.lastLegacyTime = a.stats.lifetime;
        a.hasJustPlacedLegacy = true;
      }
      a.mission.type = "none";
      break;

    case "defend":
      if (a.mission.target) tryMove(a, a.mission.target.pos.sub(a.pos), animalSpeed);
      break;

    case "patrol":
      if (a.mission.target) tryMove(a, a.mission.target.pos.sub(a.pos), animalSpeed * 0.6);
      break;

    case "roam":
      if (a.mission.target) tryMove(a, a.mission.target.pos.sub(a.pos), animalSpeed * 0.7);
      break;

    case "explore":
      if (!a.mission.target || a.mission.timer > 4) {
        a.mission = { type: "explore", target: randomDirection(), timer: 0 };
      }
      tryMove(a, a.mission.target, animalSpeed * 0.4);
      break;

    default:
      tryMove(a, randomDirection(), animalSpeed * 0.3);
  }

  // === Attack logic ==========================================================
  a.attackTimer = (a.attackTimer || 0) + dt();
  if (a.mission.type === "attack" && a.mission.target && a.pos.dist(a.mission.target.pos) < 10) {
    if (a.attackTimer >= a.attackCooldown) {
      a.attackTimer = 0;

      if (rand(1) > 0.2) {
        const damage = rand(5, 15);
        a.mission.target.health -= damage;
        showDamage(a.mission.target);
        addNews(`${a.firstName} hits ${a.mission.target.firstName} for ${Math.floor(damage)} damage!`);

        if (a.mission.target.health <= 0) {
          killAnimal(a.mission.target, "defeated");
          a.mission = { type: "none", target: null, timer: 0 };
        }
      } else {
        addNews(`${a.firstName} missed ${a.mission.target.firstName}!`);
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
      if (dist < 20 && b.isLegacy && !colorsMatch(a.familyColor, b.familyColor)) {
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
  // Track motion
  const prev = a._prevPos || a.pos.clone();
  const moved = a.pos.dist(prev);

  a._stuckTimer = (a._stuckTimer || 0) + dt();
  if (moved > STUCK_DIST_EPS) {
    a._stuckTimer = 0;
  }

  // If stuck for a while, nudge perpendicular to last mission vector
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

    // Apply within the window in subsequent frames
    if (time() < endTime) {
      tryMove(a, perp, NUDGE_SPEED);
    }

    // For wanderers, reset grid target to encourage a new pick
    if (a.mode === "wander") a.targetPos = null;
  }

  a._prevPos = a.pos.clone();
});
