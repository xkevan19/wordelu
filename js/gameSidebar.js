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
      li.className =
        "bg-black bg-opacity-20 rounded-lg p-2 px-3 truncate text-white";
      const achievementName =
        typeof a === "string" ? a : a.name || "Achievement";
      li.textContent = `${ACHIEVEMENTS[a.id]?.icon || "🏅"} ${achievementName}`;
      li.title = achievementName;
      l.appendChild(li);
    });
  } else {
    l.innerHTML =
      '<li class="bg-black bg-opacity-20 rounded-lg p-2 px-3 italic text-text-muted">None yet. Log in to track!</li>';
  }
}
