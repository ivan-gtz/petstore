// --- Ajustes Section Logic ---
import { isAdmin, getLoginState } from './loginHandler.js';
import { loadUsersFromLocalStorage, saveUsersToLocalStorage } from './storage.js'; // Keep user storage for password changes
import { db } from './firebase-init.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


const THEME_STORAGE_KEY = 'themePreference'; // Key for storing theme preference
const ADMIN_USERNAME = 'adminmas';

// --- Firestore Document Reference ---
const appConfigRef = doc(db, "settings", "appConfig");

// --- Theme functions (remain with localStorage) ---
export function loadThemePreference() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
}
function saveThemePreference(theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
}
export function applyTheme(theme) {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    if (!body) return;
    if (theme === 'dark') {
        body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true;
    } else {
        body.classList.remove('dark-theme');
        if (themeToggle) themeToggle.checked = false;
    }
}

// --- App Config Fetcher from Firestore ---
async function getAppConfig() {
    try {
        const docSnap = await getDoc(appConfigRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            // Return a default structure if the document doesn't exist
            return { adminContact: '', adminWebsite: '', appName: 'Caneko' };
        }
    } catch (error) {
        console.error("Error fetching app config from Firestore:", error);
        return { adminContact: '', adminWebsite: '', appName: 'Caneko' }; // Return default on error
    }
}


export function initSettingsSection() {
    const settingsForm = document.getElementById('settings-form');
    const adminSettingsDiv = document.getElementById('admin-settings');
    const adminSettingsForm = document.getElementById('admin-settings-form');
    const adminSettingsErrorMsg = document.getElementById('admin-settings-error-msg');
    const adminSettingsSuccessMsg = document.getElementById('admin-settings-success-msg');
    const themeToggle = document.getElementById('theme-toggle');
    const adminContactNumberInput = document.getElementById('admin-contact-number');
    const adminWebsiteInput = document.getElementById('admin-website-input');

    if (settingsForm) {
        settingsForm.addEventListener('submit', (event) => event.preventDefault());
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            const theme = this.checked ? 'dark' : 'light';
            applyTheme(theme);
            saveThemePreference(theme);
        });
    }

    if (adminSettingsForm) {
        adminSettingsForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            adminSettingsErrorMsg.textContent = '';
            adminSettingsSuccessMsg.textContent = '';

            if (!isAdmin()) {
                adminSettingsErrorMsg.textContent = 'Acceso denegado.';
                return;
            }

            const currentPasswordInput = document.getElementById('current-admin-password');
            const newPasswordInput = document.getElementById('new-admin-password');
            const currentPassword = currentPasswordInput.value.trim();
            const newPassword = newPasswordInput.value.trim();
            const newContactNumber = adminContactNumberInput.value.trim();
            const newWebsiteURL = adminWebsiteInput.value.trim();

            let passwordUpdated = false;
            let configUpdated = false;

            // Password update logic (remains using localStorage)
            if (newPassword) {
                if (!currentPassword) {
                    adminSettingsErrorMsg.textContent = 'Debes introducir la contraseña actual para cambiarla.';
                    return;
                }
                let users = loadUsersFromLocalStorage();
                const adminUserIndex = users.findIndex(user => user.name === ADMIN_USERNAME);
                if (adminUserIndex === -1) {
                    adminSettingsErrorMsg.textContent = 'Error: Usuario administrador no encontrado.';
                    return;
                }
                if (users[adminUserIndex].password !== currentPassword) {
                    adminSettingsErrorMsg.textContent = 'Contraseña actual incorrecta.';
                    return;
                }
                users[adminUserIndex].password = newPassword;
                saveUsersToLocalStorage(users);
                passwordUpdated = true;
            }

            // App config update logic (using Firestore)
            const currentConfig = await getAppConfig();
            if (newContactNumber !== currentConfig.adminContact || newWebsiteURL !== currentConfig.adminWebsite) {
                try {
                    await setDoc(appConfigRef, {
                        adminContact: newContactNumber,
                        adminWebsite: newWebsiteURL
                    }, { merge: true });
                    configUpdated = true;
                } catch (error) {
                    console.error("Error updating app config:", error);
                    adminSettingsErrorMsg.textContent = 'Error al guardar la configuración.';
                    return;
                }
            }

            if (passwordUpdated || configUpdated) {
                let successMsg = '';
                if (passwordUpdated) successMsg += 'Contraseña actualizada. ';
                if (configUpdated) successMsg += 'Configuración de la aplicación actualizada.';
                adminSettingsSuccessMsg.textContent = successMsg.trim();
                populateAdminContactButton();
                populateMainWebsiteButton();
            } else {
                adminSettingsErrorMsg.textContent = 'No se detectaron cambios.';
            }

            currentPasswordInput.value = '';
            newPasswordInput.value = '';
        });
    }

    document.querySelectorAll('.settings-group h2').forEach((h, i) => {
        if (h.querySelector('.settings-h2-icon')) return;
        let emoji = '⚙️';
        if (h.textContent.includes('Tema')) emoji = '🌓';
        else if (h.textContent.includes('Usuario')) emoji = '👤';
        else if (h.textContent.includes('Administrador')) emoji = '🔒';
        else if (h.textContent.includes('Contacto')) emoji = '💬';
        else if (h.textContent.includes('Sitio Web')) emoji = '🌐';
        h.insertAdjacentHTML('afterbegin', `<span class="settings-h2-icon" aria-hidden="true" style="margin-right:10px;">${emoji}</span>`);
    });
}

