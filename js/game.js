(function () {
  const CONFIG = {
    WORD_LENGTH: 5,
    MAX_ATTEMPTS: 6,
    LEADERBOARD_SIZE: 10,
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
      "show",
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
      "coded",
      "chips",
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

  class WordleGame {
    constructor(playerName, difficulty, category) {
      this.WORD_LENGTH = CONFIG.WORD_LENGTH;
      this.MAX_ATTEMPTS = CONFIG.MAX_ATTEMPTS;
      this.score = 0;
      this.playerName = playerName;
      this.difficulty = difficulty;
      this.category = category;
      this.timeLeft =
        this.difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
      this.timerInterval = null;
      this.letterCubes = [];
      this.currentRow = 0;
      this.currentCol = 0;
      this.targetWord = this.selectRandomWord();
      this.currentGuess = [];
      this.gameOver = false;
      this.gameWon = false;
      this.guessedLetters = new Set();

      this.sounds = {
        correct: new Howl({
          src: ["sound/correct.wav"],
          volume: 0.5,
          onloaderror: (id, err) =>
            console.error("Howler load error (correct):", err),
        }),
        wrong: new Howl({
          src: ["sound/wrong.wav"],
          volume: 0.5,
          onloaderror: (id, err) =>
            console.error("Howler load error (wrong):", err),
        }),
        type: new Howl({
          src: ["sound/type.wav"],
          volume: 0.3,
          onloaderror: (id, err) =>
            console.error("Howler load error (type):", err),
        }),
        win: new Howl({
          src: ["sound/win.wav"],
          volume: 0.7,
          onloaderror: (id, err) =>
            console.error("Howler load error (win):", err),
        }),
        lose: new Howl({
          src: ["sound/lose.wav"],
          volume: 0.7,
          onloaderror: (id, err) =>
            console.error("Howler load error (lose):", err),
        }),
      };

      this.playerStats = this.loadPlayerStats();
      this.leaderboard = this.loadLeaderboard();
      this.achievements = this.loadAchievements();

      this.boundHandleKeyDown = this.handleKeyDown.bind(this);
      this.boundHandleModalKeyDown = this.handleModalKeyDown.bind(this);

      this.createGameBoard();
      this.createKeyboard();
      this.setupEventListeners();
      this.updateDifficultyDisplay();
      this.updateScoreDisplay();
      this.updateTimerDisplay();
      if (this.timeLeft !== null) {
        this.startTimer();
      }

      document
        .getElementById("back-to-menu-btn")
        .addEventListener("click", () => {
          this.resetGameToMenu();
        });
    }

    selectRandomWord() {
      const categoryWords = WORDS[this.category];
      if (!categoryWords || categoryWords.length === 0) {
        console.error(
          `No words found for category: ${this.category}. Falling back to general.`
        );
        return WORDS.general[
          Math.floor(Math.random() * WORDS.general.length)
        ].toUpperCase();
      }
      return categoryWords[
        Math.floor(Math.random() * categoryWords.length)
      ].toUpperCase();
    }

    createGameBoard() {
      const gameBoard = document.getElementById("game-board");
      gameBoard.innerHTML = "";
      const fragment = document.createDocumentFragment();
      for (let row = 0; row < this.MAX_ATTEMPTS; row++) {
        const rowElement = document.createElement("div");
        rowElement.id = `row-${row}`;
        rowElement.className = "flex space-x-grid-gap";
        for (let col = 0; col < this.WORD_LENGTH; col++) {
          const cell = document.createElement("div");
          cell.id = `cell-${row}-${col}`;
          cell.className = `w-cell-size h-cell-size border-2 border-gray-600 flex items-center justify-center text-2xl font-bold uppercase transition-all duration-300`;
          rowElement.appendChild(cell);
        }
        fragment.appendChild(rowElement);
      }
      gameBoard.appendChild(fragment);
    }

    createKeyboard() {
      const keyboardRows = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
      ];
      const keyboard = document.getElementById("keyboard");
      keyboard.innerHTML = "";
      const fragment = document.createDocumentFragment();

      keyboardRows.forEach((row) => {
        const rowElement = document.createElement("div");
        rowElement.className = "flex justify-center space-x-key-gap mb-2";
        row.forEach((key) => {
          const keyButton = document.createElement("button");
          keyButton.textContent = key;
          keyButton.dataset.key = key;
          keyButton.className = `key bg-key-bg text-white px-3 py-2 rounded hover:bg-key-hover transition duration-200 h-key-height text-sm ${
            key === "ENTER" || key === "⌫" ? "w-enter-width" : "w-key-width"
          }`;
          rowElement.appendChild(keyButton);
        });
        fragment.appendChild(rowElement);
      });
      keyboard.appendChild(fragment);
    }

    setupEventListeners() {
      document.getElementById("keyboard").addEventListener("click", (event) => {
        if (event.target.classList.contains("key")) {
          this.handleKeyPress(event.target.dataset.key);
        }
      });
      document.addEventListener("keydown", this.boundHandleKeyDown);
    }

    handleKeyDown(event) {
      if (this.gameOver) return;
      if (!document.getElementById("message-box").classList.contains("hidden"))
        return;

      const key = event.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        this.handleKeyPress(key);
      } else if (event.key === "Enter") {
        this.handleKeyPress("ENTER");
      } else if (event.key === "Backspace") {
        this.handleKeyPress("⌫");
      }
    }

    handleKeyPress(key) {
      if (this.gameOver) return;

      if (key === "ENTER") {
        this.submitGuess();
      } else if (key === "⌫") {
        this.deleteLetter();
      } else if (/^[A-Z]$/.test(key)) {
        this.addLetter(key);
      }
    }

    addLetter(letter) {
      if (this.currentCol < this.WORD_LENGTH) {
        const cell = document.getElementById(
          `cell-${this.currentRow}-${this.currentCol}`
        );
        cell.textContent = letter;
        cell.classList.add("scale-110");
        setTimeout(() => cell.classList.remove("scale-110"), 100);
        this.currentGuess.push(letter);
        this.currentCol++;
        this.playSound("type");
      }
    }

    deleteLetter() {
      if (this.currentCol > 0) {
        this.currentCol--;
        const cell = document.getElementById(
          `cell-${this.currentRow}-${this.currentCol}`
        );
        cell.textContent = "";
        this.currentGuess.pop();
      }
    }

    submitGuess() {
      if (this.currentCol !== this.WORD_LENGTH) {
        this.shakeRow();
        this.playSound("wrong");
        this.showToast("Not enough letters!");
        return;
      }

      const guess = this.currentGuess.join("");
      const result = this.checkGuess(guess);
      const currentRowToUpdate = this.currentRow;

      this.updateRowColors(result, currentRowToUpdate);
      this.updateKeyboardColors(guess, result);

      if (guess === this.targetWord) {
        setTimeout(() => this.handleWin(), this.WORD_LENGTH * 200 + 100);
      } else {
        this.currentRow++;
        if (this.currentRow >= this.MAX_ATTEMPTS) {
          setTimeout(() => this.handleLose(), this.WORD_LENGTH * 200 + 100);
        } else {
          this.playSound("wrong");
          this.currentGuess = [];
          this.currentCol = 0;
        }
      }
    }

    checkGuess(guess) {
      const result = new Array(this.WORD_LENGTH).fill("absent");
      const targetLetters = this.targetWord.split("");
      const guessLetters = guess.split("");

      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (guessLetters[i] === targetLetters[i]) {
          result[i] = "correct";
          targetLetters[i] = null;
          guessLetters[i] = null;
        }
      }

      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (guessLetters[i] !== null) {
          const index = targetLetters.indexOf(guessLetters[i]);
          if (index !== -1) {
            result[i] = "present";
            targetLetters[index] = null;
            guessLetters[i] = null;
          }
        }
      }

      const points = this.calculatePoints(guess, result);

      let finalPointsForGuess = points;
      const isCorrectGuess = result.every((r) => r === "correct");
      const isFirstAttempt = this.currentRow === 0;

      if (isCorrectGuess && isFirstAttempt) {
        finalPointsForGuess *= 2;
        console.log(
          "First attempt correct! Doubling points for this guess to:",
          finalPointsForGuess
        );
        this.showToast("✨ Perfect First Guess! +20 Points! ✨");
      }

      this.score += finalPointsForGuess;
      this.updateScoreDisplay();

      return result;
    }

    calculatePoints(guess, result) {
      let points = 0;
      const uniqueLettersAwarded = new Set();

      if (result.every((r) => r === "correct")) {
        return 10;
      }

      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        if (!uniqueLettersAwarded.has(letter)) {
          if (result[i] === "correct") {
            points += 2;
            uniqueLettersAwarded.add(letter);
          } else if (result[i] === "present") {
            points += 1;
            uniqueLettersAwarded.add(letter);
          }
        }
      }
      return points;
    }

    updateRowColors(colors, rowIndex) {
      for (let index = 0; index < colors.length; index++) {
        setTimeout(() => {
          const cell = document.getElementById(`cell-${rowIndex}-${index}`);
          if (cell) {
            cell.classList.remove(
              "border-gray-600",
              "bg-correct",
              "bg-present",
              "bg-absent"
            );
            cell.classList.add(`bg-${colors[index]}`);
            cell.classList.add("text-white");
          }
        }, index * 200);
      }
    }

    updateKeyboardColors(guess, result) {
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        const status = result[i];
        const keyButton = document.querySelector(
          `#keyboard button[data-key="${letter}"]`
        );

        if (keyButton) {
          const currentStatusIsCorrect =
            keyButton.classList.contains("correct");
          const currentStatusIsPresent =
            keyButton.classList.contains("present");

          if (status === "correct") {
            keyButton.classList.remove("present", "absent");
            keyButton.classList.add("correct");
          } else if (status === "present" && !currentStatusIsCorrect) {
            keyButton.classList.remove("absent");
            keyButton.classList.add("present");
          } else if (
            status === "absent" &&
            !currentStatusIsCorrect &&
            !currentStatusIsPresent
          ) {
            keyButton.classList.add("absent");
          }
        }
      }
    }

    shakeRow() {
      const row = document.getElementById(`row-${this.currentRow}`);
      if (row) {
        row.classList.add("shake");
        setTimeout(() => row.classList.remove("shake"), 500);
      }
    }

    handleWin() {
      this.gameOver = true;
      this.gameWon = true;
      clearInterval(this.timerInterval);

      if (this.difficulty === "hard" && this.timeLeft > 0) {
        this.score += Math.floor(this.timeLeft / 4);
        this.updateScoreDisplay();
      }

      this.playerStats.totalWins++;
      this.playerStats.categoriesWon.add(this.category);
      if (this.difficulty === "hard") this.playerStats.hardModeWins++;
      this.playerStats.totalGamesPlayed++;

      this.checkAchievements();
      this.addScoreToLeaderboard();

      this.savePlayerStats();
      this.saveLeaderboard();
      this.saveAchievements();

      this.playSound("win");
      this.showMessage(
        "Congratulations!",
        `You guessed the word: ${this.targetWord}. Score: ${this.score}`
      );
    }

    handleLose() {
      this.gameOver = true;
      clearInterval(this.timerInterval);

      this.playerStats.totalGamesPlayed++;
      this.savePlayerStats();

      this.playSound("lose");
      this.showMessage(
        "Game Over",
        `The word was: ${this.targetWord}. Final Score: ${this.score}`
      );
    }

    restartGame() {
      this.resetGameState();
      this.createGameBoard();
      this.createKeyboard();
      this.updateScoreDisplay();
      this.updateTimerDisplay();
      this.updateDifficultyDisplay();
      if (this.timeLeft !== null) {
        this.startTimer();
      }
      document.getElementById("message-box").classList.add("hidden");
    }

    resetGameState() {
      clearInterval(this.timerInterval);
      this.currentRow = 0;
      this.currentCol = 0;
      this.currentGuess = [];
      this.gameOver = false;
      this.gameWon = false;
      this.targetWord = this.selectRandomWord();
      this.timeLeft =
        this.difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
      this.score = 0;
      this.guessedLetters = new Set();
    }

    resetGameToMenu() {
      this.destroy();
      document.getElementById("game-container").classList.add("hidden");
      document.getElementById("menu-container").classList.remove("hidden");
    }

    destroy() {
      clearInterval(this.timerInterval);
      document.removeEventListener("keydown", this.boundHandleKeyDown);
      const messageBox = document.getElementById("message-box");
      if (messageBox) {
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
      }
      Object.values(this.sounds).forEach((sound) => {
        if (sound && typeof sound.unload === "function") {
          // sound.unload(); // Consider if unloading is truly needed
        }
      });
      console.log("Game instance destroyed and listeners removed.");
    }

    startTimer() {
      clearInterval(this.timerInterval);
      this.updateTimerDisplay();
      this.timerInterval = setInterval(() => {
        this.timeLeft--;
        this.updateTimerDisplay();
        if (this.timeLeft <= 0) {
          clearInterval(this.timerInterval);
          if (!this.gameOver) {
            this.handleLose();
          }
        }
      }, 1000);
    }

    updateTimerDisplay() {
      const timerEl = document.getElementById("timer");
      if (this.difficulty === "hard" && this.timeLeft !== null) {
        timerEl.textContent = `Time: ${this.timeLeft}s`;
        timerEl.classList.toggle(
          "text-red-500",
          this.timeLeft <= 10 && this.timeLeft > 0
        );
        timerEl.classList.toggle("text-text-secondary", this.timeLeft > 10);
      } else {
        timerEl.textContent = "";
      }
    }

    updateDifficultyDisplay() {
      const difficultyEl = document.getElementById("difficulty-mode");
      if (difficultyEl) {
        difficultyEl.textContent =
          this.difficulty === "easy" ? `Easy Mode` : `Hard Mode`;
      }
    }

    updateScoreDisplay() {
      const scoreEl = document.getElementById("score");
      if (scoreEl) {
        scoreEl.textContent = `Score: ${this.score}`;
      }
    }

    showMessage(title, text) {
      const messageBox = document.getElementById("message-box");
      const messageTitle = document.getElementById("message-title");
      const messageText = document.getElementById("message-text");
      const newGameBtn = document.getElementById("new-game-btn");
      const quitBtn = document.getElementById("quit-btn");

      if (
        !messageBox ||
        !messageTitle ||
        !messageText ||
        !newGameBtn ||
        !quitBtn
      ) {
        console.error("Message box elements not found!");
        return;
      }

      messageTitle.textContent = title;
      messageText.textContent = text;
      messageBox.classList.remove("hidden");

      newGameBtn.focus();

      messageBox.addEventListener("keydown", this.boundHandleModalKeyDown);

      newGameBtn.onclick = () => {
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
        messageBox.classList.add("hidden");
        this.restartGame();
      };

      quitBtn.onclick = () => {
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
        messageBox.classList.add("hidden");
        this.resetGameToMenu();
      };
    }

    handleModalKeyDown(event) {
      if (event.key === "Tab") {
        const messageBox = document.getElementById("message-box");
        const focusableElements = messageBox.querySelectorAll("button");
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      } else if (event.key === "Enter") {
        if (
          document.activeElement &&
          typeof document.activeElement.click === "function"
        ) {
          // document.activeElement.click();
        }
      } else if (event.key === "Escape") {
        // Optional: Allow Escape to close modal
      }
    }

    showToast(message) {
      const container = document.getElementById("toast-container");
      if (!container) {
        console.error("Toast container not found!");
        return;
      }

      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      container.appendChild(toast);

      toast.offsetHeight;

      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");

        toast.addEventListener(
          "transitionend",
          () => {
            if (toast.parentNode === container) {
              container.removeChild(toast);
            }
          },
          { once: true }
        );
      }, CONFIG.TOAST_DURATION);
    }

    playSound(soundName) {
      const sound = this.sounds[soundName];
      if (sound && sound.state() === "loaded") {
        sound.play();
      } else if (sound && sound.state() === "loading") {
        sound.once("load", () => {
          sound.play();
        });
      } else if (!sound) {
        console.warn(`Sound "${soundName}" not found.`);
      } else {
        console.warn(
          `Sound "${soundName}" not loaded. State: ${sound.state()}`
        );
      }
    }

    loadData(key, defaultValue) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (
            key === "wordlePlayerStats" &&
            parsed.categoriesWon &&
            Array.isArray(parsed.categoriesWon)
          ) {
            parsed.categoriesWon = new Set(parsed.categoriesWon);
          }
          return parsed;
        }
      } catch (error) {
        console.error(`Error loading ${key} from LocalStorage:`, error);
      }
      return defaultValue;
    }

    saveData(key, data) {
      try {
        let dataToSave = data;
        if (key === "wordlePlayerStats" && data.categoriesWon instanceof Set) {
          dataToSave = {
            ...data,
            categoriesWon: Array.from(data.categoriesWon),
          };
        }
        localStorage.setItem(key, JSON.stringify(dataToSave));
      } catch (error) {
        console.error(`Error saving ${key} to LocalStorage:`, error);
      }
    }

    loadLeaderboard() {
      return this.loadData("wordleLeaderboard", []);
    }
    saveLeaderboard() {
      this.saveData("wordleLeaderboard", this.leaderboard);
    }

    addScoreToLeaderboard() {
      const newScore = {
        name: this.playerName,
        score: this.score,
        difficulty: this.difficulty,
        category: this.category,
      };
      this.leaderboard.push(newScore);
      this.leaderboard.sort((a, b) => b.score - a.score);
      this.leaderboard = this.leaderboard.slice(0, CONFIG.LEADERBOARD_SIZE);
      this.saveLeaderboard();
      this.updateLeaderboardDisplay();
    }

    updateLeaderboardDisplay() {
      updateLeaderboardDisplayGlobal(this.leaderboard);
    }

    loadPlayerStats() {
      return this.loadData("wordlePlayerStats", {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
      });
    }
    savePlayerStats() {
      this.saveData("wordlePlayerStats", this.playerStats);
    }

    updateStatisticsDisplay() {
      updateStatisticsDisplayGlobal(this.playerStats);
    }

    loadAchievements() {
      return this.loadData("wordleAchievements", {});
    }
    saveAchievements() {
      this.saveData("wordleAchievements", this.achievements);
    }

    checkAchievements() {
      if (
        this.gameWon &&
        this.playerStats.totalWins === 1 &&
        !this.achievements[ACHIEVEMENTS.FIRST_VICTORY.id]
      ) {
        this.unlockAchievement(ACHIEVEMENTS.FIRST_VICTORY);
      }

      if (
        this.gameWon &&
        this.currentRow === 0 &&
        !this.achievements[ACHIEVEMENTS.PERFECT_GAME.id]
      ) {
        this.unlockAchievement(ACHIEVEMENTS.PERFECT_GAME);
      }

      if (
        this.gameWon &&
        this.difficulty === "hard" &&
        !this.achievements[ACHIEVEMENTS.HARD_MODE_MASTER.id]
      ) {
        this.unlockAchievement(ACHIEVEMENTS.HARD_MODE_MASTER);
      }

      const allCategories = Object.keys(WORDS);
      if (
        this.gameWon &&
        allCategories.every((cat) => this.playerStats.categoriesWon.has(cat)) &&
        !this.achievements[ACHIEVEMENTS.CATEGORY_CHAMPION.id]
      ) {
        this.unlockAchievement(ACHIEVEMENTS.CATEGORY_CHAMPION);
      }

      const timeThreshold = Math.floor(CONFIG.HARD_MODE_DURATION / 2);
      ACHIEVEMENTS.TIME_MASTER.description = `Won a hard mode game with at least ${timeThreshold} seconds remaining`;
      if (
        this.gameWon &&
        this.difficulty === "hard" &&
        this.timeLeft >= timeThreshold &&
        !this.achievements[ACHIEVEMENTS.TIME_MASTER.id]
      ) {
        this.unlockAchievement(ACHIEVEMENTS.TIME_MASTER);
      }
    }

    unlockAchievement(achievement) {
      if (achievement && achievement.id && !this.achievements[achievement.id]) {
        this.achievements[achievement.id] = true;
        this.saveAchievements();
        this.updateAchievementsDisplay();
        this.showToast(`🏆 Achievement Unlocked: ${achievement.name}`);
      }
    }

    updateAchievementsDisplay() {
      updateAchievementsDisplayGlobal(this.achievements);
    }
  }

  let currentGameInstance = null;

  document
    .getElementById("show-leaderboard-btn")
    .addEventListener("click", () => showSection("leaderboard-section"));
  document
    .getElementById("show-statistics-btn")
    .addEventListener("click", () => showSection("statistics-section"));
  document
    .getElementById("show-achievements-btn")
    .addEventListener("click", () => showSection("achievements-section"));
  document
    .getElementById("show-instructions-btn")
    .addEventListener("click", () => showSection("instructions-section"));

  document
    .getElementById("back-to-menu-from-sections-btn")
    .addEventListener("click", showMenuFromSections);

  function showSection(sectionId) {
    document.getElementById("leaderboard-section").classList.add("hidden");
    document.getElementById("statistics-section").classList.add("hidden");
    document.getElementById("achievements-section").classList.add("hidden");
    document.getElementById("instructions-section").classList.add("hidden");
    document.getElementById("main-menu-input-card").classList.add("hidden");
    document.getElementById("menu-buttons-container").classList.add("hidden");

    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) sectionToShow.classList.remove("hidden");
    document
      .getElementById("back-to-menu-from-sections-btn")
      .classList.remove("hidden");

    if (sectionId === "leaderboard-section") {
      const tempLeaderboard = JSON.parse(
        localStorage.getItem("wordleLeaderboard") || "[]"
      );
      updateLeaderboardDisplayGlobal(tempLeaderboard);
    } else if (sectionId === "statistics-section") {
      const tempStats = JSON.parse(
        localStorage.getItem("wordlePlayerStats") || "{}"
      );
      tempStats.categoriesWon = new Set(tempStats.categoriesWon || []);
      updateStatisticsDisplayGlobal(tempStats);
    } else if (sectionId === "achievements-section") {
      const tempAchievements = JSON.parse(
        localStorage.getItem("wordleAchievements") || "{}"
      );
      updateAchievementsDisplayGlobal(tempAchievements);
    }
  }

  function showMenuFromSections() {
    document.getElementById("leaderboard-section").classList.add("hidden");
    document.getElementById("statistics-section").classList.add("hidden");
    document.getElementById("achievements-section").classList.add("hidden");
    document.getElementById("instructions-section").classList.add("hidden");
    document
      .getElementById("back-to-menu-from-sections-btn")
      .classList.add("hidden");

    document.getElementById("main-menu-input-card").classList.remove("hidden");
    document
      .getElementById("menu-buttons-container")
      .classList.remove("hidden");
    document.getElementById("player-name").focus();
  }

  function updateLeaderboardDisplayGlobal(leaderboard) {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;
    leaderboardBody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    if (!leaderboard || leaderboard.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5" class="px-4 py-4 text-center text-text-muted">No scores yet! Play a game.</td>`;
      fragment.appendChild(row);
    } else {
      const sortedLeaderboard = [...leaderboard].sort(
        (a, b) => b.score - a.score
      );

      sortedLeaderboard.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.className = index % 2 === 0 ? "bg-input-bg/50" : "";
        row.innerHTML = `
                      <td class="px-4 py-2 text-center">${index + 1}</td>
                      <td class="px-4 py-2">${entry.name || "Player"}</td>
                      <td class="px-4 py-2 text-center">${entry.score}</td>
                      <td class="px-4 py-2 capitalize">${
                        entry.difficulty || "N/A"
                      }</td>
                      <td class="px-4 py-2 capitalize">${
                        entry.category || "N/A"
                      }</td>`;
        fragment.appendChild(row);
      });
    }
    leaderboardBody.appendChild(fragment);
  }

  function updateStatisticsDisplayGlobal(stats) {
    const defaultStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      categoriesWon: new Set(),
      hardModeWins: 0,
    };
    const playerStats = { ...defaultStats, ...stats };
    if (!(playerStats.categoriesWon instanceof Set)) {
      playerStats.categoriesWon = new Set(playerStats.categoriesWon || []);
    }

    const gamesPlayedEl = document.getElementById("games-played");
    if (gamesPlayedEl) gamesPlayedEl.textContent = playerStats.totalGamesPlayed;

    const totalWinsEl = document.getElementById("total-wins");
    if (totalWinsEl) totalWinsEl.textContent = playerStats.totalWins;

    const categoriesWonEl = document.getElementById("categories-won");
    if (categoriesWonEl) {
      const categoriesWonText =
        Array.from(playerStats.categoriesWon)
          .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
          .join(", ") || "None";
      categoriesWonEl.textContent = categoriesWonText;
      categoriesWonEl.title =
        categoriesWonText.length > 25 ? categoriesWonText : "";
    }

    const hardModeWinsEl = document.getElementById("hard-mode-wins");
    if (hardModeWinsEl) hardModeWinsEl.textContent = playerStats.hardModeWins;
  }

  function updateAchievementsDisplayGlobal(unlockedAchievements) {
    const achievementsList = document.getElementById("achievements-list");
    if (!achievementsList) return;
    achievementsList.innerHTML = "";
    const fragment = document.createDocumentFragment();

    Object.values(ACHIEVEMENTS).forEach((achievement) => {
      const isUnlocked = unlockedAchievements[achievement.id] === true;
      const achievementDiv = document.createElement("div");

      achievementDiv.className = `w-full sm:w-64 bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center justify-center text-center transition-opacity duration-300 ${
        isUnlocked ? "opacity-100" : "opacity-50"
      }`;

      achievementDiv.innerHTML = `
                 <div class="text-4xl sm:text-5xl mb-2 ${
                   isUnlocked ? "text-yellow-400" : "text-gray-500"
                 }">
                     ${isUnlocked ? achievement.icon : "🔒"}
                 </div>
                 <h3 class="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">${
                   achievement.name
                 }</h3>
                 <p class="text-gray-400 text-xs sm:text-sm">${
                   achievement.description
                 }</p>`;
      fragment.appendChild(achievementDiv);
    });

    if (fragment.childElementCount === 0) {
      achievementsList.innerHTML =
        '<p class="text-text-muted col-span-full text-center">No achievements defined yet.</p>';
    } else {
      achievementsList.appendChild(fragment);
    }
  }

  document.getElementById("start-game-btn").addEventListener("click", () => {
    if (currentGameInstance) {
      currentGameInstance.destroy();
      currentGameInstance = null;
    }

    const playerName =
      document.getElementById("player-name").value.trim() || "Player";
    const difficulty = document.getElementById("difficulty").value;
    const category = document.getElementById("category").value;

    document.getElementById("menu-container").classList.add("hidden");
    document.getElementById("game-container").classList.remove("hidden");

    currentGameInstance = new WordleGame(playerName, difficulty, category);
  });

  document.addEventListener("DOMContentLoaded", () => {
    showMenuFromSections();

    const initialLeaderboard = JSON.parse(
      localStorage.getItem("wordleLeaderboard") || "[]"
    );
    updateLeaderboardDisplayGlobal(initialLeaderboard);

    const initialStats = JSON.parse(
      localStorage.getItem("wordlePlayerStats") || "{}"
    );
    initialStats.categoriesWon = new Set(initialStats.categoriesWon || []);
    updateStatisticsDisplayGlobal(initialStats);

    const initialAchievements = JSON.parse(
      localStorage.getItem("wordleAchievements") || "{}"
    );
    updateAchievementsDisplayGlobal(initialAchievements);

    const playerNameInput = document.getElementById("player-name");
    if (playerNameInput) playerNameInput.focus();
  });
})();
