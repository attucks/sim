function spawnAnimal(x = rand(penX + 40, penX + penWidth - 40), y = rand(penY + 40, penY + penHeight - 40), parent = null) {
  const name = generateName();
  const familyLine = parent ? [...parent.familyLine, name] : [name];
  const familyColor = parent ? parent.familyColor : rgb(rand(50, 255), rand(50, 255), rand(50, 255)); // 🔥 PURE rgb()

const a = add([
  text("🧝"), // Attach sprite ONCE
  scale(.5), // or whatever size you like
  pos(x, y),
  color(familyColor),
  area(),
  "animal",
  {
    dir: vec2(rand(-1, 1), rand(-1, 1)).unit(),
    currentDirection: "front", 
    hunger: 0,
    satedTime: 0,
    mode: "wander",
    target: null,
    alive: true,
    hungerTime: 0,

    firstName: name,
    lastName: parent ? parent.firstName + "z" : "",
    parentName: parent ? parent.firstName : null,
    offspring: [],
    victims: [],
    stats: { lifetime: 0, kids: 0, foods: 0, kills: 0 },
    legacyBarriers: [],
    familyLine,
    familyColor,
    bravery: rand(0.3, 1.0),
    curiosity: rand(0.3, 1.0),
    territorial: rand(0.3, 1.0),
    greed: rand(0.3, 1.0),
    legacyDesire: rand(0.3, 1.0),
    lastLegacyTime: 0,
    //currentSprite: "creatureFront", // Start facing front
    packMode: false, // initially not in a pack

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
  const char = cause === "starvation" ? "☠️" : "☠️";
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

//  addNews(`${a.firstName} left a legacy`);

  const legacyBlock = add([
    color(a.familyColor),        // ✅ color first
    text("🍄", { size: 18 }),     // ✅ then text
    pos(sx, sy),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "legacy",
    {
      familyColor: a.familyColor,
      creatorName: a.firstName,
      isLegacy: true,
    },
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


