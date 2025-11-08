// storage.js

// Función para guardar datos en localStorage
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving data for key ${key}:`, error);
    }
}


const USERS_STORAGE_KEY = 'userData'; // Stores user credentials (demo)
const LOGIN_ATTEMPTS_PREFIX = 'loginAttempts_'; // Prefix for failed login attempts data

// New admin-managed limit keys (global defaults, editable via admin control)
const ADMIN_GALLERY_LIMIT_KEY = 'adminGalleryLimit';

// New per-user limit key prefixes
const USER_GALLERY_LIMIT_PREFIX = 'userGalleryLimit_';

// --- Define Limits ---
export const MAX_GALLERY_ITEMS = 12;
// --- End Limits ---

// --- Admin-managed limit helpers (persisted in localStorage) ---
export function saveAdminGalleryLimit(limit) {
    try { 
        localStorage.setItem(ADMIN_GALLERY_LIMIT_KEY, String(Number(limit))); 
        console.log('Admin gallery limit saved:', limit); 
    } catch (e) { 
        console.error('Error saving admin gallery limit:', e); 
    }
}
export function loadAdminGalleryLimit() {
    try {
        const v = parseInt(localStorage.getItem(ADMIN_GALLERY_LIMIT_KEY), 10);
        return Number.isInteger(v) && v > 0 ? v : MAX_GALLERY_ITEMS;
    } catch (e) { 
        console.error('Error loading admin gallery limit:', e); 
        return MAX_GALLERY_ITEMS; 
    }
}

// --- Per-user limit helpers ---
export function saveUserGalleryLimit(username, limit) {
    if (!username) { console.error('saveUserGalleryLimit: username required'); return; }
    try {
        localStorage.setItem(USER_GALLERY_LIMIT_PREFIX + username, String(Number(limit)));
        console.log(`Gallery limit saved for user "${username}":`, limit);
    } catch (e) {
        console.error('Error saving user gallery limit:', e);
    }
}
export function loadUserGalleryLimit(username) {
    if (!username) return null;
    try {
        const v = parseInt(localStorage.getItem(USER_GALLERY_LIMIT_PREFIX + username), 10);
        return Number.isInteger(v) && v > 0 ? v : null;
    } catch (e) {
        console.error('Error loading user gallery limit:', e);
        return null;
    }
}



// --- User Storage (for demo login) ---
// Note: This stores username/password pairs for demo purposes. Passwords are NOT hashed!
// Modified to include 'active', 'startDate', 'expiryDate' status.
export function saveUsersToLocalStorage(usersData) {
    try {
        // Ensure only name, email, password, active, startDate, expiryDate are saved for each user object
        const usersToSave = usersData.map(user => ({
            name: user.name,
            email: user.email || '',
            password: user.password,
            active: user.active !== undefined ? user.active : true, // Default to true if missing
            startDate: user.startDate || '', // Ensure field exists, default empty string
            expiryDate: user.expiryDate || '' // Ensure field exists, default empty string
        }));

        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersToSave));
        console.log('User data saved to localStorage');
    } catch (e) {
        console.error('Error saving users to localStorage:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Error: Storage limit reached. Cannot save user data.');
        } else {
            alert('Error saving user data.');
        }
    }
}

export function loadUsersFromLocalStorage() {
    try {
        const data = localStorage.getItem(USERS_STORAGE_KEY);
        const parsedData = data ? JSON.parse(data) : [];
        // Ensure it's an array and each user has required properties (defaulting if missing)
        return Array.isArray(parsedData) ?
               parsedData.map(user => ({
                   name: user.name,
                   email: user.email || '',
                   password: user.password,
                   active: user.active !== undefined ? user.active : true, // Default to true
                   startDate: user.startDate || '', // Default to empty string
                   expiryDate: user.expiryDate || '' // Default to empty string
               }))
               : [];
    } catch (e) {
        console.error('Error loading users from localStorage:', e);
        return [];
    }
}

// --- Login Attempts Storage ---
export function saveLoginAttempts(username, attemptsData) {
     if (!username) {
         console.error('Cannot save login attempts: username is required.');
         return;
     }
     const userStorageKey = LOGIN_ATTEMPTS_PREFIX + username;
     try {
         localStorage.setItem(userStorageKey, JSON.stringify(attemptsData));
         // console.log(`Login attempts saved for user "${username}"`, attemptsData); // Avoid excessive logging
     } catch (e) {
         console.error(`Error saving login attempts for user "${username}" to localStorage:`, e);
         // No alert here, as it might happen during a failed login attempt, which is already handled.
     }
}

export function loadLoginAttempts(username) {
     if (!username) {
         console.warn('Cannot load login attempts: username is required.');
         return { attempts: 0, lockoutUntil: 0 };
     }
     const userStorageKey = LOGIN_ATTEMPTS_PREFIX + username;
     try {
         const data = localStorage.getItem(userStorageKey);
         const parsedData = data ? JSON.parse(data) : { attempts: 0, lockoutUntil: 0 };
         // Ensure it's a valid object structure
         return {
             attempts: typeof parsedData.attempts === 'number' ? parsedData.attempts : 0,
             lockoutUntil: typeof parsedData.lockoutUntil === 'number' ? parsedData.lockoutUntil : 0
         };
     } catch (e) {
         console.error(`Error loading login attempts for user "${username}" from localStorage:`, e);
         return { attempts: 0, lockoutUntil: 0 }; // Return default on error
     }
}

export function clearLoginAttempts(username) {
    if (!username) {
        console.warn('Cannot clear login attempts: username is required.');
        return;
    }
    const userStorageKey = LOGIN_ATTEMPTS_PREFIX + username;
     try {
        localStorage.removeItem(userStorageKey);
        console.log(`Login attempts cleared for user "${username}"`);
     } catch (e) {
         console.error(`Error clearing login attempts for user "${username}" from localStorage:`, e);
     }
}