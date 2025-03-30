let _supabase;
const { createClient } = supabase;
let currentUser = null;
let userProfile = null;

const authContainer = document.getElementById("auth-container");
const loginFormContainer = document.getElementById("login-form-container");
const signupFormContainer = document.getElementById("signup-form-container");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const signInButton = document.getElementById("signIn");
const signUpButton = document.getElementById("signUp");
const switchToLoginMobileLink = document.getElementById("switchToLoginMobile");
const switchToSignUpMobileLink = document.getElementById(
  "switchToSignUpMobile"
);
const signupUsernameInput = document.getElementById("signup-username");
const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const signupTeamSelect = document.getElementById("signup-team");
const signupCountryInput = document.getElementById("signup-country");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const signupSubmitButton = document.getElementById("signup-button");
const loginSubmitButton = document.getElementById("login-button");
const signupMessage = document.getElementById("signup-message");
const loginMessage = document.getElementById("login-message");
const forgotPasswordLink = document.getElementById("forgot-password-link");
const resetRequestSection = document.getElementById("reset-request-section");
const resetRequestForm = document.getElementById("reset-request-form");
const resetEmailInput = document.getElementById("reset-email-input");
const sendResetLinkButton = document.getElementById("send-reset-link-button");
const resetRequestMessage = document.getElementById("reset-request-message");
const closeResetRequestButton = document.getElementById("close-reset-request");
const resetUpdateSection = document.getElementById("reset-update-section");
const resetUpdateForm = document.getElementById("reset-update-form");
const newPasswordInput = document.getElementById("new-password-input");
const confirmPasswordInput = document.getElementById("confirm-password-input");
const updatePasswordButton = document.getElementById("update-password-button");
const resetUpdateMessage = document.getElementById("reset-update-message");
const continueAsGuestLink = document.getElementById("continue-as-guest");

function showMessage(element, message, isError = true) {
  if (!element) return;
  element.textContent = message;
  element.className = `auth-message ${isError ? "error" : "success"}`;
  element.style.display = "block";
}

function clearMessages() {
  if (signupMessage) {
    signupMessage.style.display = "none";
    signupMessage.textContent = "";
  }
  if (loginMessage) {
    loginMessage.style.display = "none";
    loginMessage.textContent = "";
  }
  if (resetRequestMessage) {
    resetRequestMessage.style.display = "none";
    resetRequestMessage.textContent = "";
  }
  if (resetUpdateMessage) {
    resetUpdateMessage.style.display = "none";
    resetUpdateMessage.textContent = "";
  }
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

function showLoginForm() {
  if (!authContainer) return;
  authContainer.classList.remove("right-panel-active");
  if (window.innerWidth < 768 && loginFormContainer && signupFormContainer) {
    loginFormContainer.style.display = "flex";
    signupFormContainer.style.display = "none";
  }
  clearMessages();
}

function showSignUpForm() {
  if (!authContainer) return;
  authContainer.classList.add("right-panel-active");
  if (window.innerWidth < 768 && loginFormContainer && signupFormContainer) {
    signupFormContainer.style.display = "flex";
    loginFormContainer.style.display = "none";
  }
  clearMessages();
}

if (signInButton) signInButton.addEventListener("click", showLoginForm);
if (signUpButton) signUpButton.addEventListener("click", showSignUpForm);
if (switchToLoginMobileLink)
  switchToLoginMobileLink.addEventListener("click", (e) => {
    e.preventDefault();
    showLoginForm();
  });
if (switchToSignUpMobileLink)
  switchToSignUpMobileLink.addEventListener("click", (e) => {
    e.preventDefault();
    showSignUpForm();
  });

if (authContainer && loginFormContainer && signupFormContainer) {
  if (window.innerWidth >= 768) {
    loginFormContainer.style.display = "flex";
    signupFormContainer.style.display = "flex";
  } else {
    showLoginForm();
  }
}

async function initializeSupabase() {
  try {
    const response = await fetch("/.netlify/functions/get-supabase-config");
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "Failed to parse error response from config endpoint.",
      }));
      throw new Error(
        `Failed to fetch Supabase config: ${response.status} ${
          response.statusText
        } - ${errorData.error || "Unknown server error"}`
      );
    }
    const config = await response.json();
    if (!config.url || !config.key) {
      throw new Error("Invalid config received from server.");
    }
    _supabase = createClient(config.url, config.key);

    const {
      data: { session: initialSession },
      error: initialError,
    } = await _supabase.auth.getSession();
    if (initialError) {
      console.error("Error getting initial session:", initialError);
    }
    currentUser = initialSession?.user ?? null;
    if (currentUser) {
      await fetchUserProfile(currentUser.id);
    }

    if (authContainer) {
      enableAuthForms();
      setupAuthFormListeners();
    }
    setupAuthStateListener();
  } catch (error) {
    console.error("Supabase Initialization Error (from auth.js):", error);
    if (loginMessage) {
      showMessage(
        loginMessage,
        `Error initializing application: ${error.message}. Please try again later or contact support.`,
        true
      );
    }
  }
}

