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
    greedDiff <= 0.5 &&
    territorialDiff <= 0.5 &&
    curiosityDiff <= 0.5
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
    a.move(moveStep);
  } else {
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
        nextPosY.y + a.height > bPos.y
      );
    });
    if (!blockedY) {
      a.move(slideY);
      return;
    }

    if (a.mode === "wander") {
      a.dir = vec2(rand(-1, 1), rand(-1, 1)).unit();
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
  if (!a.alive) return;

  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 1) {
    a.allies = get("animal").filter(o => o !== a && areRelatives(a, o) && o.alive);
    a.enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
    a.scanTimer = 0;
  }

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

  if (a.target && !a.target.exists()) {
    a.target = null;
    a.mode = "wander";
  }

  if (a.hunger > (3 - a.greed)) {
    findTarget(a);

    if (a.target) {
      if (a.target.is("food")) {
        a.mode = "hunt";
      } else if (a.target.is("animal")) {
        a.mode = "hunt";
      }
    } else {
      a.mode = "wander";
    }
  }

  // === FIGHTING ===
  if (a.target && a.mode === "hunt" && a.pos.dist(a.target.pos) < 10) {
    const damage = rand(5, 15);
    a.target.health -= damage;
    showDamage(a.target);
    addNews(`${a.firstName} attacks ${a.target.firstName} for ${Math.floor(damage)} damage!`);

    if (a.target.health <= 0) {
      killAnimal(a.target, "defeated");
      a.target = null;
      a.mode = "wander";
    }
  }

  const colorMultiplier = (a.mode === "wander") ? 1.0 :
    (a.mode === "hunt") ? 1.3 :
    (a.mode === "flee") ? 0.7 : 1.0;
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

  // === MOVEMENT ===
  if (a.mode === "hunt" && a.target) {
    tryMove(a, a.target.pos.sub(a.pos), animalSpeed);
  } else if (a.mode === "flee" && a.target) {
    tryMove(a, a.pos.sub(a.target.pos), animalSpeed + 20);
  } else if (a.mode === "wander") {
    if (a.allies && a.allies.length > 0) {
      const nearestAlly = a.allies.reduce((closest, ally) =>
        a.pos.dist(ally.pos) < a.pos.dist(closest.pos) ? ally : closest,
        a.allies[0]
      );
      const distToAlly = a.pos.dist(nearestAlly.pos);

      if (distToAlly > 30) {
        tryMove(a, nearestAlly.pos.sub(a.pos), animalSpeed * 0.4);
      } else if (rand(1) < a.curiosity) {
        tryMove(a, vec2(rand(-1, 1), rand(-1, 1)).unit(), animalSpeed * 0.2);
      }
    } else if (rand(1) < 0.6) {
      tryMove(a, vec2(rand(-1, 1), rand(-1, 1)).unit(), animalSpeed * 0.3);
    }
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
          a.mode = "hunt";
          a.target = o.target;
          break;
        }
      }
    }
    a.helpTimer = 0;
  }

  // === FLEE IF LOW HEALTH ===
  if (a.health < 30 && a.mode !== "flee") {
    a.mode = "flee";
    a.target = findClosestEnemy(a);
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

  // === BORDER CHECKING ===
  const boundsMargin = 5;
  if (a.pos.x < penX + boundsMargin) {
    a.pos.x = penX + boundsMargin;
    if (a.mode === "wander") a.dir.x *= -1;
  }
  if (a.pos.x > penX + penWidth - boundsMargin) {
    a.pos.x = penX + penWidth - boundsMargin;
    if (a.mode === "wander") a.dir.x *= -1;
  }
  if (a.pos.y < penY + boundsMargin) {
    a.pos.y = penY + boundsMargin;
    if (a.mode === "wander") a.dir.y *= -1;
  }
  if (a.pos.y > penY + penHeight - boundsMargin) {
    a.pos.y = penY + penHeight - boundsMargin;
    if (a.mode === "wander") a.dir.y *= -1;
  }

  // === LEGACY CREATION ===
  const legacyChance = (a.territorial + a.legacyDesire) / 2;
  if (
    a.stats.lifetime > goldAge &&
    a.stats.lifetime - a.lastLegacyTime > 30 &&
    rand(1) < legacyChance * 0.5
  ) {
    leaveLegacyBlock(a);
    a.lastLegacyTime = a.stats.lifetime;
  }

  // === FORM ALLIANCES ===
  a.allianceTimer = (a.allianceTimer || 0) + dt();
  if (a.allianceTimer > 5) {
    maybeFormAlliance(a);
    a.allianceTimer = 0;
  }
});
