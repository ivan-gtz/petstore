// --- Login/Logout Logic ---
import { loadUsersFromLocalStorage, saveUsersToLocalStorage, loadLoginAttempts, saveLoginAttempts, clearLoginAttempts } from './storage.js'; // Ensure correct imports

const LOGIN_STATE_KEY = 'loggedInUser'; // Use sessionStorage for temporary login state

// Hardcoded admin user details for INITIAL setup and login role check
// NOTE: The password here is only the *initial* password. The actual password
// for the admin user is loaded from localStorage. The name 'adminmas' is FIXED
// and used to identify the admin user for role assignment.
const ADMIN_INITIAL_USER = { name: 'adminmas', password: 'mas123', active: true }; // Added active status

// Brute-force protection settings
const MAX_FAILED_ATTEMPTS = 7; // Total attempts allowed (0-indexed count means 6 failures lead to lockout on 7th attempt)
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Function to initialize login form listener
// Logout button listeners are now handled in app.js inside setupMainApp
export function initLoginHandler(onLoginSuccess) {
    const loginForm = document.getElementById('login-form');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    // Get the password toggle elements
    const togglePasswordButton = document.getElementById('toggle-password-visibility');
    const eyeOpenIcon = document.getElementById('eye-open');
    const eyeClosedIcon = document.getElementById('eye-closed');

    if (!loginForm || !loginUsernameInput || !loginPasswordInput || !loginErrorMsg || !togglePasswordButton || !eyeOpenIcon || !eyeClosedIcon) { // Check for new elements
        console.error('Login form or password toggle elements not found. Login handler not fully initialized.');
         // Log missing elements for debugging
         if (!loginForm) console.error('#login-form missing');
         if (!loginUsernameInput) console.error('#login-username missing');
         if (!loginPasswordInput) console.error('#login-password missing');
         if (!loginErrorMsg) console.error('#login-error-msg missing');
         if (!togglePasswordButton) console.error('#toggle-password-visibility missing'); // New log
         if (!eyeOpenIcon) console.error('#eye-open missing'); // New log
         if (!eyeClosedIcon) console.error('#eye-closed missing'); // New log
        return;
    }

    // --- Password Toggle Listener ---
    togglePasswordButton.addEventListener('click', function() {
        const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPasswordInput.setAttribute('type', type);

        // Toggle the eye icons visibility
        if (type === 'password') {
            eyeOpenIcon.style.display = 'block';
            eyeClosedIcon.style.display = 'none';
             togglePasswordButton.setAttribute('aria-label', 'Mostrar contraseña');
        } else {
            eyeOpenIcon.style.display = 'none';
            eyeClosedIcon.style.display = 'block';
             togglePasswordButton.setAttribute('aria-label', 'Ocultar contraseña');
        }
    });
    console.log('Password toggle listener initialized.');
    // --- End Password Toggle Listener ---


    // Ensure admin user exists in storage if it's empty or if the specific admin user is missing
    // This uses the fixed ADMIN_INITIAL_USER.name to identify the admin entry.
    ensureAdminUserExists();

    loginForm.addEventListener('submit', async function(event) { // Added async keyword
        event.preventDefault();

        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();

        loginErrorMsg.textContent = ''; // Clear previous messages

        if (!username || !password) {
            loginErrorMsg.textContent = 'Por favor, introduce usuario y contraseña.';
            return;
        }

        // --- Brute-force protection check ---
        let attemptsData = loadLoginAttempts(username);
        const now = Date.now();

        // If lockout is active and not expired
        if (attemptsData.lockoutUntil > now) {
            const timeLeft = Math.ceil((attemptsData.lockoutUntil - now) / 1000 / 60); // Time left in minutes
            loginErrorMsg.textContent = `Demasiados intentos fallidos. Por favor, espera aproximadamente ${timeLeft} minutos para intentar de nuevo.`;
            console.warn(`Login attempt blocked for user "${username}": Account locked until ${new Date(attemptsData.lockoutUntil).toLocaleString()}.`);
            loginPasswordInput.value = ''; // Clear password field
            return; // Stop the login process
        } else if (attemptsData.lockoutUntil > 0 && attemptsData.lockoutUntil <= now) {
             // Lockout expired, reset attempts count but keep the timestamp until a successful login?
             // Or just reset everything on expiration? Let's reset attempts, keep lockoutUntil 0.
             console.log(`Lockout expired for user "${username}". Resetting attempts.`);
             attemptsData = { attempts: 0, lockoutUntil: 0 };
             saveLoginAttempts(username, attemptsData); // Save reset state
        }
        // --- End brute-force protection check ---


        // Load current users from storage
        const users = loadUsersFromLocalStorage();

        // Find the user by the submitted username
        const foundUser = users.find(user => user.name === username);

        if (foundUser) {
            // Verify password against the found user's password in storage
            if (foundUser.password === password) {
                // --- Password matches, now check if user is active ---
                if (!foundUser.active) {
                    // User found and password correct, but account is inactive
                     console.warn(`Login failed for user "${username}": Account is inactive.`);
                     // Increment failed attempts for inactive users too? Or treat differently?
                     // Let's increment attempts to avoid leaking info about *why* it failed (inactive vs wrong password).
                     attemptsData.attempts = (attemptsData.attempts || 0) + 1;
                     saveLoginAttempts(username, attemptsData);

                     loginErrorMsg.textContent = 'Tu cuenta está desactivada. Contacta al administrador.';
                     loginPasswordInput.value = ''; // Clear password field
                     return; // Stop the login process

                } else {
                     // --- Successful Login (Active User) ---
                    loginErrorMsg.textContent = ''; // Clear error message

                    // Clear failed attempts data for this user on successful login
                    clearLoginAttempts(username);

                    // Determine role based on the submitted username matching the fixed admin name
                    const role = (username === ADMIN_INITIAL_USER.name) ? 'admin' : 'user';

                    // Store the logged-in user's *current* name and determined role in sessionStorage
                    storeLoginState({ name: foundUser.name, role: role });

                    onLoginSuccess(); // Callback to set up the main app
                    loginForm.reset(); // Clear form fields
                    console.log(`Login successful for user "${username}" with role "${role}".`);
                }

            } else {
                 // --- Password mismatch (Failed Login) ---
                 console.warn(`Login failed for user "${username}": Incorrect password.`);

                 // Increment failed attempts
                 attemptsData.attempts = (attemptsData.attempts || 0) + 1;

                 if (attemptsData.attempts >= MAX_FAILED_ATTEMPTS) {
                     // Lockout the user
                     attemptsData.lockoutUntil = now + LOCKOUT_DURATION_MS;
                     saveLoginAttempts(username, attemptsData);
                     const timeLeft = Math.ceil(LOCKOUT_DURATION_MS / 1000 / 60); // Time left in minutes (should be 60)
                     loginErrorMsg.textContent = `Demasiados intentos fallidos (${attemptsData.attempts} de ${MAX_FAILED_ATTEMPTS}). Por favor, espera aproximadamente ${timeLeft} minutos para intentar de nuevo.`; // Corrected typo
                      console.warn(`User "${username}" account locked for ${LOCKOUT_DURATION_MS / 1000 / 60} minutes.`);
                 } else {
                     // Display remaining attempts
                     const remainingAttempts = MAX_FAILED_ATTEMPTS - attemptsData.attempts;
                     loginErrorMsg.textContent = `Contraseña incorrecta. Te quedan ${remainingAttempts} intento(s).`;
                      saveLoginAttempts(username, attemptsData); // Save updated attempts count
                     console.log(`User "${username}" failed login. Attempts: ${attemptsData.attempts}/${MAX_FAILED_ATTEMPTS}`);
                 }
                 loginPasswordInput.value = ''; // Clear password field
            }
        } else {
            // --- User not found (Failed Login) ---
             console.warn(`Login failed: User "${username}" not found.`);

             // Increment failed attempts for the *entered* username (even if not found)
             // This prevents iterating through valid usernames to find one without a lockout.
             attemptsData.attempts = (attemptsData.attempts || 0) + 1;

            if (attemptsData.attempts >= MAX_FAILED_ATTEMPTS) {
                 attemptsData.lockoutUntil = now + LOCKOUT_DURATION_MS;
                 saveLoginAttempts(username, attemptsData);
                 const timeLeft = Math.ceil(LOCKOUT_DURATION_MS / 1000 / 60);
                 loginErrorMsg.textContent = `Demasiados intentos fallidos (${attemptsData.attempts} de ${MAX_FAILED_ATTEMPTS}). Por favor, espera aproximadamente ${timeLeft} minutos para intentar de nuevo.`;
                  console.warn(`Unknown user "${username}" account locked for ${LOCKOUT_DURATION_MS / 1000 / 60} minutes.`);
            } else {
                const remainingAttempts = MAX_FAILED_ATTEMPTS - attemptsData.attempts;
                 // Use a generic message for "user not found" to avoid leaking info about valid usernames
                 loginErrorMsg.textContent = `Usuario o contraseña incorrectos. Te quedan ${remainingAttempts} intento(s).`;
                 saveLoginAttempts(username, attemptsData);
                 console.log(`Unknown user "${username}" failed login. Attempts: ${attemptsData.attempts}/${MAX_FAILED_ATTEMPTS}`);
            }
            loginPasswordInput.value = ''; // Clear password field
        }
    });

    console.log('Login handler (form submit with brute-force protection) initialized.');
}

