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
  if (a.familyColor === b.familyColor) return true;
  if (familyAlliances[a.familyColor] && familyAlliances[a.familyColor].includes(b.familyColor)) return true;
  if (familyAlliances[b.familyColor] && familyAlliances[b.familyColor].includes(a.familyColor)) return true;
  return false;
}
function scaleColor(color, factor) {
  return rgb(
    Math.min(color.r * factor, 255),
    Math.min(color.g * factor, 255),
    Math.min(color.b * factor, 255)
  );
}
function colorsMatch(c1, c2) {
    if (!c1 || !c2) return false; // Safely handle undefined color
    return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;
}
function clampToPen(entity) {
  const buffer = 5; // optional padding so they don't stick exactly on wall

  if (entity.pos.x < penX + buffer) {
    entity.pos.x = penX + buffer;
  }
  if (entity.pos.x > penX + penWidth - buffer) {
    entity.pos.x = penX + penWidth - buffer;
  }
  if (entity.pos.y < penY + buffer) {
    entity.pos.y = penY + buffer;
  }
  if (entity.pos.y > penY + penHeight - buffer) {
    entity.pos.y = penY + penHeight - buffer;
  }
}

function familyColorToCSS(color) {
  if (!color) return "white";
  return `rgb(${color.r ?? 255}, ${color.g ?? 255}, ${color.b ?? 255})`;
}
function findClosest(list, pos) {
  if (!list || list.length === 0) return null;
  return list.reduce((closest, item) => 
    pos.dist(item.pos) < pos.dist(closest.pos) ? item : closest
  );
}
