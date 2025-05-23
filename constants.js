// constants.js
window.buildTime = "v3.1"; // Set to your local time when you update

// Pen dimensions
window.penX = 20;
window.penY = 20;
window.penWidth = 760;
window.penHeight = 560;
window.familyAlliances = {}
// Speeds and gameplay mechanics
window.animalSpeed = 40;
window.spawnFoodInterval = 3;
window.foodHealAmount = 5;
window.birthingTime = 10;
window.birthingHungerThreshold = 1.5; 
window.corpseLifetime = 180;
window.corpseRepelDistance = 20;
window.barrierRepelDistance = 20;
window.hungerRate = 0.16;
window.starvationThreshold = 5;
window.starvationTimeLimit = 10;
window.goldAge = 60;

window.maxPopulation = 50; 
 window.isPaused = false;
  window.simTick = 0;
window.simSkipFrames = 1;

// Data tracking
window.animalsStats = [];
window.ancestorStats = [];
window.newsFeed = [];
