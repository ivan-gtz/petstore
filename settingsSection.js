// --- Ajustes Section Logic ---
import { isAdmin, getLoginState } from './loginHandler.js';
// Import user storage functions and new admin contact/website storage functions
import { loadUsersFromLocalStorage, saveUsersToLocalStorage, saveAdminContact, loadAdminContact, saveAdminWebsite, loadAdminWebsite, saveAppName, loadAppName } from './storage.js';

// Hardcoded admin name (must match the logic in loginHandler for role determination)
const ADMIN_USERNAME = 'adminmas';
const THEME_STORAGE_KEY = 'themePreference'; // Key for storing theme preference

// Function to load the user's theme preference from localStorage
export function loadThemePreference() {
    // Default to 'light' if no preference is saved
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
}

// Function to save the user's theme preference to localStorage
function saveThemePreference(theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// Function to apply the theme class to the body
export function applyTheme(theme) {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');

    if (!body) {
        console.error('Body element not found. Cannot apply theme.');
        return;
    }

    if (theme === 'dark') {
        body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true; // Set toggle state if dark
    } else {
        body.classList.remove('dark-theme');
        if (themeToggle) themeToggle.checked = false; // Set toggle state if light
    }
    console.log(`Applied theme: ${theme}`);
}

export function initSettingsSection() {
    const settingsForm = document.getElementById('settings-form');
    const adminSettingsDiv = document.getElementById('admin-settings'); // Get the admin settings div
    const adminSettingsForm = document.getElementById('admin-settings-form'); // Get the admin settings form
    const adminSettingsErrorMsg = document.getElementById('admin-settings-error-msg');
    const adminSettingsSuccessMsg = document.getElementById('admin-settings-success-msg');
    const themeToggle = document.getElementById('theme-toggle'); // Get the theme toggle checkbox

    // Get elements for admin contact and website
    const adminContactNumberInput = document.getElementById('admin-contact-number');
    const adminWhatsappButtonContainer = document.getElementById('admin-whatsapp-button-container');
    const notConfiguredMsg = document.getElementById('admin-whatsapp-not-configured');

    // Get elements for the new main website link
    const adminWebsiteInput = document.getElementById('admin-website-input'); // New admin input
    const mainWebsiteButtonContainer = document.getElementById('main-website-button-container'); // Container for the button
    const mainWebsiteNotConfiguredMsg = document.getElementById('main-website-not-configured'); // Not configured message for website
    const mainWebsiteSettingsGroup = document.getElementById('main-website-settings'); // The settings group div

    // --- Basic User Settings Form (Placeholder) ---
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const userNameInput = document.getElementById('user-name');
            const userName = userNameInput ? userNameInput.value : 'N/A';
            alert(`Settings saved! User Name: ${userName}`); // Placeholder action
            // In a real app, you'd save settings (e.g., to localStorage or a server)
        });
    } else {
        console.warn('Element #settings-form not found. Basic settings form logic skipped.');
    }

    // --- Theme Toggle Listener ---
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            const theme = this.checked ? 'dark' : 'light';
            applyTheme(theme); // Apply the theme
            saveThemePreference(theme); // Save the preference
        });
        console.log('Theme toggle listener initialized.');
    } else {
        console.warn('Theme toggle element (#theme-toggle) not found. Theme toggle logic skipped.');
    }

    // --- Admin Settings Form ---
    // The visibility of the admin section is controlled by loadSettings() which is called
    // when the section is shown via navigation.
    // Check for all admin-related elements including the new website input
    if (adminSettingsForm && adminSettingsErrorMsg && adminSettingsSuccessMsg && adminContactNumberInput && adminWebsiteInput) {
        adminSettingsForm.addEventListener('submit', function(event) {
            event.preventDefault();

            // Clear previous messages
            adminSettingsErrorMsg.textContent = '';
            adminSettingsSuccessMsg.textContent = '';

            // Double check if user is admin on submit (based on session state)
            if (!isAdmin()) {
                adminSettingsErrorMsg.textContent = 'Acceso denegado.';
                console.warn('Attempted admin settings submit by non-admin.');
                adminSettingsForm.reset();
                return;
            }

            const currentPasswordInput = document.getElementById('current-admin-password');
            const newPasswordInput = document.getElementById('new-admin-password');

            const currentPassword = currentPasswordInput.value.trim();
            const newPassword = newPasswordInput.value.trim();
            const newContactNumber = adminContactNumberInput.value.trim();
            const newWebsiteURL = adminWebsiteInput.value.trim(); // Get the new website URL

            let passwordUpdated = false;
            let contactUpdated = false;
            let websiteUpdated = false;

            // Password update logic (required if new password field is filled)
            if (newPassword !== '') {
                if (currentPassword === '') {
                    adminSettingsErrorMsg.textContent = 'Debes introducir la contraseña actual para cambiar la contraseña.';
                    return;
                }

                let users = loadUsersFromLocalStorage();
                const adminUserIndex = users.findIndex(user => user.name === ADMIN_USERNAME);

                if (adminUserIndex === -1) {
                    adminSettingsErrorMsg.textContent = 'Error interno: Usuario administrador no encontrado en almacenamiento.';
                    console.error('Admin user not found in localStorage during settings update.');
                    return;
                }

                if (users[adminUserIndex].password !== currentPassword) {
                    adminSettingsErrorMsg.textContent = 'Contraseña actual incorrecta.';
                    currentPasswordInput.value = '';
                    return;
                }

                if (newPassword === currentPassword) {
                    adminSettingsErrorMsg.textContent = 'La nueva contraseña es la misma que la actual.';
                    newPasswordInput.value = ''; // Clear the new password field
                } else {
                    users[adminUserIndex].password = newPassword;
                    saveUsersToLocalStorage(users); // Save updated users array
                    passwordUpdated = true;
                    console.log('Admin password updated.');
                }
            } else if (currentPassword !== '') {
                console.log('Current password entered but new password is empty.');
                // Optionally re-validate current password here if contact/website save requires auth.
                // For now, assuming contact/website save is permitted if admin is logged in.
            }

            // Contact number update logic (always attempt if admin)
            const currentContact = loadAdminContact();
            if (newContactNumber !== currentContact) {
                saveAdminContact(newContactNumber);
                contactUpdated = true;
                console.log('Admin contact number saved.');
            }

            // Website URL update logic (always attempt if admin)
            const currentWebsite = loadAdminWebsite();
            if (newWebsiteURL !== currentWebsite) {
                saveAdminWebsite(newWebsiteURL);
                websiteUpdated = true;
                console.log('Admin website URL saved.');
            }

            // Display success message based on what was updated
            if (passwordUpdated || contactUpdated || websiteUpdated) {
                let successMsg = '';
                if (passwordUpdated) successMsg += 'Contraseña actualizada. ';
                if (contactUpdated) successMsg += 'Contacto de WhatsApp actualizado. ';
                if (websiteUpdated) successMsg += 'Sitio web principal actualizado. ';

                adminSettingsSuccessMsg.textContent = successMsg.trim();

                // After saving admin contact/website, refresh the displayed link/button in the main settings area
                populateAdminContactButton(); // Refresh WhatsApp button
                populateMainWebsiteButton(); // Refresh Website button

            } else {
                adminSettingsErrorMsg.textContent = 'No se detectaron cambios para guardar.';
            }

            // Clear password fields after successful update
            currentPasswordInput.value = '';
            newPasswordInput.value = '';
            // Keep contact/website fields populated with the saved values after saving.
        });
        console.log('Admin settings form listener initialized.');
    } else {
        console.warn('Admin settings elements not fully found. Admin settings form logic skipped.');
        if (!adminSettingsForm) console.warn('#admin-settings-form missing');
        if (!adminSettingsErrorMsg) console.warn('#admin-settings-error-msg missing');
        if (!adminSettingsSuccessMsg) console.warn('#admin-settings-success-msg missing');
        if (!adminContactNumberInput) console.warn('#admin-contact-number missing');
        if (!adminWebsiteInput) console.warn('#admin-website-input missing'); // Log the new input
    }

    // --- Admin Contact Button ---
    // Creation is handled in loadSettings, but console log init state here
    if (!adminWhatsappButtonContainer || !notConfiguredMsg) {
        console.warn('Admin WhatsApp button container or "not configured" message not found. Admin contact button logic skipped.');
    } else {
        console.log('Admin contact elements found. Button will be created on section load.');
    }

    // --- Main Website Button ---
    // Creation is handled in loadSettings, but console log init state here
    if (!mainWebsiteButtonContainer || !mainWebsiteNotConfiguredMsg || !mainWebsiteSettingsGroup) { // Include the settings group div in the check
        console.warn('Main Website button elements not fully found. Main website button logic skipped.');
    } else {
        console.log('Main website elements found. Button will be created on section load.');
    }

    // Small UI polish: prepend emoji icons to each settings-group H2 and animate them subtly
    document.querySelectorAll('.settings-group h2').forEach((h, i) => {
        if (!h.querySelector('.settings-h2-icon')) {
            let emoji = '⚙️';
            if (h.textContent.includes('Tema')) emoji = '🌓';
            else if (h.textContent.includes('Usuario')) emoji = '👤';
            else if (h.textContent.includes('Administrador')) emoji = '🔒';
            else if (h.textContent.includes('Contacto')) emoji = '💬';
            else if (h.textContent.includes('Sitio Web')) emoji = '🌐';
            h.insertAdjacentHTML('afterbegin', `<span class="settings-h2-icon" aria-hidden="true" style="margin-right:10px;font-size:1.15rem;display:inline-block;transform-origin:center">${emoji}</span>`);
            const ic = h.querySelector('.settings-h2-icon');
            // gentle float animation using Web Animations API
            try { ic.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 2200, iterations: Infinity, delay: i * 220 }); } catch (e) { /* noop if not supported */ }
        }
    });
}

