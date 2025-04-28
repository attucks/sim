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
      nextPos.y + a.height > bPos.y
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

onUpdate("animal", (a) => {
  if (!a.alive) return;

  // === SCAN ALLIES + ENEMIES ===
  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 1) {
    a.allies = get("animal").filter(o =>
      o !== a && areRelatives(a, o) && o.alive
    );
    a.enemies = get("animal").filter(o =>
      o !== a && !areRelatives(a, o) && o.alive
    );
    a.scanTimer = 0;
  }

  // === PACK DETECTION ===
  a.packMode = (a.allies && a.allies.length >= 16);

  // === HUNT TARGET IF PACK ===
  if (a.packMode && a.enemies && a.enemies.length > 0) {
    const nearestEnemy = a.enemies.reduce((closest, enemy) =>
      a.pos.dist(enemy.pos) < a.pos.dist(closest.pos) ? enemy : closest,
      a.enemies[0]
    );
    a.mode = "hunt";
    a.target = nearestEnemy;
  }

  // === BASIC STATS ===
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

  // === TARGET VALIDATION ===
  if (a.target && !a.target.exists()) {
    a.target = null;
    a.mode = "wander";
  }

  if (a.hunger > (3 - a.greed) && a.mode !== "hunt") {
    a.mode = "hunt";
    findTarget(a);
  }

  // === COLOR BASED ON MODE ===
  const colorMultiplier = (a.mode === "wander") ? 1.0 :
    (a.mode === "hunt") ? 1.3 :
    (a.mode === "flee") ? 0.7 : 1.0;
  a.color = scaleColor(a.familyColor, colorMultiplier);

  // === BADGE ===
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

  // === REPEL FROM BARRIERS + CORPSES ===
  a.repelTimer = (a.repelTimer || 0) + dt();
  if (a.repelTimer > 0.5) {
    for (const b of [...get("barrier"), ...get("legacy")]) {  // 👈 updated here
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
      spawnAnimal(cx, cy, a);
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

  // === LEGACY BLOCK CREATION ===
  const legacyChance = (a.territorial + a.legacyDesire) / 2;
  if (
    a.stats.lifetime > goldAge &&
    a.stats.lifetime - a.lastLegacyTime > 30 &&
    rand(1) < legacyChance * 0.5
  ) {
    leaveLegacyBlock(a);
    a.lastLegacyTime = a.stats.lifetime;
  }
});
