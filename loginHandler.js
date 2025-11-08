// --- Login/Logout Logic ---
import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
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
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            clearLoginAttempts(email);

            const userDocRef = doc(db, "users", user.uid);
            let userDoc = await getDoc(userDocRef);
            let userData;

            if (!userDoc.exists()) {
                console.log(`User document for ${user.uid} not found, creating one.`);
                const usersCollection = collection(db, "users");
                const usersSnapshot = await getDocs(usersCollection);
                const isFirstUser = usersSnapshot.empty;
                
                const newUserProfile = {
                    email: user.email,
                    name: '', // Default empty name
                    role: isFirstUser ? 'admin' : 'client',
                    active: true,
                    expiryDate: '', // Default empty expiry
                    startDate: new Date().toISOString().split('T')[0]
                };
                
                await setDoc(userDocRef, newUserProfile);
                userDoc = await getDoc(userDocRef); // Re-fetch the document
            }
            
            userData = userDoc.data();

            // --- Authorization Checks ---
            if (userData.active === false) {
                loginErrorMsg.textContent = 'Tu cuenta está inactiva. Contacta al administrador.';
                await signOut(auth); // Sign out from Firebase Auth
                return;
            }

            if (userData.expiryDate && new Date(userData.expiryDate) < new Date()) {
                loginErrorMsg.textContent = 'Tu cuenta ha caducado. Contacta al administrador.';
                await signOut(auth); // Sign out from Firebase Auth
                return;
            }
            // --- End Authorization Checks ---

            const sessionData = {
                uid: user.uid,
                email: user.email,
                name: userData.name || user.email, // Fallback to email if name is empty
                role: userData.role || 'client'
            };

            storeLoginState(sessionData);
            onLoginSuccess();
            loginForm.reset();
            console.log(`Login successful for user "${sessionData.email}" with role "${sessionData.role}".`);

        } catch (error) {
            console.warn(`Login failed for user "${email}":`, error.code);
            
            attemptsData.attempts = (attemptsData.attempts || 0) + 1;
            if (attemptsData.attempts >= MAX_FAILED_ATTEMPTS) {
                attemptsData.lockoutUntil = now + LOCKOUT_DURATION_MS;
                loginErrorMsg.textContent = `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada.`;
            } else {
                loginErrorMsg.textContent = 'Correo o contraseña incorrectos.';
            }
            saveLoginAttempts(email, attemptsData);
            loginPasswordInput.value = '';
        }
    });

    console.log('Login handler initialized with Firebase Auth and extended Firestore profile checks.');
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