// main.js

// barrierSize needs kaboom() first, so we set it now:
window.barrierSize = vec2(10, 10);

// Draw pen
add([
  rect(penWidth, penHeight),
  pos(penX, penY),
  outline(4),
  color(50, 50, 50),
]);

// Load sprites
loadSprite("creatureFront", "sprites/front.png");
loadSprite("creatureLeft", "sprites/left.png");
loadSprite("creatureRight", "sprites/right.png");

// Spawn initial animals
for (let i = 0; i < 15; i++) {
  spawnAnimal();
}

// Now setup the UI
//setupUI();
