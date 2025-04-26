onUpdate("animal", (a) => {
  if (!a.alive) return;

  // Update lifetime and hunger
  a.stats.lifetime += dt();
  a.hunger += dt() * hungerRate;

  // Starvation tracking
  a.hunger > starvationThreshold ? a.hungerTime += dt() : a.hungerTime = 0;
  if (a.hungerTime > starvationTimeLimit) return killAnimal(a, "starvation");

  // Target handling
  if (a.target && !a.target.exists()) {
    a.target = null;
    a.mode = "wander";
  }

  // Greed-based hunting
  if (a.hunger > (2 - a.greed) && a.mode !== "hunt") {   // <<<< FIXED greed math
    a.mode = "hunt";
    findTarget(a);
  }

  // Birthing logic
  if (a.hunger < 1) {
    a.satedTime += dt();
  } else {
    a.satedTime = 0;
  }
if (a.satedTime > birthingTime) {
  a.satedTime = 0;
  a.stats.kids++;
  a.text = a.firstName.toUpperCase();
  const child = spawnAnimal(a.pos.x + rand(-20, 20), a.pos.y + rand(-20, 20), a);
  addNews(`${a.firstName} birthed ${child.firstName} ${child.lastName}`);
}
if (a.mode === "wander") {
  a.color = scaleColor(a.familyColor, 1.0); 
} else if (a.mode === "hunt") {
  a.color = scaleColor(a.familyColor, 1.3); 
} else if (a.mode === "flee") {
  a.color = scaleColor(a.familyColor, 0.7); 
}

if (a.stats.lifetime > goldAge) {
  a.color = rgb(255, 215, 0);

  // 🛠 Add a badge if not already added
  if (!a.hasBadge) {
    const badge = add([
      rect(5, 5),
      pos(a.pos.x, a.pos.y - 8), // 8px above the animal
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

  // Movement
  if (a.mode === "wander") {
    if (rand(1) < a.curiosity) {
      a.move(a.dir.scale(animalSpeed * 0.5));
    }
    // else idle
  } else if (a.mode === "flee" && a.target) {
    const dir = a.pos.sub(a.target.pos).unit();
    a.move(dir.scale(animalSpeed + 20));
  } else if (a.mode === "hunt" && a.target) {
    const dir = a.target.pos.sub(a.pos).unit();
    a.move(dir.scale(animalSpeed));
  }

  // Repel from corpses
  for (const c of get("corpse")) {
    if (a.pos.dist(c.pos) < corpseRepelDistance) {
      const away = a.pos.sub(c.pos).unit();
      a.move(away.scale(animalSpeed * 0.5));
    }
  }

  // Repel from barriers
  for (const b of get("barrier")) {
    if (a.pos.dist(b.pos) < barrierRepelDistance) {
      const away = a.pos.sub(b.pos).unit();
      a.move(away.scale(animalSpeed * 0.5));
    }
  }

const boundsMargin = 5; // 5px margin to avoid clipping

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


  // Legacy block generation (one time, based on traits)
// Legacy block creation every 60 seconds after goldAge
const legacyChance = (a.territorial + a.legacyDesire) / 2;
if (a.stats.lifetime > goldAge && a.stats.lifetime - a.lastLegacyTime > 60 && rand(1) < legacyChance * 0.5) {
  leaveLegacyBlock(a);
  a.lastLegacyTime = a.stats.lifetime; // Update the time they last left a legacy
}

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
