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

  // --- DOM Elements ---
  const menuContainer = document.getElementById("menu-container");
  const gameContainer = document.getElementById("game-container");
  const menuToggleBtn = document.getElementById("menu-toggle-btn");
  const userActionsMenu = document.getElementById("user-actions-menu");
  const userActionsGame = document.getElementById("user-actions-game");
  const gameBoardElement = document.getElementById("game-board");
  const keyboardElement = document.getElementById("keyboard");
  const messageBox = document.getElementById("message-box");
  // Sidebar elements
  const gameSidebar = document.getElementById("game-sidebar");
  const sidebarQuitBtn = document.getElementById("sidebar-quit-btn");
  const sidebarChangeCategoryBtn = document.getElementById(
    "sidebar-change-category"
  );
  const sidebarAchievementsLink = document.getElementById(
    "sidebar-achievements-link"
  );
  const sidebarStatsLink = document.getElementById("sidebar-stats-link");
  const sidebarLeaderboardLink = document.getElementById(
    "sidebar-leaderboard-link"
  );
  // Main Menu elements
  const startGameBtn = document.getElementById("start-game-btn");
  const showLeaderboardBtn = document.getElementById("show-leaderboard-btn");
  const showStatisticsBtn = document.getElementById("show-statistics-btn");
  const showAchievementsBtn = document.getElementById("show-achievements-btn");
  const showInstructionsBtn = document.getElementById("show-instructions-btn");
  const showTeamLeaderboardBtn = document.getElementById(
    "show-team-leaderboard-btn"
  );
  const backToMenuFromSectionsBtn = document.getElementById(
    "back-to-menu-from-sections-btn"
  );

  // --- Initialization ---
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
      if (currentUser) {
        await fetchUserProfile(currentUser.id);
        handleLoggedInState(); // Update menu UI
      } else {
        handleGuestState(); // Update menu UI
      }

      setupAuthListener();
      await loadAndDisplayInitialData(); // Load data for menu sections
      setupMenuNavigation(); // Setup main menu button listeners
    } catch (error) {
      console.error("Supabase Initialization Error:", error);
      showToast(`Error initializing: ${error.message}`);
      handleGuestState(); // Fallback to guest state
      await loadAndDisplayInitialData();
      setupMenuNavigation();
    }
  }

  function setupAuthListener() {
    if (!_supabase) return;
    _supabase.auth.onAuthStateChange(async (_event, session) => {
      const prevUser = currentUser;
      currentUser = session?.user ?? null;

      console.log(
        "Auth State Changed:",
        _event,
        "| User:",
        currentUser?.email || "Guest"
      );

      // User Logged In or Profile Loaded
      if (currentUser && (!prevUser || currentUser.id !== prevUser.id)) {
        await fetchUserProfile(currentUser.id);
        handleLoggedInState(); // Update menu appearance
        if (menuContainer && !menuContainer.classList.contains("hidden")) {
          await loadAndDisplayInitialData(); // Refresh menu data if menu is visible
        }
        // If a game is active, update its header, otherwise do nothing to game state
        if (currentGameInstance) {
          currentGameInstance.updateGameHeaderUserInfo(); // Update header in game
          currentGameInstance.userId = currentUser.id; // Update game instance user info
          currentGameInstance.userProfileData = userProfile;
        }
      }
      // User Logged Out
      else if (!currentUser && prevUser) {
        userProfile = null;
        handleGuestState(); // Update menu appearance
        if (menuContainer && !menuContainer.classList.contains("hidden")) {
          await loadAndDisplayInitialData(); // Refresh menu data for guest view
        }
        // If a game was active, force return to menu as guest state changed
        if (currentGameInstance) {
          showToast("Logged out. Returning to menu.");
          currentGameInstance.resetGameToMenu("menu"); // Force back to menu
        }
      }
      // Update correct header based on which container is visible
      updateUserStatusHeader(
        gameContainer && !gameContainer.classList.contains("hidden")
          ? "game"
          : "menu"
      );
    });
  }

  // --- UI State Handling ---
  function updateUserStatusHeader(context = "menu") {
    const targetUserActions =
      context === "game" ? userActionsGame : userActionsMenu;

    // Clear both, then populate the target
    if (userActionsMenu) userActionsMenu.innerHTML = "";
    if (userActionsGame) userActionsGame.innerHTML = "";
    if (!targetUserActions) return;

    if (currentUser && userProfile) {
      const welcomeText = document.createElement("span");
      welcomeText.className = `text-sm ${
        context === "game" ? "text-text-muted" : "text-text-secondary"
      } hidden sm:inline`;
      welcomeText.textContent = `Hi, ${userProfile.username}!`;

      const accountLink = document.createElement("a");
      accountLink.href = "account.html";
      accountLink.className = `text-sm ${
        context === "game"
          ? "bg-secondary hover:bg-secondary-hover"
          : "bg-secondary hover:bg-secondary-hover"
      } text-white font-semibold py-1 px-3 rounded-md transition duration-200`; // Adjusted game view style
      accountLink.textContent = "Account";

      const logoutButton = document.createElement("button");
      logoutButton.id = `nav-logout-button-${context}`;
      logoutButton.className = `text-sm ${
        context === "game"
          ? "bg-error hover:bg-red-600"
          : "bg-primary hover:bg-primary-hover"
      } text-white font-semibold py-1 px-3 rounded-md transition duration-200`;
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
          console.log("Logout initiated..."); // Auth listener will handle UI update
        }
      });

      targetUserActions.appendChild(welcomeText);
      targetUserActions.appendChild(accountLink);
      targetUserActions.appendChild(logoutButton);
    } else {
      // Guest view
      const guestText = document.createElement("span");
      guestText.className = "text-sm text-text-muted hidden sm:inline";
      guestText.textContent = context === "game" ? "Guest" : "Playing as Guest";

      const loginLink = document.createElement("a");
      loginLink.href = "auth.html";
      loginLink.className =
        "text-sm bg-primary hover:bg-primary-hover text-white font-semibold py-1 px-3 rounded-md transition duration-200";
      loginLink.textContent = "Login / Sign Up";

      targetUserActions.appendChild(guestText);
      targetUserActions.appendChild(loginLink);
    }
  }

  function handleGuestState() {
    console.log("Handling Guest State UI");
    const playerNameInput = document.getElementById("player-name");
    const welcomeMessage = document.getElementById("welcome-message");
    const statsGuestMsg = document.getElementById("stats-guest-message");
    const achieveGuestMsg = document.getElementById(
      "achievements-guest-message"
    );
    const statsDl = document.querySelector("#statistics-section dl");
    const achieveList = document.getElementById("achievements-list");

    if (playerNameInput) {
      playerNameInput.value = localStorage.getItem("wordleGuestName") || "";
      playerNameInput.disabled = false;
      playerNameInput.placeholder = "Enter Your Name (Optional)";
    }
    if (welcomeMessage)
      welcomeMessage.textContent = "Log in to save progress & compete!";
    if (showTeamLeaderboardBtn) showTeamLeaderboardBtn.classList.add("hidden");

    // Hide logged-in stats/achievements, show guest message
    if (statsDl) statsDl.classList.add("hidden");
    if (statsGuestMsg) statsGuestMsg.classList.remove("hidden");
    if (achieveList) achieveList.classList.add("hidden");
    if (achieveGuestMsg) achieveGuestMsg.classList.remove("hidden");

    updateUserStatusHeader("menu"); // Update header for menu view
  }

  function handleLoggedInState() {
    console.log("Handling Logged In State UI");
    const playerNameInput = document.getElementById("player-name");
    const welcomeMessage = document.getElementById("welcome-message");
    const statsGuestMsg = document.getElementById("stats-guest-message");
    const achieveGuestMsg = document.getElementById(
      "achievements-guest-message"
    );
    const statsDl = document.querySelector("#statistics-section dl");
    const achieveList = document.getElementById("achievements-list");

    if (playerNameInput && userProfile?.username) {
      playerNameInput.value = userProfile.username;
      playerNameInput.disabled = true;
    } else if (playerNameInput) {
      playerNameInput.value = currentUser?.email || "Loading..."; // Fallback
      playerNameInput.disabled = true;
    }

    if (welcomeMessage && userProfile?.username) {
      welcomeMessage.textContent = `Ready for a challenge, ${userProfile.username}?`;
    } else if (welcomeMessage) {
      welcomeMessage.textContent = `Welcome back!`;
    }

    if (showTeamLeaderboardBtn) {
      if (userProfile?.team) showTeamLeaderboardBtn.classList.remove("hidden");
      else showTeamLeaderboardBtn.classList.add("hidden");
    }

    // Show stats/achievements, hide guest message
    if (statsDl) statsDl.classList.remove("hidden");
    if (statsGuestMsg) statsGuestMsg.classList.add("hidden");
    if (achieveList) achieveList.classList.remove("hidden");
    if (achieveGuestMsg) achieveGuestMsg.classList.add("hidden");

    updateUserStatusHeader("menu"); // Update header for menu view
  }

  // --- Data Fetching & Display ---
  async function fetchUserProfile(userId) {
    if (!_supabase || !userId) {
      userProfile = null;
      return;
    }
    try {
      const { data, error, status } = await _supabase
        .from("profiles")
        .select("username, team") // Add other fields if needed (country?)
        .eq("id", userId)
        .single();

      if (error && status !== 406) {
        console.error("Error fetching user profile:", error);
        userProfile = null; // Ensure profile is null on error
      } else {
        userProfile = data; // Can be null if profile doesn't exist yet
        console.log("User profile fetched:", userProfile);
      }
    } catch (error) {
      console.error("Exception fetching user profile:", error);
      userProfile = null;
    }
  }

  function showToast(message, duration = CONFIG.TOAST_DURATION) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    // Trigger reflow to enable animation
    void toast.offsetWidth;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener(
        "transitionend",
        () => {
          // Check if the element still exists before removing
          if (toast.parentNode === container) {
            container.removeChild(toast);
          }
        },
        { once: true }
      );
    }, duration);
  }

  // --- Game Class ---
  class WordleGame {
    constructor(playerName, difficulty, category, userId, userProfileData) {
      this.WORD_LENGTH = CONFIG.WORD_LENGTH;
      this.MAX_ATTEMPTS = CONFIG.MAX_ATTEMPTS;
      this.score = 0; // Score for the current game only
      this.userId = userId;
      this.userProfileData = userProfileData; // Store profile passed during creation
      this.playerName = userId
        ? userProfileData?.username || "Player"
        : playerName || "Guest";
      this.userTeam = userProfileData?.team;
      this.difficulty = difficulty;
      this.category = category;
      this.timeLeft = difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
      this.timerInterval = null;
      this.currentRow = 0;
      this.currentCol = 0;
      this.targetWord = this.selectRandomWord();
      this.currentGuess = [];
      this.gameOver = false;
      this.gameWon = false;
      this.isProcessing = false; // Flag to prevent double submission

      // Player stats are handled globally now, not per game instance
      // Achievements are also handled globally

      this.sounds = {
        correct: new Howl({ src: ["sound/correct.wav"], volume: 0.5 }),
        wrong: new Howl({ src: ["sound/wrong.wav"], volume: 0.5 }),
        type: new Howl({ src: ["sound/type.wav"], volume: 0.3 }),
        win: new Howl({ src: ["sound/win.wav"], volume: 0.7 }),
        lose: new Howl({ src: ["sound/lose.wav"], volume: 0.7 }),
      };

      this.boundHandleKeyDown = this.handleKeyDown.bind(this);
      this.boundHandleModalKeyDown = this.handleModalKeyDown.bind(this);
      this.boundHandleKeyboardClick = this.handleKeyboardClick.bind(this);

      console.log(`Starting game. Word: ${this.targetWord}`); // Debugging

      // Don't fetch stats here, use global ones fetched on load/login
      this.createGameBoard();
      this.createKeyboard();
      this.setupEventListeners();
      this.setupSidebarListeners(); // Add sidebar listeners for this game instance
      // No need to update difficulty/score displays as they are removed
      // this.updateDifficultyDisplay();
      // this.updateScoreDisplay();
      this.updateTimerDisplay(); // Keep timer if needed (though not shown in screenshot)
      if (this.timeLeft !== null) this.startTimer();
      this.updateGameHeaderUserInfo(); // Set user info in game header
    }

    selectRandomWord() {
      const categoryWords = WORDS[this.category];
      const wordList =
        !categoryWords || categoryWords.length === 0
          ? WORDS.general
          : categoryWords;
      return wordList[
        Math.floor(Math.random() * wordList.length)
      ].toUpperCase();
    }

    createGameBoard() {
      if (!gameBoardElement) return;
      gameBoardElement.innerHTML = "";
      const fragment = document.createDocumentFragment();
      for (let row = 0; row < this.MAX_ATTEMPTS; row++) {
        const rowElement = document.createElement("div");
        rowElement.id = `row-${row}`;
        rowElement.className = "grid grid-cols-5 gap-grid-gap"; // Use grid layout for rows
        for (let col = 0; col < this.WORD_LENGTH; col++) {
          const cell = document.createElement("div");
          cell.id = `cell-${row}-${col}`;
          cell.className = `board-cell`; // Base cell class
          rowElement.appendChild(cell);
        }
        fragment.appendChild(rowElement);
      }
      gameBoardElement.appendChild(fragment);
    }

    createKeyboard() {
      if (!keyboardElement) return;
      const keyboardRows = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
      ];
      keyboardElement.innerHTML = "";
      const fragment = document.createDocumentFragment();
      keyboardRows.forEach((row) => {
        const rowElement = document.createElement("div");
        // Tailwind classes for flex row with gap applied in CSS via #keyboard > div
        row.forEach((key) => {
          const keyButton = document.createElement("button");
          keyButton.textContent = key;
          keyButton.dataset.key = key;
          // Base class + special classes for Enter/Backspace
          keyButton.className = `key ${key === "ENTER" ? "key-enter" : ""} ${
            key === "⌫" ? "key-backspace" : ""
          }`;
          rowElement.appendChild(keyButton);
        });
        fragment.appendChild(rowElement);
      });
      keyboardElement.appendChild(fragment);
    }

    setupEventListeners() {
      // Remove previous listeners if any to prevent duplicates
      document.removeEventListener("keydown", this.boundHandleKeyDown);
      if (keyboardElement && keyboardElement.listener) {
        keyboardElement.removeEventListener("click", keyboardElement.listener);
        delete keyboardElement.listener;
      }

      // Add new listeners
      document.addEventListener("keydown", this.boundHandleKeyDown);
      if (keyboardElement) {
        keyboardElement.listener = this.boundHandleKeyboardClick; // Store reference
        keyboardElement.addEventListener("click", keyboardElement.listener);
      }
    }

    setupSidebarListeners() {
      if (sidebarQuitBtn)
        sidebarQuitBtn.onclick = () => this.resetGameToMenu("menu");
      if (sidebarChangeCategoryBtn)
        sidebarChangeCategoryBtn.onclick = () => this.resetGameToMenu("menu"); // Quit to change
      if (sidebarAchievementsLink)
        sidebarAchievementsLink.onclick = () =>
          this.resetGameToMenu("achievements");
      if (sidebarStatsLink)
        sidebarStatsLink.onclick = () => this.resetGameToMenu("statistics");
      if (sidebarLeaderboardLink)
        sidebarLeaderboardLink.onclick = () =>
          this.resetGameToMenu("leaderboard");

      // Add listener to close sidebar if clicking outside of it (on the main content)
      const gameContent = document.getElementById("game-content");
      if (gameContent) {
        gameContent.onclick = (e) => {
          if (gameContainer?.classList.contains("sidebar-open")) {
            gameContainer.classList.remove("sidebar-open");
          }
        };
      }
    }

    handleKeyboardClick(event) {
      if (event.target.classList.contains("key")) {
        this.handleKeyPress(event.target.dataset.key);
      }
    }

    handleKeyDown(event) {
      if (
        this.gameOver ||
        this.isProcessing ||
        messageBox?.classList.contains("hidden") === false ||
        gameSidebar?.contains(document.activeElement)
      ) {
        // Ignore input if game over, processing, modal shown, or sidebar has focus
        return;
      }

      // Allow sidebar toggle even if game over? Maybe not.
      if (
        gameContainer?.classList.contains("sidebar-open") &&
        event.key === "Escape"
      ) {
        gameContainer.classList.remove("sidebar-open");
        return;
      }

      const key = event.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) this.handleKeyPress(key);
      else if (event.key === "Enter") this.handleKeyPress("ENTER");
      else if (event.key === "Backspace") this.handleKeyPress("⌫");
    }

    handleKeyPress(key) {
      if (this.gameOver || this.isProcessing) return;

      // Close sidebar if a key is pressed? Optional.
      // if (gameContainer?.classList.contains('sidebar-open')) {
      //     gameContainer.classList.remove('sidebar-open');
      // }

      if (key === "ENTER") this.submitGuess();
      else if (key === "⌫") this.deleteLetter();
      else if (/^[A-Z]$/.test(key) && this.currentCol < this.WORD_LENGTH)
        this.addLetter(key);
    }

    addLetter(letter) {
      const cell = document.getElementById(
        `cell-${this.currentRow}-${this.currentCol}`
      );
      if (!cell) return;
      cell.textContent = letter;
      cell.classList.add("scale-110"); // Animate cell
      this.currentGuess.push(letter);
      this.currentCol++;
      this.playSound("type");
      // Remove animation class after a short delay
      setTimeout(() => cell.classList.remove("scale-110"), 100);
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
        this.playSound("type"); // Sound for backspace too?
      }
    }

    async submitGuess() {
      if (this.currentCol !== this.WORD_LENGTH) {
        this.shakeRow();
        this.playSound("wrong");
        showToast("Not enough letters!");
        return;
      }
      if (this.isProcessing) return; // Prevent double submit

      this.isProcessing = true; // Start processing

      const guess = this.currentGuess.join("");
      const result = this.checkGuess(guess); // Calculates score internally
      const currentRowToUpdate = this.currentRow; // Capture current row before potential increment

      // Animate row colors, then handle win/loss/next row
      this.animateRowColors(result, currentRowToUpdate).then(() => {
        this.updateKeyboardColors(guess, result);

        if (guess === this.targetWord) {
          this.handleWin(); // Now handles async updates
        } else {
          this.currentRow++;
          if (this.currentRow >= this.MAX_ATTEMPTS) {
            this.handleLose(); // Now handles async updates
          } else {
            // Prepare for next guess
            this.currentGuess = [];
            this.currentCol = 0;
            this.playSound("wrong"); // Sound after animation completes
            this.isProcessing = false; // Ready for next input
          }
        }
      });
    }

    checkGuess(guess) {
      const result = new Array(this.WORD_LENGTH).fill("absent");
      const targetLetters = this.targetWord.split("");
      const guessLetters = guess.split("");
      let currentTurnScore = 0;

      // Check for correct letters (Green)
      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (guessLetters[i] === targetLetters[i]) {
          result[i] = "correct";
          targetLetters[i] = null; // Mark as used
          guessLetters[i] = null; // Mark as used
          currentTurnScore += 2;
        }
      }

      // Check for present letters (Yellow)
      for (let i = 0; i < this.WORD_LENGTH; i++) {
        if (guessLetters[i] !== null) {
          const index = targetLetters.indexOf(guessLetters[i]);
          if (index !== -1) {
            result[i] = "present";
            targetLetters[index] = null; // Mark as used
            guessLetters[i] = null; // Mark as used
            currentTurnScore += 1;
          }
        }
      }

      // Apply bonuses/overrides
      if (this.currentRow === 0 && guess === this.targetWord) {
        currentTurnScore = 20; // First try bonus overrides letter points
        showToast("✨ Perfect First Guess! +20 Points! ✨");
      }

      if (
        this.difficulty === "hard" &&
        guess === this.targetWord &&
        this.timeLeft > 0
      ) {
        const timeBonus = Math.floor(this.timeLeft / 4);
        currentTurnScore += timeBonus;
        showToast(`⏱️ Time Bonus: +${timeBonus} points!`);
      }

      this.score = currentTurnScore; // Set the final score for this specific game instance
      // No need to update score display on screen anymore
      // this.updateScoreDisplay();
      return result;
    }

    animateRowColors(colors, rowIndex) {
      return new Promise((resolve) => {
        const cells = Array.from(
          gameBoardElement.querySelectorAll(`#row-${rowIndex} .board-cell`)
        );
        let animationCount = 0;

        cells.forEach((cell, index) => {
          setTimeout(() => {
            if (cell) {
              // Remove previous state classes
              cell.classList.remove(
                "correct",
                "present",
                "absent",
                "border-border-color"
              );
              // Add new state class
              cell.classList.add(colors[index]);
              // Optional: Add flip animation class
              // cell.classList.add('flip-animation');
              // cell.addEventListener('animationend', () => {
              //     cell.classList.remove('flip-animation');
              // }, { once: true });
            }
            animationCount++;
            if (animationCount === cells.length) {
              resolve(); // Resolve promise when all animations are triggered
            }
          }, index * 200); // Stagger animation
        });
      });
    }

    updateKeyboardColors(guess, result) {
      if (!keyboardElement) return;
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        const status = result[i];
        const keyButton = keyboardElement.querySelector(
          `button[data-key="${letter}"]`
        );
        if (keyButton) {
          // Determine highest status for the letter so far (correct > present > absent)
          const currentStatus = keyButton.classList.contains("correct")
            ? "correct"
            : keyButton.classList.contains("present")
            ? "present"
            : keyButton.classList.contains("absent")
            ? "absent"
            : "none";

          if (status === "correct") {
            keyButton.classList.remove("present", "absent");
            keyButton.classList.add("correct");
          } else if (status === "present" && currentStatus !== "correct") {
            keyButton.classList.remove("absent");
            keyButton.classList.add("present");
          } else if (status === "absent" && currentStatus === "none") {
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

    async handleWin() {
      if (this.gameOver) return; // Prevent multiple calls
      this.gameOver = true;
      this.gameWon = true;
      clearInterval(this.timerInterval);
      const currentGameScore = this.score; // Score for THIS game win

      this.playSound("win");

      // Update stats and achievements IF user is logged in
      if (this.userId && _supabase) {
        try {
          // Fetch the latest stats before updating
          const latestStats = await fetchSupabaseStats(this.userId);
          latestStats.totalGamesPlayed++;
          latestStats.totalWins++;
          if (this.difficulty === "hard") latestStats.hardModeWins++;
          latestStats.categoriesWon.add(this.category); // Add current category
          latestStats.totalScore += currentGameScore; // Add current game score to total

          // Check achievements based on LATEST stats
          const latestAchievements = await fetchSupabaseAchievements(
            this.userId
          );
          const unlockedAchievements = checkAchievements(
            latestStats,
            latestAchievements,
            this.gameWon,
            this.currentRow,
            this.difficulty,
            this.timeLeft
          );

          // Update Supabase (stats + only newly unlocked achievements)
          await updateSupabaseStats(
            this.userId,
            1,
            1,
            this.difficulty === "hard" ? 1 : 0,
            currentGameScore,
            Array.from(latestStats.categoriesWon)
          );
          await Promise.all(
            unlockedAchievements.map((ach) =>
              unlockSupabaseAchievement(this.userId, ach)
            )
          );

          // Update UI in main menu (will be shown after modal)
          updateStatisticsDisplayGlobal(latestStats);
          updateAchievementsDisplayGlobal({
            ...latestAchievements,
            ...unlockedAchievements.reduce((acc, ach) => {
              acc[ach.id] = true;
              return acc;
            }, {}),
          });
          await loadAndDisplayLeaderboard(); // Refresh leaderboard
          await loadAndDisplayTeamLeaderboard(); // Refresh team scores

          // Prepare message
          let message = `🎉 You got it: ${this.targetWord}! Score: ${currentGameScore}. Your total score is now ${latestStats.totalScore}.`;
          if (unlockedAchievements.length > 0) {
            message += `\n🏆 Achievement${
              unlockedAchievements.length > 1 ? "s" : ""
            } unlocked!`;
          }
          this.showMessage("Congratulations!", message);
        } catch (error) {
          console.error("Error saving game win data to Supabase:", error);
          showToast("Error saving game results to server.");
          // Show basic win message even if save failed
          this.showMessage(
            "Congratulations!",
            `🎉 You got it: ${this.targetWord}! Score: ${currentGameScore}. (Save failed)`
          );
        } finally {
          this.isProcessing = false; // Done processing
        }
      } else {
        // Guest user
        addScoreToLocalGuestLeaderboard(this.playerName, currentGameScore);
        await loadAndDisplayLeaderboard(); // Refresh guest leaderboard display

        let message = `🎉 You guessed it: ${this.targetWord}! Score for this game: ${currentGameScore}.`;
        message += `\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save scores!`;
        this.showMessage("You Won!", message, true); // Allow HTML in message for links
        this.isProcessing = false; // Done processing
      }
    }

    async handleLose() {
      if (this.gameOver) return; // Prevent multiple calls
      this.gameOver = true;
      clearInterval(this.timerInterval);
      this.playSound("lose");

      if (this.userId && _supabase) {
        try {
          // Fetch latest stats just to display total score correctly
          const latestStats = await fetchSupabaseStats(this.userId);

          // Update only games played count in Supabase
          await updateSupabaseStats(this.userId, 1, 0, 0, 0, null); // Increment games played, no wins/score/category change

          // Update local display (games played increments, score stays same)
          latestStats.totalGamesPlayed++;
          updateStatisticsDisplayGlobal(latestStats);
          await loadAndDisplayLeaderboard(); // Refresh leaderboard (score didn't change)
          await loadAndDisplayTeamLeaderboard();

          let message = `😥 The word was: ${this.targetWord}. Better luck next time! Your total score remains ${latestStats.totalScore}.`;
          this.showMessage("Game Over", message);
        } catch (error) {
          console.error("Failed to update Supabase stats on loss:", error);
          showToast("Error saving game stats to server.");
          this.showMessage(
            "Game Over",
            `😥 The word was: ${this.targetWord}. (Save failed)`
          );
        } finally {
          this.isProcessing = false; // Done processing
        }
      } else {
        // Guest user
        // No stats to save for guest on loss
        await loadAndDisplayLeaderboard(); // Refresh guest leaderboard display (no change)
        let message = `😥 The word was: ${this.targetWord}. Score: 0.`; // Score is 0 on loss
        message += `\n<a href="auth.html" class="text-primary hover:underline">Sign up</a> or <a href="auth.html" class="text-primary hover:underline">Log in</a> to save scores!`;
        this.showMessage("Game Over", message, true); // Allow HTML
        this.isProcessing = false; // Done processing
      }
    }

    updateTimerDisplay() {
      // Although not shown in screenshot, keep logic if 'hard' mode exists
      const timerEl = document.getElementById("timer"); // This element might not exist in new HTML
      if (!timerEl || this.difficulty !== "hard" || this.timeLeft === null)
        return;

      timerEl.textContent = `Time: ${this.timeLeft}s`;
      timerEl.classList.toggle(
        "text-red-500",
        this.timeLeft <= 10 && this.timeLeft > 0
      );
      timerEl.classList.toggle("text-text-secondary", this.timeLeft > 10);
    }

    updateGameHeaderUserInfo() {
      // This should ideally be handled by the global updateUserStatusHeader('game')
      // But keep it as a fallback if needed within the instance
      updateUserStatusHeader("game");
    }

    showMessage(title, text, allowHtml = false) {
      const msgTitle = document.getElementById("message-title");
      const msgText = document.getElementById("message-text");
      const newGameBtn = document.getElementById("new-game-btn");
      const quitBtn = document.getElementById("quit-btn");

      if (!messageBox || !msgTitle || !msgText || !newGameBtn || !quitBtn)
        return;

      msgTitle.textContent = title;
      if (allowHtml) msgText.innerHTML = text;
      else msgText.textContent = text;

      messageBox.classList.remove("hidden");
      newGameBtn.focus(); // Focus the primary action

      // Clean up previous listeners before adding new ones
      newGameBtn.replaceWith(newGameBtn.cloneNode(true));
      quitBtn.replaceWith(quitBtn.cloneNode(true));
      // Get the new cloned buttons
      const newNewGameBtn = document.getElementById("new-game-btn");
      const newQuitBtn = document.getElementById("quit-btn");

      document.removeEventListener("keydown", this.boundHandleModalKeyDown); // Remove old modal listener first
      document.addEventListener("keydown", this.boundHandleModalKeyDown); // Add new modal listener

      const handleNewGame = () => {
        document.removeEventListener("keydown", this.boundHandleModalKeyDown);
        messageBox.classList.add("hidden");
        this.restartGame(); // Restart with same settings
      };
      const handleQuit = () => {
        document.removeEventListener("keydown", this.boundHandleModalKeyDown);
        messageBox.classList.add("hidden");
        this.resetGameToMenu("menu"); // Go back to main menu
      };

      if (newNewGameBtn)
        newNewGameBtn.addEventListener("click", handleNewGame, { once: true });
      if (newQuitBtn)
        newQuitBtn.addEventListener("click", handleQuit, { once: true });
    }

    handleModalKeyDown(event) {
      // Only handle if message box is visible
      if (!messageBox || messageBox.classList.contains("hidden")) return;

      if (event.key === "Enter") {
        // Trigger the "New Game" button if Enter is pressed in the modal
        const newGameBtn = document.getElementById("new-game-btn");
        newGameBtn?.click();
        event.preventDefault();
      } else if (event.key === "Escape") {
        // Trigger the "Quit" button if Escape is pressed
        const quitBtn = document.getElementById("quit-btn");
        quitBtn?.click();
        event.preventDefault();
      } else if (event.key === "Tab") {
        const focusableElements = messageBox.querySelectorAll("button");
        if (!focusableElements.length) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }

    playSound(soundName) {
      const sound = this.sounds[soundName];
      try {
        if (sound && sound.state() === "loaded") {
          sound.play();
        } else if (sound && sound.state() === "loading") {
          sound.once("load", () => {
            sound.play();
          });
        } else if (sound) {
          // If unloaded, load and play
          sound.load();
          sound.once("load", () => {
            sound.play();
          });
        }
      } catch (e) {
        console.error("Error playing sound:", soundName, e);
      }
    }

    restartGame() {
      this.resetGameState(); // Reset internal state
      this.createGameBoard(); // Rebuild board
      this.createKeyboard(); // Rebuild keyboard with default colors
      // No score/difficulty display needed
      this.updateTimerDisplay(); // Reset timer display if applicable
      if (this.timeLeft !== null) this.startTimer(); // Restart timer if hard mode
      if (messageBox) messageBox.classList.add("hidden");
      this.isProcessing = false; // Ensure processing flag is reset
    }

    resetGameState() {
      clearInterval(this.timerInterval);
      this.currentRow = 0;
      this.currentCol = 0;
      this.currentGuess = [];
      this.gameOver = false;
      this.gameWon = false;
      this.targetWord = this.selectRandomWord(); // Get a new word
      this.timeLeft =
        this.difficulty === "hard" ? CONFIG.HARD_MODE_DURATION : null;
      this.score = 0;
      this.isProcessing = false;
      console.log(`Restarted game. New Word: ${this.targetWord}`); // Debugging
    }

    resetGameToMenu(sectionToShow = null) {
      console.log(`Resetting game to menu. Target section: ${sectionToShow}`);
      this.destroy(); // Clean up game instance listeners etc.
      currentGameInstance = null; // Clear global instance reference

      if (gameContainer) {
        gameContainer.classList.add("hidden");
        gameContainer.classList.remove("sidebar-open"); // Ensure sidebar is hidden state
      }
      if (menuContainer) {
        menuContainer.classList.remove("hidden");
      }

      // Update header for menu view AFTER showing menu container
      updateUserStatusHeader("menu");

      // Load initial data for menu sections (leaderboard, stats etc.)
      loadAndDisplayInitialData().then(() => {
        if (currentUser) {
          handleLoggedInState(); // Ensure correct menu state for logged in user
        } else {
          handleGuestState(); // Ensure correct menu state for guest
        }

        // If a specific section was requested from sidebar, show it in main menu
        if (sectionToShow && sectionToShow !== "menu") {
          const sectionIdMap = {
            achievements: "achievements-section",
            statistics: "statistics-section",
            leaderboard: "leaderboard-section",
            team: "team-leaderboard-section", // Map if needed
            instructions: "instructions-section",
          };
          const targetSectionId =
            sectionIdMap[sectionToShow] || `${sectionToShow}-section`;
          showSection(targetSectionId); // Use existing function to show the section
        } else {
          // Ensure default menu view is shown
          showMenuFromSections();
        }
      });
    }

    destroy() {
      console.log("Destroying game instance");
      clearInterval(this.timerInterval);
      document.removeEventListener("keydown", this.boundHandleKeyDown);
      document.removeEventListener("keydown", this.boundHandleModalKeyDown); // Remove modal listener too
      if (keyboardElement && keyboardElement.listener) {
        keyboardElement.removeEventListener("click", keyboardElement.listener);
        delete keyboardElement.listener;
      }
      // Remove sidebar listeners to prevent memory leaks
      if (sidebarQuitBtn) sidebarQuitBtn.onclick = null;
      if (sidebarChangeCategoryBtn) sidebarChangeCategoryBtn.onclick = null;
      if (sidebarAchievementsLink) sidebarAchievementsLink.onclick = null;
      if (sidebarStatsLink) sidebarStatsLink.onclick = null;
      if (sidebarLeaderboardLink) sidebarLeaderboardLink.onclick = null;
      const gameContent = document.getElementById("game-content");
      if (gameContent) gameContent.onclick = null;

      // Stop sounds? Optional.
      Object.values(this.sounds).forEach((sound) => sound.stop());
    }

    startTimer() {
      clearInterval(this.timerInterval);
      this.updateTimerDisplay(); // Initial display
      this.timerInterval = setInterval(() => {
        if (this.timeLeft > 0) {
          this.timeLeft--;
          this.updateTimerDisplay();
        }
        if (this.timeLeft <= 0) {
          clearInterval(this.timerInterval);
          if (!this.gameOver) {
            console.log("Timer ran out, handling lose.");
            this.handleLose();
          }
        }
      }, 1000);
    }
  } // --- End of WordleGame Class ---

  // --- Global Functions for Data & UI ---

  async function loadAndDisplayInitialData() {
    // Fetch data needed for the main menu sections
    console.log("Loading initial menu data...");
    await Promise.all([
      loadAndDisplayLeaderboard(),
      loadAndDisplayStatistics(), // Will fetch based on currentUser
      loadAndDisplayAchievements(), // Will fetch based on currentUser
      loadAndDisplayTeamLeaderboard(), // Will fetch based on currentUser
    ]);
    // Ensure UI reflects login state after data loads
    if (currentUser) handleLoggedInState();
    else handleGuestState();
  }

  function setupMenuNavigation() {
    // Main Menu Section Toggles
    if (showLeaderboardBtn)
      showLeaderboardBtn.addEventListener("click", () =>
        showSection("leaderboard-section")
      );
    if (showStatisticsBtn)
      showStatisticsBtn.addEventListener("click", () =>
        showSection("statistics-section")
      );
    if (showAchievementsBtn)
      showAchievementsBtn.addEventListener("click", () =>
        showSection("achievements-section")
      );
    if (showInstructionsBtn)
      showInstructionsBtn.addEventListener("click", () =>
        showSection("instructions-section")
      );
    if (showTeamLeaderboardBtn)
      showTeamLeaderboardBtn.addEventListener("click", () =>
        showSection("team-leaderboard-section")
      ); // Load handled by showSection

    // Back button from sections
    if (backToMenuFromSectionsBtn)
      backToMenuFromSectionsBtn.addEventListener("click", showMenuFromSections);

    // Start Game Button
    if (startGameBtn) startGameBtn.addEventListener("click", startGame);

    // Sidebar Toggle Button (in game header)
    if (menuToggleBtn) menuToggleBtn.addEventListener("click", toggleSidebar);
  }

  function toggleSidebar() {
    if (gameContainer) gameContainer.classList.toggle("sidebar-open");
  }

  function startGame() {
    if (currentGameInstance) {
      currentGameInstance.destroy(); // Clean up old instance if any
      currentGameInstance = null;
    }

    const nameInput = document.getElementById("player-name");
    const difficulty = document.getElementById("difficulty")?.value || "easy";
    const category = document.getElementById("category")?.value || "general";
    let playerName = nameInput ? nameInput.value.trim() : null;

    let finalPlayerName = "Guest";
    if (currentUser && userProfile?.username) {
      finalPlayerName = userProfile.username;
    } else if (!currentUser && playerName) {
      finalPlayerName = playerName;
      localStorage.setItem("wordleGuestName", finalPlayerName); // Save guest name
    } else if (!currentUser) {
      // Use default if guest didn't enter name
      finalPlayerName = "Guest";
      localStorage.setItem("wordleGuestName", finalPlayerName);
    }

    if (menuContainer) menuContainer.classList.add("hidden");
    if (gameContainer) gameContainer.classList.remove("hidden");
    updateUserStatusHeader("game"); // Set header for game view

    currentGameInstance = new WordleGame(
      finalPlayerName,
      difficulty,
      category,
      currentUser?.id, // Pass current user ID
      userProfile // Pass current user profile data
    );
  }

  function showSection(sectionId) {
    // Hide all menu cards/buttons and potentially visible sections
    [
      "main-menu-input-card",
      "menu-buttons-container",
      "leaderboard-section",
      "statistics-section",
      "achievements-section",
      "instructions-section",
      "team-leaderboard-section",
    ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));

    // Show the target section
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) sectionToShow.classList.remove("hidden");

    // Show the 'Back' button
    if (backToMenuFromSectionsBtn)
      backToMenuFromSectionsBtn.classList.remove("hidden");

    // Reload data for dynamic sections when shown
    if (sectionId === "leaderboard-section") loadAndDisplayLeaderboard();
    else if (sectionId === "statistics-section") loadAndDisplayStatistics();
    else if (sectionId === "achievements-section") loadAndDisplayAchievements();
    else if (sectionId === "team-leaderboard-section")
      loadAndDisplayTeamLeaderboard();
  }

  function showMenuFromSections() {
    // Hide all sections and the back button
    [
      "leaderboard-section",
      "statistics-section",
      "achievements-section",
      "instructions-section",
      "team-leaderboard-section",
      "back-to-menu-from-sections-btn",
    ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));

    // Show the main menu input card and buttons
    document.getElementById("main-menu-input-card")?.classList.remove("hidden");
    document
      .getElementById("menu-buttons-container")
      ?.classList.remove("hidden");

    // Refresh UI state based on login status
    if (currentUser) handleLoggedInState();
    else handleGuestState();
  }

  // --- Global Stat/Achievement/Leaderboard Functions ---
  // These operate independently of a specific game instance

  async function fetchSupabaseStats(userId) {
    const defaultStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      categoriesWon: new Set(),
      hardModeWins: 0,
      totalScore: 0,
    };
    if (!userId || !_supabase) return defaultStats;
    try {
      const { data, error, status } = await _supabase
        .from("game_stats")
        .select(
          "total_games_played, total_wins, hard_mode_wins, categories_won, total_score"
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error && status !== 406) throw error;
      if (data) {
        return {
          totalGamesPlayed: data.total_games_played || 0,
          totalWins: data.total_wins || 0,
          hardModeWins: data.hard_mode_wins || 0,
          // Ensure categoriesWon is always a Set
          categoriesWon: new Set(data.categories_won || []),
          totalScore: data.total_score || 0,
        };
      } else return defaultStats; // Return default if no record found
    } catch (error) {
      console.error("Exception during fetchSupabaseStats:", error);
      throw error; // Re-throw to be caught by caller
    }
  }

  async function updateSupabaseStats(
    userId,
    gamesInc,
    winsInc,
    hardWinsInc,
    scoreInc,
    categories
  ) {
    if (!userId || !_supabase) return;
    // If categories is null, it means don't update it (e.g., on loss)
    const categoriesToSave = categories === null ? undefined : categories;

    // Use the RPC function for atomic updates
    const { error } = await _supabase.rpc("update_game_stats", {
      p_user_id: userId,
      p_games_increment: gamesInc,
      p_wins_increment: winsInc,
      p_hard_wins_increment: hardWinsInc,
      p_score_increment: scoreInc,
      p_categories: categoriesToSave, // Pass array or undefined
    });

    if (error) {
      console.error("Error calling update_game_stats RPC:", error);
      throw error;
    } else {
      console.log("Supabase stats updated successfully via RPC.");
    }
  }

  async function fetchSupabaseAchievements(userId) {
    const defaultAchievements = {};
    if (!userId || !_supabase) return defaultAchievements;
    try {
      const { data, error } = await _supabase
        .from("achievements")
        .select("achievement_id")
        .eq("user_id", userId);
      if (error) throw error;
      const achievementsMap = {};
      if (data)
        data.forEach((ach) => {
          achievementsMap[ach.achievement_id] = true;
        });
      return achievementsMap;
    } catch (error) {
      console.error("Error fetching Supabase achievements:", error);
      return defaultAchievements; // Return empty on error
    }
  }

  async function unlockSupabaseAchievement(userId, achievement) {
    if (!userId || !_supabase || !achievement?.id) return;
    const { error } = await _supabase
      .from("achievements")
      .insert({ user_id: userId, achievement_id: achievement.id });

    // Ignore duplicate key errors (23505), log others
    if (error && error.code !== "23505") {
      console.error(
        `Error unlocking Supabase achievement ${achievement.id}:`,
        error
      );
      // Optionally throw error to indicate failure
    } else if (!error) {
      console.log(`Achievement ${achievement.id} unlocked or already present.`);
    }
  }

  function checkAchievements(
    playerStats,
    currentAchievements,
    gameWon,
    currentRow,
    difficulty,
    timeLeft
  ) {
    if (!playerStats || !gameWon) return []; // Only check on win

    const newlyUnlocked = [];
    const check = (achievement) => {
      if (achievement && !currentAchievements[achievement.id]) {
        let conditionMet = false;
        switch (achievement.id) {
          case ACHIEVEMENTS.FIRST_VICTORY.id:
            conditionMet = playerStats.totalWins === 1;
            break;
          case ACHIEVEMENTS.PERFECT_GAME.id:
            conditionMet = currentRow === 0;
            break;
          case ACHIEVEMENTS.HARD_MODE_MASTER.id:
            conditionMet = difficulty === "hard";
            break;
          case ACHIEVEMENTS.CATEGORY_CHAMPION.id:
            const allCategories = Object.keys(WORDS);
            conditionMet = allCategories.every((cat) =>
              playerStats.categoriesWon.has(cat)
            );
            break;
          case ACHIEVEMENTS.TIME_MASTER.id:
            const timeThreshold = Math.floor(CONFIG.HARD_MODE_DURATION / 2);
            conditionMet = difficulty === "hard" && timeLeft >= timeThreshold;
            break;
        }
        if (conditionMet) {
          newlyUnlocked.push(achievement);
          showToast(`🏆 Achievement Unlocked: ${achievement.name}`);
        }
      }
    };

    Object.values(ACHIEVEMENTS).forEach(check);
    return newlyUnlocked;
  }

  function addScoreToLocalGuestLeaderboard(playerName, score) {
    if (currentUser) return; // Only for guests
    try {
      const localLeaderboard = JSON.parse(
        localStorage.getItem("wordleGuestLeaderboard") || "[]"
      );
      localLeaderboard.push({ name: playerName || "Guest", score: score });
      localLeaderboard.sort((a, b) => b.score - a.score);
      const trimmedLeaderboard = localLeaderboard.slice(
        0,
        CONFIG.LEADERBOARD_SIZE
      );
      localStorage.setItem(
        "wordleGuestLeaderboard",
        JSON.stringify(trimmedLeaderboard)
      );
    } catch (error) {
      console.error("Error updating local guest leaderboard:", error);
    }
  }

  async function loadAndDisplayLeaderboard() {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;
    leaderboardBody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-text-muted">Loading Leaderboard...</td></tr>`;
    let leaderboardData = [];
    let isLocal = false;

    try {
      if (_supabase) {
        // Always try to fetch online if supabase exists
        const { data, error } = await _supabase
          .from("game_stats")
          .select(
            `total_score, user_id, profile:profiles!inner ( username, team )`
          )
          .not("profile", "is", null) // Ensure profile exists
          .order("total_score", { ascending: false })
          .limit(CONFIG.LEADERBOARD_SIZE);
        if (error) throw error;
        leaderboardData = data || [];
        isLocal = false; // Fetched online data
      } else {
        // Fallback to local if supabase isn't initialized (shouldn't happen often)
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleGuestLeaderboard") || "[]"
        );
        isLocal = true;
      }
      updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      // Fallback to local guest scores on error
      try {
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleGuestLeaderboard") || "[]"
        );
        isLocal = true;
        updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
        if (_supabase)
          showToast(
            "Could not load online leaderboard. Showing local guest scores."
          );
      } catch (localError) {
        console.error(
          "Error loading local guest leaderboard fallback:",
          localError
        );
        leaderboardBody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-error">Failed to load leaderboard.</td></tr>`;
      }
    }
  }

  function updateLeaderboardDisplayGlobal(
    leaderboardData = [],
    isLocal = false
  ) {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;
    leaderboardBody.innerHTML = ""; // Clear existing rows
    const fragment = document.createDocumentFragment();

    if (!leaderboardData || leaderboardData.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4" class="px-4 py-4 text-center text-text-muted">No scores yet! ${
        isLocal ? "(Guests)" : "Play a game!"
      }</td>`;
      fragment.appendChild(row);
    } else {
      leaderboardData.forEach((entry, index) => {
        // Use optional chaining for safer access
        const displayName = isLocal
          ? entry.name || "Guest"
          : entry.profile?.username || "Unknown";
        const score = isLocal ? entry.score : entry.total_score;
        const team = isLocal ? null : entry.profile?.team || null; // Null for guests

        const row = document.createElement("tr");
        row.className = index % 2 === 0 ? "bg-input-bg/50" : ""; // Alternate row background

        let teamDisplay = "";
        if (team === "red")
          teamDisplay = '<span class="text-red-400">Red</span>';
        else if (team === "blue")
          teamDisplay = '<span class="text-blue-400">Blue</span>';
        else if (!isLocal)
          teamDisplay = '<span class="text-text-muted">N/A</span>';
        // No team display for guests (isLocal = true)

        row.innerHTML = `
                  <td class="px-4 py-2 text-center font-medium">${
                    index + 1
                  }</td>
                  <td class="px-4 py-2">${displayName}${
          isLocal ? ' <span class="text-xs text-text-muted">(Guest)</span>' : ""
        }</td>
                  <td class="px-4 py-2 text-center font-semibold">${
                    score ?? 0
                  }</td>
                  <td class="px-4 py-2 capitalize text-center">${teamDisplay}</td>`;
        fragment.appendChild(row);
      });
    }
    leaderboardBody.appendChild(fragment);
  }

  async function loadAndDisplayStatistics() {
    if (currentUser && _supabase) {
      try {
        const statsData = await fetchSupabaseStats(currentUser.id);
        updateStatisticsDisplayGlobal(statsData);
      } catch (error) {
        console.error("Error loading Supabase statistics:", error);
        showToast("Could not load your statistics from server.");
        updateStatisticsDisplayGlobal(null); // Show guest view on error
      }
    } else {
      updateStatisticsDisplayGlobal(null); // Show guest view
    }
  }

  function updateStatisticsDisplayGlobal(stats) {
    const dlElement = document.querySelector("#statistics-section dl");
    const guestMessageElement = document.getElementById("stats-guest-message");
    const section = document.getElementById("statistics-section");

    if (!section) return;

    if (currentUser && stats && dlElement) {
      dlElement.classList.remove("hidden");
      if (guestMessageElement) guestMessageElement.classList.add("hidden");

      const defaultStats = {
        totalGamesPlayed: 0,
        totalWins: 0,
        categoriesWon: new Set(),
        hardModeWins: 0,
      };
      // Ensure stats object exists and merge with defaults
      const playerStats = { ...defaultStats, ...stats };
      // Crucially, ensure categoriesWon is a Set
      if (!(playerStats.categoriesWon instanceof Set)) {
        playerStats.categoriesWon = new Set(playerStats.categoriesWon || []);
      }

      document.getElementById("games-played").textContent =
        playerStats.totalGamesPlayed;
      document.getElementById("total-wins").textContent = playerStats.totalWins;
      document.getElementById("hard-mode-wins").textContent =
        playerStats.hardModeWins || 0;

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
        // Add tooltip for long lists
        categoriesWonEl.title =
          categoriesArray.length > 5 ? categoriesText : "";
      }
    } else {
      // Guest or error state
      if (dlElement) dlElement.classList.add("hidden");
      if (guestMessageElement) guestMessageElement.classList.remove("hidden");
    }
  }

  async function loadAndDisplayAchievements() {
    if (currentUser && _supabase) {
      try {
        const achievementsData = await fetchSupabaseAchievements(
          currentUser.id
        );
        updateAchievementsDisplayGlobal(achievementsData);
      } catch (error) {
        console.error("Error loading Supabase achievements:", error);
        showToast("Could not load your achievements from server.");
        updateAchievementsDisplayGlobal(null); // Show guest view on error
      }
    } else {
      updateAchievementsDisplayGlobal(null); // Show guest view
    }
  }

  function updateAchievementsDisplayGlobal(unlockedAchievements) {
    const achievementsList = document.getElementById("achievements-list");
    const guestMessageElement = document.getElementById(
      "achievements-guest-message"
    );
    const section = document.getElementById("achievements-section");

    if (!section) return;

    if (currentUser && unlockedAchievements !== null && achievementsList) {
      achievementsList.innerHTML = ""; // Clear previous
      if (guestMessageElement) guestMessageElement.classList.add("hidden");
      achievementsList.classList.remove("hidden");

      const fragment = document.createDocumentFragment();
      const allPossibleAchievements = Object.values(ACHIEVEMENTS);

      if (allPossibleAchievements.length === 0) {
        achievementsList.innerHTML =
          '<p class="text-text-muted col-span-full text-center">No achievements defined.</p>';
        return;
      }

      allPossibleAchievements
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((achievement) => {
          const isUnlocked = unlockedAchievements[achievement.id] === true;
          const achievementDiv = document.createElement("div");
          // Adjusted styles to better match screenshot appearance if needed
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
                  <p class="text-sm text-text-muted">${
                    achievement.description
                  }</p>
              `;
          fragment.appendChild(achievementDiv);
        });
      achievementsList.appendChild(fragment);
    } else {
      // Guest or error state
      if (achievementsList) {
        achievementsList.innerHTML = ""; // Clear just in case
        achievementsList.classList.add("hidden");
      }
      if (guestMessageElement) guestMessageElement.classList.remove("hidden");
    }
  }

  async function loadAndDisplayTeamLeaderboard() {
    const teamBody = document.getElementById("team-leaderboard-body");
    if (!teamBody) return;

    if (!currentUser || !_supabase) {
      updateTeamLeaderboardDisplay(null); // Show guest message
      return;
    }

    teamBody.innerHTML =
      '<tr><td colspan="2" class="text-center text-text-muted py-4">Loading Team Scores...</td></tr>';
    try {
      // Fetch scores only for users with a team assigned in profiles
      const { data, error } = await _supabase
        .from("game_stats")
        .select(
          `
                    total_score,
                    profile:profiles!inner ( team )
                `
        )
        .in("profile.team", ["blue", "red"]); // Only fetch for valid teams

      if (error) throw error;

      const teamScores = { blue: 0, red: 0 };
      if (data) {
        data.forEach((item) => {
          // Check profile and team exist and are valid
          if (
            item.profile &&
            item.profile.team &&
            teamScores.hasOwnProperty(item.profile.team)
          ) {
            teamScores[item.profile.team] += item.total_score || 0;
          }
        });
      }
      updateTeamLeaderboardDisplay(teamScores);
    } catch (error) {
      console.error("Error loading team leaderboard:", error);
      updateTeamLeaderboardDisplay(undefined); // Indicate error
    }
  }

  function updateTeamLeaderboardDisplay(teamScores) {
    const teamBody = document.getElementById("team-leaderboard-body");
    const teamSection = document.getElementById("team-leaderboard-section"); // Get section itself
    if (!teamBody || !teamSection) return;

    // Show/Hide section based on login status first
    if (!currentUser) {
      teamSection.classList.add("hidden"); // Hide the whole section for guests
      return; // Don't process further
    } else {
      teamSection.classList.remove("hidden"); // Ensure section is visible for logged-in users
    }

    if (teamScores === undefined) {
      // Error state
      teamBody.innerHTML =
        '<tr><td colspan="2" class="text-center text-error py-4">Error loading team scores.</td></tr>';
    } else if (teamScores === null) {
      // Explicitly guest state (though handled above by hiding section)
      teamBody.innerHTML =
        '<tr><td colspan="2" class="text-center text-text-muted py-4"><a href="auth.html" class="text-primary hover:underline">Log in</a> to see team scores</td></tr>';
    } else {
      // Logged in, scores available
      let blueStyle = "text-text-primary";
      let redStyle = "text-text-primary";
      if (teamScores.blue > teamScores.red)
        blueStyle = "text-blue-400 font-bold";
      else if (teamScores.red > teamScores.blue)
        redStyle = "text-red-400 font-bold";

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
    }
  }

  // --- Event Listeners & Initial Setup ---
  document.addEventListener("DOMContentLoaded", () => {
    initializeSupabase().then(() => {
      // Supabase initialized, auth state determined. UI updated by listener/init functions.
      showMenuFromSections(); // Ensure main menu is visible initially
    });
  });
})(); // End IIFE
