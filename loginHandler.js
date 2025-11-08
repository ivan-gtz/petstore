// --- Login/Logout Logic ---
import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { loadLoginAttempts, saveLoginAttempts, clearLoginAttempts } from './storage.js'; // Keep for brute-force

const LOGIN_STATE_KEY = 'loggedInUser'; // Use sessionStorage for temporary login state

// Brute-force protection settings
const MAX_FAILED_ATTEMPTS = 7;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour

export function initLoginHandler(onLoginSuccess) {
    const loginForm = document.getElementById('login-form');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const togglePasswordButton = document.getElementById('toggle-password-visibility');
    const eyeOpenIcon = document.getElementById('eye-open');
    const eyeClosedIcon = document.getElementById('eye-closed');

    if (!loginForm || !loginUsernameInput || !loginPasswordInput || !loginErrorMsg || !togglePasswordButton || !eyeOpenIcon || !eyeClosedIcon) {
        console.error('Login form or password toggle elements not found. Login handler not fully initialized.');
        return;
    }

    togglePasswordButton.addEventListener('click', function() {
        const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPasswordInput.setAttribute('type', type);
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

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const email = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();

        loginErrorMsg.textContent = '';

        if (!email || !password) {
            loginErrorMsg.textContent = 'Por favor, introduce correo y contraseña.';
            return;
        }

        let attemptsData = loadLoginAttempts(email);
        const now = Date.now();

        if (attemptsData.lockoutUntil > now) {
            const timeLeft = Math.ceil((attemptsData.lockoutUntil - now) / 1000 / 60);
            loginErrorMsg.textContent = `Demasiados intentos fallidos. Por favor, espera aproximadamente ${timeLeft} minutos.`;
            loginPasswordInput.value = '';
            return;
        } else if (attemptsData.lockoutUntil > 0 && attemptsData.lockoutUntil <= now) {
            attemptsData = { attempts: 0, lockoutUntil: 0 };
            saveLoginAttempts(email, attemptsData);
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            loginErrorMsg.textContent = '';
            clearLoginAttempts(email);

            // Check user role from Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            let role = 'client'; // Default role

            if (userDoc.exists()) {
                role = userDoc.data().role;
            } else {
                // If user doc doesn't exist, check if they are the first user.
                const usersCollection = collection(db, "users");
                const usersSnapshot = await getDocs(usersCollection);
                if (usersSnapshot.empty) {
                    // First user becomes admin
                    role = 'admin';
                }
                // Create the user document
                await setDoc(userDocRef, { email: user.email, role: role });
            }

            storeLoginState({ name: user.email, role: role, uid: user.uid });

            onLoginSuccess();
            loginForm.reset();
            console.log(`Login successful for user "${user.email}" with role "${role}".`);

        } catch (error) {
            console.warn(`Login failed for user "${email}":`, error.code);
            
            attemptsData.attempts = (attemptsData.attempts || 0) + 1;

            if (attemptsData.attempts >= MAX_FAILED_ATTEMPTS) {
                attemptsData.lockoutUntil = now + LOCKOUT_DURATION_MS;
                saveLoginAttempts(email, attemptsData);
                const timeLeft = Math.ceil(LOCKOUT_DURATION_MS / 1000 / 60);
                loginErrorMsg.textContent = `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por ${timeLeft} minutos.`;
            } else {
                saveLoginAttempts(email, attemptsData);
                const remainingAttempts = MAX_FAILED_ATTEMPTS - attemptsData.attempts;
                
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        loginErrorMsg.textContent = `Correo o contraseña incorrectos. Te quedan ${remainingAttempts} intento(s).`;
                        break;
                    case 'auth/invalid-email':
                        loginErrorMsg.textContent = 'El formato del correo electrónico no es válido.';
                        break;
                    default:
                        loginErrorMsg.textContent = 'Error al iniciar sesión. Inténtalo de nuevo.';
                        break;
                }
            }
            loginPasswordInput.value = '';
        }
    });

    console.log('Login handler initialized with Firebase Auth and Firestore roles.');
}

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

export function isAdmin() {
    const loginState = getLoginState();
    return loginState && loginState.role === 'admin';
}