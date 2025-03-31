async function loadAndDisplayAchievements() {
  if (
    typeof currentUser !== "undefined" &&
    currentUser &&
    typeof _supabase !== "undefined" &&
    _supabase
  ) {
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
      if (typeof showToast === "function")
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

  if (
    typeof currentUser !== "undefined" &&
    currentUser &&
    userAchievements !== null &&
    achievementsList
  ) {
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
  } else if (
    typeof currentUser === "undefined" ||
    (!currentUser && guestMessage)
  ) {
    guestMessage.classList.remove("hidden");
    if (achievementsList) achievementsList.classList.add("hidden");
  }
}
