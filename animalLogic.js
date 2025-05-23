const tileSize = 10;

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


// === VISUAL FEEDBACK ===

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

// === ALLIANCES ===

function findClosestEnemy(a) {
  const enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
  if (enemies.length === 0) return null;
  return enemies.reduce((closest, o) => a.pos.dist(o.pos) < a.pos.dist(closest.pos) ? o : closest, enemies[0]);
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

  return (
    greedDiff <= 0.2 &&
    territorialDiff <= 0.2 &&
    curiosityDiff <= 0.2
  );
}

function maybeFormAlliance(a) {
  const potentialAllies = get("animal").filter(o =>
    o !== a &&
    !areRelatives(a, o) &&
    a.pos.dist(o.pos) < 80
  );

  for (const o of potentialAllies) {
    if (traitsCompatible(a, o)) {
      formAlliance(a.familyColor, o.familyColor);
      addNews(`${a.firstName}'s family allied with ${o.firstName}'s family!`);
      showAlliance(a, o);
    }
  }
}

// === MOVEMENT ===

function tryMove(a, dirVec, speed) {
  const moveStep = dirVec.unit().scale(speed);
  const nextPos = a.pos.add(moveStep.scale(dt()));

  // === COLLISION WITH BARRIERS ===
  const collision = get("barrier").some(b => {
    const bPos = b.pos;
    const bW = b.width || 10;
    const bH = b.height || 10;
    return (
      nextPos.x < bPos.x + bW &&
      nextPos.x + a.width > bPos.x &&
      nextPos.y < bPos.y + bH &&
      a.pos.y + a.height > bPos.y
    );
  });

  if (!collision) {
    // === NEW: COLLISION WITH OTHER ANIMALS ===
    const nearbyAnimal = get("animal").find(o => 
      o !== a &&
      o.alive &&
      o.pos.dist(nextPos) < 6 // 6px threshold
    );

    if (nearbyAnimal) {
      // Gently veer away if another animal too close
      const avoidVec = a.pos.sub(nearbyAnimal.pos).unit();
      a.move(avoidVec.scale(speed * dt() * 0.5));
    } else {
      a.move(moveStep);
    }

  } else {
    // Try to slide along X axis
    const slideX = vec2(moveStep.x, 0);
    const nextPosX = a.pos.add(slideX.scale(dt()));
    const blockedX = get("barrier").some(b => {
      const bPos = b.pos;
      const bW = b.width || 10;
      const bH = b.height || 10;
      return (
        nextPosX.x < bPos.x + bW &&
        nextPosX.x + a.width > bPos.x &&
        a.pos.y < bPos.y + bH &&
        a.pos.y + a.height > bPos.y
      );
    });
    if (!blockedX) {
      a.move(slideX);
      return;
    }

    // Try to slide along Y axis
    const slideY = vec2(0, moveStep.y);
    const nextPosY = a.pos.add(slideY.scale(dt()));
    const blockedY = get("barrier").some(b => {
      const bPos = b.pos;
      const bW = b.width || 10;
      const bH = b.height || 10;
      return (
        a.pos.x < bPos.x + bW &&
        a.pos.x + a.width > bPos.x &&
        nextPosY.y < bPos.y + bH &&
        a.pos.y + a.height > bPos.y
      );
    });
    if (!blockedY) {
      a.move(slideY);
      return;
    }

    // No slide possible → don't move
    return;
  }

  // === GRID-BASED WANDER TARGET (only if wandering) ===
  if (a.mode === "wander") {
    if (!a.targetPos || a.pos.dist(a.targetPos) < 0.5) {
      const newPos = a.pos.add(pickGridDirection());

      // Clamp inside pen bounds
      const clamped = vec2(
        clamp(newPos.x, penX + 10, penX + penWidth - 10),
        clamp(newPos.y, penY + 10, penY + penHeight - 10)
      );

      a.targetPos = snapToGrid(clamped);
    }

    if (a.targetPos) {
      const delta = a.targetPos.sub(a.pos);
      const step = delta.unit().scale(animalSpeed * dt());

      if (step.len() > delta.len()) {
        a.pos = a.targetPos.clone();
        a.targetPos = null;
      } else {
        a.move(step);
      }
    }
  }
}


// === TARGETING ===

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

// === MAIN UPDATE ===

