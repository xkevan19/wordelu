let _supabase;
let currentUser = null;
let userProfile = null;

async function initializeSupabase() {
  try {
    const response = await fetch("/.netlify/functions/get-supabase-config");
    if (!response.ok)
      throw new Error(`Failed Supabase config: ${response.status}`);
    const config = await response.json();
    if (!config.url || !config.key) throw new Error("Invalid Supabase config");
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
        if (typeof currentGameInstance !== "undefined" && currentGameInstance) {
          currentGameInstance.resetGameToMenu();
          showToast("Logged out.");
        }
      }

      if (typeof loadAndDisplayInitialData === "function") {
        await loadAndDisplayInitialData();
      }

      if (typeof currentGameInstance !== "undefined" && currentGameInstance) {
        currentGameInstance.updateGameHeaderUserInfo?.();
      } else if (
        document.getElementById("game-container") &&
        !document.getElementById("game-container").classList.contains("hidden")
      ) {
        if (typeof showWordleMenuView === "function") {
          showWordleMenuView();
        }
      }
      if (typeof updateSidebarButtonsVisibility === "function") {
        updateSidebarButtonsVisibility();
      }
    });

    if (currentUser) {
      await fetchUserProfile(currentUser.id);
      handleLoggedInState();
    } else {
      handleGuestState();
    }

    if (typeof populateLeaderboardFilterDropdowns === "function") {
      populateLeaderboardFilterDropdowns();
    }
    if (typeof setupLeaderboardFilterListeners === "function") {
      setupLeaderboardFilterListeners();
    }
    if (typeof loadAndDisplayInitialData === "function") {
      await loadAndDisplayInitialData();
    }
    if (typeof currentGameInstance === "undefined" || !currentGameInstance) {
      if (typeof showWordleMenuView === "function") {
        showWordleMenuView();
      }
    }
  } catch (error) {
    console.error("Supabase Init Error:", error);
    if (typeof showToast === "function") {
      showToast(`Init Error: ${error.message}`);
    }
    handleGuestState();
    if (typeof populateLeaderboardFilterDropdowns === "function") {
      populateLeaderboardFilterDropdowns();
    }
    if (typeof setupLeaderboardFilterListeners === "function") {
      setupLeaderboardFilterListeners();
    }
    if (typeof loadAndDisplayInitialData === "function") {
      await loadAndDisplayInitialData();
    }
    if (typeof showWordleMenuView === "function") {
      showWordleMenuView();
    }
  }
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

function updateUserStatusHeader() {
  const ua = document.getElementById("user-actions");
  if (!ua) return;
  ua.innerHTML = "";

  if (currentUser && userProfile) {
    const wt = document.createElement("span");
    wt.className = "text-sm text-text-secondary hidden sm:inline";
    let teamIndicator = "";
    if (userProfile.team === "red")
      teamIndicator = '<span class="text-red-400 ml-1">(Red)</span>';
    else if (userProfile.team === "blue")
      teamIndicator = '<span class="text-blue-400 ml-1">(Blue)</span>';
    wt.innerHTML = `Hi, ${userProfile.username}! ${teamIndicator}`;

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
        if (typeof showToast === "function")
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
  if (typeof updateStatisticsDisplayGlobal === "function")
    updateStatisticsDisplayGlobal(null);
  if (typeof updateAchievementsDisplayGlobal === "function")
    updateAchievementsDisplayGlobal(null);
  if (typeof updateTeamLeaderboardDisplay === "function")
    updateTeamLeaderboardDisplay(null);
  if (typeof updateRankingSidebar === "function") updateRankingSidebar(null);
  if (typeof updateLatestAchievementsSidebar === "function")
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
    let loggedInText = "Logged in";
    if (userProfile?.username) {
      loggedInText = `Logged in as ${userProfile.username}`;
      if (userProfile.team === "red") loggedInText += " (Red)";
      else if (userProfile.team === "blue") loggedInText += " (Blue)";
    } else if (currentUser?.email) {
      loggedInText = `Logged in as ${currentUser.email}`;
    }
    lii.textContent = loggedInText;
  }

  if (wm && userProfile?.username) {
    wm.textContent = `Ready for a challenge, ${userProfile.username}?`;
  } else if (wm) {
    wm.textContent = `Welcome back!`;
  }

  updateUserStatusHeader();
}

function updateSidebarButtonsVisibility() {
  const teamLeaderboardBtn = document.getElementById(
    "dropdown-team-leaderboard-btn"
  );
  if (teamLeaderboardBtn) {
    teamLeaderboardBtn.classList.remove("hidden");
  }
}
