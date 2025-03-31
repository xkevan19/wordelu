const CONFIG = {
  WORD_LENGTH: 5,
  MAX_ATTEMPTS: 6,
  LEADERBOARD_SIZE: 20,
  HARD_MODE_DURATION: 120,
  TOAST_DURATION: 3000,
};

const WORDS = {
  general: [
    "apple",
    "beach",
    "chair",
    "dance",
    "eagle",
    "flame",
    "grape",
    "horse",
    "image",
    "joker",
    "knife",
    "lemon",
    "music",
    "noble",
    "ocean",
    "paint",
    "queen",
    "river",
    "smile",
    "tiger",
    "uncle",
    "voice",
    "water",
    "xerox",
    "yacht",
  ],
  animals: [
    "camel",
    "koala",
    "sloth",
    "whale",
    "gecko",
    "tiger",
    "panda",
    "lion",
    "snake",
    "hippo",
    "zebra",
    "lemur",
    "horse",
    "eagle",
    "goose",
  ],
  fruits: [
    "apple",
    "guava",
    "mango",
    "grape",
    "lemon",
    "peach",
    "melon",
    "berry",
    "plums",
    "kiwis",
  ],
  sports: [
    "rugby",
    "skate",
    "cycle",
    "punch",
    "score",
    "arena",
    "field",
    "match",
    "court",
    "medal",
  ],
  colours: [
    "azure",
    "black",
    "brown",
    "green",
    "white",
    "olive",
    "slate",
    "ivory",
    "pearl",
    "steel",
  ],
  entertainment: [
    "scene",
    "actor",
    "stage",
    "movie",
    "drama",
    "music",
    "dance",
    "radio",
    "video",
  ],
  tech: [
    "cloud",
    "pixel",
    "smart",
    "bytes",
    "drive",
    "cyber",
    "robot",
    "laser",
    "space",
    "probe",
    "virus",
  ],
  science: [
    "orbit",
    "solar",
    "laser",
    "space",
    "probe",
    "light",
    "virus",
    "genes",
    "earth",
    "power",
  ],
};

for (const category in WORDS) {
  if (Object.hasOwnProperty.call(WORDS, category)) {
    WORDS[category] = WORDS[category].filter(
      (word) => word.length === CONFIG.WORD_LENGTH
    );
  }
}

const ACHIEVEMENTS = {
  FIRST_VICTORY: {
    id: "FIRST_VICTORY",
    name: "First Victory",
    description: "Won your first game!",
    icon: "🏆",
  },
  PERFECT_GAME: {
    id: "PERFECT_GAME",
    name: "Perfect Game",
    description: "Guessed the word on the first try!",
    icon: "💯",
  },
  HARD_MODE_MASTER: {
    id: "HARD_MODE_MASTER",
    name: "Hard Mode Master",
    description: "Won a game in hard mode!",
    icon: "💪",
  },
  CATEGORY_CHAMPION: {
    id: "CATEGORY_CHAMPION",
    name: "Category Champion",
    description: "Won a game in every category!",
    icon: "👑",
  },
  TIME_MASTER: {
    id: "TIME_MASTER",
    name: "Time Master",
    description: `Won a hard mode game with at least ${Math.floor(
      CONFIG.HARD_MODE_DURATION / 2
    )} seconds remaining`,
    icon: "⏱️",
  },
};
ACHIEVEMENTS.TIME_MASTER.description = `Won a hard mode game with at least ${Math.floor(
  CONFIG.HARD_MODE_DURATION / 2
)} seconds remaining`;
