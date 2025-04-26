loop(spawnFoodInterval, spawnFood);

onClick(() => {
  const m = mousePos();
  if (m.x > penX && m.x < penX + penWidth && m.y > penY && m.y < penY + penHeight) {
    spawnFoodAt(m.x, m.y);
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
