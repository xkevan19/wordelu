function populateLeaderboardFilterDropdowns() {
  const categoryFilter = document.getElementById("leaderboard-category-filter");
  if (!categoryFilter) return;

  while (categoryFilter.options.length > 1) {
    categoryFilter.remove(1);
  }

  Object.keys(WORDS).forEach((categoryKey) => {
    const option = document.createElement("option");
    option.value = categoryKey;
    option.textContent =
      categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
    categoryFilter.appendChild(option);
  });
}

function setupLeaderboardFilterListeners() {
  const categoryFilter = document.getElementById("leaderboard-category-filter");
  const difficultyFilter = document.getElementById(
    "leaderboard-difficulty-filter"
  );

  const reloadLeaderboard = () => {
    loadAndDisplayLeaderboard();
  };

  if (categoryFilter) {
    categoryFilter.removeEventListener("change", reloadLeaderboard);
    categoryFilter.addEventListener("change", reloadLeaderboard);
  }
  if (difficultyFilter) {
    difficultyFilter.removeEventListener("change", reloadLeaderboard);
    difficultyFilter.addEventListener("change", reloadLeaderboard);
  }
}

async function loadAndDisplayLeaderboard() {
  const leaderboardBody = document.getElementById("leaderboard-body");
  const categoryFilter =
    document.getElementById("leaderboard-category-filter")?.value || "all";
  const difficultyFilter =
    document.getElementById("leaderboard-difficulty-filter")?.value || "all";
  const leaderboardTitle = document.querySelector("#leaderboard-section h2");

  if (!leaderboardBody) return;

  leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-text-muted p-4">Loading leaderboard...</td></tr>`;
  let leaderboardData = [];
  let isLocal = false;
  let queryError = null;

  if (leaderboardTitle) {
    let titleText = "Global Leaderboard";
    if (categoryFilter !== "all" && difficultyFilter === "all") {
      titleText = `Leaderboard - ${
        categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)
      }`;
    } else if (categoryFilter === "all" && difficultyFilter !== "all") {
      titleText = `Leaderboard - ${
        difficultyFilter.charAt(0).toUpperCase() + difficultyFilter.slice(1)
      } Mode`;
    } else if (categoryFilter !== "all" && difficultyFilter !== "all") {
      titleText = `Leaderboard - ${
        categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)
      } (${
        difficultyFilter.charAt(0).toUpperCase() + difficultyFilter.slice(1)
      })`;
    }
    leaderboardTitle.textContent = titleText;
  }

  try {
    let finalAggregatedData = [];
    if (categoryFilter === "all" && difficultyFilter === "all") {
      const { data, error } = await _supabase
        .from("game_stats")
        .select(`total_score, user_id, profile:profiles!inner(username, team)`)
        .order("total_score", { ascending: false })
        .limit(CONFIG.LEADERBOARD_SIZE);

      if (error) throw error;

      finalAggregatedData = (data || []).map((item) => ({
        user_id: item.user_id,
        profile: item.profile,
        score: item.total_score,
      }));
    } else {
      let resultsQuery = _supabase
        .from("game_results")
        .select(`user_id, score`);

      if (categoryFilter !== "all") {
        resultsQuery = resultsQuery.eq("category", categoryFilter);
      }
      if (difficultyFilter !== "all") {
        resultsQuery = resultsQuery.eq("difficulty", difficultyFilter);
      }
      const { data: resultsData, error: resultsError } = await resultsQuery;
      if (resultsError) throw resultsError;
      const userScoresMap = {};
      (resultsData || []).forEach((result) => {
        if (!userScoresMap[result.user_id]) {
          userScoresMap[result.user_id] = {
            user_id: result.user_id,
            score: 0,
          };
        }
        userScoresMap[result.user_id].score += result.score;
      });
      const aggregatedScores = Object.values(userScoresMap);
      const userIds = aggregatedScores
        .map((item) => item.user_id)
        .filter((id) => id);

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await _supabase
          .from("profiles")
          .select("id, username, team")
          .in("id", userIds);
        if (profilesError) {
          console.error(
            "Error fetching profiles for leaderboard:",
            profilesError
          );
          finalAggregatedData = aggregatedScores.map((item) => ({
            ...item,
            profile: { username: "Unknown", team: "N/A" },
          }));
        } else {
          const profilesMap = {};
          (profilesData || []).forEach((profile) => {
            profilesMap[profile.id] = profile;
          });
          finalAggregatedData = aggregatedScores.map((item) => ({
            ...item,
            profile: profilesMap[item.user_id] || {
              username: "Unknown",
              team: "N/A",
            },
          }));
        }
      } else {
        finalAggregatedData = [];
      }
    }
    leaderboardData = finalAggregatedData
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.LEADERBOARD_SIZE);
    isLocal = false;
  } catch (e) {
    console.error("Error loading leaderboard:", e);
    queryError = e;

    if (!currentUser) {
      try {
        leaderboardData = JSON.parse(
          localStorage.getItem("wordleLeaderboard") || "[]"
        );
        leaderboardData = leaderboardData
          .slice(0, CONFIG.LEADERBOARD_SIZE)
          .map((item) => ({ ...item, score: item.score }));
        isLocal = true;

        if (leaderboardTitle)
          leaderboardTitle.textContent = "Guest Leaderboard";
      } catch (localError) {
        console.error("Error loading local leaderboard fallback:", localError);
        leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-error p-4">Failed to load leaderboard. ${
          queryError?.message || ""
        }</td></tr>`;
        return;
      }
    } else {
      leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-error p-4">Failed to load leaderboard. ${
        queryError?.message || ""
      }</td></tr>`;
      return;
    }
  } finally {
    updateLeaderboardDisplayGlobal(leaderboardData, isLocal);
  }
}

