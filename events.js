loop(spawnFoodInterval, spawnFood);

onClick(() => {
  const m = mousePos();
  if (m.x > penX && m.x < penX + penWidth && m.y > penY && m.y < penY + penHeight) {
    spawnFoodAt(m.x, m.y);
  }
});

onCollide("animal", "animal", (a, b) => {
  if (!a.alive || !b.alive) return;
  if (a.target === b) {

    // 🧬 Check if they are relatives
    const sameParent = a.parentName && b.parentName && a.parentName === b.parentName;
    const aIsParentOfB = b.parentName === a.firstName;
    const bIsParentOfA = a.parentName === b.firstName;

    if (sameParent || aIsParentOfB || bIsParentOfA) {
      // ✅ They are related — don't fight
      a.mode = "wander";
      b.mode = "wander";
      a.target = null;
      b.target = null;
      return;
    }

    // (Normal fight bravery roll follows...)
    if (rand(1) > a.bravery) {
      a.mode = "flee";
      a.target = b;
      return;
    }
    if (rand(1) > b.bravery) {
      b.mode = "flee";
      b.target = a;
      return;
    }

    const aMagic = computeMagicNumber(a);
    const bMagic = computeMagicNumber(b);
    const totalMagic = aMagic + bMagic;
    const chanceA = totalMagic > 0 ? aMagic / totalMagic : 0.5;

    if (rand(1) < chanceA) {
      a.victims.push(b.firstName + (b.lastName ? " " + b.lastName : ""));
      a.stats.kills++;
      addNews(`${a.firstName} defeated ${b.firstName}`);
      killAnimal(b);
    } else {
      b.victims.push(a.firstName + (a.lastName ? " " + a.lastName : ""));
      b.stats.kills++;
      addNews(`${b.firstName} defeated ${a.firstName}`);
      killAnimal(a);
    }
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
