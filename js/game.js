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
  let currentGameInstance = null;

  async function initializeSupabase() {
    try {
      const response = await fetch("/.netlify/functions/get-supabase-config");
      if (!response.ok)
        throw new Error(`Failed to fetch Supabase config: ${response.status}`);
      const config = await response.json();
      if (!config.url || !config.key)
        throw new Error("Invalid Supabase config received");
      _supabase = supabase.createClient(config.url, config.key);

      const {
        data: { session },
        error: sessionError,
      } = await _supabase.auth.getSession();
      if (sessionError)
        console.error("Error getting initial session:", sessionError);
      currentUser = session?.user ?? null;

      _supabase.auth.onAuthStateChange(async (_event, session) => {
        const prevUser = currentUser;
        currentUser = session?.user ?? null;
        console.log(
          "Auth State Changed:",
          _event,
          " | User:",
          currentUser?.email || "Guest"
        );
        if (currentUser && (!prevUser || currentUser.id !== prevUser.id)) {
          await fetchUserProfile(currentUser.id);
          handleLoggedInState();
        } else if (!currentUser && prevUser) {
          userProfile = null;
          handleGuestState();
          // If user logs out during a game, return to menu
          if (currentGameInstance) {
            currentGameInstance.resetGameToMenu();
          }
        }
        await loadAndDisplayInitialData(); // Refresh data for menu/game column
        if (currentGameInstance) {
          updateGameHeaderUserInfo(); // Update game UI if game is active
        } else if (
          !document
            .getElementById("game-container")
            .classList.contains("hidden")
        ) {
          // If somehow game container is visible without instance, reset
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
      showWordleMenuView(); // Show Wordle menu by default
    } catch (error) {
      console.error("Supabase Initialization Error:", error);
      showToast(`Error initializing: ${error.message}`);
      handleGuestState();
      await loadAndDisplayInitialData();
      showWordleMenuView();
    }
  }

  function updateUserStatusHeader() {
    const userActions = document.getElementById("user-actions");
    if (!userActions) return;
    userActions.innerHTML = "";
    if (currentUser && userProfile) {
      const welcomeText = document.createElement("span");
      welcomeText.className = "text-sm text-text-secondary hidden sm:inline";
      welcomeText.textContent = `Hi, ${userProfile.username}!`;
      const accountLink = document.createElement("a");
      accountLink.href = "account.html";
      accountLink.className =
        "text-sm bg-secondary hover:bg-secondary-hover text-text-primary font-semibold py-1 px-3 rounded-md transition duration-200";
      accountLink.textContent = "Account";
      const logoutButton = document.createElement("button");
      logoutButton.id = "nav-logout-button";
      logoutButton.className =
        "text-sm bg-primary hover:bg-primary-hover text-white font-semibold py-1 px-3 rounded-md transition duration-200";
      logoutButton.textContent = "Logout";
      logoutButton.addEventListener("click", async () => {
        if (!_supabase) return;
        logoutButton.disabled = true;
        logoutButton.textContent = "...";
        const { error } = await _supabase.auth.signOut();
        if (error) {
          showToast(`Logout failed: ${error.message}`);
          console.error("Logout error:", error);
          logoutButton.disabled = false;
          logoutButton.textContent = "Logout";
        } else {
          console.log("Logout initiated...");
        }
      });
      userActions.appendChild(welcomeText);
      userActions.appendChild(accountLink);
      userActions.appendChild(logoutButton);
    } else {
      const guestText = document.createElement("span");
      guestText.className = "text-sm text-text-muted hidden sm:inline";
      guestText.textContent = "Playing as Guest";
      const loginLink = document.createElement("a");
      loginLink.href = "auth.html";
      loginLink.className =
        "text-sm bg-primary hover:bg-primary-hover text-white font-semibold py-1 px-3 rounded-md transition duration-200";
      loginLink.textContent = "Login / Sign Up";
      userActions.appendChild(guestText);
      userActions.appendChild(loginLink);
    }
  }

  function updateSidebarButtonsVisibility() {
    const teamButton = document.getElementById("show-team-leaderboard-btn");
    if (teamButton) {
      teamButton.classList.toggle(
        "hidden",
        !(currentUser && userProfile?.team)
      );
    }
  }

  function handleGuestState() {
    console.log("Handling Guest State UI");
    const playerNameInput = document.getElementById("player-name");
    const welcomeMessage = document.getElementById("welcome-message");
    if (playerNameInput) {
      playerNameInput.value = localStorage.getItem("wordleGuestName") || "";
      playerNameInput.disabled = false;
      playerNameInput.placeholder = "Enter Your Name (Optional)";
    }
    if (welcomeMessage) {
      welcomeMessage.textContent = "Log in to save progress & compete!";
    }
    updateUserStatusHeader();
    updateStatisticsDisplayGlobal(null);
    updateAchievementsDisplayGlobal(null);
    updateTeamLeaderboardDisplay(null);
    updateRankingSidebar(null);
    updateLatestAchievementsSidebar(null);
  }

  function handleLoggedInState() {
    console.log("Handling Logged In State UI");
    const playerNameInput = document.getElementById("player-name");
    const welcomeMessage = document.getElementById("welcome-message");
    if (playerNameInput && userProfile?.username) {
      playerNameInput.value = userProfile.username;
      playerNameInput.disabled = true;
    } else if (playerNameInput) {
      playerNameInput.value = currentUser?.email || "Loading...";
      playerNameInput.disabled = true;
    }
    if (welcomeMessage && userProfile?.username) {
      welcomeMessage.textContent = `Ready for a challenge, ${userProfile.username}?`;
    } else if (welcomeMessage) {
      welcomeMessage.textContent = `Welcome back!`;
    }
    updateUserStatusHeader();
  }

  async function fetchUserProfile(userId) {
    if (!_supabase || !userId) {
      userProfile = null;
      return;
    }
    try {
      const { data, error, status } = await _supabase
        .from("profiles")
        .select("username, team")
        .eq("id", userId)
        .single();
      if (error && status !== 406) {
        console.error("Error fetching user profile:", error);
        userProfile = null;
      } else {
        userProfile = data;
        console.log("User profile fetched:", userProfile);
      }
    } catch (error) {
      console.error("Exception fetching user profile:", error);
      userProfile = null;
    }
  }

  function updateRankingSidebar(rankData) {
    const nameEl = document.getElementById("rank-player-name-ingame");
    const posEl = document.getElementById("rank-position-ingame");
    const pointsEl = document.getElementById("rank-points-ingame");
    if (!nameEl || !posEl || !pointsEl) return;
    if (rankData) {
      nameEl.textContent = rankData.name || "Top Player";
      posEl.innerHTML = `<span class="text-yellow-400 mr-1.5">🏆</span> ranked #${
        rankData.rank || "?"
      }`;
      pointsEl.textContent = `with ${rankData.points || 0} points`;
    } else {
      nameEl.textContent = "No Rank Data";
      posEl.innerHTML = `<span class="text-gray-500 mr-1.5">🏆</span> Not Ranked`;
      pointsEl.textContent = "Play games to get ranked!";
    }
  }
  function updateLatestAchievementsSidebar(achievements) {
    const list = document.getElementById("latest-achievements-list-ingame");
    if (!list) return;
    list.innerHTML = "";
    if (achievements && achievements.length > 0) {
      achievements.slice(0, 3).forEach((ach) => {
        const li = document.createElement("li");
        li.className = "bg-black bg-opacity-20 rounded-lg p-2 px-3 truncate";
        li.textContent = typeof ach === "string" ? ach : ach.name;
        li.title = typeof ach === "string" ? ach : ach.name;
        list.appendChild(li);
      });
    } else {
      list.innerHTML =
        '<li class="bg-black bg-opacity-20 rounded-lg p-2 px-3 text-gray-300 italic">No recent achievements.</li>';
    }
  }

  function showToast(message, duration = CONFIG.TOAST_DURATION) {
    const container = document.getElementById("toast-container");
    if (!container) return;
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
          if (toast.parentNode === container) container.removeChild(toast);
        },
        { once: true }
      );
    }, duration);
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
      this.letterCubes = [];
      this.currentRow = 0;
      this.currentCol = 0;
      this.targetWord = this.selectRandomWord();
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
      this.gameContainer = document.getElementById("game-container");
      this.toastContainer = document.getElementById("toast-container");
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
          this.updateGameHeaderUserInfo();
          loadAndDisplayInitialData();
        })
        .catch((error) => {
          console.error("Error initializing game data:", error);
          showToast("Error loading game data.");
          this.createGameBoard();
          this.createKeyboard();
          this.setupEventListeners();
          this.updateDifficultyDisplay();
          this.updateGameHeaderUserInfo();
        });
      const quitBtn = this.gameContainer.querySelector("#quit-btn");
      if (quitBtn) {
        const newQuitBtn = quitBtn.cloneNode(true);
        quitBtn.parentNode.replaceChild(newQuitBtn, quitBtn);
        newQuitBtn.addEventListener("click", () => this.resetGameToMenu());
      }
      // Add listeners for the left column buttons inside game container
      document
        .getElementById("quit-to-menu-btn-ingame")
        ?.addEventListener("click", () => this.resetGameToMenu());
      document
        .getElementById("change-category-btn-ingame")
        ?.addEventListener("click", () => this.resetGameToMenu());
    }
    updateGameHeaderUserInfo() {
      const gameUserInfoEl =
        this.gameContainer?.querySelector("#game-user-info");
      if (gameUserInfoEl) {
        if (this.userId && this.userProfileData) {
          let t =
            this.userProfileData.team === "red"
              ? '<span class="text-red-400">(Red)</span>'
              : this.userProfileData.team === "blue"
              ? '<span class="text-blue-400">(Blue)</span>'
              : "";
          gameUserInfoEl.innerHTML = `Playing as ${this.userProfileData.username} ${t}`;
          gameUserInfoEl.classList.remove("hidden");
        } else {
          gameUserInfoEl.textContent = `Playing as ${this.playerName}`;
          gameUserInfoEl.classList.remove("hidden");
        }
      }
    }
    async initGameData() {
      if (this.userId && _supabase) {
        try {
          const [stats, achievementsData] = await Promise.all([
            this.fetchSupabaseStats(),
            this.fetchSupabaseAchievements(),
          ]);
          this.playerStats = stats;
          this.achievements = achievementsData;
        } catch (error) {
          console.error("Failed Supabase data fetch:", error);
          showToast("Could not load profile.");
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
    } // Removed redundant loadAndDisplayInitialData call from constructor
    selectRandomWord() {
      const w = WORDS[this.category] || WORDS.general;
      return w[Math.floor(Math.random() * w.length)].toUpperCase();
    }
    createGameBoard() {
      const gb = this.gameContainer?.querySelector("#game-board");
      if (!gb) return;
      gb.innerHTML = "";
      const f = document.createDocumentFragment();
      for (let r = 0; r < this.MAX_ATTEMPTS; r++) {
        const re = document.createElement("div");
        re.id = `row-${r}`;
        re.className = "flex space-x-grid-gap";
        for (let c = 0; c < this.WORD_LENGTH; c++) {
          const ce = document.createElement("div");
          ce.id = `cell-${r}-${c}`;
          ce.className = `w-cell-size h-cell-size border-2 border-gray-600 flex items-center justify-center text-2xl font-bold uppercase transition-all duration-300`;
          re.appendChild(ce);
        }
        f.appendChild(re);
      }
      gb.appendChild(f);
    }
    createKeyboard() {
      const kr = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
      ];
      const k = this.gameContainer?.querySelector("#keyboard");
      if (!k) return;
      k.innerHTML = "";
      const f = document.createDocumentFragment();
      kr.forEach((r) => {
        const re = document.createElement("div");
        re.className = "flex justify-center space-x-key-gap mb-2";
        r.forEach((ky) => {
          const kb = document.createElement("button");
          kb.textContent = ky;
          kb.dataset.key = ky;
          kb.className = `key bg-key-bg text-white px-3 py-2 rounded hover:bg-key-hover transition duration-200 h-key-height text-sm ${
            ky === "ENTER" || ky === "⌫" ? "w-enter-width" : "w-key-width"
          }`;
          if (ky === "ENTER") kb.classList.add("key-enter");
          if (ky === "⌫") kb.classList.add("key-backspace");
          re.appendChild(kb);
        });
        f.appendChild(re);
      });
      k.appendChild(f);
    }
    setupEventListeners() {
      const ke = this.gameContainer?.querySelector("#keyboard");
      if (!ke) return;
      if (ke.listener) ke.removeEventListener("click", ke.listener);
      ke.listener = (e) => {
        if (e.target.classList.contains("key"))
          this.handleKeyPress(e.target.dataset.key);
      };
      ke.addEventListener("click", ke.listener);
      document.removeEventListener("keydown", this.boundHandleKeyDown);
      document.addEventListener("keydown", this.boundHandleKeyDown);
    }
    handleKeyDown(e) {
      if (
        this.gameOver ||
        !document.getElementById("message-box")?.classList.contains("hidden")
      )
        return;
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) this.handleKeyPress(k);
      else if (e.key === "Enter") this.handleKeyPress("ENTER");
      else if (e.key === "Backspace") this.handleKeyPress("⌫");
    }
    handleKeyPress(k) {
      if (this.gameOver) return;
      if (k === "ENTER") this.submitGuess();
      else if (k === "⌫") this.deleteLetter();
      else if (/^[A-Z]$/.test(k)) this.addLetter(k);
    }
    addLetter(l) {
      if (this.currentCol < this.WORD_LENGTH) {
        const c = document.getElementById(
          `cell-${this.currentRow}-${this.currentCol}`
        );
        if (!c) return;
        c.textContent = l;
        c.classList.add("scale-110");
        setTimeout(() => c.classList.remove("scale-110"), 100);
        this.currentGuess.push(l);
        this.currentCol++;
        this.playSound("type");
      }
    }
    deleteLetter() {
      if (this.currentCol > 0) {
        this.currentCol--;
        const c = document.getElementById(
          `cell-${this.currentRow}-${this.currentCol}`
        );
        if (!c) return;
        c.textContent = "";
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
      const g = this.currentGuess.join("");
      const res = this.checkGuess(g);
      const crtu = this.currentRow;
      this.updateRowColors(res, crtu);
      this.updateKeyboardColors(g, res);
      const ad = this.WORD_LENGTH * 200 + 100;
      if (g === this.targetWord) {
        setTimeout(() => this.handleWin(), ad);
      } else {
        this.currentRow++;
        if (this.currentRow >= this.MAX_ATTEMPTS) {
          setTimeout(() => this.handleLose(), ad);
        } else {
          this.currentGuess = [];
          this.currentCol = 0;
          this.playSound("wrong");
        }
      }
    }
    checkGuess(g) {
      const res = new Array(this.WORD_LENGTH).fill("absent");
      const tl = this.targetWord.split("");
      const gl = g.split("");
      let gs = 0;
      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (gl[i] === tl[i]) {
          res[i] = "correct";
          tl[i] = null;
          gl[i] = null;
          gs += 2;
        }
      }
      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (gl[i] !== null) {
          const idx = tl.indexOf(gl[i]);
          if (idx !== -1) {
            res[i] = "present";
            tl[idx] = null;
            gl[i] = null;
            gs += 1;
          }
        }
      }
      if (this.currentRow === 0 && g === this.targetWord) {
        gs = 20;
        this.showToast("✨ Perfect First Guess! +20 Points! ✨");
      }
      this.score = gs;
      if (
        this.difficulty === "hard" &&
        g === this.targetWord &&
        this.timeLeft > 0
      ) {
        const tb = Math.floor(this.timeLeft / 4);
        this.score += tb;
        showToast(`⏱️ Time Bonus: +${tb} points!`);
      }
      this.updateScoreDisplay();
      return res;
    }
    updateRowColors(colors, ri) {
      for (let i = 0; i < colors.length; i++) {
        setTimeout(() => {
          const c = document.getElementById(`cell-${ri}-${i}`);
          if (c) {
            c.classList.remove(
              "border-gray-600",
              "bg-correct",
              "bg-present",
              "bg-absent",
              "text-white"
            );
            c.classList.add(
              `bg-${colors[i]}`,
              "text-white",
              "border-transparent"
            );
          }
        }, i * 200);
      }
    }
    updateKeyboardColors(g, res) {
      const kd = this.gameContainer?.querySelector("#keyboard");
      if (!kd) return;
      for (let i = 0; i < g.length; i++) {
        const l = g[i];
        const s = res[i];
        const kb = kd.querySelector(`button[data-key="${l}"]`);
        if (kb) {
          const ic = kb.classList.contains("correct");
          const ip = kb.classList.contains("present");
          if (s === "correct") {
            kb.classList.remove(
              "present",
              "absent",
              "bg-key-bg",
              "hover:bg-key-hover"
            );
            kb.classList.add("correct", "bg-correct");
          } else if (s === "present" && !ic) {
            kb.classList.remove("absent", "bg-key-bg", "hover:bg-key-hover");
            kb.classList.add("present", "bg-present");
          } else if (s === "absent" && !ic && !ip) {
            kb.classList.remove("bg-key-bg", "hover:bg-key-hover");
            kb.classList.add("absent", "bg-absent");
          }
          if (s !== "absent") kb.classList.add("text-white");
        }
      }
    }
    shakeRow() {
      const r = document.getElementById(`row-${this.currentRow}`);
      if (r) {
        r.classList.add("shake");
        setTimeout(() => r.classList.remove("shake"), 500);
      }
    }
    async handleWin() {
      if (this.gameOver) return;
      this.gameOver = true;
      this.gameWon = true;
      clearInterval(this.timerInterval);
      const cgs = this.score;
      if (this.userId && _supabase) {
        this.playerStats.totalGamesPlayed++;
        this.playerStats.totalWins++;
        this.playerStats.categoriesWon.add(this.category);
        if (this.difficulty === "hard") this.playerStats.hardModeWins++;
        this.playerStats.totalScore += cgs;
        updateStatisticsDisplayGlobal(this.playerStats);
        updateAchievementsDisplayGlobal(this.achievements);
        let msg = `🎉 You got it: ${this.targetWord}! Score: ${cgs}. Your total score is now ${this.playerStats.totalScore}.`;
        const uA = this.checkAchievements();
        if (uA.length > 0) {
          msg += `\n🏆 Achievement${uA.length > 1 ? "s" : ""} unlocked!`;
        }
        try {
          await this.updateSupabaseStats();
          await Promise.all(uA.map((a) => this.unlockSupabaseAchievement(a)));
          await loadAndDisplayInitialData();
        } catch (err) {
          console.error("Error saving win:", err);
          showToast("Error saving results.");
        }
        this.showMessage("Congratulations!", msg);
      } else {
        this.addScoreToLocalGuestLeaderboard();
        await loadAndDisplayInitialData();
        updateStatisticsDisplayGlobal(null);
        updateAchievementsDisplayGlobal(null);
        let msg = `🎉 You guessed it: ${this.targetWord}! Score: ${cgs}.\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save scores!`;
        this.showMessage("You Won!", msg, true);
      }
      this.playSound("win");
    }
    async handleLose() {
      if (this.gameOver) return;
      this.gameOver = true;
      clearInterval(this.timerInterval);
      if (this.userId && _supabase) {
        this.playerStats.totalGamesPlayed++;
        try {
          await this.updateSupabaseStats();
          await loadAndDisplayInitialData();
        } catch (err) {
          console.error("Failed stat update:", err);
          showToast("Error saving stats.");
        }
        updateStatisticsDisplayGlobal(this.playerStats);
        updateAchievementsDisplayGlobal(this.achievements);
        let msg = `😥 The word was: ${this.targetWord}. Better luck next time! Score remains ${this.playerStats.totalScore}.`;
        this.showMessage("Game Over", msg);
      } else {
        updateStatisticsDisplayGlobal(null);
        updateAchievementsDisplayGlobal(null);
        await loadAndDisplayInitialData();
        let msg = `😥 The word was: ${this.targetWord}. Score: ${this.score}.\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save scores!`;
        this.showMessage("Game Over", msg, true);
      }
      this.playSound("lose");
    }
    async fetchSupabaseStats() {
      const dS = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
        totalScore: 0,
      };
      if (!this.userId || !_supabase) return dS;
      try {
        const { data, error, status } = await _supabase
          .from("game_stats")
          .select(
            "total_games_played,total_wins,hard_mode_wins,categories_won,total_score"
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
          : dS;
      } catch (err) {
        console.error("Fetch Stats Err:", err);
        throw err;
      }
    }
    async updateSupabaseStats() {
      if (!this.userId || !_supabase) return;
      const gI = 1;
      const wI = this.gameWon ? 1 : 0;
      const hWI = this.gameWon && this.difficulty === "hard" ? 1 : 0;
      const sI = this.gameWon ? this.score : 0;
      const cA = Array.from(this.playerStats.categoriesWon || []);
      const cTS = cA;
      try {
        const { error } = await _supabase.rpc("update_game_stats", {
          p_user_id: this.userId,
          p_games_increment: gI,
          p_wins_increment: wI,
          p_hard_wins_increment: hWI,
          p_score_increment: sI,
          p_categories: cTS,
        });
        if (error) {
          console.error("RPC Err:", error);
          throw error;
        } else console.log("Stats updated via RPC.");
      } catch (rpcErr) {
        console.error("RPC Call Err:", rpcErr);
        throw rpcErr;
      }
    }
    async fetchSupabaseAchievements() {
      const dA = {};
      if (!this.userId || !_supabase) return dA;
      try {
        const { data, error } = await _supabase
          .from("achievements")
          .select("achievement_id")
          .eq("user_id", this.userId);
        if (error) {
          console.error("Fetch Ach Err:", error);
          throw error;
        }
        const aM = {};
        if (data)
          data.forEach((a) => {
            aM[a.achievement_id] = true;
          });
        return aM;
      } catch (err) {
        console.error("Fetch Ach Ex:", err);
        return dA;
      }
    }
    async unlockSupabaseAchievement(ach) {
      if (!this.userId || !_supabase || !ach?.id) return;
      const { error } = await _supabase
        .from("achievements")
        .insert({ user_id: this.userId, achievement_id: ach.id });
      if (error && error.code !== "23505")
        console.error(`Unlock Ach Err ${ach.id}:`, error);
      else if (!error) console.log(`Ach ${ach.id} unlocked.`);
    }
    loadData(k, dV) {
      try {
        const d = localStorage.getItem(k);
        if (d) return JSON.parse(d);
      } catch (e) {
        console.error(`Load ${k} Err:`, e);
      }
      return dV;
    }
    saveData(k, d) {
      try {
        localStorage.setItem(k, JSON.stringify(d));
      } catch (e) {
        console.error(`Save ${k} Err:`, e);
      }
    }
    addScoreToLocalGuestLeaderboard() {
      if (this.userId) return;
      const l = this.loadData("wordleLeaderboard", []);
      l.push({
        name: this.playerName || "Guest",
        score: this.score,
        isGuest: true,
      });
      l.sort((a, b) => b.score - a.score);
      const t = l.slice(0, CONFIG.LEADERBOARD_SIZE);
      this.saveData("wordleLeaderboard", t);
    }
    checkAchievements() {
      if (!this.userId) return [];
      const self = this;
      const nU = [];
      const check = (a) => {
        if (a && !self.achievements[a.id]) {
          let cM = false;
          switch (a.id) {
            case ACHIEVEMENTS.FIRST_VICTORY.id:
              cM = self.gameWon && self.playerStats.totalWins === 1;
              break;
            case ACHIEVEMENTS.PERFECT_GAME.id:
              cM = self.gameWon && self.currentRow === 0;
              break;
            case ACHIEVEMENTS.HARD_MODE_MASTER.id:
              cM = self.gameWon && self.difficulty === "hard";
              break;
            case ACHIEVEMENTS.CATEGORY_CHAMPION.id:
              cM =
                self.gameWon &&
                Object.keys(WORDS).every((cat) =>
                  self.playerStats.categoriesWon.has(cat)
                );
              break;
            case ACHIEVEMENTS.TIME_MASTER.id:
              cM =
                self.gameWon &&
                self.difficulty === "hard" &&
                self.timeLeft >= Math.floor(CONFIG.HARD_MODE_DURATION / 2);
              break;
          }
          if (cM) {
            self.achievements[a.id] = true;
            nU.push(a);
            showToast(`🏆 Ach Unlocked: ${a.name}`);
          }
        }
      };
      Object.values(ACHIEVEMENTS).forEach(check);
      return nU;
    }
    updateTimerDisplay() {
      const t = document.getElementById("timer");
      if (!t) return;
      if (this.difficulty === "hard" && this.timeLeft !== null) {
        t.textContent = `Time: ${this.timeLeft}s`;
        t.classList.toggle(
          "text-red-500",
          this.timeLeft <= 10 && this.timeLeft > 0
        );
        t.classList.toggle("text-text-secondary", this.timeLeft > 10);
      } else t.textContent = "";
    }
    updateDifficultyDisplay() {
      const d = this.gameContainer?.querySelector("#difficulty-mode");
      if (d) {
        d.textContent = this.difficulty === "easy" ? `Easy Mode` : `Hard Mode`;
        d.className = `text-lg sm:text-xl order-first md:order-none w-full md:w-auto text-center md:text-left ${
          this.difficulty === "hard"
            ? "text-red-400 font-semibold"
            : "text-green-400"
        }`;
      }
    }
    updateScoreDisplay() {
      const s = this.gameContainer?.querySelector("#score");
      if (s) s.textContent = `Score: ${this.score}`;
    }
    showMessage(t, txt, html = false) {
      const mb = document.getElementById("message-box");
      const mt = document.getElementById("message-title");
      const mtxt = document.getElementById("message-text");
      const ngb = document.getElementById("new-game-btn");
      const qb = document.getElementById("quit-btn");
      if (!mb || !mt || !mtxt || !ngb || !qb) return;
      mt.textContent = t;
      if (html) mtxt.innerHTML = txt;
      else mtxt.textContent = txt;
      const ngbc = ngb.cloneNode(true);
      ngb.parentNode.replaceChild(ngbc, ngb);
      const qbc = qb.cloneNode(true);
      qb.parentNode.replaceChild(qbc, qb);
      mb.classList.remove("hidden");
      ngbc.focus();
      mb.removeEventListener("keydown", this.boundHandleModalKeyDown);
      mb.addEventListener("keydown", this.boundHandleModalKeyDown);
      const hNG = () => {
        mb.classList.add("hidden");
        this.restartGame();
      };
      const hQ = () => {
        mb.classList.add("hidden");
        this.resetGameToMenu();
      };
      ngbc.addEventListener("click", hNG, { once: true });
      qbc.addEventListener("click", hQ, { once: true });
    }
    handleModalKeyDown(e) {
      if (e.key === "Tab") {
        const mb = document.getElementById("message-box");
        if (!mb) return;
        const fe = mb.querySelectorAll("button");
        if (!fe.length) return;
        const fE = fe[0];
        const lE = fe[fe.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === fE) {
            lE.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lE) {
            fE.focus();
            e.preventDefault();
          }
        }
      }
    }
    playSound(sN) {
      const s = this.sounds[sN];
      if (s && s.state() === "loaded") s.play();
      else if (s && s.state() === "loading")
        s.once("load", () => {
          s.play();
        });
    }
    restartGame() {
      this.resetGameState();
      this.createGameBoard();
      this.createKeyboard();
      this.updateScoreDisplay();
      this.updateTimerDisplay();
      this.updateDifficultyDisplay();
      if (this.timeLeft !== null) this.startTimer();
      const mb = document.getElementById("message-box");
      if (mb) mb.classList.add("hidden");
      loadAndDisplayInitialData();
    } // Reload sidebar data on restart
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
      this.createKeyboard();
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
      const ke = this.gameContainer?.querySelector("#keyboard");
      if (ke && ke.listener) {
        ke.removeEventListener("click", ke.listener);
        delete ke.listener;
      }
      const mb = document.getElementById("message-box");
      if (mb) mb.removeEventListener("keydown", this.boundHandleModalKeyDown);
    }
    startTimer() {
      clearInterval(this.timerInterval);
      this.updateTimerDisplay();
      this.timerInterval = setInterval(() => {
        this.timeLeft--;
        this.updateTimerDisplay();
        if (this.timeLeft <= 0) {
          clearInterval(this.timerInterval);
          if (!this.gameOver) this.handleLose();
        }
      }, 1000);
    }
  }

  // View Switching Functions
  function showWordleMenuView() {
    console.log("Showing Wordle Menu View");
    document.getElementById("menu-container")?.classList.remove("hidden");
    document.getElementById("game-container")?.classList.add("hidden");
    document
      .getElementById("sections-display-area")
      ?.classList.remove("hidden");
    hideAllSections();
    document.getElementById("main-menu-input-card")?.classList.remove("hidden");
    document
      .getElementById("menu-buttons-container")
      ?.classList.remove("hidden");
  } // Ensure main menu parts are shown
  function showGameView() {
    console.log("Showing Game View");
    document.getElementById("menu-container")?.classList.add("hidden");
    document.getElementById("game-container")?.classList.remove("hidden");
  }
  function hideAllSections() {
    const sa = document.getElementById("sections-display-area");
    if (sa) {
      Array.from(sa.children).forEach((c) => {
        if (c.id && (c.id.endsWith("-section") || c.id.endsWith("-btn"))) {
          c.classList.add("hidden");
        }
      });
    }
  }
  function showSection(sId) {
    showWordleMenuView();
    hideAllSections();
    const sTS = document.getElementById(sId);
    const bB = document.getElementById("back-to-menu-from-sections-btn");
    if (sTS) sTS.classList.remove("hidden");
    if (bB) bB.classList.remove("hidden");
    document.getElementById("main-menu-input-card")?.classList.add("hidden");
    document.getElementById("menu-buttons-container")?.classList.add("hidden");
    if (sId === "leaderboard-section") loadAndDisplayLeaderboard();
    else if (sId === "statistics-section") loadAndDisplayStatistics();
    else if (sId === "achievements-section") loadAndDisplayAchievements();
    else if (sId === "team-leaderboard-section")
      loadAndDisplayTeamLeaderboard();
  }
  function showMenuFromSections() {
    showWordleMenuView();
    hideAllSections();
    document.getElementById("main-menu-input-card")?.classList.remove("hidden");
    document
      .getElementById("menu-buttons-container")
      ?.classList.remove("hidden");
  }

  // Event Listeners (Wordle Menu)
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
    .getElementById("show-team-leaderboard-btn")
    ?.addEventListener("click", () => showSection("team-leaderboard-section"));
  document
    .getElementById("back-to-menu-from-sections-btn")
    ?.addEventListener("click", showMenuFromSections);

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
      } catch (error) {
        console.error("Error fetching top player:", error);
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
            "`inserted_at` column not found on achievements. Cannot sort by latest."
          );
          const { data: allData, error: allError } = await _supabase
            .from("achievements")
            .select("achievement_id")
            .eq("user_id", currentUser.id)
            .limit(3);
          if (allError) throw allError;
          if (allData)
            latestAchievementsData = allData.map(
              (a) => ACHIEVEMENTS[a.achievement_id]?.name || a.achievement_id
            );
        } else if (data) {
          latestAchievementsData = data.map(
            (a) => ACHIEVEMENTS[a.achievement_id]?.name || a.achievement_id
          );
        }
      } catch (error) {
        console.error("Error fetching latest achievements:", error);
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

  // Load/Update Functions (Keep existing bodies, ensure they target correct elements)
  async function loadAndDisplayLeaderboard() {
    const lb = document.getElementById("leaderboard-body");
    if (!lb) return;
    lb.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-text-muted">Loading...</td></tr>`;
    let ld = [];
    let iL = false;
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
        ld = data || [];
        iL = false;
      } else {
        ld = JSON.parse(localStorage.getItem("wordleLeaderboard") || "[]");
        iL = true;
      }
      updateLeaderboardDisplayGlobal(ld, iL);
    } catch (e) {
      console.error("Ldrbrd Err:", e);
      try {
        ld = JSON.parse(localStorage.getItem("wordleLeaderboard") || "[]");
        iL = true;
        updateLeaderboardDisplayGlobal(ld, iL);
        if (currentUser) showToast("Online ldrbrd failed. Showing local.");
      } catch (le) {
        console.error("Lcl Ldrbrd Err:", le);
        lb.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-error">Failed load.</td></tr>`;
      }
    }
  }
  function updateLeaderboardDisplayGlobal(ld = [], iL = false) {
    const lb = document.getElementById("leaderboard-body");
    if (!lb) return;
    lb.innerHTML = "";
    const f = document.createDocumentFragment();
    if (!ld || ld.length === 0) {
      const r = document.createElement("tr");
      r.innerHTML = `<td colspan="4" class="px-4 py-4 text-center text-text-muted">No scores! ${
        iL ? "(Guests)" : "Play!"
      }</td>`;
      f.appendChild(r);
    } else {
      ld.forEach((e, i) => {
        const dN = iL ? e.name || "Guest" : e.profile?.username || "?";
        const s = iL ? e.score : e.total_score;
        const t = iL ? "N/A" : e.profile?.team || "N/A";
        const iGE = iL;
        const r = document.createElement("tr");
        r.className = i % 2 === 0 ? "bg-input-bg/50" : "";
        r.innerHTML = `<td class="px-4 py-2 text-center">${
          i + 1
        }</td><td class="px-4 py-2">${dN}${
          iGE ? " (G)" : ""
        }</td><td class="px-4 py-2 text-center">${
          s || 0
        }</td><td class="px-4 py-2 cap text-center">${t}</td>`;
        f.appendChild(r);
      });
    }
    lb.appendChild(f);
  }
  async function loadAndDisplayStatistics() {
    if (currentUser && _supabase) {
      try {
        const { data, error, status } = await _supabase
          .from("game_stats")
          .select("total_games_played,total_wins,hard_mode_wins,categories_won")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (error && status !== 406) throw error;
        const sD = data
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
        updateStatisticsDisplayGlobal(sD);
      } catch (e) {
        console.error("Stats Load Err:", e);
        showToast("Couldn't load stats.");
        updateStatisticsDisplayGlobal(null);
      }
    } else {
      updateStatisticsDisplayGlobal(null);
    }
  }
  function updateStatisticsDisplayGlobal(s) {
    const dl = document.querySelector("#statistics-section dl");
    const gm = document.getElementById("stats-guest-message");
    const sec = document.getElementById("statistics-section");
    if (!sec) return;
    if (currentUser && s && dl) {
      dl.classList.remove("hidden");
      if (gm) gm.classList.add("hidden");
      const dS = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
      };
      const pS = { ...dS, ...s };
      if (!(pS.categoriesWon instanceof Set))
        pS.categoriesWon = new Set(pS.categoriesWon || []);
      document.getElementById("games-played").textContent = pS.totalGamesPlayed;
      document.getElementById("total-wins").textContent = pS.totalWins;
      document.getElementById("hard-mode-wins").textContent =
        pS.hardModeWins || 0;
      const cWE = document.getElementById("categories-won");
      if (cWE) {
        const cA = Array.from(pS.categoriesWon);
        const cT =
          cA.length > 0
            ? cA.map((c) => c[0].toUpperCase() + c.slice(1)).join(", ")
            : "None";
        cWE.textContent = cT;
        cWE.title = cA.length > 5 ? cT : "";
      }
    } else if (dl && gm) {
      dl.classList.add("hidden");
      gm.classList.remove("hidden");
    } else if (!currentUser && gm) {
      gm.classList.remove("hidden");
      if (dl) dl.classList.add("hidden");
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
        const aD = {};
        if (data)
          data.forEach((a) => {
            aD[a.achievement_id] = true;
          });
        updateAchievementsDisplayGlobal(aD);
      } catch (e) {
        console.error("Ach Load Err:", e);
        showToast("Couldn't load achievements.");
        updateAchievementsDisplayGlobal(null);
      }
    } else {
      updateAchievementsDisplayGlobal(null);
    }
  }
  function updateAchievementsDisplayGlobal(uA) {
    const aL = document.getElementById("achievements-list");
    const gm = document.getElementById("achievements-guest-message");
    const sec = document.getElementById("achievements-section");
    if (!sec) return;
    if (currentUser && uA !== null && aL) {
      aL.innerHTML = "";
      if (gm) gm.classList.add("hidden");
      aL.classList.remove("hidden");
      const f = document.createDocumentFragment();
      const aPA = Object.values(ACHIEVEMENTS);
      if (aPA.length === 0) {
        aL.innerHTML = '<p class="t-t-m csf tc">No achievements.</p>';
        return;
      }
      aPA.forEach((a) => {
        const iU = uA[a.id] === true;
        const aD = document.createElement("div");
        aD.className = `bg-input-bg rounded-lg shadow-md p-4 flex flex-col items-center text-center transition-opacity duration-300 ${
          iU
            ? "opacity-100 border-2 border-yellow-400"
            : "opacity-60 border border-border-color"
        }`;
        aD.setAttribute("role", "listitem");
        aD.innerHTML = `<div class="text-4xl mb-2 ${
          iU
            ? "text-yellow-400 filter grayscale-0"
            : "text-gray-500 filter grayscale"
        }"> ${a.icon} ${
          !iU
            ? '<span class="sr-only">(L)</span>'
            : '<span class="sr-only">(U)</span>'
        } </div> <h3 class="text-lg font-semibold mb-1 t-t-p">${
          a.name
        }</h3> <p class="text-sm t-t-m">${a.description}</p>`;
        f.appendChild(aD);
      });
      aL.appendChild(f);
    } else if (aL && gm) {
      aL.innerHTML = "";
      aL.classList.add("hidden");
      gm.classList.remove("hidden");
    } else if (!currentUser && gm) {
      gm.classList.remove("hidden");
      if (aL) aL.classList.add("hidden");
    }
  }
  async function loadAndDisplayTeamLeaderboard() {
    const tb = document.getElementById("team-leaderboard-body");
    if (!tb || !_supabase) {
      if (tb)
        tb.innerHTML =
          '<tr><td colspan=2 class="tc t-e py-4">Err: No load.</td></tr>';
      return;
    }
    if (!currentUser) {
      updateTeamLeaderboardDisplay(null);
      return;
    }
    tb.innerHTML =
      '<tr><td colspan=2 class="tc t-t-m py-4">Loading...</td></tr>';
    try {
      const { data, error } = await _supabase
        .from("game_stats")
        .select(`total_score, profile:profiles!inner(team)`)
        .in("profile.team", ["blue", "red"]);
      if (error) throw error;
      const ts = { blue: 0, red: 0 };
      if (data) {
        data.forEach((i) => {
          if (
            i.profile &&
            i.profile.team &&
            ts.hasOwnProperty(i.profile.team)
          ) {
            ts[i.profile.team] += i.total_score || 0;
          }
        });
      }
      updateTeamLeaderboardDisplay(ts);
    } catch (e) {
      console.error("Team Ldrbrd Err:", e);
      updateTeamLeaderboardDisplay(undefined);
    }
  }
  function updateTeamLeaderboardDisplay(ts) {
    const tb = document.getElementById("team-leaderboard-body");
    if (!tb) return;
    if (currentUser && ts) {
      let bs = "t-t-p";
      let rs = "t-t-p";
      if (ts.blue > ts.red) bs = "text-blue-400 font-bold";
      else if (ts.red > ts.blue) rs = "text-red-400 font-bold";
      tb.innerHTML = `<tr class="border-b b-b-c"><td class="px-4 py-3 font-semibold ${bs}">Blue Team</td><td class="px-4 py-3 tc ${bs}">${ts.blue}</td></tr><tr><td class="px-4 py-3 font-semibold ${rs}">Red Team</td><td class="px-4 py-3 tc ${rs}">${ts.red}</td></tr>`;
    } else if (currentUser && ts === undefined) {
      tb.innerHTML =
        '<tr><td colspan=2 class="tc t-e py-4">Err load scores.</td></tr>';
    } else {
      tb.innerHTML =
        '<tr><td colspan=2 class="tc t-t-m py-4"><a href="auth.html" class="t-p h:u">Log in</a> to see scores</td></tr>';
    }
  }
  // --- End Load/Update Functions ---

  // Start Game Button (from Wordle Menu)
  document.getElementById("start-game-btn")?.addEventListener("click", () => {
    if (currentGameInstance) {
      currentGameInstance.destroy();
      currentGameInstance = null;
    }
    const nameInput = document.getElementById("player-name");
    let playerName = nameInput ? nameInput.value.trim() : null;
    const difficulty = document.getElementById("difficulty")?.value || "easy";
    const category = document.getElementById("category")?.value || "general";
    let finalPlayerName = "Guest";
    if (currentUser && userProfile?.username) {
      finalPlayerName = userProfile.username;
    } else if (!currentUser && playerName) {
      finalPlayerName = playerName;
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

  document.addEventListener("DOMContentLoaded", () => {
    initializeSupabase();
  });
})();