async function fetchUserProfile(userId) {
  if (!_supabase || !userId) {
    userProfile = null;
    return;
  }
  try {
    const { data, error, status } = await _supabase
      .from("profiles")
      .select("username, team")
      .eq("id", userId)
      .single();

    if (error && status !== 406) {
      console.error("Error fetching user profile:", error);
      userProfile = null;
    } else {
      userProfile = data;
      console.log("User profile fetched in auth.js:", userProfile);
    }
  } catch (error) {
    console.error("Exception fetching user profile in auth.js:", error);
    userProfile = null;
  }
}

function enableAuthForms() {
  if (loginSubmitButton) loginSubmitButton.disabled = false;
  if (signupSubmitButton) signupSubmitButton.disabled = false;
  if (sendResetLinkButton) sendResetLinkButton.disabled = false;
  if (updatePasswordButton) updatePasswordButton.disabled = false;
}

function setupAuthFormListeners() {
  const appBaseUrl = window.location.origin;
  const redirectUrl = `${appBaseUrl}/auth.html`;

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      clearMessages();
      if (resetRequestSection) {
        resetRequestSection.style.display = "flex";
        if (resetEmailInput) {
          resetEmailInput.value = "";
          resetEmailInput.focus();
        }
      }
    });
  }

  if (closeResetRequestButton) {
    closeResetRequestButton.addEventListener("click", () => {
      if (resetRequestSection) resetRequestSection.style.display = "none";
    });
  }

  if (resetRequestSection) {
    resetRequestSection.addEventListener("click", (e) => {
      if (e.target === resetRequestSection) {
        resetRequestSection.style.display = "none";
      }
    });
  }

  if (resetRequestForm) {
    resetRequestForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!sendResetLinkButton || !resetEmailInput || !resetRequestMessage)
        return;
      clearMessages();
      setLoading(sendResetLinkButton, true);
      const email = resetEmailInput.value.trim();
      if (!email) {
        showMessage(resetRequestMessage, "Please enter your email address.");
        setLoading(sendResetLinkButton, false);
        return;
      }
      try {
        const { error } = await _supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) console.error("Password Reset Request Error:", error);
        showMessage(
          resetRequestMessage,
          "If an account exists for this email, a password reset link has been sent.",
          false
        );
        if (sendResetLinkButton) sendResetLinkButton.disabled = true;
        setTimeout(() => {
          if (resetRequestSection) resetRequestSection.style.display = "none";
          if (sendResetLinkButton) sendResetLinkButton.disabled = false;
          setLoading(sendResetLinkButton, false);
        }, 5000);
      } catch (err) {
        console.error("Unexpected Password Reset Request Error:", err);
        showMessage(
          resetRequestMessage,
          "An unexpected error occurred. Please try again later."
        );
      } finally {
        if (sendResetLinkButton && !sendResetLinkButton.disabled)
          setLoading(sendResetLinkButton, false);
      }
    });
  }

  if (resetUpdateForm) {
    resetUpdateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (
        !newPasswordInput ||
        !confirmPasswordInput ||
        !updatePasswordButton ||
        !resetUpdateMessage
      )
        return;
      clearMessages();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      if (newPassword.length < 6) {
        showMessage(
          resetUpdateMessage,
          "Password must be at least 6 characters long."
        );
        return;
      }
      if (newPassword !== confirmPassword) {
        showMessage(resetUpdateMessage, "Passwords do not match.");
        return;
      }
      setLoading(updatePasswordButton, true);
      try {
        const { data, error } = await _supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          console.error("Password Update Error:", error);
          let userMessage = error.message;
          if (error.message.includes("expired"))
            userMessage =
              "The password reset link has expired. Please request a new one.";
          else if (error.message.includes("same password"))
            userMessage =
              "New password cannot be the same as the old password.";
          showMessage(
            resetUpdateMessage,
            `Failed to update password: ${userMessage}`
          );
        } else {
          showMessage(
            resetUpdateMessage,
            "Password updated successfully! You can now log in.",
            false
          );
          setTimeout(() => {
            if (resetUpdateSection) resetUpdateSection.style.display = "none";
            if (authContainer) authContainer.style.display = "block";
            showLoginForm();
          }, 3000);
        }
      } catch (err) {
        console.error("Unexpected Password Update Error:", err);
        showMessage(
          resetUpdateMessage,
          "An unexpected error occurred. Please try again."
        );
      } finally {
        setLoading(updatePasswordButton, false);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (
        !signupSubmitButton ||
        !signupUsernameInput ||
        !signupEmailInput ||
        !signupPasswordInput ||
        !signupTeamSelect ||
        !signupCountryInput ||
        !signupMessage
      )
        return;
      clearMessages();
      setLoading(signupSubmitButton, true);
      const username = signupUsernameInput.value.trim();
      const email = signupEmailInput.value.trim();
      const password = signupPasswordInput.value;
      const team = signupTeamSelect.value;
      const country = signupCountryInput.value;
      if (!username || !email || !password || !team) {
        showMessage(signupMessage, "Please fill in all required fields.");
        setLoading(signupSubmitButton, false);
        return;
      }
      if (password.length < 6) {
        showMessage(
          signupMessage,
          "Password must be at least 6 characters long."
        );
        setLoading(signupSubmitButton, false);
        return;
      }
      if (username.length < 3) {
        showMessage(
          signupMessage,
          "Username must be at least 3 characters long."
        );
        setLoading(signupSubmitButton, false);
        return;
      }
      try {
        const { data, error } = await _supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { username: username, team: team, country: country || null },
          },
        });
        if (error) {
          console.error("Sign up error:", error);
          let userMessage = error.message;
          if (error.message.includes("User already registered"))
            userMessage =
              "An account with this email already exists. Try logging in.";
          else if (
            error.message.includes("Password should be at least 6 characters")
          )
            userMessage = "Password is too short (minimum 6 characters).";
          else if (
            error.message.includes(
              "duplicate key value violates unique constraint"
            ) &&
            error.message.includes("username")
          )
            userMessage =
              "This username is already taken. Please choose another.";
          else if (
            error.message.includes(
              "duplicate key value violates unique constraint"
            )
          )
            userMessage =
              "An account or profile constraint failed. Please check your details.";
          showMessage(signupMessage, userMessage);
        } else if (data.user) {
          if (data.user.identities && data.user.identities.length === 0) {
            showMessage(
              signupMessage,
              "Sign up successful! Please check your email to confirm your account.",
              false
            );
            signupForm.reset();
          } else {
            showMessage(
              signupMessage,
              "Sign up successful! Redirecting...",
              false
            );
            setTimeout(() => {
              window.location.href = "index.html";
            }, 1500);
            signupForm.reset();
          }
        } else {
          showMessage(
            signupMessage,
            "An unexpected issue occurred during sign up."
          );
        }
      } catch (err) {
        console.error("Unexpected sign up exception:", err);
        if (
          err.message &&
          err.message.includes("duplicate key value") &&
          err.message.includes("profiles_username_key")
        ) {
          showMessage(
            signupMessage,
            "This username is already taken. Please choose another."
          );
        } else {
          showMessage(
            signupMessage,
            "An unexpected error occurred. Please try again."
          );
        }
      } finally {
        setLoading(signupSubmitButton, false);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (
        !loginSubmitButton ||
        !loginEmailInput ||
        !loginPasswordInput ||
        !loginMessage
      )
        return;
      clearMessages();
      setLoading(loginSubmitButton, true);
      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;
      if (!email || !password) {
        showMessage(loginMessage, "Please enter both email and password.");
        setLoading(loginSubmitButton, false);
        return;
      }
      try {
        const { data, error } = await _supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) {
          console.error("Login error:", error);
          if (error.message.includes("Invalid login credentials"))
            showMessage(loginMessage, "Incorrect email or password.");
          else if (error.message.includes("Email not confirmed"))
            showMessage(
              loginMessage,
              "Please confirm your email address first. Check your inbox."
            );
          else showMessage(loginMessage, `Login failed: ${error.message}`);
        } else if (data.user) {
          showMessage(loginMessage, "Login successful! Redirecting...", false);
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1000);
          loginForm.reset();
        } else {
          showMessage(
            loginMessage,
            "An unexpected issue occurred during login."
          );
        }
      } catch (err) {
        console.error("Unexpected login exception:", err);
        showMessage(
          loginMessage,
          "An unexpected error occurred. Please try again."
        );
      } finally {
        setLoading(loginSubmitButton, false);
      }
    });
  }

  const guestLink = document.querySelector('a[href="index.html"]');
  if (guestLink) {
    guestLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentUser) {
        console.log("User logged in, redirecting to index as user.");
        window.location.href = "index.html";
      } else {
        console.log("Continuing as guest.");
        window.location.href = "index.html";
      }
    });
  }
}