// Function to load settings and manage admin settings visibility
export function loadSettings() {
    console.log('Loading settings...');
    const userNameInput = document.getElementById('user-name');
    const adminSettingsDiv = document.getElementById('admin-settings');
    const adminSettingsErrorMsg = document.getElementById('admin-settings-error-msg');
    const adminSettingsSuccessMsg = document.getElementById('admin-settings-success-msg');
    const adminSettingsForm = document.getElementById('admin-settings-form');
    const adminContactNumberInput = document.getElementById('admin-contact-number');
    const adminWebsiteInput = document.getElementById('admin-website-input'); // Get the new website input field
    const themeToggle = document.getElementById('theme-toggle');

    // Get current logged-in user to display their name (placeholder)
    const currentUser = getLoginState();

    // Basic settings loading (placeholder)
    if (userNameInput) {
        userNameInput.value = currentUser ? `Hola, ${currentUser.name}!` : 'Usuario No Identificado'; // Display logged-in user's name as placeholder
        // Make the input read-only as it's just a display placeholder now
        userNameInput.setAttribute('readonly', true);
        userNameInput.style.cssText = 'background-color: var(--card-bg); color: var(--text-color-secondary); cursor: not-allowed;'; // Use variables for styling
        // Hide the "Guardar Ajustes" button for this placeholder form
        const saveSettingsButton = document.querySelector('#settings-form button[type="submit"]');
        if (saveSettingsButton) {
            saveSettingsButton.style.display = 'none';
        }

    } else {
        console.warn('Element #user-name not found.');
    }

    // Load and apply theme preference when settings section is loaded (optional, done on app load too)
    // It's better to do this on app load, but ensuring the toggle state is correct here is good.
    if (themeToggle) {
        const savedTheme = loadThemePreference();
        themeToggle.checked = (savedTheme === 'dark');
        // applyTheme(savedTheme); // This is already done on app load
    }

    // Admin settings visibility and data loading
    // Check for all admin-related elements including the new website input
    if (adminSettingsDiv && adminSettingsErrorMsg && adminSettingsSuccessMsg && adminSettingsForm && adminContactNumberInput && adminWebsiteInput) {
        if (isAdmin()) {
            adminSettingsDiv.style.display = 'block';
            console.log('Admin settings section shown.');
            // Clear password fields and messages when shown
            adminSettingsForm.querySelector('#current-admin-password').value = '';
            adminSettingsForm.querySelector('#new-admin-password').value = '';
            adminSettingsErrorMsg.textContent = '';
            adminSettingsSuccessMsg.textContent = '';

            // Load and display the saved admin contact number
            const savedContact = loadAdminContact();
            adminContactNumberInput.value = savedContact;
            console.log(`Loaded admin contact: ${savedContact}`);

            // Load and display the saved admin website URL
            const savedWebsite = loadAdminWebsite();
            adminWebsiteInput.value = savedWebsite;
            console.log(`Loaded admin website: ${savedWebsite}`);

        } else {
            adminSettingsDiv.style.display = 'none';
            console.log('Admin settings section hidden for non-admin.');
        }
    } else {
        console.warn('Admin settings elements not fully available for visibility toggle or data loading.');
    }

    // --- Populate Admin Contact Button (visible to all) ---
    populateAdminContactButton();

    // --- Populate Main Website Button (visible to all) ---
    populateMainWebsiteButton();
}

