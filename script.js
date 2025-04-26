// Full script incorporating legacy blocks that disappear on death.
kaboom({
  background: [0, 0, 0],
  width: 1800,
  height: 10000,
  scale: 1,
});

const penX = 20;
const penY = 20;
const penWidth = 760;
const penHeight = 560;
const animalSpeed = 40;
const spawnFoodInterval = 12;
const foodHealAmount = 5;
const birthingTime = 7;
const corpseLifetime = 22;
const corpseRepelDistance = 20;
const barrierRepelDistance = 20;
const hungerRate = 0.16;
const starvationThreshold = 5;
const starvationTimeLimit = 10;
const goldAge = 60;
const barrierSize = vec2(10, 10);

const animalsStats = [];
const ancestorStats = [];

function generateName() {
  const consonants = "bcdfghjklmnpqrstvwxyz";
  const vowels = "aeiou";
  const c = consonants[Math.floor(rand(0, consonants.length))];
  const v = vowels[Math.floor(rand(0, vowels.length))];
  return c.toUpperCase() + v;
}

add([rect(penWidth, penHeight), pos(penX, penY), outline(4), color(0, 0, 0)]);

function spawnAnimal(x = rand(penX + 40, penX + penWidth - 40), y = rand(penY + 40, penY + penHeight - 40), parent = null) {
  const name = generateName();
  const a = add([
    text(name.toLowerCase(), { size: 16 }),
    pos(x, y),
    color(100, 255, 100),
    area(),
    "animal",
    {
      dir: vec2(rand(-1, 1), rand(-1, 1)).unit(),
      hunger: 0, satedTime: 0, mode: "wander", target: null, alive: true, hungerTime: 0,
      firstName: name, lastName: parent ? parent.firstName + "z" : "", parentName: parent ? parent.firstName : null,
      offspring: [], victims: [], stats: { lifetime: 0, kids: 0, foods: 0, kills: 0 },
      legacyBarriers: [],
    },
  ]);
  animalsStats.push(a);
  if (parent) parent.offspring.push(name);
  return a;
}

function spawnFood() {
  return add([text("*", { size: 12 }), pos(rand(penX + 40, penX + penWidth - 40), rand(penY + 40, penY + penHeight - 40)), color(255, 165, 0), area(), "food"]);
}

function spawnFoodAt(x, y) {
  return add([text("*", { size: 12 }), pos(x, y), color(255, 165, 0), area(), "food"]);
}

function spawnCorpse(x, y, cause = "normal") {
  const char = cause === "starvation" ? "☠️" : "x";
  const c = add([text(char, { size: 16 }), pos(x, y), color(50, 50, 50), area(), "corpse"]);
  wait(corpseLifetime, () => destroy(c));
}

function killAnimal(a, cause = "normal") {
  a.alive = false;
  a.text = cause === "starvation" ? "☠️" : "x";
  a.color = rgb(50, 50, 50);
  spawnCorpse(a.pos.x, a.pos.y, cause);

  for (const barrier of a.legacyBarriers) {
    destroy(barrier);
  }

  ancestorStats.push({
    symbol: a.text,
    name: `${a.firstName} ${a.lastName}`,
    parent: a.parentName || "No one",
    offspring: [...a.offspring],
    lifetime: a.stats.lifetime.toFixed(1),
    kids: a.stats.kids,
    foods: a.stats.foods,
    kills: a.stats.kills,
    magic: computeMagicNumber(a).toFixed(1),
    victims: [...a.victims],
  });

  const idx = animalsStats.indexOf(a);
  if (idx !== -1) animalsStats.splice(idx, 1);
  destroy(a);
}

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

function computeMagicNumber(a) {
  return (a.stats.lifetime + a.stats.kids + a.stats.foods + a.stats.kills) / 4;
}

