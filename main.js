// main.js

// barrierSize needs kaboom() first, so we set it now:
window.barrierSize = vec2(10, 10);

// Draw pen
add([
  rect(penWidth, penHeight),
  pos(penX, penY),
  outline(4),
  color(90,79,62),
]);

// Load sprites
loadSprite("creatureFront", "sprites/front.png");
loadSprite("creatureLeft", "sprites/left.png");
loadSprite("creatureRight", "sprites/right.png");

// Spawn initial animals
for (let i = 0; i < 12; i++) {
  spawnAnimal();
}

for (let i = 0; i < 25; i++) {
  spawnFood();
}

// Add tree border around the pen (no gaps)
for (let x = penX; x <= penX + penWidth; x += barrierSize.x) {
  // Top edge
  add([
    text("🌳", { size: 18 }),
    pos(x, penY),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "barrier",
    { isNLB: true },
  ]);
  // Bottom edge
  add([
    text("🌳", { size: 18 }),
    pos(x, penY + penHeight),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "barrier",
    { isNLB: true },
  ]);
}
for (let y = penY; y <= penY + penHeight; y += barrierSize.y) {
  // Left edge
  add([
    text("🌳", { size: 18 }),
    pos(penX, y),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "barrier",
    { isNLB: true },
  ]);
  // Right edge
  add([
    text("🌳", { size: 18 }),
    pos(penX + penWidth, y),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "barrier",
    { isNLB: true },
  ]);
}

// Add interior cross-section barriers (with gaps)
const centerX = penX + Math.floor(penWidth / 2);
const centerY = penY + Math.floor(penHeight / 2);

// Vertical wall (interior)
for (let y = penY + 10; y < penY + penHeight; y += barrierSize.y) {
  if ((y - penY) % 60 === 0) continue; // Skip to leave a few gaps
  add([
    text("🌳", { size: 18 }),
    pos(centerX, y),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "barrier",
    { isNLB: true },
  ]);
}

// Horizontal wall (interior)
for (let x = penX + 10; x < penX + penWidth; x += barrierSize.x) {
  if ((x - penX) % 80 === 0) continue; // Skip to leave a few gaps
  add([
    text("🌳", { size: 18 }),
    pos(x, centerY),
    anchor("center"),
    area({ shape: new Rect(vec2(0), 18, 18) }),
    "barrier",
    { isNLB: true },
  ]);
}
onUpdate(() => {
  simTick++;
});

