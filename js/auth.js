let _supabase;
const { createClient } = supabase;

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

function showMessage(element, message, isError = true) {
  if (!element) return;
  element.textContent = message;
  element.className = `auth-message ${isError ? "error" : "success"}`;
  element.style.display = "block";
}
function clearMessages() {
  if (signupMessage) signupMessage.style.display = "none";
  if (loginMessage) loginMessage.style.display = "none";
  if (resetRequestMessage) resetRequestMessage.style.display = "none";
  if (resetUpdateMessage) resetUpdateMessage.style.display = "none";
  if (signupMessage) signupMessage.textContent = "";
  if (loginMessage) loginMessage.textContent = "";
  if (resetRequestMessage) resetRequestMessage.textContent = "";
  if (resetUpdateMessage) resetUpdateMessage.textContent = "";
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
  authContainer.classList.remove("right-panel-active");
  if (window.innerWidth < 768) {
    loginFormContainer.style.display = "flex";
    signupFormContainer.style.display = "none";
  }
  clearMessages();
}
function showSignUpForm() {
  authContainer.classList.add("right-panel-active");
  if (window.innerWidth < 768) {
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
if (window.innerWidth >= 768) {
  loginFormContainer.style.display = "flex";
  signupFormContainer.style.display = "flex";
} else {
  showLoginForm();
}

async function initializeSupabase() {
  try {
    const response = await fetch("/.netlify/functions/get-supabase-config");
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({
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
    console.log("Supabase Client Initialized successfully.");

    enableForms();
    setupAuthStateListener();
    setupFormListeners();
  } catch (error) {
    console.error("Supabase Initialization Error:", error);
    showMessage(
      loginMessage,
      `Error initializing application: ${error.message}. Please try again later or contact support.`,
      true
    );
  }
}

function enableForms() {
  if (loginSubmitButton) loginSubmitButton.disabled = false;
  if (signupSubmitButton) signupSubmitButton.disabled = false;
  if (sendResetLinkButton) sendResetLinkButton.disabled = false;
  if (updatePasswordButton) updatePasswordButton.disabled = false;
}

function setupFormListeners() {
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
            )
          )
            userMessage =
              "This username is already taken. Please choose another.";
          showMessage(signupMessage, userMessage);
        } else if (data.user) {
          if (data.user.identities && data.user.identities.length === 0) {
            showMessage(
              signupMessage,
              "Sign up successful! Please check your email to confirm your account.",
              false
            );
          } else {
            showMessage(
              signupMessage,
              "Sign up successful! Redirecting...",
              false
            );
            setTimeout(() => {
              window.location.href = "index.html";
            }, 1500);
          }
          signupForm.reset();
        } else {
          showMessage(
            signupMessage,
            "An unexpected issue occurred during sign up."
          );
        }
      } catch (err) {
        console.error("Unexpected sign up exception:", err);
        showMessage(
          signupMessage,
          "An unexpected error occurred. Please try again."
        );
      } finally {
        setLoading(signupSubmitButton, false);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
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
}

function setupAuthStateListener() {
  if (!_supabase) return;

  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (resetRequestSection) resetRequestSection.style.display = "none";
    let isRecovery = window.location.hash.includes("type=recovery");

    if (
      event === "PASSWORD_RECOVERY" ||
      (event === "SIGNED_IN" && isRecovery)
    ) {
      clearMessages();
      if (resetUpdateSection) resetUpdateSection.style.display = "flex";
      if (authContainer) authContainer.style.display = "none";
      if (isRecovery)
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
    } else if (event === "SIGNED_IN") {
      if (window.location.pathname.includes("auth.html")) {
        window.location.href = "index.html";
      }
      if (authContainer) authContainer.style.display = "block";
      if (resetUpdateSection) resetUpdateSection.style.display = "none";
    } else if (event === "SIGNED_OUT") {
      if (authContainer) authContainer.style.display = "block";
      if (resetUpdateSection) resetUpdateSection.style.display = "none";
      showLoginForm();
    } else if (event === "INITIAL_SESSION") {
      if (isRecovery) {
        clearMessages();
        if (resetUpdateSection) resetUpdateSection.style.display = "flex";
        if (authContainer) authContainer.style.display = "none";
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      } else if (session && window.location.pathname.includes("auth.html")) {
        window.location.href = "index.html";
      } else if (!session) {
        if (authContainer) authContainer.style.display = "block";
        if (resetUpdateSection) resetUpdateSection.style.display = "none";
        showLoginForm();
      }
    }
  });
}

const countries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo, Democratic Republic of the",
  "Congo, Republic of the",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Korea, North",
  "Korea, South",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar (Burma)",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine State",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];
countries.sort();
function setupCountrySearch(inputId, resultsId, hiddenInputId, wrapperId) {
  const searchInput = document.getElementById(inputId);
  const resultsList = document.getElementById(resultsId);
  const hiddenInput = document.getElementById(hiddenInputId);
  const wrapper = document.getElementById(wrapperId);
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
setupCountrySearch(
  "country-search-input-signup",
  "country-results-list-signup",
  "signup-country",
  "country-search-wrapper-signup"
);

document.addEventListener("DOMContentLoaded", initializeSupabase);
