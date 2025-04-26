function generateName() {
  const consonants = "bcdfghjklmnpqrstvwxyz";
  const vowels = "aeiou";
  const c = consonants[Math.floor(rand(0, consonants.length))];
  const v = vowels[Math.floor(rand(0, vowels.length))];
  return c.toUpperCase() + v;
}

function computeMagicNumber(a) {
  return (a.stats.lifetime + a.stats.kids + a.stats.foods + a.stats.kills) / 4;
}