// Function to check if the admin user exists in storage if it's empty or if the specific admin user is missing
// This function ONLY cares about the hardcoded initial admin name ('adminmas')
function ensureAdminUserExists() {
    let users = loadUsersFromLocalStorage();
    // Check if ANY user exists with the fixed admin name
    const adminExists = users.some(user => user.name === ADMIN_INITIAL_USER.name);

    if (!adminExists) {
        // Only store name and password. The role is determined at login based on the name.
        const adminUserForStorage = { name: ADMIN_INITIAL_USER.name, password: ADMIN_INITIAL_USER.password, active: ADMIN_INITIAL_USER.active };
        users.push(adminUserForStorage);
        saveUsersToLocalStorage(users); // Save the initial admin user
        console.log(`Initial admin user "${ADMIN_INITIAL_USER.name}" added to storage if not present.`);
    } else {
        // Optional: Clean up any accidental role property if it was saved before
        const adminIndex = users.findIndex(user => user.name === ADMIN_INITIAL_USER.name);
        if (adminIndex !== -1) {
             if (users[adminIndex].hasOwnProperty('role')) {
                delete users[adminIndex].role;
                // Update active status if it exists or add it if missing
                users[adminIndex].active = users[adminIndex].active !== undefined ? users[adminIndex].active : ADMIN_INITIAL_USER.active;
                saveUsersToLocalStorage(users);
                console.log('Cleaned up admin user data in storage.');
             } else if (!users[adminIndex].hasOwnProperty('active')) {
                 // Just add the active status if it's missing
                 users[adminIndex].active = ADMIN_INITIAL_USER.active;
                 saveUsersToLocalStorage(users);
                 console.log('Added missing active status to admin user in storage.');
             }
        }
    }
}

// Functions to manage login state in sessionStorage
// Store role here as it's determined at login
function storeLoginState(user) {
    sessionStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(user));
    console.log('Login state stored:', user);
}

export function getLoginState() {
    const state = sessionStorage.getItem(LOGIN_STATE_KEY);
    return state ? JSON.parse(state) : null;
}

export function clearLoginState() {
    sessionStorage.removeItem(LOGIN_STATE_KEY);
    console.log('Login state cleared from sessionStorage.');
}

// Function to check if the current user stored in sessionStorage is admin
export function isAdmin() {
    const loginState = getLoginState();
    // Role is stored in sessionStorage for the current session, based on the username matching ADMIN_INITIAL_USER.name at login
    return loginState && loginState.role === 'admin';
}