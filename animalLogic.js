onUpdate("animal", (a) => {
  if (!a.alive) return;

  // === TRACK ALLIES + ENEMIES ONCE ===
  const allies = get("animal").filter(o => o !== a && areRelatives(a, o) && o.alive);
  const enemies = get("animal").filter(o => o !== a && !areRelatives(a, o) && o.alive);

  // === PACK DETECTION ===
  if (allies.length >= 16) {
    a.packMode = true;
  } else {
    a.packMode = false;
  }

  // === HUNT TARGET IF PACK ===
  if (a.packMode && enemies.length > 0) {
    const nearestEnemy = enemies.reduce((closest, enemy) =>
      a.pos.dist(enemy.pos) < a.pos.dist(closest.pos) ? enemy : closest, enemies[0]
    );
    a.mode = "hunt";
    a.target = nearestEnemy;
  }

  // === BASIC STATE UPDATES ===
  a.stats.lifetime += dt();
  a.hunger += dt() * hungerRate;

  if (a.hunger > starvationThreshold) {
    a.hungerTime += dt();
  } else {
    a.hungerTime = 0;
  }

  if (a.hungerTime > starvationTimeLimit) return killAnimal(a, "starvation");

  // === TARGET REFRESH ===
  if (a.target && !a.target.exists()) {
    a.target = null;
    a.mode = "wander";
  }

  if (a.hunger > (3 - a.greed) && a.mode !== "hunt") {
    a.mode = "hunt";
    findTarget(a);
  }

  // === COLORING ===
  if (a.mode === "wander") {
    a.color = scaleColor(a.familyColor, 1.0);
  } else if (a.mode === "hunt") {
    a.color = scaleColor(a.familyColor, 1.3);
  } else if (a.mode === "flee") {
    a.color = scaleColor(a.familyColor, 0.7);
  }

  if (a.stats.lifetime > goldAge) {
    //a.color = rgb(255, 215, 0);

    if (!a.hasBadge) {
      const badge = add([
        rect(5, 5),
        pos(a.pos.x, a.pos.y - 8),
        color(a.familyColor),
        area(),
        "badge",
      ]);
      a.badge = badge;
      a.hasBadge = true;
    }
  }

  if (a.badge) {
    a.badge.pos = vec2(a.pos.x, a.pos.y - 8);
  }

  // === MOVEMENT PRIORITY ===
  if (a.mode === "hunt" && a.target) {
    const dir = a.target.pos.sub(a.pos).unit();
    a.move(dir.scale(animalSpeed));
  } 
  else if (a.mode === "flee" && a.target) {
    const dir = a.pos.sub(a.target.pos).unit();
    a.move(dir.scale(animalSpeed + 20));
  } 
else if (a.mode === "wander") {
  if (allies.length > 0) {
    const nearestAlly = allies.reduce((closest, ally) => 
      a.pos.dist(ally.pos) < a.pos.dist(closest.pos) ? ally : closest, allies[0]
    );
    const distToAlly = a.pos.dist(nearestAlly.pos);

    if (distToAlly > 30) {
      const toward = nearestAlly.pos.sub(a.pos).unit();
      a.move(toward.scale(animalSpeed * 0.4));
    } else {
      if (rand(1) < a.curiosity) {
        a.move(vec2(rand(-1, 1), rand(-1, 1)).unit().scale(animalSpeed * 0.2));
      }
    }
  } else {
    // 🧠 NEW: No allies = random wander!
    if (rand(1) < 0.6) { // 60% chance to twitch each frame
      a.move(vec2(rand(-1, 1), rand(-1, 1)).unit().scale(animalSpeed * 0.3));
    }
  }
}


  // === REPEL FROM BARRIERS + CORPSES ===
  for (const b of get("barrier")) {
    const dist = a.pos.dist(b.pos);
    if (dist < barrierRepelDistance) {
      const away = a.pos.sub(b.pos).unit();
      a.move(away.scale(20)); // mild repel
    }
    if (dist < 20 && !colorsMatch(a.familyColor, b.familyColor)) {
      if (rand(1) < a.territorial * 0.3) {
        destroy(b);
        addNews(`${a.firstName} destroyed a legacy of ${b.creatorName || "unknown"}!`);
      }
    }
  }

  for (const c of get("corpse")) {
    if (a.pos.dist(c.pos) < corpseRepelDistance) {
      const away = a.pos.sub(c.pos).unit();
      a.move(away.scale(20)); // mild repel
    }
  }

  // === HELP FAMILY ===
  for (const o of allies) {
    if (o.mode === "flee" && o.target && !areRelatives(a, o.target)) {
      a.mode = "hunt";
      a.target = o.target;
      break;
    }
  }

// === BIRTH LOGIC ===
if (a.hunger < 1) {
    a.satedTime += dt();
    if (a.satedTime > birthingTime) {
        a.readyToBirth = true; // <-- THIS!
    }
} else {
    a.satedTime = 0;
}

// Check if ready to birth and well-fed
if (a.readyToBirth && a.hunger > birthingHungerThreshold) {
    if (get("animal").length < maxPopulation) {
        spawnAnimal(a);
        a.readyToBirth = false;
        a.birthTimer = 0;
    } else {
        // Population too high, don't birth yet
        a.birthTimer = 0; // Reset birth timer so they have to get ready again
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
  if (a.stats.lifetime > goldAge && a.stats.lifetime - a.lastLegacyTime > 30 && rand(1) < legacyChance * 0.5) {
    leaveLegacyBlock(a);
    a.lastLegacyTime = a.stats.lifetime;
  }

  // === SPRITE UPDATE ===
  const threshold = 0.1;
  if (Math.abs(a.dir.x) > Math.abs(a.dir.y)) {
    if (a.dir.x > threshold && a.currentDirection !== "right") {
      a.use(sprite("creatureRight"));
      a.color = a.familyColor;
      a.currentDirection = "right";
    } else if (a.dir.x < -threshold && a.currentDirection !== "left") {
      a.use(sprite("creatureLeft"));
      a.color = a.familyColor;
      a.currentDirection = "left";
    }
  } else {
    if (Math.abs(a.dir.y) > threshold && a.currentDirection !== "front") {
      a.use(sprite("creatureFront"));
      a.color = a.familyColor;
      a.currentDirection = "front";
    }
  }
  clampToPen(a);

});



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
