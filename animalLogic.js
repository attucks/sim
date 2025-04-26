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
  addNews(`${a.firstName} birthed ${child.firstName}`);
}

  // Color based on mode
  if (a.mode === "wander") {
    a.color = rgb(100, 255, 100);
  } else if (a.mode === "hunt") {
    a.color = rgb(255, 0, 0);
  } else if (a.mode === "flee") {
    a.color = rgb(0, 0, 255);
  }

  // Gold Age override
  if (a.stats.lifetime > goldAge) {
    a.color = rgb(255, 215, 0);
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

  // Border bouncing
  if (a.pos.x < penX) {
    a.pos.x = penX;
    if (a.mode === "wander") a.dir.x *= -1;
  }
  if (a.pos.x > penX + penWidth) {
    a.pos.x = penX + penWidth;
    if (a.mode === "wander") a.dir.x *= -1;
  }
  if (a.pos.y < penY) {
    a.pos.y = penY;
    if (a.mode === "wander") a.dir.y *= -1;
  }
  if (a.pos.y > penY + penHeight) {
    a.pos.y = penY + penHeight;
    if (a.mode === "wander") a.dir.y *= -1;
  }

  // Legacy block generation (one time, based on traits)
  const legacyChance = (a.territorial + a.legacyDesire) / 2;
  if (a.stats.lifetime > goldAge && !a.hasLeftLegacy && rand(1) < legacyChance * 0.25) {
    leaveLegacyBlock(a);
    a.hasLeftLegacy = true;
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
