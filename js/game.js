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
      "space",
      "probe",
      "light",
      "virus",
      "genes",
      "earth",
      "power",
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
  let currentGameInstance = null;

  async function initializeSupabase() {
    try {
      const response = await fetch("/.netlify/functions/get-supabase-config");
      if (!response.ok)
        throw new Error(`Failed Supabase config: ${response.status}`);
      const config = await response.json();
      if (!config.url || !config.key)
        throw new Error("Invalid Supabase config");
      _supabase = supabase.createClient(config.url, config.key);
      const {
        data: { session },
        error: sessionError,
      } = await _supabase.auth.getSession();
      if (sessionError) console.error("Get session error:", sessionError);
      currentUser = session?.user ?? null;

      _supabase.auth.onAuthStateChange(async (_event, session) => {
        const prevUser = currentUser;
        currentUser = session?.user ?? null;
        console.log(
          "Auth State Change:",
          _event,
          "| User:",
          currentUser?.email || "Guest"
        );

        if (currentUser && (!prevUser || currentUser.id !== prevUser.id)) {
          await fetchUserProfile(currentUser.id);
          handleLoggedInState();
        } else if (!currentUser && prevUser) {
          userProfile = null;
          handleGuestState();
          if (currentGameInstance) {
            currentGameInstance.resetGameToMenu();
            showToast("Logged out.");
          }
        }

        await loadAndDisplayInitialData();

        if (currentGameInstance) {
          updateGameHeaderUserInfo();
        } else if (
          !document
            .getElementById("game-container")
            .classList.contains("hidden")
        ) {
          showWordleMenuView();
        }
        updateSidebarButtonsVisibility();
      });

      if (currentUser) {
        await fetchUserProfile(currentUser.id);
        handleLoggedInState();
      } else {
        handleGuestState();
      }

      await loadAndDisplayInitialData();
      if (!currentGameInstance) {
        showWordleMenuView();
      }
    } catch (error) {
      console.error("Supabase Init Error:", error);
      showToast(`Init Error: ${error.message}`);
      handleGuestState();
      await loadAndDisplayInitialData();
      showWordleMenuView();
    }
  }

  function updateUserStatusHeader() {
    const ua = document.getElementById("user-actions");
    if (!ua) return;
    ua.innerHTML = "";

    if (currentUser && userProfile) {
      const wt = document.createElement("span");
      wt.className = "text-sm text-text-secondary hidden sm:inline";
      wt.textContent = `Hi, ${userProfile.username}!`;

      const al = document.createElement("a");
      al.href = "account.html";
      al.className =
        "text-sm bg-secondary hover:bg-secondary-hover text-text-primary font-semibold py-1 px-3 rounded-md transition duration-200";
      al.textContent = "Account";

      const lb = document.createElement("button");
      lb.id = "nav-logout-button";
      lb.className =
        "text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition duration-200";
      lb.textContent = "Logout";
      lb.addEventListener("click", async () => {
        if (!_supabase) return;
        lb.disabled = true;
        lb.textContent = "...";
        const { error } = await _supabase.auth.signOut();
        if (error) {
          showToast(`Logout failed: ${error.message}`);
          lb.disabled = false;
          lb.textContent = "Logout";
        } else {
          console.log("Logout initiated...");
        }
      });

      ua.appendChild(wt);
      ua.appendChild(al);
      ua.appendChild(lb);
    } else {
      const gt = document.createElement("span");
      gt.className = "text-sm text-text-muted hidden sm:inline";
      gt.textContent = "Playing as Guest";

      const ll = document.createElement("a");
      ll.href = "auth.html";
      ll.className =
        "text-sm bg-primary hover:bg-primary-hover text-white font-semibold py-1 px-3 rounded-md transition duration-200";
      ll.textContent = "Login / Sign Up";

      ua.appendChild(gt);
      ua.appendChild(ll);
    }
  }

  function updateSidebarButtonsVisibility() {
    const tb = document.getElementById("show-team-leaderboard-btn");
    if (tb) {
      tb.classList.add("hidden");
    }
    const dropdownTeamBtn = document.querySelector(
      '#header-dropdown-menu button[id^="dropdown-team"]'
    );
    if (dropdownTeamBtn) {
      dropdownTeamBtn.classList.toggle(
        "hidden",
        !(currentUser && userProfile?.team)
      );
    }
  }

  function handleGuestState() {
    console.log("Handling Guest State");
    const pni = document.getElementById("player-name");
    const pnl = document.getElementById("player-name-label");
    const lii = document.getElementById("logged-in-info");
    const wm = document.getElementById("welcome-message");

    if (pnl) pnl.classList.remove("hidden");
    if (pni) {
      pni.classList.remove("hidden");
      pni.value = localStorage.getItem("wordleGuestName") || "";
      pni.disabled = false;
      pni.placeholder = "Enter Your Name (Optional)";
    }
    if (lii) lii.classList.add("hidden");

    if (wm) wm.textContent = "Log in to save progress & compete!";

    updateUserStatusHeader();
    updateStatisticsDisplayGlobal(null);
    updateAchievementsDisplayGlobal(null);
    updateTeamLeaderboardDisplay(null);
    updateRankingSidebar(null);
    updateLatestAchievementsSidebar(null);
  }

  function handleLoggedInState() {
    console.log("Handling Logged In State");
    const pni = document.getElementById("player-name");
    const pnl = document.getElementById("player-name-label");
    const lii = document.getElementById("logged-in-info");
    const wm = document.getElementById("welcome-message");

    if (pnl) pnl.classList.add("hidden");
    if (pni) pni.classList.add("hidden");

    if (lii) {
      lii.classList.remove("hidden");
      if (userProfile?.username) {
        lii.textContent = `Logged in as ${userProfile.username}`;
      } else if (currentUser?.email) {
        lii.textContent = `Logged in as ${currentUser.email}`;
      } else {
        lii.textContent = "Logged in";
      }
    }

    if (wm && userProfile?.username) {
      wm.textContent = `Ready for a challenge, ${userProfile.username}?`;
    } else if (wm) {
      wm.textContent = `Welcome back!`;
    }

    updateUserStatusHeader();
  }

  async function fetchUserProfile(uid) {
    if (!_supabase || !uid) {
      userProfile = null;
      return;
    }
    try {
      const { data, error, status } = await _supabase
        .from("profiles")
        .select("username, team")
        .eq("id", uid)
        .single();

      if (error && status !== 406) {
        console.error("Fetch profile err:", error);
        userProfile = null;
      } else {
        userProfile = data;
        console.log("User profile fetched:", userProfile);
      }
    } catch (e) {
      console.error("Fetch profile ex:", e);
      userProfile = null;
    }
  }

  function updateRankingSidebar(rd) {
    const ne = document.getElementById("rank-player-name-ingame");
    const pe = document.getElementById("rank-position-ingame");
    const pte = document.getElementById("rank-points-ingame");

    if (!ne || !pe || !pte) return;

    if (rd) {
      ne.textContent = rd.name || "Top Player";
      pe.innerHTML = `<span class="text-yellow-400 mr-1.5">🏆</span> #${
        rd.rank || "?"
      }`;
      pte.textContent = `${rd.points || 0} pts`;
    } else {
      ne.textContent = "N/A (Log in)";
      pe.innerHTML = `<span class="text-gray-500 mr-1.5">🏆</span> N/A`;
      pte.textContent = "N/A";
    }
  }

  function updateLatestAchievementsSidebar(achs) {
    const l = document.getElementById("latest-achievements-list-ingame");
    if (!l) return;

    l.innerHTML = "";
    if (achs && achs.length > 0) {
      achs.slice(0, 3).forEach((a) => {
        const li = document.createElement("li");
        li.className = "bg-black bg-opacity-20 rounded-lg p-2 px-3 truncate";
        const achievementName =
          typeof a === "string" ? a : a.name || "Achievement";
        li.textContent = achievementName;
        li.title = achievementName;
        l.appendChild(li);
      });
    } else {
      l.innerHTML =
        '<li class="bg-black bg-opacity-20 rounded-lg p-2 px-3 italic">None yet. Log in to track!</li>';
    }
  }

  function showToast(msg, dur = CONFIG.TOAST_DURATION) {
    const c = document.getElementById("toast-container");
    if (!c) return;

    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    c.appendChild(t);

    t.offsetHeight;
    t.classList.add("show");

    setTimeout(() => {
      t.classList.remove("show");
      t.addEventListener(
        "transitionend",
        () => {
          if (t.parentNode === c) c.removeChild(t);
        },
        { once: true }
      );
    }, dur);
  }

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
          loadAndDisplayInitialData();
        })
        .catch((error) => {
          console.error("Init game data err:", error);
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
          let teamTag =
            this.userProfileData.team === "red"
              ? "(Red)"
              : this.userProfileData.team === "blue"
              ? "(Blue)"
              : "";
          const displayText = `${
            this.userProfileData.username || "Player"
          } ${teamTag}`.trim();
          gui.textContent = displayText;
          gui.title = displayText;
        } else {
          gui.textContent = this.playerName;
          gui.title = this.playerName;
        }
      }
    }

    async initGameData() {
      if (this.userId && _supabase) {
        try {
          const [statsData, achievementsData] = await Promise.all([
            this.fetchSupabaseStats(),
            this.fetchSupabaseAchievements(),
          ]);
          this.playerStats = statsData;
          this.achievements = achievementsData;
          console.log("Loaded Supabase Stats:", this.playerStats);
          console.log("Loaded Supabase Achievements:", this.achievements);
        } catch (e) {
          console.error("Fetch Supabase data error:", e);
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
      updateStatisticsDisplayGlobal(this.userId ? this.playerStats : null);
      updateAchievementsDisplayGlobal(this.userId ? this.achievements : null);
    }

    selectRandomWord() {
      const wordList = WORDS[this.category] || WORDS.general;
      if (!wordList || wordList.length === 0) {
        console.warn(
          `No words found for category: ${this.category}. Falling back to general.`
        );
        const fallbackList = WORDS.general;
        if (!fallbackList || fallbackList.length === 0) {
          console.error("CRITICAL: No general words found!");
          return "ERROR";
        }
        return fallbackList[
          Math.floor(Math.random() * fallbackList.length)
        ].toUpperCase();
      }
      return wordList[
        Math.floor(Math.random() * wordList.length)
      ].toUpperCase();
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
          keyButton.className = `key bg-key-bg text-white px-3 py-2 rounded hover:bg-key-hover transition duration-200 h-key-height text-sm font-medium ${
            key === "ENTER" || key === "⌫"
              ? "w-enter-width px-4"
              : "w-key-width"
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
          keyboardElement.removeEventListener(
            "click",
            keyboardElement._listener
          );
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
          ?.classList.contains("hidden")
      )
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
        cell.classList.add("scale-110", "border-gray-400");
        cell.classList.remove("border-gray-600");
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
        cell.classList.add("border-gray-600");

        this.currentGuess.pop();
        this.playSound("type");
      }
    }

    submitGuess() {
      if (this.currentCol !== this.WORD_LENGTH) {
        this.shakeRow();
        this.playSound("wrong");
        showToast("Not enough letters!");
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
        showToast("✨ Perfect First Guess! +20 Points! ✨");
      }

      if (
        this.difficulty === "hard" &&
        guess === this.targetWord &&
        this.timeLeft > 0
      ) {
        const timeBonus = Math.floor(this.timeLeft / 4);
        guessScore += timeBonus;
        if (timeBonus > 0) showToast(`⏱️ Time Bonus: +${timeBonus} points!`);
      }

      this.score = guessScore;
      this.updateScoreDisplay();

      return result;
    }

    updateRowColors(colors, rowIndex) {
      for (let i = 0; i < colors.length; i++) {
        setTimeout(() => {
          const cell = document.getElementById(`cell-${rowIndex}-${i}`);
          if (cell) {
            cell.classList.remove(
              "border-gray-600",
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
          const isCorrect = keyButton.classList.contains("correct");
          const isPresent = keyButton.classList.contains("present");

          if (status === "correct") {
            keyButton.classList.remove(
              "present",
              "absent",
              "bg-key-bg",
              "hover:bg-key-hover",
              "bg-present",
              "bg-absent"
            );
            keyButton.classList.add("correct", "bg-correct");
          } else if (status === "present" && !isCorrect) {
            keyButton.classList.remove(
              "absent",
              "bg-key-bg",
              "hover:bg-key-hover",
              "bg-absent"
            );
            keyButton.classList.add("present", "bg-present");
          } else if (status === "absent" && !isCorrect && !isPresent) {
            keyButton.classList.remove("bg-key-bg", "hover:bg-key-hover");
            keyButton.classList.add("absent", "bg-absent");
          }

          if (status !== "absent") {
            keyButton.classList.add("text-white");
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

    async handleWin() {
      if (this.gameOver) return;
      this.gameOver = true;
      this.gameWon = true;
      clearInterval(this.timerInterval);

      const currentScore = this.score;

      if (this.userId && _supabase) {
        this.playerStats.totalGamesPlayed++;
        this.playerStats.totalWins++;
        this.playerStats.categoriesWon.add(this.category);
        if (this.difficulty === "hard") this.playerStats.hardModeWins++;

        updateStatisticsDisplayGlobal(this.playerStats);

        const unlockedAchievements = this.checkAchievements();
        updateAchievementsDisplayGlobal(this.achievements);

        let message = `🎉 You guessed the word: ${this.targetWord}! Score: ${currentScore}.`;

        if (unlockedAchievements.length > 0) {
          message += `\n🏆 Achievement${
            unlockedAchievements.length > 1 ? "s" : ""
          } unlocked!`;
        }

        try {
          await this.updateSupabaseStats(currentScore);
          await Promise.all(
            unlockedAchievements.map((ach) =>
              this.unlockSupabaseAchievement(ach)
            )
          );
          await loadAndDisplayInitialData();
        } catch (err) {
          console.error("Error saving win results:", err);
          showToast("Error saving your results online.");
          message += "\n(Failed to save score online)";
        }
        const updatedStats = await this.fetchSupabaseStats();
        message = `🎉 You guessed the word: ${this.targetWord}! Score: ${currentScore}. Total Score: ${updatedStats.totalScore}.`;
        if (unlockedAchievements.length > 0) {
          message += `\n🏆 Achievement${
            unlockedAchievements.length > 1 ? "s" : ""
          } unlocked!`;
        }
        this.showMessage("Congratulations!", message);
      } else {
        this.addScoreToLocalGuestLeaderboard();
        await loadAndDisplayInitialData();
        updateStatisticsDisplayGlobal(null);
        updateAchievementsDisplayGlobal(null);

        let message = `🎉 You guessed it: ${this.targetWord}! Score: ${currentScore}.\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save your progress and compete!`;
        this.showMessage("You Won!", message, true);
      }

      this.playSound("win");
    }

    async handleLose() {
      if (this.gameOver) return;
      this.gameOver = true;
      clearInterval(this.timerInterval);

      if (this.userId && _supabase) {
        this.playerStats.totalGamesPlayed++;
        const currentScore = 0;

        updateStatisticsDisplayGlobal(this.playerStats);

        try {
          await this.updateSupabaseStats(currentScore);
          await loadAndDisplayInitialData();
        } catch (err) {
          console.error("Error updating stats on loss:", err);
          showToast("Error saving game stats.");
        }
        const updatedStats = await this.fetchSupabaseStats();
        let message = `😥 The word was: ${this.targetWord}. Total Score: ${updatedStats.totalScore}. Better luck next time!`;
        this.showMessage("Game Over", message);
      } else {
        updateStatisticsDisplayGlobal(null);
        updateAchievementsDisplayGlobal(null);
        await loadAndDisplayInitialData();
        let message = `😥 The word was: ${this.targetWord}. Score: ${this.score}.\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save your progress!`;
        this.showMessage("Game Over", message, true);
      }

      this.playSound("lose");
    }

    async fetchSupabaseStats() {
      const defaultStats = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
        totalScore: 0,
      };
      if (!this.userId || !_supabase) return defaultStats;

      try {
        const { data, error, status } = await _supabase
          .from("game_stats")
          .select(
            "total_games_played, total_wins, hard_mode_wins, categories_won, total_score"
          )
          .eq("user_id", this.userId)
          .maybeSingle();

        if (error && status !== 406) throw error;

        return data
          ? {
              totalGamesPlayed: data.total_games_played || 0,
              totalWins: data.total_wins || 0,
              hardModeWins: data.hard_mode_wins || 0,
              categoriesWon: new Set(data.categories_won || []),
              totalScore: data.total_score || 0,
            }
          : defaultStats;
      } catch (e) {
        console.error("Error fetching Supabase stats:", e);
        throw e;
      }
    }

    async updateSupabaseStats(scoreIncrement = 0) {
      if (!this.userId || !_supabase) return;

      const gamesIncrement = 1;
      const winsIncrement = this.gameWon ? 1 : 0;
      const hardWinsIncrement =
        this.gameWon && this.difficulty === "hard" ? 1 : 0;
      const finalScoreIncrement = this.gameWon ? scoreIncrement : 0;
      const categoriesToSet = Array.from(this.playerStats.categoriesWon || []);

      try {
        console.log("Calling update_game_stats RPC with:", {
          p_user_id: this.userId,
          p_games_increment: gamesIncrement,
          p_wins_increment: winsIncrement,
          p_hard_wins_increment: hardWinsIncrement,
          p_score_increment: finalScoreIncrement,
          p_categories: categoriesToSet,
        });

        const { error } = await _supabase.rpc("update_game_stats", {
          p_user_id: this.userId,
          p_games_increment: gamesIncrement,
          p_wins_increment: winsIncrement,
          p_hard_wins_increment: hardWinsIncrement,
          p_score_increment: finalScoreIncrement,
          p_categories: categoriesToSet,
        });

        if (error) {
          console.error("Error calling update_game_stats RPC:", error);
          throw error;
        } else {
          console.log("Game stats updated successfully via RPC.");
        }
      } catch (e) {
        console.error("Exception calling update_game_stats RPC:", e);
        throw e;
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
      if (!this.userId || !_supabase || !achievement?.id) return;

      const { error } = await _supabase
        .from("achievements")
        .insert({ user_id: this.userId, achievement_id: achievement.id });

      if (error && error.code !== "23505") {
        console.error(`Error unlocking achievement ${achievement.id}:`, error);
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
      }
    }

    addScoreToLocalGuestLeaderboard() {
      if (this.userId) return;

      const leaderboard = this.loadData("wordleLeaderboard", []);
      leaderboard.push({
        name: this.playerName || "Guest",
        score: this.score,
        isGuest: true,
      });

      leaderboard.sort((a, b) => b.score - a.score);
      const topLeaderboard = leaderboard.slice(0, CONFIG.LEADERBOARD_SIZE);

      this.saveData("wordleLeaderboard", topLeaderboard);
    }

    checkAchievements() {
      if (!this.userId) return [];

      const self = this;
      const newlyUnlocked = [];

      const checkAchievement = (achievement) => {
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

      Object.values(ACHIEVEMENTS).forEach(checkAchievement);
      return newlyUnlocked;
    }

    updateTimerDisplay() {
      const timerElement = this.rightInfoArea?.querySelector("#timer");
      if (!timerElement) return;

      if (this.difficulty === "hard" && this.timeLeft !== null) {
        timerElement.textContent = `${this.timeLeft}s`;
        timerElement.classList.toggle(
          "text-red-500",
          this.timeLeft <= 10 && this.timeLeft > 0
        );
        timerElement.classList.toggle(
          "text-text-secondary",
          this.timeLeft > 10
        );

        if (this.mobileTimerDisplay) {
          this.mobileTimerDisplay.textContent = timerElement.textContent;
        }
      } else {
        timerElement.textContent = "-";
        if (this.mobileTimerDisplay) {
          this.mobileTimerDisplay.textContent = timerElement.textContent;
        }
      }
    }

    updateDifficultyDisplay() {
      const difficultyElement =
        this.rightInfoArea?.querySelector("#difficulty-mode");
      if (difficultyElement) {
        const difficultyText =
          this.difficulty === "easy" ? `Easy Mode` : `Hard Mode`;
        difficultyElement.textContent = difficultyText;
        difficultyElement.className = `text-base font-medium ${
          this.difficulty === "hard" ? "text-red-400" : "text-green-400"
        }`;

        if (this.mobileDifficultyDisplay) {
          this.mobileDifficultyDisplay.textContent =
            this.difficulty === "easy" ? `Easy` : `Hard`;
        }
      }
    }

    updateScoreDisplay() {
      const scoreElement = this.rightInfoArea?.querySelector("#score");
      if (scoreElement) scoreElement.textContent = this.score;
    }

    updateCategoryDisplay() {
      const categoryDisplayElement =
        this.rightInfoArea?.querySelector("#category-display");
      if (categoryDisplayElement && this.mobileCategoryDisplay) {
        const capitalizedCategory =
          this.category.charAt(0).toUpperCase() + this.category.slice(1);
        categoryDisplayElement.textContent = capitalizedCategory;
        this.mobileCategoryDisplay.textContent = capitalizedCategory;
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
        messageText.innerHTML = text;
      } else {
        messageText.textContent = text;
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

      newGameButtonClone.addEventListener("click", handleNewGame, {
        once: true,
      });
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
        const newGameButton = document.getElementById("new-game-btn");
        newGameButton?.click();
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
      document.addEventListener(
        "keydown",
        this.boundHandleCategoryModalKeyDown
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

    hideCategoryModal() {
      if (!this.categoryModal) return;
      this.categoryModal.classList.add("hidden");
      document.removeEventListener(
        "keydown",
        this.boundHandleCategoryModalKeyDown
      );
    }

    handleCategoryModalKeyDown(event) {
      if (
        !this.categoryModal ||
        this.categoryModal.classList.contains("hidden")
      )
        return;

      if (event.key === "Escape") {
        event.preventDefault();
        this.hideCategoryModal();
      } else if (event.key === "Tab") {
        const focusableElements = Array.from(
          this.categoryModal.querySelectorAll("button")
        );
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
      this.guessedLetters = new Set();
    }

    resetGameToMenu() {
      this.destroy();
      currentGameInstance = null;
      showWordleMenuView();
      loadAndDisplayInitialData();
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

      const keyboardElement = this.gameCenterArea?.querySelector("#keyboard");
      if (keyboardElement && keyboardElement._listener) {
        keyboardElement.removeEventListener("click", keyboardElement._listener);
        delete keyboardElement._listener;
      }

      const messageBox = document.getElementById("message-box");
      if (messageBox)
        messageBox.removeEventListener("keydown", this.boundHandleModalKeyDown);

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

      console.log("WordleGame instance destroyed.");
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
            showToast("Time's up!");
            this.handleLose();
          }
        }
      }, 1000);
    }
  }

  function showWordleMenuView() {
    console.log("Showing Wordle Menu View");
    const menuContainer = document.getElementById("menu-container");
    const gameContainer = document.getElementById("game-container");

    if (menuContainer) menuContainer.classList.remove("hidden");
    if (gameContainer) gameContainer.classList.add("hidden");

    document
      .getElementById("sections-display-area")
      ?.classList.remove("hidden");
    hideAllSections();
    document.getElementById("main-menu-input-card")?.classList.remove("hidden");
    document
      .getElementById("menu-buttons-container")
      ?.classList.remove("hidden");
    document
      .getElementById("back-to-menu-from-sections-btn")
      ?.classList.add("hidden");

    if (currentUser) {
      handleLoggedInState();
    } else {
      handleGuestState();
    }
  }

  function showGameView() {
    console.log("Showing Game View");
    const menuContainer = document.getElementById("menu-container");
    const gameContainer = document.getElementById("game-container");

    if (menuContainer) menuContainer.classList.add("hidden");
    if (gameContainer) {
      gameContainer.classList.remove("hidden");
      gameContainer.classList.add("flex");
    }
  }

  function hideAllSections() {
    const sectionsArea = document.getElementById("sections-display-area");
    if (sectionsArea) {
      Array.from(sectionsArea.children).forEach((child) => {
        if (
          child.id &&
          (child.id.endsWith("-section") || child.id.endsWith("-btn"))
        ) {
          child.classList.add("hidden");
        }
      });
    }
  }

  function showSection(sectionId) {
    showWordleMenuView();

    document.getElementById("main-menu-input-card")?.classList.add("hidden");
    document.getElementById("menu-buttons-container")?.classList.add("hidden");

    hideAllSections();

    const sectionToShow = document.getElementById(sectionId);
    const backButton = document.getElementById(
      "back-to-menu-from-sections-btn"
    );

    if (sectionToShow) sectionToShow.classList.remove("hidden");
    if (backButton) backButton.classList.remove("hidden");

    if (sectionId === "leaderboard-section") loadAndDisplayLeaderboard();
    else if (sectionId === "statistics-section") loadAndDisplayStatistics();
    else if (sectionId === "achievements-section") loadAndDisplayAchievements();
    else if (sectionId === "team-leaderboard-section")
      loadAndDisplayTeamLeaderboard();
  }

  function showMenuFromSections() {
    showWordleMenuView();
  }

  document
    .getElementById("show-instructions-btn")
    ?.addEventListener("click", () => showSection("instructions-section"));
  document
    .getElementById("back-to-menu-from-sections-btn")
    ?.addEventListener("click", showMenuFromSections);

  document.getElementById("start-game-btn")?.addEventListener("click", () => {
    if (currentGameInstance) {
      currentGameInstance.destroy();
      currentGameInstance = null;
    }
    const nameInput = document.getElementById("player-name");
    let playerNameFromInput = nameInput ? nameInput.value.trim() : null;
    const difficulty = document.getElementById("difficulty")?.value || "easy";
    const category = document.getElementById("category")?.value || "general";

    let finalPlayerName = "Guest";
    if (currentUser && userProfile?.username) {
      finalPlayerName = userProfile.username;
    } else if (!currentUser && playerNameFromInput) {
      finalPlayerName = playerNameFromInput;
      localStorage.setItem("wordleGuestName", finalPlayerName);
    } else if (!currentUser) {
      finalPlayerName = "Guest";
      localStorage.setItem("wordleGuestName", finalPlayerName);
    }

    showGameView();
    currentGameInstance = new WordleGame(
      finalPlayerName,
      difficulty,
      category,
      currentUser?.id,
      userProfile
    );
  });

  async function loadAndDisplayInitialData() {
    let topPlayerData = null;
    if (_supabase) {
      try {
        const { data, error } = await _supabase
          .from("game_stats")
          .select("total_score, profile:profiles!inner(username)")
          .order("total_score", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          topPlayerData = {
            rank: 1,
            name: data.profile?.username || "Top Player",
            points: data.total_score || 0,
          };
        }
      } catch (e) {
        console.error("Error fetching top player data:", e);
      }
    }
    updateRankingSidebar(topPlayerData);

    let latestAchievementsData = null;
    if (currentUser && _supabase) {
      try {
        const { data, error } = await _supabase
          .from("achievements")
          .select("achievement_id, inserted_at")
          .eq("user_id", currentUser.id)
          .order("inserted_at", { ascending: false })
          .limit(3);

        if (error && error.code !== "42703") {
          throw error;
        } else if (error && error.code === "42703") {
          console.warn(
            "Column 'inserted_at' might be missing or inaccessible. Fetching achievements without ordering."
          );
          const { data: fallbackData, error: fallbackError } = await _supabase
            .from("achievements")
            .select("achievement_id")
            .eq("user_id", currentUser.id)
            .limit(3);
          if (fallbackError) throw fallbackError;
          if (fallbackData) {
            latestAchievementsData = fallbackData.map(
              (a) => ACHIEVEMENTS[a.achievement_id]?.name || a.achievement_id
            );
          }
        } else if (data) {
          latestAchievementsData = data.map(
            (a) => ACHIEVEMENTS[a.achievement_id]?.name || a.achievement_id
          );
        }
      } catch (e) {
        console.error("Error fetching latest achievements:", e);
      }
    }
    updateLatestAchievementsSidebar(latestAchievementsData);

    await Promise.all([
      loadAndDisplayLeaderboard(),
      loadAndDisplayStatistics(),
      loadAndDisplayAchievements(),
      loadAndDisplayTeamLeaderboard(),
    ]);

    updateSidebarButtonsVisibility();
  }

  async function loadAndDisplayLeaderboard() {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;

    leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-text-muted p-4">Loading leaderboard...</td></tr>`;
    let leaderboardData = [];
    let isLocal = false;

    try {
      if (currentUser && _supabase) {
        const { data, error } = await _supabase
          .from("game_stats")
          .select(
            `total_score, user_id, profile:profiles!inner(username, team)`
          )
          .order("total_score", { ascending: false })
          .limit(CONFIG.LEADERBOARD_SIZE);

        if (error) throw error;
        leaderboardData = data || [];
        isLocal = false;
      } else {
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleLeaderboard") || "[]"
        );
        isLocal = true;
      }
      updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
    } catch (e) {
      console.error("Error loading leaderboard:", e);
      try {
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleLeaderboard") || "[]"
        );
        isLocal = true;
        updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
        if (currentUser)
          showToast(
            "Failed to load online leaderboard. Showing local guest scores."
          );
      } catch (localError) {
        console.error("Error loading local leaderboard:", localError);
        leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-error p-4">Failed to load leaderboard.</td></tr>`;
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
      row.innerHTML = `<td colspan="4" class="text-center text-text-muted p-4">No scores recorded yet! ${
        isLocal ? "(Guest)" : "Play a game!"
      }</td>`;
      fragment.appendChild(row);
    } else {
      leaderboardData.forEach((entry, index) => {
        const displayName = isLocal
          ? entry.name || "Guest"
          : entry.profile?.username || "Unknown User";
        const score = isLocal ? entry.score : entry.total_score;
        const team = isLocal ? "N/A" : entry.profile?.team || "N/A";

        const row = document.createElement("tr");
        row.className = index % 2 === 0 ? "bg-input-bg/50" : "";
        row.innerHTML = `
                  <td class="px-4 py-2 text-center">${index + 1}</td>
                  <td class="px-4 py-2 font-medium ${
                    currentUser && currentUser.id === entry.user_id
                      ? "text-primary"
                      : ""
                  }">${displayName}${isLocal ? " (Guest)" : ""}</td>
                  <td class="px-4 py-2 text-center font-semibold">${
                    score || 0
                  }</td>
                  <td class="px-4 py-2 capitalize text-center ${
                    team === "red"
                      ? "text-red-400"
                      : team === "blue"
                      ? "text-blue-400"
                      : ""
                  }">${team}</td>
              `;
        if (!isLocal && currentUser && currentUser.id === entry.user_id) {
          row.classList.add("bg-primary/20");
        }
        fragment.appendChild(row);
      });
    }
    leaderboardBody.appendChild(fragment);
  }

  async function loadAndDisplayStatistics() {
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

        const statsData = data
          ? {
              totalGamesPlayed: data.total_games_played || 0,
              totalWins: data.total_wins || 0,
              hardModeWins: data.hard_mode_wins || 0,
              categoriesWon: new Set(data.categories_won || []),
            }
          : {
              totalGamesPlayed: 0,
              totalWins: 0,
              categoriesWon: new Set(),
              hardModeWins: 0,
            };
        updateStatisticsDisplayGlobal(statsData);
      } catch (e) {
        console.error("Error loading statistics:", e);
        showToast("Could not load your statistics.");
        updateStatisticsDisplayGlobal(null);
      }
    } else {
      updateStatisticsDisplayGlobal(null);
    }
  }

  function updateStatisticsDisplayGlobal(stats) {
    const dlElement = document.querySelector("#statistics-section dl");
    const guestMessage = document.getElementById("stats-guest-message");
    const section = document.getElementById("statistics-section");
    if (!section) return;

    if (currentUser && stats && dlElement) {
      dlElement.classList.remove("hidden");
      if (guestMessage) guestMessage.classList.add("hidden");

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
        playerStats.hardModeWins || 0;

      const categoriesWonElement = document.getElementById("categories-won");
      if (categoriesWonElement) {
        const categoriesArray = Array.from(playerStats.categoriesWon);
        const categoriesText =
          categoriesArray.length > 0
            ? categoriesArray
                .map((cat) => cat.charAt(0).toUpperCase() + cat.slice(1))
                .join(", ")
            : "None";
        categoriesWonElement.textContent = categoriesText;
        categoriesWonElement.title =
          categoriesArray.length > 5 ? categoriesText : "";
      }
    } else if (dlElement && guestMessage) {
      dlElement.classList.add("hidden");
      guestMessage.classList.remove("hidden");
    } else if (!currentUser && guestMessage) {
      guestMessage.classList.remove("hidden");
      if (dlElement) dlElement.classList.add("hidden");
    }
  }

  async function loadAndDisplayAchievements() {
    if (currentUser && _supabase) {
      try {
        const { data, error } = await _supabase
          .from("achievements")
          .select("achievement_id")
          .eq("user_id", currentUser.id);

        if (error) throw error;

        const achievedData = {};
        if (data)
          data.forEach((ach) => {
            achievedData[ach.achievement_id] = true;
          });
        updateAchievementsDisplayGlobal(achievedData);
      } catch (e) {
        console.error("Error loading achievements:", e);
        showToast("Could not load your achievements.");
        updateAchievementsDisplayGlobal(null);
      }
    } else {
      updateAchievementsDisplayGlobal(null);
    }
  }

  function updateAchievementsDisplayGlobal(userAchievements) {
    const achievementsList = document.getElementById("achievements-list");
    const guestMessage = document.getElementById("achievements-guest-message");
    const section = document.getElementById("achievements-section");
    if (!section) return;

    if (currentUser && userAchievements !== null && achievementsList) {
      achievementsList.innerHTML = "";
      if (guestMessage) guestMessage.classList.add("hidden");
      achievementsList.classList.remove("hidden");
      const fragment = document.createDocumentFragment();
      const allPossibleAchievements = Object.values(ACHIEVEMENTS);

      if (allPossibleAchievements.length === 0) {
        achievementsList.innerHTML =
          '<p class="text-text-muted col-span-full text-center">No achievements defined.</p>';
        return;
      }

      allPossibleAchievements.forEach((ach) => {
        const isUnlocked = userAchievements[ach.id] === true;
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
                      ${ach.icon}
                      ${
                        !isUnlocked
                          ? '<span class="sr-only">(Locked)</span>'
                          : '<span class="sr-only">(Unlocked)</span>'
                      }
                  </div>
                  <h3 class="text-lg font-semibold mb-1 text-text-primary">${
                    ach.name
                  }</h3>
                  <p class="text-sm text-text-muted">${ach.description}</p>
              `;
        fragment.appendChild(achievementDiv);
      });
      achievementsList.appendChild(fragment);
    } else if (achievementsList && guestMessage) {
      achievementsList.innerHTML = "";
      achievementsList.classList.add("hidden");
      guestMessage.classList.remove("hidden");
    } else if (!currentUser && guestMessage) {
      guestMessage.classList.remove("hidden");
      if (achievementsList) achievementsList.classList.add("hidden");
    }
  }

  async function loadAndDisplayTeamLeaderboard() {
    const teamBody = document.getElementById("team-leaderboard-body");
    if (!teamBody || !_supabase) {
      if (teamBody)
        teamBody.innerHTML =
          '<tr><td colspan="2" class="text-center text-error py-4">Error: Could not load team data.</td></tr>';
      return;
    }
    if (!currentUser) {
      updateTeamLeaderboardDisplay(null);
      return;
    }

    teamBody.innerHTML =
      '<tr><td colspan="2" class="text-center text-text-muted py-4">Loading team scores...</td></tr>';
    try {
      const { data, error } = await _supabase
        .from("game_stats")
        .select(`total_score, profile:profiles!inner(team)`)
        .in("profile.team", ["blue", "red"]);

      if (error) throw error;

      const teamScores = { blue: 0, red: 0 };
      if (data) {
        data.forEach((item) => {
          if (
            item.profile?.team &&
            teamScores.hasOwnProperty(item.profile.team)
          ) {
            teamScores[item.profile.team] += item.total_score || 0;
          }
        });
      }
      updateTeamLeaderboardDisplay(teamScores);
    } catch (e) {
      console.error("Error loading team leaderboard:", e);
      updateTeamLeaderboardDisplay(undefined);
    }
  }

  function updateTeamLeaderboardDisplay(teamScores) {
    const teamBody = document.getElementById("team-leaderboard-body");
    if (!teamBody) return;

    if (currentUser && teamScores) {
      let blueStyle = "text-text-primary";
      let redStyle = "text-text-primary";
      if (teamScores.blue > teamScores.red) {
        blueStyle = "text-blue-400 font-bold";
      } else if (teamScores.red > teamScores.blue) {
        redStyle = "text-red-400 font-bold";
      } else if (teamScores.red === teamScores.blue && teamScores.red > 0) {
        blueStyle = "text-yellow-400 font-semibold";
        redStyle = "text-yellow-400 font-semibold";
      }

      teamBody.innerHTML = `
               <tr class="border-b border-border-color">
                   <td class="px-4 py-3 font-semibold ${blueStyle}">Blue Team</td>
                   <td class="px-4 py-3 text-center ${blueStyle}">${teamScores.blue}</td>
               </tr>
               <tr>
                   <td class="px-4 py-3 font-semibold ${redStyle}">Red Team</td>
                   <td class="px-4 py-3 text-center ${redStyle}">${teamScores.red}</td>
               </tr>
           `;
    } else if (currentUser && teamScores === undefined) {
      teamBody.innerHTML =
        '<tr><td colspan="2" class="text-center text-error py-4">Error loading team scores.</td></tr>';
    } else {
      teamBody.innerHTML =
        '<tr><td colspan="2" class="text-center text-text-muted py-4"><a href="auth.html" class="text-primary hover:underline">Log in</a> to see team standings.</td></tr>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initializeSupabase();
  });

  window.showWordleMenuView = showWordleMenuView;
  window.showSection = showSection;
})();