for (let i = 0; i < 20; i++) spawnAnimal();
loop(spawnFoodInterval, spawnFood);
onClick(() => {
  const m = mousePos();
  if (m.x > penX && m.x < penX + penWidth && m.y > penY && m.y < penY + penHeight) {
    spawnFoodAt(m.x, m.y);
  }
});

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

  if (a.mode === "flee" && a.target) {
    let fleeTarget = null;
    if (a.hunger > 1) {
      const foods = get("food");
      if (foods.length) fleeTarget = foods.reduce((c, f) => f.pos.dist(a.pos) < c.pos.dist(a.pos) ? f : c, foods[0]);
    }
    const dir = (fleeTarget ? fleeTarget.pos.sub(a.pos) : a.pos.sub(a.target.pos)).unit();
    let speed = 60;
    if (a.hunger < 1) speed += 40;
    a.move(dir.scale(speed));
  } else if (a.mode === "hunt" && a.target) {
    const dir = a.target.pos.sub(a.pos).unit();
    a.move(dir.scale(animalSpeed));
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

  // Legacy Barrier creation
  if (a.stats.lifetime > goldAge && a.stats.kids > 0 && a.stats.kills > 0 && rand(1) < 0.005) {
    const sx = Math.floor((a.pos.x - penX) / 10) * 10 + penX;
    const sy = Math.floor((a.pos.y - penY) / 10) * 10 + penY;
const legacyBlock = add([
  rect(10, 10),
  pos(sx, sy),
  area(),
  color(255, 215, 0),
  outline(1),
  "barrier",
]);

const legacyText = add([
  text(a.firstName + "x", { size: 6 }),
  pos(sx + 1, sy + 1), // slightly offset inside the block
  color(0, 0, 0),
]);
a.legacyBarriers.push(legacyBlock);
  }
});

onCollide("animal", "food", (a, f) => {
  if (!a.alive) return;
  destroy(f);
  a.hunger = 0;
  a.mode = "wander";
  a.target = null;
  a.stats.foods++;
});

onCollide("animal", "animal", (a, b) => {
  if (!a.alive || !b.alive) return;
  if (a.target === b) {
    if (rand(1) < 0.5) {
      a.victims.push(b.firstName + (b.lastName ? " " + b.lastName : ""));
      a.stats.kills++;
      killAnimal(b);
    } else {
      b.victims.push(a.firstName + (a.lastName ? " " + a.lastName : ""));
      b.stats.kills++;
      killAnimal(a);
    }
  }
});

onKeyPress("b", () => {
  const m = mousePos();
  if (m.x > penX && m.x < penX + penWidth && m.y > penY && m.y < penY + penHeight) {
    const sx = Math.floor((m.x - penX) / 10) * 10 + penX;
    const sy = Math.floor((m.y - penY) / 10) * 10 + penY;
    if (!get("barrier").find(b => Math.abs(b.pos.x - sx) < 1 && Math.abs(b.pos.y - sy) < 1)) {
      add([rect(barrierSize.x, barrierSize.y), pos(sx, sy), area(), color(150, 150, 255), outline(1), "barrier"]);
    }
  }
});

onKeyPress("x", () => {
  const m = mousePos();
  const b = get("barrier").find(b =>
    m.x >= b.pos.x && m.x <= b.pos.x + barrierSize.x &&
    m.y >= b.pos.y && m.y <= b.pos.y + barrierSize.y
  );
  if (b) destroy(b);
});

onUpdate(() => {
  destroyAll("statText");
  let aliveInfo = "ALIVE\n #  Name     Parent   Kids         L  K  F  D  M  Victims\n";
  animalsStats.forEach((a, i) => {
    aliveInfo += `${(i + 1).toString().padStart(2, ' ')}  ${(a.firstName + " " + (a.lastName || "")).padEnd(8, ' ')} ${(a.parentName || "None").padEnd(7, ' ')} ${(a.offspring.length ? a.offspring.join(",") : "-").padEnd(10, ' ')} ${a.stats.lifetime.toFixed(0).padStart(2, ' ')} ${a.stats.kids.toString().padStart(2, ' ')} ${a.stats.foods.toString().padStart(2, ' ')} ${a.stats.kills.toString().padStart(2, ' ')} ${computeMagicNumber(a).toFixed(1).padStart(4, ' ')}  ${(a.victims.length ? a.victims.join(",") : "-")}`;
    aliveInfo += "\n";
  });
  let deadInfo = "ANCESTORS\n #  Name     Parent   Kids         L  K  F  D  M  Victims\n";
  ancestorStats.forEach((a, i) => {
    deadInfo += `${(i + 1).toString().padStart(2, ' ')}  ${(a.name || "").padEnd(8, ' ')} ${(a.parent || "None").padEnd(7, ' ')} ${(a.offspring.length ? a.offspring.join(",") : "-").padEnd(10, ' ')} ${a.lifetime.toString().padStart(2, ' ')} ${a.kids.toString().padStart(2, ' ')} ${a.foods.toString().padStart(2, ' ')} ${a.kills.toString().padStart(2, ' ')} ${a.magic.toString().padStart(4, ' ')}  ${(a.victims.length ? a.victims.join(",") : "-")}`;
    deadInfo += "\n";
  });
  add([text(aliveInfo, { size: 12 }), pos(penX + penWidth + 10, penY), color(255, 255, 255), "statText"]);
  add([text(deadInfo, { size: 12 }), pos(penX + penWidth + 10, penY + 300), color(180, 180, 180), "statText"]);
});
