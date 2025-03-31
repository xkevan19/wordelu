class WordleGame {
  constructor(playerName, difficulty, category, userId, userProfileData) {
    this.WORD_LENGTH = CONFIG.WORD_LENGTH;
    this.MAX_ATTEMPTS = CONFIG.MAX_ATTEMPTS;
    this.score = 0;
    this.userId = userId;
    this.userProfileData = userProfileData;
    this.playerName = userId
      ? userProfileData?.username || "Player"
      : playerName || "Guest";
    this.userTeam = userProfileData?.team;
    this.difficulty = difficulty;
    this.category = category;
    this.timeLeft =
      this.difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
    this.timerInterval = null;
    this.currentRow = 0;
    this.currentCol = 0;
    this.targetWord = this.selectRandomWord();
    console.log("Target Word:", this.targetWord);
    this.currentGuess = [];
    this.gameOver = false;
    this.gameWon = false;
    this.guessedLetters = new Set();
    this.sounds = {
      correct: new Howl({ src: ["sound/correct.wav"], volume: 0.5 }),
      wrong: new Howl({ src: ["sound/wrong.wav"], volume: 0.5 }),
      type: new Howl({ src: ["sound/type.wav"], volume: 0.3 }),
      win: new Howl({ src: ["sound/win.wav"], volume: 0.7 }),
      lose: new Howl({ src: ["sound/lose.wav"], volume: 0.7 }),
    };
    this.playerStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      categoriesWon: new Set(),
      hardModeWins: 0,
      totalScore: 0,
    };
    this.achievements = {};
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleModalKeyDown = this.handleModalKeyDown.bind(this);
    this.boundHandleCategoryModalKeyDown =
      this.handleCategoryModalKeyDown.bind(this);
    this.boundHandleDifficultyModalKeyDown =
      this.handleDifficultyModalKeyDown.bind(this);

    this.gameContainer = document.getElementById("game-container");
    this.gameCenterArea = document.getElementById("game-center-area");
    this.rightInfoArea = document.getElementById("in-game-right-info");
    this.toastContainer = document.getElementById("toast-container");
    this.categoryModal = document.getElementById("category-modal");
    this.difficultyModal = document.getElementById("difficulty-modal");
    this.mobileCategoryDisplay = document.getElementById(
      "mobile-category-display"
    );
    this.mobileDifficultyDisplay = document.getElementById(
      "mobile-difficulty-display"
    );
    this.mobileTimerDisplay = document.getElementById("mobile-timer");

    this.initGameData()
      .then(() => {
        this.createGameBoard();
        this.createKeyboard();
        this.setupEventListeners();
        this.updateDifficultyDisplay();
        this.updateScoreDisplay();
        this.updateTimerDisplay();
        this.updateCategoryDisplay();
        if (this.timeLeft !== null) {
          this.startTimer();
        }
        this.updateGameHeaderUserInfo();
        if (typeof loadAndDisplayInitialData === "function")
          loadAndDisplayInitialData();
      })
      .catch((error) => {
        console.error("Init game data err:", error);
        if (typeof showToast === "function")
          showToast("Error loading game data.");
        this.createGameBoard();
        this.createKeyboard();
        this.setupEventListeners();
        this.updateDifficultyDisplay();
        this.updateGameHeaderUserInfo();
        this.updateCategoryDisplay();
      });
  }

  updateGameHeaderUserInfo() {
    const gui = this.rightInfoArea?.querySelector("#game-user-info");
    if (gui) {
      if (this.userId && this.userProfileData) {
        let teamTag = "";
        if (this.userProfileData.team === "red")
          teamTag = '<span class="text-red-400">(Red)</span>';
        else if (this.userProfileData.team === "blue")
          teamTag = '<span class="text-blue-400">(Blue)</span>';
        const displayText = `${
          this.userProfileData.username || "Player"
        } ${teamTag}`.trim();
        gui.innerHTML = displayText;
        gui.title = `${this.userProfileData.username || "Player"} ${
          this.userProfileData.team ? "(" + this.userProfileData.team + ")" : ""
        }`.trim();
      } else {
        gui.textContent = this.playerName;
        gui.title = this.playerName;
      }
    }
  }

  async initGameData() {
    if (this.userId && typeof _supabase !== "undefined" && _supabase) {
      try {
        const [statsData, achievementsData] = await Promise.all([
          this.fetchSupabaseStats(),
          this.fetchSupabaseAchievements(),
        ]);
        this.playerStats = statsData;
        if (
          this.playerStats &&
          !(this.playerStats.categoriesWon instanceof Set)
        ) {
          this.playerStats.categoriesWon = new Set(
            this.playerStats.categoriesWon || []
          );
        }
        this.achievements = achievementsData;
        console.log("Loaded Supabase Stats:", this.playerStats);
        console.log("Loaded Supabase Achievements:", this.achievements);
      } catch (e) {
        console.error("Fetch Supabase data error:", e);
        if (typeof showToast === "function")
          showToast("Could not load your profile data.");
        this.playerStats = {
          totalGamesPlayed: 0,
          totalWins: 0,
          categoriesWon: new Set(),
          hardModeWins: 0,
          totalScore: 0,
        };
        this.achievements = {};
      }
    } else {
      this.playerStats = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
        totalScore: 0,
      };
      this.achievements = {};
    }
    if (typeof updateStatisticsDisplayGlobal === "function")
      updateStatisticsDisplayGlobal(this.userId ? this.playerStats : null);
    if (typeof updateAchievementsDisplayGlobal === "function")
      updateAchievementsDisplayGlobal(this.userId ? this.achievements : null);
  }

  selectRandomWord() {
    const wordList =
      WORDS[this.category] && WORDS[this.category].length > 0
        ? WORDS[this.category]
        : WORDS.general;
    if (!wordList || wordList.length === 0) {
      console.error(
        `CRITICAL: No words found for category '${this.category}' or fallback 'general'!`
      );
      if (typeof showToast === "function")
        showToast("Error: Could not find a word for this category.", 5000);
      return "ERROR";
    }
    const word =
      wordList[Math.floor(Math.random() * wordList.length)].toUpperCase();
    if (word.length !== this.WORD_LENGTH) {
      console.warn(
        `Selected word "${word}" from category "${this.category}" does not match WORD_LENGTH ${this.WORD_LENGTH}. Retrying.`
      );
      return this.selectRandomWord();
    }
    return word;
  }

  createGameBoard() {
    const gameBoard = this.gameCenterArea?.querySelector("#game-board");
    if (!gameBoard) return;
    gameBoard.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < this.MAX_ATTEMPTS; r++) {
      const rowElement = document.createElement("div");
      rowElement.id = `row-${r}`;
      rowElement.className = "flex space-x-grid-gap";
      for (let c = 0; c < this.WORD_LENGTH; c++) {
        const cellElement = document.createElement("div");
        cellElement.id = `cell-${r}-${c}`;
        cellElement.className = `w-cell-size h-cell-size border-2 border-border-color flex items-center justify-center text-2xl font-bold uppercase transition-all duration-300`;
        rowElement.appendChild(cellElement);
      }
      fragment.appendChild(rowElement);
    }
    gameBoard.appendChild(fragment);
  }

  createKeyboard() {
    const keyboardLayout = [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
    ];
    const keyboardContainer = this.gameCenterArea?.querySelector("#keyboard");
    if (!keyboardContainer) return;
    keyboardContainer.innerHTML = "";
    const fragment = document.createDocumentFragment();
    keyboardLayout.forEach((row) => {
      const rowElement = document.createElement("div");
      rowElement.className = "flex justify-center space-x-key-gap mb-2";
      row.forEach((key) => {
        const keyButton = document.createElement("button");
        keyButton.textContent = key;
        keyButton.dataset.key = key;
        keyButton.className = `key bg-key-bg text-white px-3 py-2 rounded hover:bg-key-hover transition duration-200 h-key-height text-sm font-medium flex items-center justify-center ${
          key === "ENTER" || key === "⌫" ? "w-enter-width px-4" : "w-key-width"
        }`;
        if (key === "ENTER") keyButton.classList.add("key-enter");
        if (key === "⌫") keyButton.classList.add("key-backspace");
        rowElement.appendChild(keyButton);
      });
      fragment.appendChild(rowElement);
    });
    keyboardContainer.appendChild(fragment);
  }

  setupEventListeners() {
    const keyboardElement = this.gameCenterArea?.querySelector("#keyboard");
    if (keyboardElement) {
      if (keyboardElement._listener) {
        keyboardElement.removeEventListener("click", keyboardElement._listener);
      }
      keyboardElement._listener = (event) => {
        if (event.target.classList.contains("key")) {
          this.handleKeyPress(event.target.dataset.key);
        }
      };
      keyboardElement.addEventListener("click", keyboardElement._listener);
    }

    document.removeEventListener("keydown", this.boundHandleKeyDown);
    document.addEventListener("keydown", this.boundHandleKeyDown);

    const setupButtonListener = (buttonId, callback) => {
      const button = document.getElementById(buttonId);
      if (button) {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener("click", callback);
      } else {
        console.warn(`Button with ID "${buttonId}" not found.`);
      }
    };

    setupButtonListener("quit-to-menu-btn-ingame", () =>
      this.resetGameToMenu()
    );
    setupButtonListener("change-category-btn-ingame", () =>
      this.showCategoryModal()
    );
    setupButtonListener("change-difficulty-btn-ingame", () =>
      this.showDifficultyModal()
    );
    setupButtonListener("change-category-btn-mobile", () =>
      this.showCategoryModal()
    );
    setupButtonListener("change-difficulty-btn-mobile", () =>
      this.showDifficultyModal()
    );
  }

  handleKeyDown(event) {
    if (
      this.gameOver ||
      !document.getElementById("message-box")?.classList.contains("hidden") ||
      !document
        .getElementById("category-modal")
        ?.classList.contains("hidden") ||
      !document
        .getElementById("difficulty-modal")
        ?.classList.contains("hidden") ||
      event.target.tagName === "INPUT" ||
      event.target.tagName === "SELECT" ||
      event.target.tagName === "TEXTAREA"
    ) {
      return;
    }
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
      cell.classList.add("scale-110", "border-gray-400");
      cell.classList.remove("border-border-color");
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
      cell.classList.remove("border-gray-400");
      cell.classList.add("border-border-color");
      this.currentGuess.pop();
      this.playSound("type");
    }
  }

  submitGuess() {
    if (this.currentCol !== this.WORD_LENGTH) {
      this.shakeRow();
      this.playSound("wrong");
      if (typeof showToast === "function") showToast("Not enough letters!");
      return;
    }

    const guess = this.currentGuess.join("");
    const result = this.checkGuess(guess);
    const currentRowIndex = this.currentRow;

    this.updateRowColors(result, currentRowIndex);
    this.updateKeyboardColors(guess, result);

    const animationDelay = this.WORD_LENGTH * 200 + 100;

    if (guess === this.targetWord) {
      setTimeout(() => this.handleWin(), animationDelay);
    } else {
      this.currentRow++;
      if (this.currentRow >= this.MAX_ATTEMPTS) {
        setTimeout(() => this.handleLose(), animationDelay);
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
      if (typeof showToast === "function")
        showToast("✨ Perfect First Guess! +20 Points! ✨");
    }

    if (
      this.difficulty === "hard" &&
      guess === this.targetWord &&
      this.timeLeft > 0
    ) {
      const timeBonus = Math.floor(this.timeLeft / 4);
      guessScore += timeBonus;
      if (timeBonus > 0 && typeof showToast === "function")
        showToast(`⏱️ Time Bonus: +${timeBonus} points!`);
    }

    this.score = guessScore;
    this.updateScoreDisplay();
    return result;
  }

  updateRowColors(colors, rowIndex) {
    const rowElement = document.getElementById(`row-${rowIndex}`);
    if (!rowElement) return;
    for (let i = 0; i < colors.length; i++) {
      setTimeout(() => {
        const cell = document.getElementById(`cell-${rowIndex}-${i}`);
        if (cell) {
          cell.classList.remove(
            "border-border-color",
            "border-gray-400",
            "bg-correct",
            "bg-present",
            "bg-absent",
            "text-white"
          );
          cell.classList.add(
            `bg-${colors[i]}`,
            "text-white",
            "border-transparent"
          );
          cell.classList.add("flip");
        }
      }, i * 200);
    }
  }

  updateKeyboardColors(guess, result) {
    const keyboardDiv = this.gameCenterArea?.querySelector("#keyboard");
    if (!keyboardDiv) return;
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const status = result[i];
      const keyButton = keyboardDiv.querySelector(
        `button[data-key="${letter}"]`
      );
      if (keyButton) {
        const currentStatus = keyButton.classList.contains("correct")
          ? "correct"
          : keyButton.classList.contains("present")
          ? "present"
          : keyButton.classList.contains("absent")
          ? "absent"
          : "unknown";
        let newStatus = currentStatus;
        if (status === "correct") {
          newStatus = "correct";
        } else if (status === "present" && currentStatus !== "correct") {
          newStatus = "present";
        } else if (status === "absent" && currentStatus === "unknown") {
          newStatus = "absent";
        }

        keyButton.classList.remove(
          "correct",
          "present",
          "absent",
          "bg-key-bg",
          "hover:bg-key-hover",
          "bg-correct",
          "bg-present",
          "bg-absent"
        );
        keyButton.classList.add(newStatus);

        if (newStatus === "correct") keyButton.classList.add("bg-correct");
        else if (newStatus === "present") keyButton.classList.add("bg-present");
        else if (newStatus === "absent") keyButton.classList.add("bg-absent");
        else keyButton.classList.add("bg-key-bg", "hover:bg-key-hover");

        if (
          newStatus === "correct" ||
          newStatus === "present" ||
          newStatus === "absent"
        ) {
          keyButton.classList.add("text-white");
        } else {
          keyButton.classList.remove("text-white");
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

  async saveGameResultToSupabase() {
    if (!this.userId || typeof _supabase === "undefined" || !_supabase) return;
    const gameData = {
      user_id: this.userId,
      category: this.category,
      difficulty: this.difficulty,
      score: this.score,
      won: this.gameWon,
    };
    try {
      console.log("Saving individual game result:", gameData);
      const { error } = await _supabase.from("game_results").insert(gameData);
      if (error) {
        console.error("Error saving individual game result:", error);
        if (typeof showToast === "function")
          showToast("Error saving game details.", 3000);
      } else {
        console.log("Individual game result saved successfully.");
      }
    } catch (e) {
      console.error("Exception saving individual game result:", e);
      if (typeof showToast === "function")
        showToast("Error saving game details.", 3000);
    }
  }

  async updateSupabaseAggregates(scoreIncrement = 0) {
    if (!this.userId || typeof _supabase === "undefined" || !_supabase) return;

    const gamesIncrement = 1;
    const winsIncrement = this.gameWon ? 1 : 0;
    const hardWinsIncrement =
      this.gameWon && this.difficulty === "hard" ? 1 : 0;
    const categoriesToSet = Array.from(
      this.playerStats.categoriesWon instanceof Set
        ? this.playerStats.categoriesWon
        : []
    );

    let currentTotalScore = 0;
    try {
      const { data, error } = await _supabase
        .from("game_stats")
        .select("total_score")
        .eq("user_id", this.userId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("Error fetching current total score:", error);
      } else if (data) {
        currentTotalScore = data.total_score || 0;
      }
    } catch (e) {
      console.error("Exception fetching current total score:", e);
    }
    const newTotalScore = currentTotalScore + scoreIncrement;

    try {
      const { error: rpcError } = await _supabase.rpc("update_game_stats", {
        p_user_id: this.userId,
        p_games_increment: gamesIncrement,
        p_wins_increment: winsIncrement,
        p_hard_wins_increment: hardWinsIncrement,
        p_score_increment: scoreIncrement,
        p_categories: categoriesToSet,
      });

      if (rpcError) {
        console.error(
          "Error calling update_game_stats RPC for aggregates:",
          rpcError
        );
        throw rpcError;
      } else {
        console.log("Aggregate game stats updated successfully via RPC.");
        this.playerStats.totalGamesPlayed += gamesIncrement;
        this.playerStats.totalWins += winsIncrement;
        if (this.gameWon) this.playerStats.categoriesWon.add(this.category);
        if (this.gameWon && this.difficulty === "hard")
          this.playerStats.hardModeWins += hardWinsIncrement;
        this.playerStats.totalScore = newTotalScore;
      }
    } catch (e) {
      console.error("Exception updating aggregate game stats:", e);
      throw e;
    }
  }

  async handleWin() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameWon = true;
    clearInterval(this.timerInterval);
    const currentScore = this.score;

    if (this.userId && typeof _supabase !== "undefined" && _supabase) {
      try {
        await this.saveGameResultToSupabase();
      } catch (e) {
        console.error(
          "Explicit catch for saveGameResultToSupabase in handleWin:",
          e
        );
      }

      try {
        this.playerStats.totalGamesPlayed++;
        this.playerStats.totalWins++;
        this.playerStats.categoriesWon.add(this.category);
        if (this.difficulty === "hard") this.playerStats.hardModeWins++;
        if (typeof updateStatisticsDisplayGlobal === "function")
          updateStatisticsDisplayGlobal(this.playerStats);

        const unlockedAchievements = this.checkAchievements();
        if (typeof updateAchievementsDisplayGlobal === "function")
          updateAchievementsDisplayGlobal(this.achievements);

        try {
          await this.updateSupabaseAggregates(currentScore);
        } catch (e) {
          console.error(
            "Explicit catch for updateSupabaseAggregates in handleWin:",
            e
          );
          if (typeof showToast === "function")
            showToast("Error updating your total score online.", 4000);
          throw e;
        }

        await Promise.all(
          unlockedAchievements.map((ach) => this.unlockSupabaseAchievement(ach))
        );
        if (typeof loadAndDisplayInitialData === "function")
          await loadAndDisplayInitialData();

        let message = `🎉 You guessed it: **${this.targetWord}**! Score: ${currentScore}. Total Score: ${this.playerStats.totalScore}.`;
        if (unlockedAchievements.length > 0) {
          const achievementNames = unlockedAchievements
            .map((a) => a.name)
            .join(", ");
          message += `\n🏆 Achievement${
            unlockedAchievements.length > 1 ? "s" : ""
          } unlocked: ${achievementNames}!`;
        }
        this.showMessage("Congratulations!", message);
        this.playSound("win");
      } catch (err) {
        console.error("Error during handleWin processing:", err);
        if (typeof showToast === "function")
          showToast("Error saving your results online.");
        let message = `🎉 You guessed it: **${this.targetWord}**! Score: ${currentScore}.\n(Failed to save score online)`;
        this.showMessage("Congratulations!", message);
        this.playSound("wrong");
      }
    } else {
      this.addScoreToLocalGuestLeaderboard();
      if (typeof loadAndDisplayInitialData === "function")
        await loadAndDisplayInitialData();
      if (typeof updateStatisticsDisplayGlobal === "function")
        updateStatisticsDisplayGlobal(null);
      if (typeof updateAchievementsDisplayGlobal === "function")
        updateAchievementsDisplayGlobal(null);
      let message = `🎉 You guessed it: **${this.targetWord}**! Score: ${currentScore}.\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save progress and compete!`;
      this.showMessage("You Won!", message, true);
      this.playSound("win");
    }
  }

  async handleLose() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.gameWon = false;
    this.score = 0;
    clearInterval(this.timerInterval);

    if (this.userId && typeof _supabase !== "undefined" && _supabase) {
      try {
        await this.saveGameResultToSupabase();
      } catch (e) {
        console.error(
          "Explicit catch for saveGameResultToSupabase in handleLose:",
          e
        );
      }

      try {
        this.playerStats.totalGamesPlayed++;
        if (typeof updateStatisticsDisplayGlobal === "function")
          updateStatisticsDisplayGlobal(this.playerStats);

        try {
          await this.updateSupabaseAggregates(0);
        } catch (e) {
          console.error(
            "Explicit catch for updateSupabaseAggregates in handleLose:",
            e
          );
          if (typeof showToast === "function")
            showToast("Error updating game stats online.", 4000);
          throw e;
        }

        if (typeof loadAndDisplayInitialData === "function")
          await loadAndDisplayInitialData();
        let message = `😥 The word was: **${this.targetWord}**. Total Score: ${this.playerStats.totalScore}. Better luck next time!`;
        this.showMessage("Game Over", message);
        this.playSound("lose");
      } catch (err) {
        console.error("Error during handleLose processing:", err);
        if (typeof showToast === "function")
          showToast("Error saving game stats.");
        let message = `😥 The word was: **${this.targetWord}**. Failed to save stats. Better luck next time!`;
        this.showMessage("Game Over", message);
        this.playSound("lose");
      }
    } else {
      if (typeof updateStatisticsDisplayGlobal === "function")
        updateStatisticsDisplayGlobal(null);
      if (typeof updateAchievementsDisplayGlobal === "function")
        updateAchievementsDisplayGlobal(null);
      if (typeof loadAndDisplayInitialData === "function")
        await loadAndDisplayInitialData();
      let message = `😥 The word was: **${this.targetWord}**. Score: 0.\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save your progress!`;
      this.showMessage("Game Over", message, true);
      this.playSound("lose");
    }
  }

  async fetchSupabaseStats() {
    const defaultStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      categoriesWon: new Set(),
      hardModeWins: 0,
      totalScore: 0,
    };
    if (!this.userId || typeof _supabase === "undefined" || !_supabase)
      return defaultStats;
    try {
      const { data, error, status } = await _supabase
        .from("game_stats")
        .select(
          "total_games_played, total_wins, hard_mode_wins, categories_won, total_score"
        )
        .eq("user_id", this.userId)
        .maybeSingle();

      if (error && status !== 406) {
        console.error("Error fetching Supabase stats:", error);
        throw error;
      }

      return data
        ? {
            totalGamesPlayed: data.total_games_played || 0,
            totalWins: data.total_wins || 0,
            hardModeWins: data.hard_mode_wins || 0,
            categoriesWon: new Set(
              Array.isArray(data.categories_won) ? data.categories_won : []
            ),
            totalScore: data.total_score || 0,
          }
        : defaultStats;
    } catch (e) {
      console.error("Exception fetching Supabase stats:", e);
      return defaultStats;
    }
  }

  async fetchSupabaseAchievements() {
    const defaultAchievements = {};
    if (!this.userId || typeof _supabase === "undefined" || !_supabase)
      return defaultAchievements;
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
      if (data)
        data.forEach((ach) => {
          achievementsMap[ach.achievement_id] = true;
        });
      return achievementsMap;
    } catch (e) {
      console.error("Exception fetching achievements:", e);
      return defaultAchievements;
    }
  }

  async unlockSupabaseAchievement(achievement) {
    if (
      !this.userId ||
      typeof _supabase === "undefined" ||
      !_supabase ||
      !achievement?.id
    )
      return;

    const { error } = await _supabase
      .from("achievements")
      .insert({ user_id: this.userId, achievement_id: achievement.id });

    if (error && error.code !== "23505") {
      console.error(`Error unlocking achievement ${achievement.id}:`, error);
      if (typeof showToast === "function")
        showToast(`Failed to save achievement: ${achievement.name}`, 4000);
    } else if (!error) {
      console.log(`Achievement ${achievement.id} unlocked successfully.`);
    }
  }

  loadData(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(`Error loading data for key ${key}:`, e);
    }
    return defaultValue;
  }

  saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving data for key ${key}:`, e);
      if (typeof showToast === "function")
        showToast(`Error saving local data for ${key}. Storage might be full.`);
    }
  }

  addScoreToLocalGuestLeaderboard() {
    if (this.userId) return;
    const leaderboard = this.loadData("wordleLeaderboard", []);
    leaderboard.push({
      name: this.playerName || "Guest",
      score: this.score,
      isGuest: true,
      timestamp: Date.now(),
    });
    leaderboard.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
    const topLeaderboard = leaderboard.slice(0, CONFIG.LEADERBOARD_SIZE);
    this.saveData("wordleLeaderboard", topLeaderboard);
    console.log("Guest score added to local leaderboard:", this.score);
  }

  checkAchievements() {
    if (!this.userId || !this.gameWon) return [];
    const self = this;
    const newlyUnlocked = [];

    const checkAchievement = (achievement) => {
      if (achievement && !self.achievements[achievement.id]) {
        let conditionMet = false;
        switch (achievement.id) {
          case ACHIEVEMENTS.FIRST_VICTORY.id:
            conditionMet = self.playerStats.totalWins === 1;
            break;
          case ACHIEVEMENTS.PERFECT_GAME.id:
            conditionMet = self.currentRow === 0;
            break;
          case ACHIEVEMENTS.HARD_MODE_MASTER.id:
            conditionMet = self.difficulty === "hard";
            break;
          case ACHIEVEMENTS.CATEGORY_CHAMPION.id:
            const allCategories = Object.keys(WORDS);
            conditionMet = allCategories.every((cat) =>
              self.playerStats.categoriesWon.has(cat)
            );
            break;
          case ACHIEVEMENTS.TIME_MASTER.id:
            const timeThreshold = Math.floor(CONFIG.HARD_MODE_DURATION / 2);
            conditionMet =
              self.difficulty === "hard" && self.timeLeft >= timeThreshold;
            break;
        }
        if (conditionMet) {
          self.achievements[achievement.id] = true;
          newlyUnlocked.push(achievement);
          if (typeof showToast === "function")
            showToast(`🏆 Achievement Unlocked: ${achievement.name}`);
        }
      }
    };

    Object.values(ACHIEVEMENTS).forEach(checkAchievement);
    return newlyUnlocked;
  }

  updateTimerDisplay() {
    const timerElement = this.rightInfoArea?.querySelector("#timer");
    const mobileTimerElement = this.mobileTimerDisplay;
    if (!timerElement && !mobileTimerElement) return;
    let timerText = "-";
    if (this.difficulty === "hard" && this.timeLeft !== null) {
      timerText = `${this.timeLeft}s`;
    }
    if (timerElement) {
      timerElement.textContent = timerText;
      timerElement.classList.toggle(
        "text-red-500",
        this.timeLeft <= 10 && this.timeLeft > 0
      );
      timerElement.classList.toggle(
        "text-text-secondary",
        this.timeLeft > 10 || this.timeLeft === null
      );
    }
    if (mobileTimerElement) {
      mobileTimerElement.textContent = timerText;
    }
  }

  updateDifficultyDisplay() {
    const difficultyElement =
      this.rightInfoArea?.querySelector("#difficulty-mode");
    const mobileDifficultyElement = this.mobileDifficultyDisplay;
    if (!difficultyElement && !mobileDifficultyElement) return;
    const isHard = this.difficulty === "hard";
    const difficultyText = isHard ? `Hard Mode` : `Easy Mode`;
    const mobileDifficultyText = isHard ? `Hard` : `Easy`;
    const colorClass = isHard ? "text-red-400" : "text-green-400";
    if (difficultyElement) {
      difficultyElement.textContent = difficultyText;
      difficultyElement.className = `text-base font-medium ${colorClass}`;
    }
    if (mobileDifficultyElement) {
      mobileDifficultyElement.textContent = mobileDifficultyText;
    }
  }

  updateScoreDisplay() {
    const scoreElement = this.rightInfoArea?.querySelector("#score");
    if (scoreElement) scoreElement.textContent = this.score;
  }

  updateCategoryDisplay() {
    const categoryDisplayElement =
      this.rightInfoArea?.querySelector("#category-display");
    const mobileCategoryElement = this.mobileCategoryDisplay;
    if (!categoryDisplayElement && !mobileCategoryElement) return;
    const capitalizedCategory =
      this.category.charAt(0).toUpperCase() + this.category.slice(1);
    if (categoryDisplayElement) {
      categoryDisplayElement.textContent = capitalizedCategory;
    }
    if (mobileCategoryElement) {
      mobileCategoryElement.textContent = capitalizedCategory;
    }
  }

  showMessage(title, text, allowHtml = false) {
    const messageBox = document.getElementById("message-box");
    const messageTitle = document.getElementById("message-title");
    const messageText = document.getElementById("message-text");
    const newGameButton = document.getElementById("new-game-btn");
    const quitButton = document.getElementById("quit-btn");

    if (
      !messageBox ||
      !messageTitle ||
      !messageText ||
      !newGameButton ||
      !quitButton
    )
      return;

    messageTitle.textContent = title;
    if (allowHtml) {
      messageText.innerHTML = text.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-primary">$1</strong>'
      );
    } else {
      messageText.textContent = text.replace(/\*\*/g, "");
    }

    const newGameButtonClone = newGameButton.cloneNode(true);
    newGameButton.parentNode.replaceChild(newGameButtonClone, newGameButton);
    const quitButtonClone = quitButton.cloneNode(true);
    quitButton.parentNode.replaceChild(quitButtonClone, quitButton);

    messageBox.classList.remove("hidden");
    newGameButtonClone.focus();
    messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);
    messageBox.addEventListener("keydown", this.boundHandleModalKeyDown);

    const handleNewGame = () => {
      messageBox.classList.add("hidden");
      this.restartGame();
    };
    const handleQuit = () => {
      messageBox.classList.add("hidden");
      this.resetGameToMenu();
    };

    newGameButtonClone.addEventListener("click", handleNewGame, { once: true });
    quitButtonClone.addEventListener("click", handleQuit, { once: true });
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
    } else if (event.key === "Escape") {
      const quitButton = document.getElementById("quit-btn");
      quitButton?.click();
    } else if (event.key === "Enter") {
      if (document.activeElement !== document.getElementById("quit-btn")) {
        const newGameButton = document.getElementById("new-game-btn");
        newGameButton?.click();
      }
    }
  }

  playSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      if (sound.state() === "loaded") {
        sound.play();
      } else if (sound.state() === "loading") {
        sound.once("load", () => {
          sound.play();
        });
      } else {
        sound.load();
        sound.once("load", () => {
          sound.play();
        });
      }
    } else {
      console.warn(`Sound "${soundName}" not found or failed to load.`);
    }
  }

  showCategoryModal() {
    if (!this.categoryModal) return;
    const optionsContainer = this.categoryModal.querySelector(
      "#category-options-container"
    );
    const cancelBtn = this.categoryModal.querySelector(
      "#cancel-category-change-btn"
    );
    if (!optionsContainer || !cancelBtn) return;

    optionsContainer.innerHTML = "";
    Object.keys(WORDS).forEach((categoryKey) => {
      const button = document.createElement("button");
      button.textContent =
        categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
      button.dataset.category = categoryKey;
      button.className = `bg-input-bg hover:bg-key-bg text-text-secondary font-medium py-2 px-3 rounded-lg transition duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`;
      if (categoryKey === this.category) {
        button.disabled = true;
        button.classList.add("opacity-50", "cursor-not-allowed");
        button.classList.remove("hover:bg-key-bg");
      }
      button.addEventListener("click", () => {
        this.changeCategoryAndRestart(categoryKey);
        this.hideCategoryModal();
      });
      optionsContainer.appendChild(button);
    });

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener("click", () => this.hideCategoryModal(), {
      once: true,
    });

    this.categoryModal.classList.remove("hidden");
    this.categoryModal.focus();
    document.removeEventListener(
      "keydown",
      this.boundHandleCategoryModalKeyDown
    );
    document.addEventListener("keydown", this.boundHandleCategoryModalKeyDown);

    const firstButton = optionsContainer.querySelector(
      "button:not([disabled])"
    );
    if (firstButton) {
      firstButton.focus();
    } else {
      newCancelBtn.focus();
    }
  }

  hideCategoryModal() {
    if (!this.categoryModal) return;
    this.categoryModal.classList.add("hidden");
    document.removeEventListener(
      "keydown",
      this.boundHandleCategoryModalKeyDown
    );
  }

  handleCategoryModalKeyDown(event) {
    if (!this.categoryModal || this.categoryModal.classList.contains("hidden"))
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.hideCategoryModal();
    } else if (event.key === "Tab") {
      const focusableElements = Array.from(
        this.categoryModal.querySelectorAll("button")
      );
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
    }
  }

  changeCategoryAndRestart(newCategory) {
    if (this.category === newCategory) return;
    console.log(`Changing category from ${this.category} to ${newCategory}`);
    this.category = newCategory;
    this.updateCategoryDisplay();
    if (typeof showToast === "function")
      showToast(
        `Category changed to ${
          this.category.charAt(0).toUpperCase() + this.category.slice(1)
        }. New game starting!`,
        3500
      );
    this.restartGame();
  }

  showDifficultyModal() {
    if (!this.difficultyModal) return;
    const optionsContainer = this.difficultyModal.querySelector(
      "#difficulty-options-container"
    );
    const cancelBtn = this.difficultyModal.querySelector(
      "#cancel-difficulty-change-btn"
    );
    if (!optionsContainer || !cancelBtn) return;

    optionsContainer.innerHTML = "";
    const difficulties = ["easy", "hard"];
    difficulties.forEach((diffKey) => {
      const button = document.createElement("button");
      button.textContent = diffKey.charAt(0).toUpperCase() + diffKey.slice(1);
      button.dataset.difficulty = diffKey;
      button.className = `w-full bg-input-bg hover:bg-key-bg text-text-secondary font-medium py-3 px-4 rounded-lg transition duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`;
      if (diffKey === this.difficulty) {
        button.disabled = true;
        button.classList.add("opacity-50", "cursor-not-allowed");
        button.classList.remove("hover:bg-key-bg");
      }
      button.addEventListener("click", () => {
        this.changeDifficultyAndRestart(diffKey);
        this.hideDifficultyModal();
      });
      optionsContainer.appendChild(button);
    });

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener("click", () => this.hideDifficultyModal(), {
      once: true,
    });

    this.difficultyModal.classList.remove("hidden");
    this.difficultyModal.focus();
    document.removeEventListener(
      "keydown",
      this.boundHandleDifficultyModalKeyDown
    );
    document.addEventListener(
      "keydown",
      this.boundHandleDifficultyModalKeyDown
    );

    const firstButton = optionsContainer.querySelector(
      "button:not([disabled])"
    );
    if (firstButton) {
      firstButton.focus();
    } else {
      newCancelBtn.focus();
    }
  }

  hideDifficultyModal() {
    if (!this.difficultyModal) return;
    this.difficultyModal.classList.add("hidden");
    document.removeEventListener(
      "keydown",
      this.boundHandleDifficultyModalKeyDown
    );
  }

  handleDifficultyModalKeyDown(event) {
    if (
      !this.difficultyModal ||
      this.difficultyModal.classList.contains("hidden")
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.hideDifficultyModal();
    } else if (event.key === "Tab") {
      const focusableElements = Array.from(
        this.difficultyModal.querySelectorAll("button")
      );
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
    }
  }

  changeDifficultyAndRestart(newDifficulty) {
    if (this.difficulty === newDifficulty) return;
    console.log(
      `Changing difficulty from ${this.difficulty} to ${newDifficulty}`
    );
    this.difficulty = newDifficulty;
    this.updateDifficultyDisplay();
    if (typeof showToast === "function")
      showToast(
        `Difficulty changed to ${
          this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)
        }. New game starting!`,
        3500
      );
    this.restartGame();
  }

  restartGame() {
    this.resetGameState();
    this.createGameBoard();
    this.createKeyboard();
    const keyboardDiv = this.gameCenterArea?.querySelector("#keyboard");
    if (keyboardDiv) {
      keyboardDiv.querySelectorAll("button.key").forEach((btn) => {
        btn.classList.remove(
          "correct",
          "present",
          "absent",
          "bg-correct",
          "bg-present",
          "bg-absent",
          "text-white"
        );
        btn.classList.add("bg-key-bg", "hover:bg-key-hover");
      });
    }
    this.updateScoreDisplay();
    this.updateTimerDisplay();
    this.updateDifficultyDisplay();
    this.updateCategoryDisplay();
    if (this.timeLeft !== null) this.startTimer();
    const messageBox = document.getElementById("message-box");
    if (messageBox) messageBox.classList.add("hidden");
    this.hideCategoryModal();
    this.hideDifficultyModal();
  }

  resetGameState() {
    clearInterval(this.timerInterval);
    this.currentRow = 0;
    this.currentCol = 0;
    this.currentGuess = [];
    this.gameOver = false;
    this.gameWon = false;
    this.targetWord = this.selectRandomWord();
    console.log("New Target Word:", this.targetWord);
    this.timeLeft =
      this.difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
    this.score = 0;
    this.guessedLetters.clear();
  }

  resetGameToMenu() {
    this.destroy();
    if (typeof currentGameInstance !== "undefined") currentGameInstance = null;
    if (typeof showWordleMenuView === "function") showWordleMenuView();
    if (typeof loadAndDisplayInitialData === "function")
      loadAndDisplayInitialData();
    if (typeof updateSidebarButtonsVisibility === "function")
      updateSidebarButtonsVisibility();
  }

  destroy() {
    clearInterval(this.timerInterval);
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    document.removeEventListener(
      "keydown",
      this.boundHandleCategoryModalKeyDown
    );
    document.removeEventListener(
      "keydown",
      this.boundHandleDifficultyModalKeyDown
    );
    const messageBox = document.getElementById("message-box");
    if (messageBox)
      messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);

    const keyboardElement = this.gameCenterArea?.querySelector("#keyboard");
    if (keyboardElement && keyboardElement._listener) {
      keyboardElement.removeEventListener("click", keyboardElement._listener);
      delete keyboardElement._listener;
    }
    this.hideCategoryModal();
    this.hideDifficultyModal();

    const cleanupButtonListener = (buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
      }
    };

    cleanupButtonListener("quit-to-menu-btn-ingame");
    cleanupButtonListener("change-category-btn-ingame");
    cleanupButtonListener("change-difficulty-btn-ingame");
    cleanupButtonListener("change-category-btn-mobile");
    cleanupButtonListener("change-difficulty-btn-mobile");
    cleanupButtonListener("new-game-btn");
    cleanupButtonListener("quit-btn");

    console.log("WordleGame instance destroyed.");
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      if (this.gameOver) {
        clearInterval(this.timerInterval);
        return;
      }
      this.timeLeft--;
      this.updateTimerDisplay();
      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        if (!this.gameOver) {
          if (typeof showToast === "function") showToast("Time's up!");
          this.handleLose();
        }
      }
    }, 1000);
  }
}
