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
function addNews(message) {
  newsFeed.unshift(message); // add to the start
  if (newsFeed.length > 20) {
    newsFeed.pop(); // keep it to the last 20 entries
  }
}
function areRelatives(a, b) {
  return a.familyLine.some(name => b.familyLine.includes(name));
}
function scaleColor(color, factor) {
  return rgb(
    Math.min(color.r * factor, 255),
    Math.min(color.g * factor, 255),
    Math.min(color.b * factor, 255)
  );
}
