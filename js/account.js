let _supabase;
const { createClient } = supabase;

const logoutButton = document.getElementById("logout-button");
const profileForm = document.getElementById("profile-form");
const passwordForm = document.getElementById("password-form");
const profileUsernameInput = document.getElementById("profile-username");
const profileEmailInput = document.getElementById("profile-email");
const profileTeamSelect = document.getElementById("profile-team");
const profileCountryInput = document.getElementById("profile-country");
const countrySearchInput = document.getElementById("country-search-input");
const updateProfileButton = document.getElementById("update-profile-button");
const profileMessage = document.getElementById("profile-message");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmNewPasswordInput = document.getElementById("confirm-new-password");
const changePasswordButton = document.getElementById("change-password-button");
const passwordMessage = document.getElementById("password-message");

function showMessage(element, message, isError = true) {
  if (!element) return;
  element.textContent = message;
  element.className = `text-sm text-center ${
    isError ? "text-error" : "text-success"
  }`;
  element.style.display = "block";
}

function setLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-[2px] border-current border-t-transparent rounded-full" role="status" aria-label="loading"></span>`;
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

async function initializeSupabase() {
  try {
    const response = await fetch("/.netlify/functions/get-supabase-config");
    if (!response.ok) {
      throw new Error(`Failed to fetch Supabase config: ${response.status}`);
    }
    const config = await response.json();
    if (!config.url || !config.key) {
      throw new Error("Invalid Supabase config received");
    }
    _supabase = createClient(config.url, config.key);
    console.log("Supabase Client Initialized (from account.js).");

    const {
      data: { session },
      error,
    } = await _supabase.auth.getSession();

    if (error) {
      console.error("Error fetching session:", error);
      window.location.href = "auth.html";
      return;
    }

    if (!session) {
      console.log(
        "No active session found on account page, redirecting to auth."
      );
      window.location.href = "auth.html";
      return;
    }

    await loadUserProfile(session.user);
    enableAccountForms();

    _supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        console.log("Signed out detected on account page, redirecting.");
        window.location.href = "auth.html";
      }
    });
  } catch (error) {
    console.error("Supabase Initialization Error:", error);
    showMessage(
      profileMessage,
      `Error initializing application: ${error.message}`
    );
  }
}

function enableAccountForms() {
  if (updateProfileButton) updateProfileButton.disabled = false;
  if (changePasswordButton) changePasswordButton.disabled = false;
}

async function loadUserProfile(user) {
  if (!user) {
    console.log("No user provided to loadUserProfile, redirecting.");
    window.location.href = "auth.html";
    return;
  }
  if (
    !profileUsernameInput ||
    !profileEmailInput ||
    !profileTeamSelect ||
    !profileCountryInput ||
    !countrySearchInput
  ) {
    console.error("One or more profile form elements not found.");
    return;
  }

  try {
    const { data, error, status } = await _supabase
      .from("profiles")
      .select("username, team, country")
      .eq("id", user.id)
      .maybeSingle();

    if (error && status !== 406) throw error;

    if (data) {
      profileUsernameInput.value = data.username || "";
      profileEmailInput.value = user.email;

      if (profileTeamSelect) {
        profileTeamSelect.value = data.team || "";
        profileTeamSelect.disabled = true;
      }

      if (data.country) {
        profileCountryInput.value = data.country;
        countrySearchInput.value = data.country;
      } else {
        profileCountryInput.value = "";
        countrySearchInput.value = "";
      }
    } else {
      console.log("No profile found for user, using defaults.");
      profileEmailInput.value = user.email;
      profileUsernameInput.value = "";
      if (profileTeamSelect) {
        profileTeamSelect.value = "";
        profileTeamSelect.disabled = true;
      }
      profileCountryInput.value = "";
      countrySearchInput.value = "";
      showMessage(
        profileMessage,
        "Profile not fully set up yet. Please update.",
        false
      );
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    showMessage(profileMessage, `Error loading profile: ${error.message}`);
    if (user.email) profileEmailInput.value = user.email;
  }
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      !updateProfileButton ||
      !profileUsernameInput ||
      !profileCountryInput ||
      !profileMessage
    )
      return;
    clearMessages();
    setLoading(updateProfileButton, true);

    const username = profileUsernameInput.value.trim();
    const country = profileCountryInput.value;

    if (!username || username.length < 3) {
      showMessage(
        profileMessage,
        "Username must be at least 3 characters long."
      );
      setLoading(updateProfileButton, false);
      return;
    }

    try {
      const {
        data: { user },
      } = await _supabase.auth.getUser();
      if (!user) throw new Error("User not found. Please log in again.");

      const { error } = await _supabase
        .from("profiles")
        .update({ username, country: country || null })
        .eq("id", user.id);

      if (error) {
        let errorMessage = error.message;
        if (
          error.message.includes("duplicate key value") &&
          error.message.includes("username")
        ) {
          errorMessage =
            "This username is already taken. Please choose another.";
        }
        throw new Error(errorMessage);
      }

      showMessage(profileMessage, "Profile updated successfully!", false);
    } catch (error) {
      console.error("Profile Update Error:", error);
      showMessage(profileMessage, error.message);
    } finally {
      setLoading(updateProfileButton, false);
    }
  });
}

