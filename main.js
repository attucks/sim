// main.js

// barrierSize needs kaboom() first, so we set it now:
window.barrierSize = vec2(10, 10);

// Draw pen
add([
  rect(penWidth, penHeight),
  pos(penX, penY),
  outline(4),
  color(0, 0, 0),
]);

// Spawn initial animals
for (let i = 0; i < 20; i++) {
  spawnAnimal();
}
