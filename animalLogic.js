onUpdate("animal", (a) => {
  if (!a.alive) return;

  // === THROTTLE ALLY/ENEMY SCANNING ===
  a.scanTimer = (a.scanTimer || 0) + dt();
  if (a.scanTimer > 1) { // Scan every 1 second
    a.allies = get("animal").filter(o => o !== a && areRelatives(a, o) && o.alive);
    a.enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);
    a.scanTimer = 0;
  }

  // === PACK DETECTION (based on latest scan) ===
  a.packMode = (a.allies && a.allies.length >= 16);

  // === HUNT TARGET IF PACK ===
  if (a.packMode && a.enemies && a.enemies.length > 0) {
    const nearestEnemy = a.enemies.reduce((closest, enemy) =>
      a.pos.dist(enemy.pos) < a.pos.dist(closest.pos) ? enemy : closest, a.enemies[0]
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

  // === BADGE CREATION ON GOLD AGE ===
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
    const dir = a.target.pos.sub(a.pos).unit();
    a.move(dir.scale(animalSpeed));
  } else if (a.mode === "flee" && a.target) {
    const dir = a.pos.sub(a.target.pos).unit();
    a.move(dir.scale(animalSpeed + 20));
  } else if (a.mode === "wander") {
    if (a.allies && a.allies.length > 0) {
      const nearestAlly = a.allies.reduce((closest, ally) =>
        a.pos.dist(ally.pos) < a.pos.dist(closest.pos) ? ally : closest, a.allies[0]
      );
      const distToAlly = a.pos.dist(nearestAlly.pos);

      if (distToAlly > 30) {
        const toward = nearestAlly.pos.sub(a.pos).unit();
        a.move(toward.scale(animalSpeed * 0.4));
      } else if (rand(1) < a.curiosity) {
        a.move(vec2(rand(-1, 1), rand(-1, 1)).unit().scale(animalSpeed * 0.2));
      }
    } else if (rand(1) < 0.6) {
      a.move(vec2(rand(-1, 1), rand(-1, 1)).unit().scale(animalSpeed * 0.3));
    }
  }

  // === REPEL FROM BARRIERS + CORPSES (throttled) ===
  a.repelTimer = (a.repelTimer || 0) + dt();
  if (a.repelTimer > 0.5) { // Only repel every 0.5s
    for (const b of get("barrier")) {
      const dist = a.pos.dist(b.pos);
      if (dist < barrierRepelDistance) {
        const away = a.pos.sub(b.pos).unit();
        a.move(away.scale(20));
      }
      if (dist < 20 && !colorsMatch(a.familyColor, b.familyColor)) {
        if (rand(1) < a.territorial * 0.3) {
          destroy(b);
         // addNews(`${a.firstName} destroyed a legacy of ${b.creatorName || "unknown"}!`);
        }
      }
    }
    for (const c of get("corpse")) {
      if (a.pos.dist(c.pos) < corpseRepelDistance) {
        const away = a.pos.sub(c.pos).unit();
        a.move(away.scale(20));
      }
    }
    a.repelTimer = 0;
  }

  // === HELP FAMILY (staggered) ===
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
      spawnAnimal(a);
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

  // === LEGACY BLOCK CREATION (staggered chance) ===
  const legacyChance = (a.territorial + a.legacyDesire) / 2;
  if (a.stats.lifetime > goldAge && a.stats.lifetime - a.lastLegacyTime > 30 && rand(1) < legacyChance * 0.5) {
    leaveLegacyBlock(a);
    a.lastLegacyTime = a.stats.lifetime;
  }




// Find target for hunting or attacking
function findTarget(a) {
  const foods = get("food");
  const others = get("animal").filter(x => x !== a && x.alive);

  let closestFood = null;
  let closestPrey = null;
  let foodDist = Infinity;
  let preyDist = Infinity;

  for (const f of foods) {
    const dist = a.pos.dist(f.pos);
    if (dist < foodDist) {
      closestFood = f;
      foodDist = dist;
    }
  }

for (const o of others) {
  if (areRelatives(a, o)) continue; // 🧬 skip family
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
};