if (passwordForm) {
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      !changePasswordButton ||
      !currentPasswordInput ||
      !newPasswordInput ||
      !confirmNewPasswordInput ||
      !passwordMessage
    )
      return;
    clearMessages();
    setLoading(changePasswordButton, true);

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (!currentPassword) {
      showMessage(passwordMessage, "Please enter your current password.");
      setLoading(changePasswordButton, false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showMessage(passwordMessage, "New passwords do not match.");
      setLoading(changePasswordButton, false);
      return;
    }

    if (newPassword.length < 6) {
      showMessage(
        passwordMessage,
        "New password must be at least 6 characters long."
      );
      setLoading(changePasswordButton, false);
      return;
    }

    if (newPassword === currentPassword) {
      showMessage(
        passwordMessage,
        "New password cannot be the same as the current password."
      );
      setLoading(changePasswordButton, false);
      return;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await _supabase.auth.getUser();
      if (authError || !user) throw authError || new Error("User not found.");

      const { error: signInError } = await _supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          throw new Error("Current password is incorrect.");
        } else {
          throw new Error(`Verification failed: ${signInError.message}`);
        }
      }

      const { error: updateError } = await _supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      passwordForm.reset();
      showMessage(passwordMessage, "Password changed successfully!", false);
    } catch (error) {
      console.error("Password Change Error:", error);
      showMessage(passwordMessage, error.message);
    } finally {
      setLoading(changePasswordButton, false);
      if (currentPasswordInput) currentPasswordInput.value = "";
      if (newPasswordInput) newPasswordInput.value = "";
      if (confirmNewPasswordInput) confirmNewPasswordInput.value = "";
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";
    try {
      if (!_supabase) {
        console.error("Supabase not initialized during logout attempt.");

        logoutButton.disabled = false;
        logoutButton.textContent = "Logout";
        return;
      }
      const { error } = await _supabase.auth.signOut();
      if (error) throw error;
      console.log("Logout successful, auth state change will redirect.");
    } catch (error) {
      console.error("Logout Error:", error);
      showMessage(profileMessage, `Logout failed: ${error.message}`);
      logoutButton.disabled = false;
      logoutButton.textContent = "Logout";
    }
  });
}

function setupCountrySearch() {
  const searchInput = document.getElementById("country-search-input");
  const resultsList = document.getElementById("country-results-list");
  const hiddenInput = document.getElementById("profile-country");
  const wrapper = document.getElementById("country-search-wrapper");

  if (!searchInput || !resultsList || !hiddenInput || !wrapper) return;

  if (typeof countries === "undefined") {
    console.error(
      "Countries array not found. Make sure countries.js is loaded before account.js."
    );
    return;
  }

  function renderResults(filteredCountries) {
    resultsList.innerHTML = "";
    if (filteredCountries.length === 0 && searchInput.value.trim() !== "") {
      const noResultDiv = document.createElement("div");
      noResultDiv.textContent = "No countries found";
      noResultDiv.className = "px-4 py-3 text-text-muted text-sm no-results";
      resultsList.appendChild(noResultDiv);
      resultsList.classList.remove("hidden");
    } else if (filteredCountries.length > 0) {
      filteredCountries.forEach((country, index) => {
        const countryDiv = document.createElement("div");
        countryDiv.textContent = country;
        countryDiv.dataset.value = country;
        let classes =
          "px-4 py-3 cursor-pointer text-text-primary text-sm hover:bg-key-bg transition-colors duration-150 ease-in-out";
        if (index < filteredCountries.length - 1)
          classes += " border-b border-border-color";
        countryDiv.className = classes;
        countryDiv.addEventListener("click", () => {
          searchInput.value = country;
          hiddenInput.value = country;
          resultsList.classList.add("hidden");
        });
        resultsList.appendChild(countryDiv);
      });
      resultsList.classList.remove("hidden");
    } else resultsList.classList.add("hidden");
  }

  searchInput.addEventListener("input", () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchInput.value !== hiddenInput.value) {
      hiddenInput.value = "";
    }
    if (searchTerm === "") {
      resultsList.classList.add("hidden");
      resultsList.innerHTML = "";
      hiddenInput.value = "";
      return;
    }
    const filtered = countries.filter((c) =>
      c.toLowerCase().includes(searchTerm)
    );
    renderResults(filtered);
  });

  searchInput.addEventListener("focus", () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm !== "" && searchInput.value === hiddenInput.value) {
      const filtered = countries.filter((c) =>
        c.toLowerCase().includes(searchTerm)
      );
      renderResults(filtered);
    } else if (searchTerm !== "") {
      const filtered = countries.filter((c) =>
        c.toLowerCase().includes(searchTerm)
      );
      renderResults(filtered);
    } else resultsList.classList.add("hidden");
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (!hiddenInput.value) {
        searchInput.value = "";
      }
      if (!resultsList.contains(document.activeElement)) {
        resultsList.classList.add("hidden");
      }
    }, 150);
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) resultsList.classList.add("hidden");
  });
}

function clearMessages() {
  if (profileMessage) profileMessage.textContent = "";
  if (passwordMessage) passwordMessage.textContent = "";
  if (profileMessage) profileMessage.style.display = "none";
  if (passwordMessage) passwordMessage.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  initializeSupabase();
  setupCountrySearch();
});
