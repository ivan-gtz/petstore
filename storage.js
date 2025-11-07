// --- Data Storage (localStorage) ---
// Note: localStorage is client-side and browser-specific.
// Data saved here will persist only in the user's current browser
// and will NOT be available on other devices or if the user clears their browser data.
// For persistence across devices or on a hosting, a server-side database is required.

const STORAGE_KEY_PET_PREFIX = 'petProfileData_'; // Prefix for user-specific pet data
const STORAGE_KEY_GALLERY_PREFIX = 'galleryData_'; // Prefix for user-specific gallery data
const STORAGE_KEY_DOCS_PREFIX = 'docsData_'; // Prefix for user-specific documents data
const USERS_STORAGE_KEY = 'userData'; // Stores user credentials (demo)
const LOGIN_ATTEMPTS_PREFIX = 'loginAttempts_'; // Prefix for failed login attempts data
const ADMIN_CONTACT_STORAGE_KEY = 'adminContactNumber'; // Key for storing admin WhatsApp number
const ADMIN_WEBSITE_STORAGE_KEY = 'adminWebsiteURL'; // New key for storing admin website URL
const APP_NAME_STORAGE_KEY = 'appName'; // New key for storing app name

// New admin-managed limit keys (global defaults, editable via admin control)
const ADMIN_GALLERY_LIMIT_KEY = 'adminGalleryLimit';
const ADMIN_DOC_LIMIT_KEY = 'adminDocLimit';

// New per-user limit key prefixes
const USER_GALLERY_LIMIT_PREFIX = 'userGalleryLimit_';
const USER_DOC_LIMIT_PREFIX = 'userDocLimit_';