function setupAuthStateListener() {
  if (!_supabase) return;

  _supabase.auth.onAuthStateChange(async (event, session) => {
    const currentPage = window.location.pathname.split("/").pop();
    const isAuthPage = currentPage === "auth.html";
    const isAccountPage = currentPage === "account.html";
    const isIndexPage = currentPage === "index.html" || currentPage === "";

    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const type = urlParams.get("type");
    const isRecovery = type === "recovery";

    const prevUser = currentUser;
    currentUser = session?.user ?? null;

    console.log(
      "Auth State Change:",
      event,
      "| Session:",
      !!session,
      "| Page:",
      currentPage,
      "| Recovery:",
      isRecovery,
      "| Type:",
      type
    );

    if (
      event === "PASSWORD_RECOVERY" ||
      (event === "SIGNED_IN" && isRecovery && isAuthPage)
    ) {
      console.log("Password recovery flow detected.");
      if (resetUpdateSection) {
        console.log("Showing password reset update section.");
        clearMessages();
        resetUpdateSection.style.display = "flex";
        if (authContainer) authContainer.style.display = "none";
        if (newPasswordInput) newPasswordInput.focus();

        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      } else {
        console.warn(
          "Password recovery event on auth page, but resetUpdateSection not found."
        );
      }

      if (event === "PASSWORD_RECOVERY") return;
    }

    if (session) {
      console.log("User is logged in.");
      if (!userProfile || (prevUser && session.user.id !== prevUser.id)) {
        await fetchUserProfile(session.user.id);
      }

      if (isAuthPage) {
        console.log("Redirecting logged-in user FROM auth.html TO index.html.");
        window.location.href = "index.html";
      } else {
        console.log(
          `User logged in on ${currentPage}. No redirect needed from auth.js.`
        );
      }
    } else {
      console.log("User is logged out or session is null.");
      userProfile = null;

      if (isAccountPage) {
        console.log(
          "Redirecting logged-out user FROM account.html TO auth.html."
        );
        window.location.href = "auth.html";
      } else if (isAuthPage) {
        console.log(
          "User logged out and on auth page. Ensuring forms are visible."
        );
        if (authContainer) authContainer.style.display = "block";
        if (resetUpdateSection) resetUpdateSection.style.display = "none";
        showLoginForm();
      } else if (isIndexPage) {
        console.log(
          "User logged out on index page (Guest). Allowing access, game.js will handle UI."
        );
      } else {
        console.log(
          `Logged out on unknown/protected page (${currentPage}). Redirecting to auth.html.`
        );
      }
    }
  });
}

function setupCountrySearch(inputId, resultsId, hiddenInputId, wrapperId) {
  const searchInput = document.getElementById(inputId);
  const resultsList = document.getElementById(resultsId);
  const hiddenInput = document.getElementById(hiddenInputId);
  const wrapper = document.getElementById(wrapperId);
  if (!searchInput || !resultsList || !hiddenInput || !wrapper) return;
  if (typeof countries === "undefined") {
    console.error(
      "Countries array not found. Make sure countries.js is loaded before this script."
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

const signupCountrySearchInput = document.getElementById(
  "country-search-input-signup"
);
if (signupCountrySearchInput) {
  setupCountrySearch(
    "country-search-input-signup",
    "country-results-list-signup",
    "signup-country",
    "country-search-wrapper-signup"
  );
}

document.addEventListener("DOMContentLoaded", initializeSupabase);
