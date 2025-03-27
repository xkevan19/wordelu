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
  ACHIEVEMENTS.TIME_MASTER.description = `Won a hard mode game with at least ${Math.floor(
    CONFIG.HARD_MODE_DURATION / 2
  )} seconds remaining`;

  let _supabase;
  let currentUser = null;
  let userProfile = null;

  async function initializeSupabase() {
    try {
      const response = await fetch("/.netlify/functions/get-supabase-config");
      if (!response.ok) {
        throw new Error(`Failed to fetch Supabase config: ${response.status}`);
      }
      const config = await response.json();
      if (!config.url || !config.key) {
        throw new Error("Invalid Supabase config received");
      }
      _supabase = supabase.createClient(config.url, config.key);

      const {
        data: { session },
      } = await _supabase.auth.getSession();
      currentUser = session?.user ?? null;
      if (currentUser) {
        await fetchUserProfile(currentUser.id);
      }

      _supabase.auth.onAuthStateChange(async (_event, session) => {
        const prevUser = currentUser;
        currentUser = session?.user ?? null;
        if (currentUser && currentUser.id !== prevUser?.id) {
          await fetchUserProfile(currentUser.id);

          await loadAndDisplayInitialData();
        } else if (!currentUser && prevUser) {
          userProfile = null;

          const playerNameInput = document.getElementById("player-name");
          if (playerNameInput) {
            playerNameInput.value = "";
            playerNameInput.disabled = false;
            playerNameInput.focus();
          }
          await loadAndDisplayInitialData();
        }
      });

      await loadAndDisplayInitialData();
    } catch (error) {
      console.error("Supabase Initialization Error:", error);
      showToast(`Error initializing: ${error.message}`);
      await loadAndDisplayInitialData();
    }
  }

  async function fetchUserProfile(userId) {
    if (!_supabase || !userId) return;
    try {
      const { data, error, status } = await _supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      userProfile = data;
      const playerNameInput = document.getElementById("player-name");
      if (playerNameInput && userProfile?.username) {
        playerNameInput.value = userProfile.username;
        playerNameInput.disabled = true;
      } else if (playerNameInput) {
        playerNameInput.disabled = false;
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      userProfile = null;
      const playerNameInput = document.getElementById("player-name");
      if (playerNameInput) {
        playerNameInput.disabled = false;
      }
    }
  }

  function showToast(message, duration = CONFIG.TOAST_DURATION) {
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
    }, duration);
  }

  class WordleGame {
    constructor(playerName, difficulty, category, userId) {
      this.WORD_LENGTH = CONFIG.WORD_LENGTH;
      this.MAX_ATTEMPTS = CONFIG.MAX_ATTEMPTS;
      this.score = 0;
      this.playerName = playerName;
      this.difficulty = difficulty;
      this.category = category;
      this.userId = userId;
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

      this.playerStats = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
      };
      this.achievements = {};

      this.boundHandleKeyDown = this.handleKeyDown.bind(this);
      this.boundHandleModalKeyDown = this.handleModalKeyDown.bind(this);

      this.initGameData()
        .then(() => {
          this.createGameBoard();
          this.createKeyboard();
          this.setupEventListeners();
          this.updateDifficultyDisplay();
          this.updateScoreDisplay();
          this.updateTimerDisplay();
          if (this.timeLeft !== null) {
            this.startTimer();
          }
        })
        .catch((error) => {
          console.error("Error initializing game data:", error);
          showToast(
            "Error loading game data. Some features might be unavailable."
          );
          this.createGameBoard();
          this.createKeyboard();
          this.setupEventListeners();
          this.updateDifficultyDisplay();
        });

      document
        .getElementById("back-to-menu-btn")
        .addEventListener("click", () => {
          this.resetGameToMenu();
        });
    }

    async initGameData() {
      if (this.userId && _supabase) {
        try {
          const [stats, achievements] = await Promise.all([
            this.fetchSupabaseStats(),
            this.fetchSupabaseAchievements(),
          ]);
          this.playerStats = stats;
          this.achievements = achievements;

          updateStatisticsDisplayGlobal(this.playerStats);
          updateAchievementsDisplayGlobal(this.achievements);
        } catch (error) {
          console.error("Failed to fetch Supabase data:", error);
          showToast("Could not load your stats/achievements from server.");
          this.playerStats = this.loadData("wordlePlayerStats", {
            totalGamesPlayed: 0,
            totalWins: 0,
            categoriesWon: new Set(),
            hardModeWins: 0,
          });
          this.achievements = this.loadData("wordleAchievements", {});
          updateStatisticsDisplayGlobal(this.playerStats);
          updateAchievementsDisplayGlobal(this.achievements);
        }
      } else {
        this.playerStats = this.loadData("wordlePlayerStats", {
          totalGamesPlayed: 0,
          totalWins: 0,
          categoriesWon: new Set(),
          hardModeWins: 0,
        });
        this.achievements = this.loadData("wordleAchievements", {});

        updateStatisticsDisplayGlobal(this.playerStats);
        updateAchievementsDisplayGlobal(this.achievements);
      }
    }

    selectRandomWord() {
      const categoryWords = WORDS[this.category];
      if (!categoryWords || categoryWords.length === 0) {
        console.warn(
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
          if (key === "ENTER") keyButton.classList.add("key-enter");
          if (key === "⌫") keyButton.classList.add("key-backspace");
          rowElement.appendChild(keyButton);
        });
        fragment.appendChild(rowElement);
      });
      keyboard.appendChild(fragment);
    }

    setupEventListeners() {
      const keyboardElement = document.getElementById("keyboard");
      if (keyboardElement.listener) {
        keyboardElement.removeEventListener("click", keyboardElement.listener);
      }
      keyboardElement.listener = (event) => {
        if (event.target.classList.contains("key")) {
          this.handleKeyPress(event.target.dataset.key);
        }
      };
      keyboardElement.addEventListener("click", keyboardElement.listener);

      document.removeEventListener("keydown", this.boundHandleKeyDown);
      document.addEventListener("keydown", this.boundHandleKeyDown);
    }

    handleKeyDown(event) {
      if (this.gameOver) return;
      if (!document.getElementById("message-box")?.classList.contains("hidden"))
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
        if (!cell) return;
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
        if (!cell) return;
        cell.textContent = "";
        this.currentGuess.pop();
        this.playSound("type");
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

      const animationDuration = this.WORD_LENGTH * 200 + 100;

      if (guess === this.targetWord) {
        setTimeout(() => this.handleWin(), animationDuration);
      } else {
        this.currentRow++;
        if (this.currentRow >= this.MAX_ATTEMPTS) {
          setTimeout(() => this.handleLose(), animationDuration);
        } else {
          this.currentGuess = [];
          this.currentCol = 0;
          this.playSound("wrong");
        }
      }
    }

    checkGuess(guess) {
      const result = new Array(this.WORD_LENGTH).fill("absent");
      const targetLetters = this.targetWord.split("");
      const guessLetters = guess.split("");
      let guessScore = 0;

      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (guessLetters[i] === targetLetters[i]) {
          result[i] = "correct";
          targetLetters[i] = null;
          guessLetters[i] = null;
          guessScore += 2;
        }
      }

      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (guessLetters[i] !== null) {
          const index = targetLetters.indexOf(guessLetters[i]);
          if (index !== -1) {
            result[i] = "present";
            targetLetters[index] = null;
            guessLetters[i] = null;
            guessScore += 1;
          }
        }
      }

      if (this.currentRow === 0 && guess === this.targetWord) {
        guessScore = 20;
        this.showToast("✨ Perfect First Guess! +20 Points! ✨");
      }

      this.score += guessScore;
      this.updateScoreDisplay();

      return result;
    }

    calculatePoints(guess, result) {
      let points = 0;
      if (result.every((r) => r === "correct") && this.currentRow === 0) {
        return 20;
      }
      for (let i = 0; i < guess.length; i++) {
        if (result[i] === "correct") {
          points += 2;
        } else if (result[i] === "present") {
          points += 1;
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
              "bg-absent",
              "text-white"
            );
            cell.classList.add(`bg-${colors[index]}`);
            cell.classList.add("text-white", "border-transparent");
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
          const isCorrect = keyButton.classList.contains("correct");
          const isPresent = keyButton.classList.contains("present");

          if (status === "correct") {
            keyButton.classList.remove(
              "present",
              "absent",
              "bg-key-bg",
              "hover:bg-key-hover"
            );
            keyButton.classList.add("correct", "bg-correct");
          } else if (status === "present" && !isCorrect) {
            keyButton.classList.remove(
              "absent",
              "bg-key-bg",
              "hover:bg-key-hover"
            );
            keyButton.classList.add("present", "bg-present");
          } else if (status === "absent" && !isCorrect && !isPresent) {
            keyButton.classList.remove("bg-key-bg", "hover:bg-key-hover");
            keyButton.classList.add("absent", "bg-absent");
          }
          if (status !== "absent") keyButton.classList.add("text-white");
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

    async handleWin() {
      console.log("--- HARD MODE TEST: handleWin called ---");
      if (this.gameOver) {
        // Prevent double execution
        console.log(
          "--- HARD MODE TEST: handleWin called but game already over, exiting. ---"
        );
        return;
      }
      this.gameOver = true;
      this.gameWon = true;
      clearInterval(this.timerInterval);

      if (this.difficulty === "hard" && this.timeLeft > 0) {
        const timeBonus = Math.floor(this.timeLeft / 4);
        this.score += timeBonus;
        this.updateScoreDisplay();
        showToast(`⏱️ Time Bonus: +${timeBonus} points!`);
      }

      console.log(
        `HANDLE WIN - Difficulty: ${this.difficulty}, Current Hard Mode Wins: ${this.playerStats.hardModeWins}`
      );

      this.playerStats.totalGamesPlayed++;
      this.playerStats.totalWins++;
      this.playerStats.categoriesWon.add(this.category);
      if (this.difficulty === "hard") {
        console.log("INCREMENTING HARD MODE WINS");
        this.playerStats.hardModeWins++;
      }

      const unlockedAchievements = this.checkAchievements();

      console.log(
        `HANDLE WIN - Stats before saving:`,
        JSON.stringify(this.playerStats)
      ); // Use stringify for Set

      if (this.userId && _supabase) {
        try {
          await Promise.all([
            this.updateSupabaseStats().catch((err) =>
              console.error("Update Stats failed:", err)
            ),
            this.submitScoreToSupabase().catch((err) =>
              console.error("Submit Score failed:", err)
            ),
            ...unlockedAchievements.map((ach) =>
              this.unlockSupabaseAchievement(ach).catch((err) =>
                console.error(`Unlock Achievement ${ach.id} failed:`, err)
              )
            ),
          ]);
          console.log("Game win data saving attempted.");
          await loadAndDisplayLeaderboard();
        } catch (error) {
          console.error(
            "General error during Supabase win data saving:",
            error
          );
          showToast("Error saving game results to server.");
          this.saveData("wordlePlayerStats", this.playerStats);
          this.saveData("wordleAchievements", this.achievements);
          this.addScoreToLeaderboard();
          await loadAndDisplayLeaderboard();
        }
      } else {
        this.saveData("wordlePlayerStats", this.playerStats);
        this.saveData("wordleAchievements", this.achievements);
        this.addScoreToLeaderboard();

        await loadAndDisplayLeaderboard();
      }

      updateStatisticsDisplayGlobal(this.playerStats);
      updateAchievementsDisplayGlobal(this.achievements);

      console.log("--- HARD MODE TEST: About to call playSound('win') ---");
      this.playSound("win");
      console.log(
        "--- HARD MODE TEST: About to call showMessage in handleWin ---"
      );
      this.showMessage(
        "Congratulations!",
        `You guessed the word: ${this.targetWord}. Final Score: ${this.score}`
      );
      console.log(
        "--- HARD MODE TEST: showMessage call completed in handleWin ---"
      );
    }

    async handleLose() {
      console.log("--- HARD MODE TEST: handleLose called ---");
      if (this.gameOver) {
        console.log(
          "--- HARD MODE TEST: handleLose called but game already over, exiting. ---"
        );
        return;
      }
      this.gameOver = true;
      clearInterval(this.timerInterval);
      this.playerStats.totalGamesPlayed++;

      if (this.userId && _supabase) {
        try {
          await this.updateSupabaseStats();
        } catch (error) {
          console.error("Failed to update Supabase stats on loss:", error);
          showToast("Error saving game stats to server.");
          this.saveData("wordlePlayerStats", this.playerStats);
        }
      } else {
        this.saveData("wordlePlayerStats", this.playerStats);
      }

      updateStatisticsDisplayGlobal(this.playerStats);

      console.log("--- HARD MODE TEST: About to call playSound('lose') ---");
      this.playSound("lose");
      console.log(
        "--- HARD MODE TEST: About to call showMessage in handleLose ---"
      );
      this.showMessage(
        "Game Over",
        `The word was: ${this.targetWord}. Final Score: ${this.score}`
      );
      console.log(
        "--- HARD MODE TEST: showMessage call completed in handleLose ---"
      );
    }

    async fetchSupabaseStats() {
      const defaultStats = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
      };
      if (!this.userId || !_supabase) return defaultStats;

      try {
        const { data, error, status } = await _supabase
          .from("game_stats")
          .select(
            "total_games_played, total_wins, hard_mode_wins, categories_won"
          )
          .eq("user_id", this.userId)
          .maybeSingle();

        if (error && status !== 406) {
          console.error("Error fetching Supabase stats:", error);
          throw error;
        }

        if (data) {
          return {
            totalGamesPlayed: data.total_games_played || 0,
            totalWins: data.total_wins || 0,
            hardModeWins: data.hard_mode_wins || 0,
            categoriesWon: new Set(data.categories_won || []),
          };
        } else {
          return defaultStats;
        }
      } catch (error) {
        console.error("Exception during fetchSupabaseStats:", error);
        return defaultStats;
      }
    }

    async updateSupabaseStats() {
      if (!this.userId || !_supabase) return;

      const statsToSave = {
        user_id: this.userId,
        total_games_played: this.playerStats.totalGamesPlayed,
        total_wins: this.playerStats.totalWins,
        hard_mode_wins: this.playerStats.hardModeWins,
        categories_won: Array.from(this.playerStats.categoriesWon),
      };
      console.log("Attempting to save stats:", statsToSave);

      const { error } = await _supabase
        .from("game_stats")
        .upsert(statsToSave, { onConflict: "user_id" });

      if (error) {
        console.error("Error updating Supabase stats:", error);
        throw error;
      } else {
        console.log("Supabase stats updated successfully.");
      }
    }

    async fetchSupabaseAchievements() {
      const defaultAchievements = {};
      if (!this.userId || !_supabase) return defaultAchievements;

      try {
        const { data, error } = await _supabase
          .from("achievements")
          .select("achievement_id")
          .eq("user_id", this.userId);

        if (error) {
          console.error("Error fetching Supabase achievements:", error);
          throw error;
        }

        const achievementsMap = {};
        if (data) {
          data.forEach((ach) => {
            achievementsMap[ach.achievement_id] = true;
          });
        }
        return achievementsMap;
      } catch (error) {
        console.error("Exception during fetchSupabaseAchievements:", error);
        return defaultAchievements;
      }
    }

    async unlockSupabaseAchievement(achievement) {
      if (!this.userId || !_supabase || !achievement?.id) return;

      const { error } = await _supabase
        .from("achievements")
        .insert({ user_id: this.userId, achievement_id: achievement.id });

      if (error && error.code !== "23505") {
        console.error(
          `Error unlocking Supabase achievement ${achievement.id}:`,
          error
        );
      } else if (!error) {
      }
    }

    async submitScoreToSupabase() {
      if (!this.userId || !_supabase) return;

      const scoreData = {
        user_id: this.userId,
        player_name: this.playerName,
        score: this.score,
        difficulty: this.difficulty,
        category: this.category,
      };

      const { error } = await _supabase.from("leaderboard").insert(scoreData);

      if (error) {
        console.error("Error submitting score to Supabase leaderboard:", error);
        throw error;
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

      if (
        key === "wordlePlayerStats" &&
        defaultValue.categoriesWon &&
        !(defaultValue.categoriesWon instanceof Set)
      ) {
        defaultValue.categoriesWon = new Set(defaultValue.categoriesWon);
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
    saveLeaderboard(leaderboard) {
      this.saveData("wordleLeaderboard", leaderboard);
    }

    addScoreToLeaderboard() {
      if (this.userId) return;

      const localLeaderboard = this.loadLeaderboard();
      const newScore = {
        name: this.playerName,
        score: this.score,
        difficulty: this.difficulty,
        category: this.category,
      };
      localLeaderboard.push(newScore);
      localLeaderboard.sort((a, b) => b.score - a.score);
      const trimmedLeaderboard = localLeaderboard.slice(
        0,
        CONFIG.LEADERBOARD_SIZE
      );
      this.saveLeaderboard(trimmedLeaderboard);
    }

    checkAchievements() {
      const self = this;
      const newlyUnlocked = [];

      const checkAndUnlock = (achievement) => {
        if (achievement && !self.achievements[achievement.id]) {
          let conditionMet = false;
          switch (achievement.id) {
            case ACHIEVEMENTS.FIRST_VICTORY.id:
              conditionMet = self.gameWon && self.playerStats.totalWins === 1;
              break;
            case ACHIEVEMENTS.PERFECT_GAME.id:
              conditionMet = self.gameWon && self.currentRow === 0;
              break;
            case ACHIEVEMENTS.HARD_MODE_MASTER.id:
              conditionMet = self.gameWon && self.difficulty === "hard";
              break;
            case ACHIEVEMENTS.CATEGORY_CHAMPION.id:
              const allCategories = Object.keys(WORDS);
              conditionMet =
                self.gameWon &&
                allCategories.every((cat) =>
                  self.playerStats.categoriesWon.has(cat)
                );
              break;
            case ACHIEVEMENTS.TIME_MASTER.id:
              const timeThreshold = Math.floor(CONFIG.HARD_MODE_DURATION / 2);
              conditionMet =
                self.gameWon &&
                self.difficulty === "hard" &&
                self.timeLeft >= timeThreshold;
              break;
          }

          if (conditionMet) {
            self.achievements[achievement.id] = true;
            newlyUnlocked.push(achievement);
            showToast(`🏆 Achievement Unlocked: ${achievement.name}`);
          }
        }
      };

      Object.values(ACHIEVEMENTS).forEach((achievement) =>
        checkAndUnlock(achievement)
      );

      return newlyUnlocked;
    }

    updateTimerDisplay() {
      const timerEl = document.getElementById("timer");
      if (!timerEl) return;
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
        difficultyEl.className = `text-xl ${
          this.difficulty === "hard"
            ? "text-red-400 font-semibold"
            : "text-green-400"
        }`;
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

      messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
      messageBox.addEventListener("keydown", this.boundHandleModalKeyDown);

      const handleNewGame = () => {
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
        messageBox.classList.add("hidden");
        this.restartGame();
        newGameBtn.removeEventListener("click", handleNewGame);
        quitBtn.removeEventListener("click", handleQuit);
      };
      const handleQuit = () => {
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
        messageBox.classList.add("hidden");
        this.resetGameToMenu();
        newGameBtn.removeEventListener("click", handleNewGame);
        quitBtn.removeEventListener("click", handleQuit);
      };

      newGameBtn.addEventListener("click", handleNewGame, { once: true });
      quitBtn.addEventListener("click", handleQuit, { once: true });
    }
    handleModalKeyDown(event) {
      if (event.key === "Tab") {
        const messageBox = document.getElementById("message-box");
        if (!messageBox) return;
        const focusableElements = messageBox.querySelectorAll("button");
        if (!focusableElements.length) return;

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
      } else if (event.key === "Escape") {
      }
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
          `Sound "${soundName}" could not be played. State: ${sound.state()}`
        );
      }
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
      const messageBox = document.getElementById("message-box");
      if (messageBox) messageBox.classList.add("hidden");
    }

    resetGameState() {
      clearInterval(this.timerInterval);
      this.currentRow = 0;
      this.currentCol = 0;
      this.currentGuess = [];
      this.gameOver = false; // Reset gameOver flag
      this.gameWon = false; // Reset gameWon flag
      this.targetWord = this.selectRandomWord();
      this.timeLeft =
        this.difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
      this.score = 0;
      this.guessedLetters = new Set();
      this.createKeyboard(); // Recreate keyboard to reset colors
    }

    resetGameToMenu() {
      this.destroy();
      document.getElementById("game-container").classList.add("hidden");
      document.getElementById("menu-container").classList.remove("hidden");
      loadAndDisplayInitialData();
      const playerNameInput = document.getElementById("player-name");
      if (playerNameInput) {
        playerNameInput.disabled = !!(currentUser && userProfile?.username);
        if (currentUser && userProfile?.username) {
          playerNameInput.value = userProfile.username;
        } else if (!currentUser) {
          playerNameInput.value = "";
        }
        playerNameInput.focus();
      }
    }

    destroy() {
      clearInterval(this.timerInterval);
      document.removeEventListener("keydown", this.boundHandleKeyDown);
      const keyboardElement = document.getElementById("keyboard");
      if (keyboardElement && keyboardElement.listener) {
        keyboardElement.removeEventListener("click", keyboardElement.listener);
        delete keyboardElement.listener;
      }
      const messageBox = document.getElementById("message-box");
      if (messageBox) {
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
      }
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
            // Check if game isn't already over
            console.log(
              "--- HARD MODE TEST: Timer reached zero, calling handleLose ---"
            );
            this.handleLose();
          } else {
            console.log(
              "--- HARD MODE TEST: Timer reached zero, but game already over ---"
            );
          }
        }
      }, 1000);
    }
  }

  let currentGameInstance = null;

  document
    .getElementById("show-leaderboard-btn")
    ?.addEventListener("click", () => showSection("leaderboard-section"));
  document
    .getElementById("show-statistics-btn")
    ?.addEventListener("click", () => showSection("statistics-section"));
  document
    .getElementById("show-achievements-btn")
    ?.addEventListener("click", () => showSection("achievements-section"));
  document
    .getElementById("show-instructions-btn")
    ?.addEventListener("click", () => showSection("instructions-section"));
  document
    .getElementById("back-to-menu-from-sections-btn")
    ?.addEventListener("click", showMenuFromSections);

  function showSection(sectionId) {
    document.getElementById("leaderboard-section")?.classList.add("hidden");
    document.getElementById("statistics-section")?.classList.add("hidden");
    document.getElementById("achievements-section")?.classList.add("hidden");
    document.getElementById("instructions-section")?.classList.add("hidden");
    document.getElementById("main-menu-input-card")?.classList.add("hidden");
    document.getElementById("menu-buttons-container")?.classList.add("hidden");

    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) sectionToShow.classList.remove("hidden");

    document
      .getElementById("back-to-menu-from-sections-btn")
      ?.classList.remove("hidden");

    if (sectionId === "leaderboard-section") {
      loadAndDisplayLeaderboard();
    } else if (sectionId === "statistics-section") {
      loadAndDisplayStatistics();
    } else if (sectionId === "achievements-section") {
      loadAndDisplayAchievements();
    }
  }

  function showMenuFromSections() {
    document.getElementById("leaderboard-section")?.classList.add("hidden");
    document.getElementById("statistics-section")?.classList.add("hidden");
    document.getElementById("achievements-section")?.classList.add("hidden");
    document.getElementById("instructions-section")?.classList.add("hidden");
    document
      .getElementById("back-to-menu-from-sections-btn")
      ?.classList.add("hidden");

    document.getElementById("main-menu-input-card")?.classList.remove("hidden");
    document
      .getElementById("menu-buttons-container")
      ?.classList.remove("hidden");

    const playerNameInput = document.getElementById("player-name");
    if (playerNameInput) {
      playerNameInput.disabled = !!(currentUser && userProfile?.username);
      if (currentUser && userProfile?.username) {
        playerNameInput.value = userProfile.username;
      } else if (!currentUser) {
        playerNameInput.value = "";
      }
      playerNameInput.focus();
    }
  }

  async function loadAndDisplayInitialData() {
    updateLeaderboardDisplayGlobal([], false);
    updateStatisticsDisplayGlobal({});
    updateAchievementsDisplayGlobal({});

    await Promise.all([
      loadAndDisplayLeaderboard(),
      loadAndDisplayStatistics(),
      loadAndDisplayAchievements(),
    ]);
  }

  async function loadAndDisplayLeaderboard() {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;
    leaderboardBody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-text-muted">Loading Leaderboard...</td></tr>`;
    let leaderboardData = [];
    let isLocal = false;

    try {
      if (currentUser && _supabase) {
        const { data, error } = await _supabase
          .from("leaderboard")
          .select(
            ` player_name, score, difficulty, category, user_id, profile:profiles ( username ) `
          )
          .order("score", { ascending: false })
          .limit(CONFIG.LEADERBOARD_SIZE);

        if (error) throw error;
        leaderboardData = data || [];
      } else {
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleLeaderboard") || "[]"
        );
        isLocal = true;
      }
      updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
    } catch (error) {
      console.error("Error loading leaderboard:", error);

      try {
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleLeaderboard") || "[]"
        );
        isLocal = true;
        updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
        showToast("Could not load online leaderboard. Showing local scores.");
      } catch (localError) {
        console.error("Error loading local leaderboard fallback:", localError);
        leaderboardBody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-error">Failed to load leaderboard.</td></tr>`;
      }
    }
  }

  function updateLeaderboardDisplayGlobal(
    leaderboardData = [],
    isLocal = false
  ) {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;
    leaderboardBody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    if (!leaderboardData || leaderboardData.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5" class="px-4 py-4 text-center text-text-muted">No scores yet! Play a game.${
        isLocal ? " (Local Scores)" : ""
      }</td>`;
      fragment.appendChild(row);
    } else {
      leaderboardData.forEach((entry, index) => {
        const displayName =
          entry.profile?.username || entry.player_name || entry.name || "Guest";
        const isGuestEntry = !entry.user_id;
        const row = document.createElement("tr");
        row.className = index % 2 === 0 ? "bg-input-bg/50" : "";
        row.innerHTML = `
            <td class="px-4 py-2 text-center">${index + 1}</td>
            <td class="px-4 py-2">${displayName}${
          isGuestEntry ? " (Guest)" : ""
        }</td>
            <td class="px-4 py-2 text-center">${entry.score}</td>
            <td class="px-4 py-2 capitalize">${entry.difficulty || "N/A"}</td>
            <td class="px-4 py-2 capitalize">${entry.category || "N/A"}</td>`;
        fragment.appendChild(row);
      });
    }
    leaderboardBody.appendChild(fragment);
  }

  async function loadAndDisplayStatistics() {
    let statsData = {
      totalGamesPlayed: 0,
      totalWins: 0,
      categoriesWon: new Set(),
      hardModeWins: 0,
    };
    if (currentUser && _supabase) {
      try {
        const { data, error, status } = await _supabase
          .from("game_stats")
          .select(
            "total_games_played, total_wins, hard_mode_wins, categories_won"
          )
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (error && status !== 406) throw error;

        if (data) {
          statsData = {
            totalGamesPlayed: data.total_games_played || 0,
            totalWins: data.total_wins || 0,
            hardModeWins: data.hard_mode_wins || 0,
            categoriesWon: new Set(data.categories_won || []),
          };
        }
      } catch (error) {
        console.error("Error loading Supabase statistics:", error);
        showToast("Could not load your statistics from server.");

        const localStats = JSON.parse(
          localStorage.getItem("wordlePlayerStats") || "{}"
        );
        statsData = {
          totalGamesPlayed: localStats.totalGamesPlayed || 0,
          totalWins: localStats.totalWins || 0,
          hardModeWins: localStats.hardModeWins || 0,
          categoriesWon: new Set(localStats.categoriesWon || []),
        };
      }
    } else {
      const localStats = JSON.parse(
        localStorage.getItem("wordlePlayerStats") || "{}"
      );
      statsData = {
        totalGamesPlayed: localStats.totalGamesPlayed || 0,
        totalWins: localStats.totalWins || 0,
        hardModeWins: localStats.hardModeWins || 0,
        categoriesWon: new Set(localStats.categoriesWon || []),
      };
    }
    updateStatisticsDisplayGlobal(statsData);
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

    document.getElementById("games-played").textContent =
      playerStats.totalGamesPlayed;
    document.getElementById("total-wins").textContent = playerStats.totalWins;
    document.getElementById("hard-mode-wins").textContent =
      playerStats.hardModeWins;

    const categoriesWonEl = document.getElementById("categories-won");
    if (categoriesWonEl) {
      const categoriesArray = Array.from(playerStats.categoriesWon);
      const categoriesText =
        categoriesArray.length > 0
          ? categoriesArray
              .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
              .join(", ")
          : "None";
      categoriesWonEl.textContent = categoriesText;
      categoriesWonEl.title = categoriesArray.length > 5 ? categoriesText : "";
    }
  }

  async function loadAndDisplayAchievements() {
    let achievementsData = {};
    if (currentUser && _supabase) {
      try {
        const { data, error } = await _supabase
          .from("achievements")
          .select("achievement_id")
          .eq("user_id", currentUser.id);

        if (error) throw error;

        if (data) {
          data.forEach((ach) => {
            achievementsData[ach.achievement_id] = true;
          });
        }
      } catch (error) {
        console.error("Error loading Supabase achievements:", error);
        showToast("Could not load your achievements from server.");
        achievementsData = JSON.parse(
          localStorage.getItem("wordleAchievements") || "{}"
        );
      }
    } else {
      achievementsData = JSON.parse(
        localStorage.getItem("wordleAchievements") || "{}"
      );
    }
    updateAchievementsDisplayGlobal(achievementsData);
  }

  function updateAchievementsDisplayGlobal(unlockedAchievements = {}) {
    const achievementsList = document.getElementById("achievements-list");
    if (!achievementsList) return;
    achievementsList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const allPossibleAchievements = Object.values(ACHIEVEMENTS);

    if (allPossibleAchievements.length === 0) {
      achievementsList.innerHTML =
        '<p class="text-text-muted col-span-full text-center">No achievements defined.</p>';
      return;
    }

    allPossibleAchievements.forEach((achievement) => {
      const isUnlocked = unlockedAchievements[achievement.id] === true;
      const achievementDiv = document.createElement("div");
      achievementDiv.className = `bg-input-bg rounded-lg shadow-md p-4 flex flex-col items-center text-center transition-opacity duration-300 ${
        isUnlocked
          ? "opacity-100 border-2 border-yellow-400"
          : "opacity-60 border border-border-color"
      }`;
      achievementDiv.setAttribute("role", "listitem");
      achievementDiv.innerHTML = `
              <div class="text-4xl mb-2 ${
                isUnlocked
                  ? "text-yellow-400 filter grayscale-0"
                  : "text-gray-500 filter grayscale"
              }">
                  ${achievement.icon} ${
        !isUnlocked
          ? '<span class="sr-only">(Locked)</span>'
          : '<span class="sr-only">(Unlocked)</span>'
      }
              </div>
              <h3 class="text-lg font-semibold mb-1 text-text-primary">${
                achievement.name
              }</h3>
              <p class="text-sm text-text-muted">${achievement.description}</p>
          `;
      fragment.appendChild(achievementDiv);
    });
    achievementsList.appendChild(fragment);
  }

  document.getElementById("start-game-btn")?.addEventListener("click", () => {
    if (currentGameInstance) {
      currentGameInstance.destroy();
      currentGameInstance = null;
    }

    const nameInput = document.getElementById("player-name");
    let playerName = nameInput ? nameInput.value.trim() : "Guest";
    const difficulty = document.getElementById("difficulty")?.value || "easy";
    const category = document.getElementById("category")?.value || "general";

    if (currentUser && userProfile?.username) {
      playerName = userProfile.username;
    } else if (!playerName) {
      playerName = "Guest";
    }

    document.getElementById("menu-container")?.classList.add("hidden");
    document.getElementById("game-container")?.classList.remove("hidden");

    currentGameInstance = new WordleGame(
      playerName,
      difficulty,
      category,
      currentUser?.id
    );
  });

  document.addEventListener("DOMContentLoaded", () => {
    initializeSupabase().then(() => {
      showMenuFromSections();
    });
  });
})();