onUpdate("animal", (a) => {
  if (isPaused || !a.alive) return;
  if (simTick % simSkipFrames !== 0) return;

  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 1) {
    a.allies = get("animal").filter(o => o !== a && areRelatives(a, o) && o.alive);
    a.enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
    a.scanTimer = 0;
  }

  // === LIFETIME + HUNGER ===
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

  // === MISSION SYSTEM ===
  a.mission = a.mission || { type: "none", target: null, timer: 0 };
  a.mission.timer += dt();



function decideMission(a) {
  // === 1. Emergency Flee ===
  if (a.health < 30) {
    a.mission = { type: "flee", target: findClosestEnemy(a), timer: 0 };
    return;
  }

  // === 2. Eat if Hungry Enough ===
  if (a.hunger > (3 - a.greed)) {
    const foods = get("food");
    const food = (foods.length > 0) ? foods.reduce((closest, f) => 
      a.pos.dist(f.pos) < a.pos.dist(closest.pos) ? f : closest
    ) : null;
    if (food) {
      a.mission = { type: "eat", target: food, timer: 0 };
      return;
    }
  }

  // === 3. Defend Nearby Legacy (if Enemy Nearby) ===
  if (get("legacy").length > 0 && a.enemies && a.enemies.length > 0) {
    const enemyNearLegacy = a.enemies.find(e => 
      get("legacy").some(l => 
        colorsMatch(l.familyColor, a.familyColor) &&
        l.pos.dist(e.pos) < 60
      )
    );
    if (enemyNearLegacy) {
      a.mission = { type: "defend", target: enemyNearLegacy, timer: 0 };
      return;
    }
  }

  // === 4. Patrol Own Legacy (Territorial Sims) ===
  if (a.territorial > 0.5 && get("legacy").length > 0 && rand(1) < 0.4) {
    const myLegacy = findClosest(get("legacy").filter(l => colorsMatch(l.familyColor, a.familyColor)), a.pos);
    if (myLegacy) {
      a.mission = { type: "patrol", target: myLegacy, timer: 0 };
      return;
    }
  }

  // === 5. Roam With Pack (Allies Nearby) ===
  if (a.allies && a.allies.length > 0 && rand(1) < 0.3) {
    const packMate = a.allies[Math.floor(rand(0, a.allies.length))];
    if (packMate) {
      a.mission = { type: "roam", target: packMate, timer: 0 };
      return;
    }
  }

  // === 6. Attack Enemy if No Other Jobs ===
  if (a.enemies && a.enemies.length > 0) {
    const nearEnemy = a.enemies.find(e => a.pos.dist(e.pos) < 80);
    if (nearEnemy && rand(1) < 0.5) {
      a.mission = { type: "attack", target: nearEnemy, timer: 0 };
      return;
    }
  }

  // === 7. Place New Legacy (Territorial/Old Enough) ===
  if (
    a.stats.lifetime > goldAge &&
    a.stats.lifetime - (a.lastLegacyTime || 0) > 30 &&
    rand(1) < (a.territorial + a.legacyDesire) / 2
  ) {
    a.mission = { type: "legacy", target: null, timer: 0 };
    return;
  }

  // === 8. Curious Exploration ===
  if (a.curiosity > 0.5 && rand(1) < 0.6) {
    a.mission = { type: "explore", target: randomDirection(), timer: 0 };
    return;
  }

  // === 9. Bored fallback ===
  a.mission = { type: "explore", target: randomDirection(), timer: 0 };
}

if (!a.mission.type || a.mission.timer > 10 || (a.mission.target && !a.mission.target.exists))
 {
  decideMission(a);
}

  function randomDirection() {
    return vec2(rand(-1, 1), rand(-1, 1)).unit();
  }

  // === ACTING ON MISSION ===

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
      a.mission.type = "none"; // Finished
      break;
    case "explore":
      if (a.mission.target) tryMove(a, a.mission.target, animalSpeed * 0.4);
      break;
    default:
      tryMove(a, randomDirection(), animalSpeed * 0.3);
  }

  // === ATTACK LOGIC ===
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

  // === COLOR FEEDBACK ===
  const colorMultiplier =
    (a.mission.type === "explore") ? 1.0 :
    (a.mission.type === "eat") ? 1.1 :
    (a.mission.type === "attack") ? 1.3 :
    (a.mission.type === "flee") ? 0.7 :
    1.0;
  a.color = scaleColor(a.familyColor, colorMultiplier);

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

  // === REPEL ===
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

  // === HELP FAMILY ===
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

  // === BIRTH ===
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

  // === BORDER CHECK ===
  const boundsMargin = 5;
  if (a.pos.x < penX + boundsMargin) a.pos.x = penX + boundsMargin;
  if (a.pos.x > penX + penWidth - boundsMargin) a.pos.x = penX + penWidth - boundsMargin;
  if (a.pos.y < penY + boundsMargin) a.pos.y = penY + boundsMargin;
  if (a.pos.y > penY + penHeight - boundsMargin) a.pos.y = penY + penHeight - boundsMargin;

  // === FORM ALLIANCES ===
  a.allianceTimer = (a.allianceTimer || 0) + dt();
  if (a.allianceTimer > 5) {
    maybeFormAlliance(a);
    a.allianceTimer = 0;
  }
});
