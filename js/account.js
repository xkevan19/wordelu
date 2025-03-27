let _supabase;
const { createClient } = supabase;

// DOM Elements
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

// Message display function
function showMessage(element, message, isError = true) {
  if (!element) return;
  element.textContent = message;
  element.className = `text-sm text-center ${
    isError ? "text-error" : "text-success"
  }`;
}

// Loading state for buttons
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

// Initialize Supabase
async function initializeSupabase() {
  try {
    const response = await fetch("/.netlify/functions/get-supabase-config");
    if (!response.ok) {
      throw new Error(`Failed to fetch Supabase config: ${response.status}`);
    }
    const config = await response.json();
    _supabase = createClient(config.url, config.key);

    // Check authentication state
    const {
      data: { session },
      error,
    } = await _supabase.auth.getSession();
    if (error || !session) {
      window.location.href = "auth.html";
      return;
    }

    // Populate profile data
    await loadUserProfile(session.user);
  } catch (error) {
    console.error("Supabase Initialization Error:", error);
    showMessage(
      profileMessage,
      `Error initializing application: ${error.message}`
    );
  }
}

// Load user profile data
async function loadUserProfile(user) {
  try {
    const { data, error } = await _supabase
      .from("profiles")
      .select("username, team, country")
      .eq("uuid", user.id)
      .single();

    if (error) throw error;

    // Populate form fields
    profileUsernameInput.value = data.username || "";
    profileEmailInput.value = user.email;

    // Set team as read-only text with proper capitalization
    const teamMapping = {
      red: "Red Team",
      blue: "Blue Team",
    };
    profileTeamInput.value = teamMapping[data.team] || data.team;

    if (data.country) {
      profileCountryInput.value = data.country;
      countrySearchInput.value = data.country;
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    showMessage(profileMessage, `Error loading profile: ${error.message}`);
  }
}

// Update profile handler
if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(updateProfileButton, true);

    const username = profileUsernameInput.value.trim();
    const country = profileCountryInput.value;

    // Validate inputs
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

      // Update profile in Supabase
      const { error } = await _supabase
        .from("profiles")
        .update({
          username,
          country: country || null,
          // Prevent team change
        })
        .eq("uuid", user.id);

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes("duplicate key value")) {
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

// Change password handler
if (passwordForm) {
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(changePasswordButton, true);

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    // Validate inputs
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

    try {
      // Re-authenticate user first
      const {
        data: { user },
        error: authError,
      } = await _supabase.auth.getUser();
      if (authError) throw authError;

      // Attempt to sign in to verify current password
      const { error: signInError } = await _supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect.");
      }

      // Update password
      const { error } = await _supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Clear form and show success
      passwordForm.reset();
      showMessage(passwordMessage, "Password changed successfully!", false);
    } catch (error) {
      console.error("Password Change Error:", error);
      showMessage(passwordMessage, error.message);
    } finally {
      setLoading(changePasswordButton, false);
    }
  });
}

// Logout functionality
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      const { error } = await _supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "auth.html";
    } catch (error) {
      console.error("Logout Error:", error);
      showMessage(profileMessage, `Logout failed: ${error.message}`);
    }
  });
}

// Country search setup (similar to your existing implementation)
function setupCountrySearch() {
  const searchInput = document.getElementById("country-search-input");
  const resultsList = document.getElementById("country-results-list");
  const hiddenInput = document.getElementById("profile-country");
  const wrapper = document.getElementById("country-search-wrapper");

  if (!searchInput || !resultsList || !hiddenInput || !wrapper) return;

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
    hiddenInput.value = "";
    if (searchTerm === "") {
      resultsList.classList.add("hidden");
      resultsList.innerHTML = "";
      return;
    }
    const filtered = countries.filter((c) =>
      c.toLowerCase().includes(searchTerm)
    );
    renderResults(filtered);
  });

  searchInput.addEventListener("focus", () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm !== "") {
      const filtered = countries.filter((c) =>
        c.toLowerCase().includes(searchTerm)
      );
      renderResults(filtered);
    } else resultsList.classList.add("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) resultsList.classList.add("hidden");
  });
}

// Helper function to clear messages
function clearMessages() {
  if (profileMessage) profileMessage.textContent = "";
  if (passwordMessage) passwordMessage.textContent = "";
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initializeSupabase();
  setupCountrySearch();
});
