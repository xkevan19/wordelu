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

function showWordleMenuView() {
  console.log("Showing Wordle Menu View");
  const menuContainer = document.getElementById("menu-container");
  const gameContainer = document.getElementById("game-container");
  if (menuContainer) menuContainer.classList.remove("hidden");
  if (gameContainer) gameContainer.classList.add("hidden");
  document.getElementById("sections-display-area")?.classList.remove("hidden");
  hideAllSections();
  document.getElementById("main-menu-input-card")?.classList.remove("hidden");
  document.getElementById("menu-buttons-container")?.classList.remove("hidden");
  document
    .getElementById("back-to-menu-from-sections-btn")
    ?.classList.add("hidden");
  if (typeof currentUser !== "undefined" && currentUser) {
    if (typeof handleLoggedInState === "function") handleLoggedInState();
  } else {
    if (typeof handleGuestState === "function") handleGuestState();
  }
  if (typeof loadAndDisplayInitialData === "function")
    loadAndDisplayInitialData();
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
  document.getElementById("sections-display-area")?.classList.add("hidden");
}

function hideAllSections() {
  const sectionsArea = document.getElementById("sections-display-area");
  if (sectionsArea) {
    Array.from(sectionsArea.children).forEach((child) => {
      if (
        child.id &&
        (child.id.endsWith("-section") ||
          child.id === "back-to-menu-from-sections-btn")
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
  const backButton = document.getElementById("back-to-menu-from-sections-btn");
  if (sectionToShow) sectionToShow.classList.remove("hidden");
  if (backButton) backButton.classList.remove("hidden");

  if (
    sectionId === "leaderboard-section" &&
    typeof loadAndDisplayLeaderboard === "function"
  )
    loadAndDisplayLeaderboard();
  else if (
    sectionId === "statistics-section" &&
    typeof loadAndDisplayStatistics === "function"
  )
    loadAndDisplayStatistics();
  else if (
    sectionId === "achievements-section" &&
    typeof loadAndDisplayAchievements === "function"
  )
    loadAndDisplayAchievements();
  else if (
    sectionId === "team-leaderboard-section" &&
    typeof loadAndDisplayTeamLeaderboard === "function"
  )
    loadAndDisplayTeamLeaderboard();
}

function showMenuFromSections() {
  hideAllSections();
  document.getElementById("main-menu-input-card")?.classList.remove("hidden");
  document.getElementById("menu-buttons-container")?.classList.remove("hidden");
}
