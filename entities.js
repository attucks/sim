function spawnAnimal(parent = null) {
  const spawnPos = parent
    ? parent.pos.add(vec2(rand(-10, 10), rand(-10, 10)))
    : vec2(rand(penX, penX + penWidth), rand(penY, penY + penHeight));

  const familyColor = parent ? parent.familyColor : rgb(rand(0, 255), rand(0, 255), rand(0, 255));
  const parentName = parent ? parent.firstName : null;
  const lastName = parent ? parent.firstName + "z" : null;

  const firstName = generateName(); // 👈 Generate name first

  const a = add([
    sprite("creatureFront"),
    pos(spawnPos),
    area(),
    anchor("center"),
    body(),
    "animal",
{
  alive: true,
  color: familyColor,
  familyColor: familyColor,
  firstName: firstName,
  lastName: lastName,
  parentName: parentName,
  familyLine: parent ? [...parent.familyLine, parent.firstName, firstName] : [firstName],
  stats: {
    lifetime: 0,
    kids: 0,
    foods: 0,
    kills: 0,
  },
  satedTime: 0,
  hunger: 0,
  hungerTime: 0,
  readyToBirth: false,
  badge: null,
  hasBadge: false,
  victims: [],
  offspring: [],
  legacyBlocks: [],
  legacyBarriers: [], // 🛠 ✅ ADD THIS
  mode: "wander",
  dir: vec2(rand(-1, 1), rand(-1, 1)).unit(),
  greed: rand(0.5, 1.5),
  curiosity: rand(0.5, 1.5),
  territorial: rand(0.5, 1.5),
  legacyDesire: rand(0.5, 1.5),
}

  ]);

  if (parent) {
    parent.offspring.push(firstName);
  }

  animalsStats.push({
    firstName: a.firstName,
    lastName: a.lastName,
    parentName: a.parentName,
    stats: a.stats,
    victims: a.victims,
    offspring: a.offspring,
  });

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
  a.text = cause === "starvation" ? "☠️" : "☠️";
  a.color = rgb(255, 255, 255);
  spawnCorpse(a.pos.x, a.pos.y, cause);

  for (const barrier of a.legacyBarriers) destroy(barrier);

  ancestorStats.push({
    symbol: a.text,
    name: `${a.firstName} ${a.lastName}`,
    parent: a.parentName || "--",
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

function generateLegacyColor(firstName, lastName) {
  let hash = 0;
  const str = firstName + lastName;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = (hash >> 0) & 0xFF;
  const g = (hash >> 8) & 0xFF;
  const b = (hash >> 16) & 0xFF;
  return rgb(r % 255, g % 255, b % 255);
}

function leaveLegacyBlock(a) {
  const sx = Math.floor((a.pos.x - penX) / 10) * 10 + penX;
  const sy = Math.floor((a.pos.y - penY) / 10) * 10 + penY;
  addNews(`${a.firstName} left a legacy`);

const legacyBlock = add([
  rect(10, 10),
  pos(sx, sy),
  area(),
  color(a.familyColor),
  outline(1),
  "barrier",
  {
    familyColor: a.familyColor, // ✅ Track owner family
  }
]);


  a.legacyBarriers.push(legacyBlock);

  // Spawn food around it
  for (let i = 0; i < 3; i++) {
    const offsetX = rand(-30, 30);
    const offsetY = rand(-30, 30);
    const fx = clamp(sx + offsetX, penX + 10, penX + penWidth - 10);
    const fy = clamp(sy + offsetY, penY + 10, penY + penHeight - 10);
    add([
      text("*", { size: 12 }),
      pos(fx, fy),
      color(255, 165, 0),
      area(),
      "food",
    ]);
  }
}