// --- Define Limits ---
export const MAX_GALLERY_ITEMS = 10;
export const MAX_DOC_ITEMS = 10;
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
export function saveAdminDocLimit(limit) {
    try { 
        localStorage.setItem(ADMIN_DOC_LIMIT_KEY, String(Number(limit))); 
        console.log('Admin doc limit saved:', limit); 
    } catch (e) { 
        console.error('Error saving admin doc limit:', e); 
    }
}
export function loadAdminDocLimit() {
    try {
        const v = parseInt(localStorage.getItem(ADMIN_DOC_LIMIT_KEY), 10);
        return Number.isInteger(v) && v > 0 ? v : MAX_DOC_ITEMS;
    } catch (e) { 
        console.error('Error loading admin doc limit:', e); 
        return MAX_DOC_ITEMS; 
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
export function saveUserDocLimit(username, limit) {
    if (!username) { console.error('saveUserDocLimit: username required'); return; }
    try {
        localStorage.setItem(USER_DOC_LIMIT_PREFIX + username, String(Number(limit)));
        console.log(`Doc limit saved for user "${username}":`, limit);
    } catch (e) {
        console.error('Error saving user doc limit:', e);
    }
}
export function loadUserDocLimit(username) {
    if (!username) return null;
    try {
        const v = parseInt(localStorage.getItem(USER_DOC_LIMIT_PREFIX + username), 10);
        return Number.isInteger(v) && v > 0 ? v : null;
    } catch (e) {
        console.error('Error loading user doc limit:', e);
        return null;
    }
}

// Modified functions to include username for pet data
export function savePetToLocalStorage(username, petData) {
    if (!username) {
        console.error('Cannot save pet data: username is required.');
        return;
    }
    const userStorageKey = STORAGE_KEY_PET_PREFIX + username;
    try {
        localStorage.setItem(userStorageKey, JSON.stringify(petData));
        console.log(`Pet data saved for user "${username}" to localStorage`);
    } catch (e) {
        console.error(`Error saving pet data for user "${username}" to localStorage:`, e);
        // Provide user feedback if storage is full or restricted
        if (e.name === 'QuotaExceededError') {
            alert('Error: Storage limit reached. Cannot save pet data. Please delete some data or try again.');
        } else {
            alert('Error saving pet data.');
        }
    }
}

export function loadPetFromLocalStorage(username) {
    if (!username) {
         console.warn('Cannot load pet data: username is required.');
         return null;
    }
    const userStorageKey = STORAGE_KEY_PET_PREFIX + username;
    try {
        const data = localStorage.getItem(userStorageKey);
        const petData = data ? JSON.parse(data) : null;
        // console.log(`Pet data loaded for user "${username}" from localStorage`, petData); // Avoid spamming console on every load
        return petData;
    } catch (e) {
        console.error(`Error loading pet data for user "${username}" from localStorage:`, e);
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

// --- Gallery Storage (modified for username and limit) ---
export function saveGalleryItemToLocalStorage(username, item) {
    if (!username) {
        console.error('Cannot save gallery item: username is required.');
        return false; // Indicate failure
    }
    const userStorageKey = STORAGE_KEY_GALLERY_PREFIX + username;
    try {
        const gallery = loadGalleryFromLocalStorage(username); // Load for the specific user

        // --- Limit Check (use per-user if present, otherwise admin-configurable limit) ---
        const userLimit = loadUserGalleryLimit(username);
        const galleryLimit = Number.isInteger(userLimit) && userLimit > 0 ? userLimit : loadAdminGalleryLimit();
        if (gallery.length >= galleryLimit) {
            console.warn(`Gallery limit (${galleryLimit}) reached for user "${username}". Cannot save item "${item.name}".`);
            return false; // Indicate failure due to limit
        }
        // --- End Limit Check ---

        gallery.push(item);
        localStorage.setItem(userStorageKey, JSON.stringify(gallery));
        console.log(`Gallery item saved for user "${username}" to localStorage`);
        return true; // Indicate success
    } catch (e) {
        console.error(`Error saving gallery item for user "${username}" to localStorage:`, e);
        if (e.name === 'QuotaExceededError') {
            alert('Error: Storage limit reached. Cannot save gallery item. Please try saving smaller images or delete some existing ones.');
        } else {
            alert('Error saving gallery item.');
        }
        return false; // Indicate failure
    }
}

export function loadGalleryFromLocalStorage(username) {
    if (!username) {
        console.warn('Cannot load gallery data: username is required.');
        return []; // Return empty array if username is missing
    }
    const userStorageKey = STORAGE_KEY_GALLERY_PREFIX + username;
    try {
        const data = localStorage.getItem(userStorageKey);
        const parsedData = data ? JSON.parse(data) : [];
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (e) {
        console.error(`Error loading gallery data for user "${username}" from localStorage:`, e);
        return [];
    }
}

// Function to delete a gallery item (by data URL for simplicity)
export function deleteGalleryItemFromLocalStorage(username, itemToDelete) {
     if (!username) {
         console.error('Cannot delete gallery item: username is required.');
         return;
     }
     const userStorageKey = STORAGE_KEY_GALLERY_PREFIX + username;
    try {
        let gallery = loadGalleryFromLocalStorage(username); // Load for the specific user
        // Filter out the item based on data URL (assuming data URL is unique enough for this demo)
        // Also filter by name in case dataUrl is missing or duplicates occur
        gallery = gallery.filter(item => !(item.name === itemToDelete.name && item.dataUrl === itemToDelete.dataUrl));
        localStorage.setItem(userStorageKey, JSON.stringify(gallery));
        console.log(`Gallery item deleted for user "${username}" from localStorage`);
    } catch (e) {
         console.error(`Error deleting gallery item for user "${username}" from localStorage:`, e);
         alert('Error deleting gallery item.');
    }
}

// --- Documents Storage (modified for username and saving Data URL) ---
export function saveDocItemToLocalStorage(username, item) {
     if (!username) {
         console.error('Cannot save document item: username is required.');
         return false; // Indicate failure
     }
    const userStorageKey = STORAGE_KEY_DOCS_PREFIX + username;
    try {
        const docs = loadDocsFromLocalStorage(username); // Load for the specific user
        // --- Limit Check (use per-user if present, otherwise admin-configurable limit) ---
        const userLimit = loadUserDocLimit(username);
        const docsLimit = Number.isInteger(userLimit) && userLimit > 0 ? userLimit : loadAdminDocLimit();
        if (docs.length >= docsLimit) {
            console.warn(`Documents limit (${docsLimit}) reached for user "${username}". Cannot save item "${item.name}".`);
            return false; // Indicate failure due to limit
        }
        // --- End Limit Check ---
        docs.push(item); // Item now includes dataUrl
        localStorage.setItem(userStorageKey, JSON.stringify(docs));
        console.log(`Document item saved for user "${username}" to localStorage`);
         return true; // Indicate success
    } catch (e) {
        console.error(`Error saving document item for user "${username}" to localStorage:`, e);
        if (e.name === 'QuotaExceededError') {
            alert('Error: Storage limit reached. Cannot save document item. Please try saving smaller files or delete some existing ones.');
        } else {
            alert('Error saving document item.');
        }
         return false; // Indicate failure
    }
}

export function loadDocsFromLocalStorage(username) {
     if (!username) {
         console.warn('Cannot load document data: username is required.');
         return []; // Return empty array if username is missing
     }
    const userStorageKey = STORAGE_KEY_DOCS_PREFIX + username;
    try {
        const data = localStorage.getItem(userStorageKey);
        const parsedData = data ? JSON.parse(data) : [];
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (e) {
        console.error(`Error loading document data for user "${username}" from localStorage:`, e);
        return [];
    }
}

// Function to delete a document item (by name and dataUrl if available)
export function deleteDocItemFromLocalStorage(username, itemToDelete) {
    if (!username) {
        console.error('Cannot delete document item: username is required.');
        return;
    }
     const userStorageKey = STORAGE_KEY_DOCS_PREFIX + username;
    try {
        let docs = loadDocsFromLocalStorage(username); // Load for the specific user
        // Filter out the item based on name and dataUrl (more robust)
        docs = docs.filter(item => !(item.name === itemToDelete.name && item.dataUrl === itemToDelete.dataUrl));
        localStorage.setItem(userStorageKey, JSON.stringify(docs));
        console.log(`Document item deleted for user "${username}" from localStorage`);
    } catch (e) {
         console.error(`Error deleting document item for user "${username}" from localStorage:`, e);
         alert('Error deleting document item.');
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

// --- Admin Contact Storage ---
export function saveAdminContact(contactNumber) {
     try {
         localStorage.setItem(ADMIN_CONTACT_STORAGE_KEY, contactNumber.trim());
         console.log('Admin contact number saved to localStorage.');
     } catch (e) {
         console.error('Error saving admin contact number to localStorage:', e);
         if (e.name === 'QuotaExceededError') {
             alert('Error: Storage limit reached. Cannot save admin contact.');
         } else {
             alert('Error saving admin contact.');
         }
     }
}

export function loadAdminContact() {
     try {
         const contact = localStorage.getItem(ADMIN_CONTACT_STORAGE_KEY);
         return contact || ''; // Return empty string if not found
     } catch (e) {
         console.error('Error loading admin contact number from localStorage:', e);
         return ''; // Return empty string on error
     }
}

export function saveAdminWebsite(websiteUrl) {
    try {
        localStorage.setItem(ADMIN_WEBSITE_STORAGE_KEY, websiteUrl.trim());
        console.log('Admin website URL saved to localStorage.');
    } catch (e) {
        console.error('Error saving admin website URL to localStorage:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Error: Storage limit reached. Cannot save admin website URL.');
        } else {
            alert('Error saving admin website URL.');
        }
    }
}

export function loadAdminWebsite() {
    try {
        const websiteUrl = localStorage.getItem(ADMIN_WEBSITE_STORAGE_KEY);
        return websiteUrl || ''; // Return empty string if not found
    } catch (e) {
        console.error('Error loading admin website URL from localStorage:', e);
        return ''; // Return empty string on error
    }
}

// --- App Name Storage (for shared view branding) ---
export function saveAppName(appName) {
    try {
        localStorage.setItem(APP_NAME_STORAGE_KEY, appName.trim());
        console.log(`App name saved: ${appName}`);
    } catch (e) {
        console.error('Error saving app name to localStorage:', e);
    }
}

export function loadAppName() {
    try {
        return localStorage.getItem(APP_NAME_STORAGE_KEY) || 'Caneko'; // Default to "Caneko"
    } catch (e) {
        console.error('Error loading app name from localStorage:', e);
        return 'Caneko'; // Return default on error
    }
}