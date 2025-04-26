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
  return add([
    text("*", { size: 12 }),
    pos(rand(penX + 40, penX + penWidth - 40), rand(penY + 40, penY + penHeight - 40)),
    color(255, 165, 0),
    area(),
    "food"
  ]);
}

function spawnFoodAt(x, y) {
  return add([
    text("*", { size: 12 }),
    pos(x, y),
    color(255, 165, 0),
    area(),
    "food"
  ]);
}

function spawnCorpse(x, y, cause = "normal") {
  const char = cause === "starvation" ? "☠️" : "x";
  const c = add([
    text(char, { size: 16 }),
    pos(x, y),
    color(50, 50, 50),
    area(),
    "corpse"
  ]);
  wait(corpseLifetime, () => destroy(c));
}

function killAnimal(a, cause = "normal") {
  a.alive = false;
  a.text = cause === "starvation" ? "☠️" : "x";
  a.color = rgb(50, 50, 50);
  spawnCorpse(a.pos.x, a.pos.y, cause);

  for (const barrier of a.legacyBarriers) destroy(barrier);

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