export async function loadSettings() {
    const userNameInput = document.getElementById('user-name');
    const adminSettingsDiv = document.getElementById('admin-settings');
    const adminSettingsForm = document.getElementById('admin-settings-form');
    const adminContactNumberInput = document.getElementById('admin-contact-number');
    const adminWebsiteInput = document.getElementById('admin-website-input');
    const themeToggle = document.getElementById('theme-toggle');

    const currentUser = getLoginState();
    if (userNameInput) {
        userNameInput.value = currentUser ? `Hola, ${currentUser.name}!` : 'Usuario No Identificado';
        userNameInput.setAttribute('readonly', true);
        const saveBtn = document.querySelector('#settings-form button[type="submit"]');
        if (saveBtn) saveBtn.style.display = 'none';
    }

    if (themeToggle) {
        themeToggle.checked = (loadThemePreference() === 'dark');
    }

    if (adminSettingsDiv && adminSettingsForm) {
        if (isAdmin()) {
            adminSettingsDiv.style.display = 'block';
            adminSettingsForm.querySelector('#current-admin-password').value = '';
            adminSettingsForm.querySelector('#new-admin-password').value = '';
            
            const config = await getAppConfig();
            adminContactNumberInput.value = config.adminContact || '';
            adminWebsiteInput.value = config.adminWebsite || '';
        } else {
            adminSettingsDiv.style.display = 'none';
        }
    }

    populateAdminContactButton();
    populateMainWebsiteButton();
}

async function populateAdminContactButton() {
    const container = document.getElementById('admin-whatsapp-button-container');
    const notConfiguredMsg = document.getElementById('admin-whatsapp-not-configured');
    if (!container || !notConfiguredMsg) return;

    container.innerHTML = '';
    const config = await getAppConfig();
    const contact = config.adminContact;

    if (contact && contact.trim()) {
        notConfiguredMsg.style.display = 'none';
        const link = document.createElement('a');
        const phoneNumberClean = contact.replace(/[^0-9+]/g, '');
        link.href = `https://wa.me/${phoneNumberClean}`;
        link.textContent = 'Contactar por WhatsApp';
        link.target = '_blank';
        link.className = 'save-btn';
        container.appendChild(link);
    } else {
        notConfiguredMsg.style.display = 'block';
    }
}

async function populateMainWebsiteButton() {
    const container = document.getElementById('main-website-button-container');
    const notConfiguredMsg = document.getElementById('main-website-not-configured');
    if (!container || !notConfiguredMsg) return;

    container.innerHTML = '';
    const config = await getAppConfig();
    const website = config.adminWebsite;

    if (website && website.trim()) {
        notConfiguredMsg.style.display = 'none';
        const link = document.createElement('a');
        const safeUrl = website.startsWith('http') ? website : `https://${website}`;
        link.href = safeUrl;
        link.textContent = 'Ir al Sitio Web Principal';
        link.target = '_blank';
        link.className = 'save-btn';
        container.appendChild(link);
    } else {
        notConfiguredMsg.style.display = 'block';
    }
}