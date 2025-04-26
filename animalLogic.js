onUpdate("animal", (a) => {
  if (!a.alive) return;

  a.stats.lifetime += dt();
  a.hunger += dt() * hungerRate;
  a.hunger > starvationThreshold ? a.hungerTime += dt() : a.hungerTime = 0;
  if (a.hungerTime > starvationTimeLimit) return killAnimal(a, "starvation");

  if (a.target && !a.target.exists()) a.target = null, a.mode = "wander";
  if (a.hunger > 3 && a.mode !== "hunt") a.mode = "hunt", findTarget(a);
  if (a.hunger < 1) a.satedTime += dt(); else a.satedTime = 0;
  if (a.satedTime > birthingTime) {
    a.satedTime = 0;
    a.stats.kids++;
    a.text = a.firstName.toUpperCase();
    spawnAnimal(a.pos.x + rand(-20, 20), a.pos.y + rand(-20, 20), a);
  }

  a.mode === "wander" ? a.color = rgb(100, 255, 100) : a.mode === "hunt" ? a.color = rgb(255, 0, 0) : a.color = rgb(0, 0, 255);
  if (a.stats.lifetime > goldAge) a.color = rgb(255, 215, 0);

  let moveSpeed = a.mode === "hunt" ? animalSpeed : animalSpeed * 0.5;
  if (a.mode === "flee" && a.target) moveSpeed += 20;

  if (a.mode === "flee" && a.target) {
    const dir = a.pos.sub(a.target.pos).unit();
    a.move(dir.scale(moveSpeed));
  } else if (a.target) {
    const dir = a.target.pos.sub(a.pos).unit();
    a.move(dir.scale(moveSpeed));
  } else {
    a.move(a.dir.scale(animalSpeed * 0.5));
  }

  for (const c of get("corpse")) {
    if (a.pos.dist(c.pos) < corpseRepelDistance) {
      const away = a.pos.sub(c.pos).unit();
      a.move(away.scale(animalSpeed * 0.5));
    }
  }

  for (const b of get("barrier")) {
    if (a.pos.dist(b.pos) < barrierRepelDistance) {
      const away = a.pos.sub(b.pos).unit();
      a.move(away.scale(animalSpeed * 0.5));
    }
  }

  if (a.pos.x < penX) a.pos.x = penX, a.mode === "wander" && (a.dir.x *= -1);
  if (a.pos.x > penX + penWidth) a.pos.x = penX + penWidth, a.mode === "wander" && (a.dir.x *= -1);
  if (a.pos.y < penY) a.pos.y = penY, a.mode === "wander" && (a.dir.y *= -1);
  if (a.pos.y > penY + penHeight) a.pos.y = penY + penHeight, a.mode === "wander" && (a.dir.y *= -1);

  if (a.stats.lifetime > goldAge && a.stats.kids > 0 && a.stats.kills > 0 && rand(1) < 0.005) {
    const sx = Math.floor((a.pos.x - penX) / 10) * 10 + penX;
    const sy = Math.floor((a.pos.y - penY) / 10) * 10 + penY;
    const legacyBlock = add([rect(10, 10), pos(sx, sy), area(), color(255, 215, 0), outline(1), "barrier"]);
    const legacyText = add([text(a.firstName + "x", { size: 6 }), pos(sx + 1, sy + 1), color(0, 0, 0)]);
    a.legacyBarriers.push(legacyBlock);
  }
});

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
