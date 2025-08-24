
onClick("pauseBtn", () => {
  isPaused = !isPaused;
  pauseLabel.text = isPaused ? "▶️ Play" : "⏸️ Pause";
});
let foodTimer = 0;

onUpdate(() => {
  if (simTick % simSkipFrames !== 0) return;

  foodTimer += dt();
  if (foodTimer >= spawnFoodInterval) {
    spawnFood();
    foodTimer = 0;
  }
});
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
    if (areRelatives(a, b)) {
  // 🧬 Family detected — no fighting
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
     // addNews(`${a.firstName} defeated ${b.firstName}`);
      killAnimal(b);
    } else {
      b.victims.push(a.firstName + (a.lastName ? " " + a.lastName : ""));
      b.stats.kills++;
     // addNews(`${b.firstName} defeated ${a.firstName}`);
      killAnimal(a);
    }
  }
});

onCollide("animal", "food", (a, f) => {
  if (!a.alive) return;
  destroy(f);
  a.hunger = 0;
    a.target = null;
  a.stats.foods++;
  a.health = if(a.health<100){(a.health/2)+ a.health}else{100};
  a.mode = "wander";
});


onKeyPress("b", () => {
  const m = mousePos();
  if (m.x > penX && m.x < penX + penWidth && m.y > penY && m.y < penY + penHeight) {
    const sx = Math.floor((m.x - penX) / 10) * 10 + penX;
    const sy = Math.floor((m.y - penY) / 10) * 10 + penY;

    const exists = get("barrier").find(b =>
      Math.abs(b.pos.x - sx) < 1 && Math.abs(b.pos.y - sy) < 1
    );

    if (!exists) {
      add([
        text("🌳", { size: 18 }),
        pos(sx, sy),
        anchor("center"),
        area({ shape: new Rect(vec2(0), 18, 18) }),
        "barrier",
        { isNLB: true },
      ]);
    }
  }
});

onKeyPress("x", () => {
  const m = mousePos();
  const b = get("barrier").find(b => {
    if (!b.pos) return false;
    return b.pos.dist(m) < 10; // 10px radius tolerance
  });
  if (b) destroy(b);
});

