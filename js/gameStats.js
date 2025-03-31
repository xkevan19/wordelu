async function loadAndDisplayStatistics() {
  if (
    typeof currentUser !== "undefined" &&
    currentUser &&
    typeof _supabase !== "undefined" &&
    _supabase
  ) {
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
            categoriesWon: new Set(
              Array.isArray(data.categories_won) ? data.categories_won : []
            ),
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
      if (typeof showToast === "function")
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

  if (typeof currentUser !== "undefined" && currentUser && stats && dlElement) {
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
  } else if (
    typeof currentUser === "undefined" ||
    (!currentUser && guestMessage)
  ) {
    guestMessage.classList.remove("hidden");
    if (dlElement) dlElement.classList.add("hidden");
  }
}