function updateLeaderboardDisplayGlobal(leaderboardData = [], isLocal = false) {
  const leaderboardBody = document.getElementById("leaderboard-body");
  if (!leaderboardBody) return;
  leaderboardBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  if (!leaderboardData || leaderboardData.length === 0) {
    const row = document.createElement("tr");
    const categoryFilter =
      document.getElementById("leaderboard-category-filter")?.value || "all";
    const difficultyFilter =
      document.getElementById("leaderboard-difficulty-filter")?.value || "all";
    let message = "No scores recorded yet!";
    if (categoryFilter !== "all" || difficultyFilter !== "all") {
      message = "No scores found for this filter.";
    }
    message += ` ${
      isLocal
        ? "(Guest)"
        : '<a href="auth.html" class="text-primary hover:underline">Log in</a> to compete!'
    }`;
    row.innerHTML = `<td colspan="4" class="text-center text-text-muted p-4">${message}</td>`;
    fragment.appendChild(row);
  } else {
    leaderboardData.forEach((entry, index) => {
      const rank = index + 1;
      const displayName = isLocal
        ? entry.name || "Guest"
        : entry.profile?.username || "Unknown User";
      const team = isLocal ? "N/A" : entry.profile?.team || "N/A";
      const score = entry.score || 0;
      const isCurrentUser =
        typeof currentUser !== "undefined" &&
        currentUser &&
        currentUser.id === entry.user_id;
      const row = document.createElement("tr");
      row.className = `${index % 2 === 0 ? "bg-input-bg/50" : ""} ${
        isCurrentUser ? "bg-primary/20 font-semibold" : ""
      }`;
      row.innerHTML = `
                 <td class="px-4 py-2 text-center">${rank}</td>
                 <td class="px-4 py-2 ${
                   isCurrentUser ? "text-primary" : ""
                 }">${displayName}${isLocal ? " (Guest)" : ""}</td>
                 <td class="px-4 py-2 text-center font-semibold">${score}</td>
                 <td class="px-4 py-2 capitalize text-center ${
                   team === "red"
                     ? "text-red-400"
                     : team === "blue"
                     ? "text-blue-400"
                     : ""
                 }">${team}</td>
             `;
      fragment.appendChild(row);
    });
  }
  leaderboardBody.appendChild(fragment);
}

async function loadAndDisplayTeamLeaderboard() {
  const teamBody = document.getElementById("team-leaderboard-body");
  if (!teamBody) return;
  if (
    typeof currentUser === "undefined" ||
    !currentUser ||
    typeof _supabase === "undefined" ||
    !_supabase
  ) {
    updateTeamLeaderboardDisplay(null);
    return;
  }
  teamBody.innerHTML = `<tr><td colspan="2" class="text-center text-text-muted py-4">Loading team scores...</td></tr>`;
  try {
    const { data, error } = await _supabase
      .from("profiles")
      .select(`id, team`)
      .neq("team", null);
    if (error) throw error;

    const teamScores = { blue: 0, red: 0 };

    if (data) {
      const { data: blueScores, error: blueError } = await _supabase
        .from("game_stats")
        .select(`total_score`)
        .in(
          "user_id",
          data.filter((user) => user.team === "blue").map((user) => user.id)
        );
      if (blueError) throw blueError;
      if (blueScores) {
        teamScores.blue = blueScores.reduce(
          (sum, item) => sum + item.total_score,
          0
        );
      }

      const { data: redScores, error: redError } = await _supabase
        .from("game_stats")
        .select(`total_score`)
        .in(
          "user_id",
          data.filter((user) => user.team === "red").map((user) => user.id)
        );
      if (redError) throw redError;
      if (redScores) {
        teamScores.red = redScores.reduce(
          (sum, item) => sum + item.total_score,
          0
        );
      }
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

  if (typeof currentUser !== "undefined" && currentUser && teamScores) {
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
  } else if (
    typeof currentUser !== "undefined" &&
    currentUser &&
    teamScores === undefined
  ) {
    teamBody.innerHTML = `<tr><td colspan="2" class="text-center text-error py-4">Error loading team scores.</td></tr>`;
  } else {
    teamBody.innerHTML = `<tr><td colspan="2" class="text-center text-text-muted py-4"><a href="auth.html" class="text-primary hover:underline">Log in</a> and join a team to see standings!</td></tr>`;
  }
}
