let currentGameInstance = null;

async function loadAndDisplayInitialData() {
  console.log("Loading and displaying initial data...");
  let topPlayerData = null;
  if (typeof _supabase !== "undefined" && _supabase) {
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
  if (typeof updateRankingSidebar === "function")
    updateRankingSidebar(topPlayerData);

  let latestAchievementsData = null;
  if (
    typeof currentUser !== "undefined" &&
    currentUser &&
    typeof _supabase !== "undefined" &&
    _supabase
  ) {
    try {
      const { data, error } = await _supabase
        .from("achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", currentUser.id)
        .order("unlocked_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      if (data) {
        latestAchievementsData = data.map((a) => ({
          id: a.achievement_id,
          name: ACHIEVEMENTS[a.achievement_id]?.name || a.achievement_id,
        }));
      }
    } catch (e) {
      console.error("Error fetching latest achievements:", e);
    }
  }
  if (typeof updateLatestAchievementsSidebar === "function")
    updateLatestAchievementsSidebar(latestAchievementsData);

  await Promise.all([
    typeof loadAndDisplayLeaderboard === "function"
      ? loadAndDisplayLeaderboard()
      : Promise.resolve(),
    typeof loadAndDisplayStatistics === "function"
      ? loadAndDisplayStatistics()
      : Promise.resolve(),
    typeof loadAndDisplayAchievements === "function"
      ? loadAndDisplayAchievements()
      : Promise.resolve(),
    typeof loadAndDisplayTeamLeaderboard === "function"
      ? loadAndDisplayTeamLeaderboard()
      : Promise.resolve(),
  ]);
  if (typeof updateSidebarButtonsVisibility === "function")
    updateSidebarButtonsVisibility();
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof initializeSupabase === "function") {
    initializeSupabase();
  }

  document
    .getElementById("show-instructions-btn")
    ?.addEventListener("click", () => {
      if (typeof showSection === "function")
        showSection("instructions-section");
    });
  document
    .getElementById("back-to-menu-from-sections-btn")
    ?.addEventListener("click", () => {
      if (typeof showMenuFromSections === "function") showMenuFromSections();
    });
  document
    .getElementById("dropdown-leaderboard-btn")
    ?.addEventListener("click", () => {
      if (typeof showSection === "function") showSection("leaderboard-section");
    });
  document
    .getElementById("dropdown-stats-btn")
    ?.addEventListener("click", () => {
      if (typeof showSection === "function") showSection("statistics-section");
    });
  document
    .getElementById("dropdown-achievements-btn")
    ?.addEventListener("click", () => {
      if (typeof showSection === "function")
        showSection("achievements-section");
    });
  document
    .getElementById("dropdown-team-leaderboard-btn")
    ?.addEventListener("click", () => {
      if (typeof showSection === "function")
        showSection("team-leaderboard-section");
    });

  document.getElementById("start-game-btn")?.addEventListener("click", () => {
    if (currentGameInstance) {
      console.warn(
        "Destroying existing game instance before starting a new one."
      );
      currentGameInstance.destroy();
      currentGameInstance = null;
    }

    const nameInput = document.getElementById("player-name");
    let playerNameFromInput = nameInput ? nameInput.value.trim() : null;
    const difficulty = document.getElementById("difficulty")?.value || "easy";
    const category = document.getElementById("category")?.value || "general";

    let finalPlayerName = "Guest";
    if (
      typeof currentUser !== "undefined" &&
      currentUser &&
      typeof userProfile !== "undefined" &&
      userProfile?.username
    ) {
      finalPlayerName = userProfile.username;
    } else if (
      typeof currentUser === "undefined" ||
      (!currentUser && playerNameFromInput)
    ) {
      finalPlayerName = playerNameFromInput;
      localStorage.setItem("wordleGuestName", finalPlayerName);
    } else if (typeof currentUser === "undefined" || !currentUser) {
      finalPlayerName = "Guest";
      localStorage.setItem("wordleGuestName", "Guest");
    }

    if (typeof showGameView === "function") showGameView();

    currentGameInstance = new WordleGame(
      finalPlayerName,
      difficulty,
      category,
      typeof currentUser !== "undefined" ? currentUser?.id : null,
      typeof userProfile !== "undefined" ? userProfile : null
    );
  });
});

window.showWordleMenuView =
  typeof showWordleMenuView !== "undefined" ? showWordleMenuView : () => {};
window.showSection =
  typeof showSection !== "undefined" ? showSection : () => {};