// Helper function to create and display the Admin WhatsApp button
function populateAdminContactButton() {
    const adminWhatsappButtonContainer = document.getElementById('admin-whatsapp-button-container');
    const notConfiguredMsg = document.getElementById('admin-whatsapp-not-configured');

    if (adminWhatsappButtonContainer && notConfiguredMsg) {
        adminWhatsappButtonContainer.innerHTML = ''; // Clear previous content

        const savedContact = loadAdminContact();

        if (savedContact && savedContact.trim() !== '') {
            notConfiguredMsg.style.display = 'none';
            const whatsappLink = document.createElement('a');
            const phoneNumberClean = savedContact.replace(/[^0-9+]/g, '');
            whatsappLink.href = `https://wa.me/${phoneNumberClean}`;
            whatsappLink.textContent = 'Contactar por WhatsApp';
            whatsappLink.target = '_blank';
            whatsappLink.classList.add('save-btn');
            whatsappLink.style.cssText = 'background-color: var(--whatsapp-button-bg); color: white; display: inline-block; margin: 0 auto; text-align: center;';

            // enhance: add subtle transform/hover feedback and a gentle pulse animation
            whatsappLink.style.transition = 'transform .18s ease, box-shadow .18s ease';
            whatsappLink.onmouseover = () => { whatsappLink.style.transform = 'translateY(-4px) scale(1.02)'; whatsappLink.style.boxShadow = '0 12px 30px rgba(0,0,0,0.12)'; };
            whatsappLink.onmouseout = () => { whatsappLink.style.transform = 'none'; whatsappLink.style.boxShadow = ''; };
            try { whatsappLink.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 2600, iterations: Infinity, delay: 420 }); } catch (e) {}
            adminWhatsappButtonContainer.appendChild(whatsappLink);
            console.log('Admin WhatsApp button created using stored contact.');
        } else {
            notConfiguredMsg.style.display = 'block';
            console.log('Admin contact not configured. WhatsApp button not created.');
        }
    } else {
        console.warn('Admin WhatsApp button elements missing for population.');
    }
}

