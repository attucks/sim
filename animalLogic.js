onUpdate("animal", (a) => {
  if (!a.alive) return;

  // === UTIL: Line of Sight ===
function hasLineOfSight(from, to) {
  const direction = to.pos.sub(from.pos).unit();
  const distance = from.pos.dist(to.pos);

  for (let d = 0; d < distance; d += 4) {
    const point = from.pos.add(direction.scale(d));

    const blocked = get("barrier").some(b => {
      const bPos = b.pos;
      const bW = b.width || 10;
      const bH = b.height || 10;

      return (
        point.x >= bPos.x &&
        point.x <= bPos.x + bW &&
        point.y >= bPos.y &&
        point.y <= bPos.y + bH
      );
    });

    if (blocked) return false;
  }
  return true;
}

  // === THROTTLE ALLY/ENEMY SCANNING ===
  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 1) {
    a.allies = get("animal").filter(o =>
      o !== a && areRelatives(a, o) && o.alive && hasLineOfSight(a, o)
    );
    a.enemies = get("animal").filter(o =>
      o !== a && !areRelatives(a, o) && o.alive && hasLineOfSight(a, o)
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

  // === BASIC STATE UPDATES ===
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

  // === COLORING BASED ON MODE ===
  const colorMultiplier = (a.mode === "wander") ? 1.0 :
    (a.mode === "hunt") ? 1.3 :
    (a.mode === "flee") ? 0.7 : 1.0;
  a.color = scaleColor(a.familyColor, colorMultiplier);

  // === BADGE CREATION ===
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

  // === MOVEMENT (WITH BARRIER CHECK) ===
function tryMove(dirVec, speed) {
  const nextPos = a.pos.add(dirVec.unit().scale(speed * dt()));

  const collision = get("barrier").some(b => {
    if (!b.area) return false;
    const bPos = b.pos;
    const bSize = vec2(b.width || 10, b.height || 10); // Default size fallback

    return (
      nextPos.x < bPos.x + bSize.x &&
      nextPos.x + a.width > bPos.x &&
      nextPos.y < bPos.y + bSize.y &&
      nextPos.y + a.height > bPos.y
    );
  });

  if (!collision) {
    a.move(dirVec.scale(speed));
  } else {
    if (a.mode === "wander") {
      a.dir = vec2(rand(-1, 1), rand(-1, 1)).unit();
    }
  }
}


  if (a.mode === "hunt" && a.target) {
    tryMove(a.target.pos.sub(a.pos), animalSpeed);
  } else if (a.mode === "flee" && a.target) {
    tryMove(a.pos.sub(a.target.pos), animalSpeed + 20);
  } else if (a.mode === "wander") {
    if (a.allies && a.allies.length > 0) {
      const nearestAlly = a.allies.reduce((closest, ally) =>
        a.pos.dist(ally.pos) < a.pos.dist(closest.pos) ? ally : closest,
        a.allies[0]
      );
      const distToAlly = a.pos.dist(nearestAlly.pos);

      if (distToAlly > 30) {
        tryMove(nearestAlly.pos.sub(a.pos), animalSpeed * 0.4);
      } else if (rand(1) < a.curiosity) {
        tryMove(vec2(rand(-1, 1), rand(-1, 1)).unit(), animalSpeed * 0.2);
      }
    } else if (rand(1) < 0.6) {
      tryMove(vec2(rand(-1, 1), rand(-1, 1)).unit(), animalSpeed * 0.3);
    }
  }

  // === REPEL FROM BARRIERS + CORPSES ===
  a.repelTimer = (a.repelTimer || 0) + dt();
  if (a.repelTimer > 0.5) {
    for (const b of get("barrier")) {
      const dist = a.pos.dist(b.pos);
      if (dist < barrierRepelDistance) {
        const away = a.pos.sub(b.pos).unit();
        tryMove(away, 20);
      }
      if (dist < 20 && !colorsMatch(a.familyColor, b.familyColor)) {
        if (rand(1) < a.territorial * 0.3 && b.isLegacy) {
          destroy(b);
          // addNews(`${a.firstName} destroyed a legacy of ${b.creatorName || "unknown"}!`);
        }
      }
    }
    for (const c of get("corpse")) {
      if (a.pos.dist(c.pos) < corpseRepelDistance) {
        const away = a.pos.sub(c.pos).unit();
        tryMove(away, 20);
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

  // === BIRTH LOGIC ===
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
}); // end onUpdate

// Find target for hunting or attacking
function findTarget(a) {
  const foods = get("food");
  const others = get("animal").filter(x => x !== a && x.alive);

  let closestFood = null, foodDist = Infinity;
  let closestPrey = null, preyDist = Infinity;

  for (const f of foods) {
    if (!hasLineOfSight(a, f)) continue;
    const dist = a.pos.dist(f.pos);
    if (dist < foodDist) {
      closestFood = f;
      foodDist = dist;
    }
  }

  for (const o of others) {
    if (areRelatives(a, o)) continue;
    if (!hasLineOfSight(a, o)) continue;
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