// Helper function to create and display the Main Website button
function populateMainWebsiteButton() {
    const mainWebsiteButtonContainer = document.getElementById('main-website-button-container');
    const mainWebsiteNotConfiguredMsg = document.getElementById('main-website-not-configured');

    if (mainWebsiteButtonContainer && mainWebsiteNotConfiguredMsg) {
        mainWebsiteButtonContainer.innerHTML = ''; // Clear previous content

        const savedWebsite = loadAdminWebsite();

        if (savedWebsite && savedWebsite.trim() !== '') {
            mainWebsiteNotConfiguredMsg.style.display = 'none';
            const websiteLink = document.createElement('a');
            // Ensure the URL has a protocol
            const safeUrl = savedWebsite.startsWith('http://') || savedWebsite.startsWith('https://') ? savedWebsite : `https://${savedWebsite}`;
            websiteLink.href = safeUrl;
            websiteLink.textContent = 'Ir al Sitio Web Principal';
            websiteLink.target = '_blank';
            websiteLink.classList.add('save-btn'); // Reuse save button style
            // Optional: Add a specific class if different styling is needed
            // websiteLink.classList.add('website-button');
            websiteLink.style.cssText = 'background-color: var(--accent-color); color: #222; display: inline-block; margin: 0 auto; text-align: center;';

            // enhance: add hover/press micro-interaction and a slight glow to indicate external link
            websiteLink.style.transition = 'transform .18s ease, box-shadow .18s ease, filter .18s ease';
            websiteLink.onmouseover = () => { websiteLink.style.transform = 'translateY(-4px)'; websiteLink.style.boxShadow = '0 14px 36px rgba(0,0,0,0.10)'; websiteLink.style.filter = 'brightness(1.03)'; };
            websiteLink.onmouseout = () => { websiteLink.style.transform = 'none'; websiteLink.style.boxShadow = ''; websiteLink.style.filter = ''; };
            try { websiteLink.animate([{ opacity: 0.98 }, { opacity: 1 }, { opacity: 0.98 }], { duration: 3000, iterations: Infinity }); } catch (e) {}
            mainWebsiteButtonContainer.appendChild(websiteLink);
            console.log('Main Website button created using stored URL.');
        } else {
            mainWebsiteNotConfiguredMsg.style.display = 'block';
            console.log('Main Website URL not configured. Button not created.');
        }
    } else {
        console.warn('Main Website button elements missing for population.');
    }
}