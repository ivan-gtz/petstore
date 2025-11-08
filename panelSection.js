// --- Panel Section Logic ---
import { db } from './firebase-init.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { displayAvatar } from './avatarHandler.js';
import { getLoginState } from './loginHandler.js'; // Import getLoginState to get current user

// --- Firestore Document Reference ---
const appConfigRef = doc(db, "settings", "appConfig");

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

export async function displayPetInPanel(username) {
    if (!username) {
        console.error('displayPetInPanel requires a username.');
        // Attempt to get logged-in user if username is missing (e.g., direct call)
        const currentUser = getLoginState();
        if (currentUser?.uid) {
            username = currentUser.uid;
            console.warn(`displayPetInPanel called without username, using logged-in user: ${username}`);
        } else {
            console.error('Cannot display pet data: No username provided and no user logged in.');
            // Fallback to showing no data message if user context is missing
            showNoPetDataInPanel();
            return;
        }
    }

    const panelSection = document.getElementById('panel-section');
    if (!panelSection) {
        console.warn('Panel section element not found.');
        return;
    }

    const panelPetAvatarDiv = panelSection.querySelector('#panel-pet-avatar');
    const panelPetName = panelSection.querySelector('#panel-pet-name');
    const panelPetBreed = panelSection.querySelector('#panel-pet-breed');
    const panelPetSex = panelSection.querySelector('#panel-pet-sex');
    const panelPetPedigree = panelSection.querySelector('#panel-pet-pedigree');
    const panelPetSterilized = panelSection.querySelector('#panel-pet-sterilized'); // Corrected ID
    const panelPetBirthdate = panelSection.querySelector('#panel-pet-birthdate');
    const panelPetAge = panelSection.querySelector('#panel-pet-age');
    const panelPetColor = panelSection.querySelector('#panel-pet-color');
    const panelPetNotes = panelSection.querySelector('#panel-pet-notes');
    const panelPetLostStatus = panelSection.querySelector('#panel-pet-lost-status'); // Get the new element
    const panelOwnerName = panelSection.querySelector('#panel-owner-name');
    const panelOwnerPhone = panelSection.querySelector('#panel-owner-phone');
    const panelOwnerLocation = panelSection.querySelector('#panel-owner-location');

    const panelNoDataMsg = panelSection.querySelector('#panel-no-data');
    const panelPetDisplayDiv = panelSection.querySelector('.panel-pet-display'); // Reference the main display div
    const panelWebsiteLink = panelSection.querySelector('#panel-website-link'); // Get the new link element

    // Check if necessary panel elements exist before trying to update them
    if (!panelPetAvatarDiv || !panelPetName || !panelPetBreed || !panelPetAge || !panelPetColor || !panelPetNotes || !panelNoDataMsg || !panelPetDisplayDiv ||
        !panelPetSex || !panelPetPedigree || !panelPetSterilized || !panelPetBirthdate || !panelOwnerName || !panelOwnerPhone || !panelOwnerLocation || !panelPetLostStatus || !panelWebsiteLink) { // Check for the new link
        console.error('One or more Panel elements not found. Cannot display pet data in panel.');
        return;
    }

    // --- Set the H1 link href dynamically and update text with app name ---
    const appConfig = await getAppConfig();
    const currentAppName = appConfig.appName;
    const adminWebsiteURL = appConfig.adminWebsite;

    const logoImg = panelWebsiteLink.querySelector('.header-logo');
     if (logoImg) {
         logoImg.alt = `${currentAppName} Logo`;
     }
     let textNode = Array.from(panelWebsiteLink.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
     if (textNode) {
         textNode.textContent = ` ${currentAppName}`;
     } else {
          let textSpan = panelWebsiteLink.querySelector('span:not(.menu-text)');
          if (!textSpan) {
               textSpan = document.createElement('span');
               panelWebsiteLink.appendChild(textSpan);
          }
          textSpan.textContent = currentAppName;
     }

    if (adminWebsiteURL && adminWebsiteURL.trim() !== '') {
        const safeUrl = adminWebsiteURL.startsWith('http://') || adminWebsiteURL.startsWith('https://') ? adminWebsiteURL : `https://${adminWebsiteURL}`;
        panelWebsiteLink.href = safeUrl;
        panelWebsiteLink.style.cursor = 'pointer';
        panelWebsiteLink.title = `Ir al Sitio Web Principal de ${currentAppName}`;
        panelWebsiteLink.classList.remove('link-disabled');
    } else {
        panelWebsiteLink.href = '#';
        panelWebsiteLink.style.cursor = 'default';
        panelWebsiteLink.title = 'Sitio web principal no configurado';
        panelWebsiteLink.classList.add('link-disabled');
    }

    panelWebsiteLink.removeEventListener('click', handleDisabledLink);
    if (!adminWebsiteURL || adminWebsiteURL.trim() === '') {
        panelWebsiteLink.addEventListener('click', handleDisabledLink);
    }

    const petDocRef = doc(db, "pets", username);
    const petDoc = await getDoc(petDocRef);
    const petData = petDoc.exists() ? petDoc.data() : null;

    if (petData && petData.name) {
        // Hide no data message, show info div (the parent container)
        panelNoDataMsg.style.display = 'none';
        panelPetDisplayDiv.style.display = 'flex'; // Ensure the main flex container is visible

        // Display pet data with animal-themed icons
        panelPetName.innerHTML = `<strong>Nombre:</strong> <span class="pet-icon">🐾</span> ${petData.name || '-'}`;
        panelPetBreed.innerHTML = `<strong>Raza:</strong> <span class="pet-icon">🐶</span> ${petData.breed || '-'}`;
        panelPetSex.innerHTML = `<strong>Sexo:</strong> <span class="pet-icon">⚥</span> ${petData.sex || '-'}`;
        panelPetPedigree.innerHTML = `<strong>Pedigrí:</strong> <span class="pet-icon">🏷️</span> ${petData.pedigree || '-'}`;
        panelPetSterilized.innerHTML = `<strong>Esterilizado:</strong> <span class="pet-icon">✂️</span> ${petData.sterilized || 'no'}`; // Use data key 'sterilized', default to 'no'
        panelPetBirthdate.innerHTML = `<strong>Fecha de Nacimiento:</strong> <span class="pet-icon">🎂</span> ${petData.birthdate || '-'}`;
        panelPetAge.innerHTML = `<strong>Edad:</strong> <span class="pet-icon">🕒</span> ${petData.age || '-'}`;
        panelPetColor.innerHTML = `<strong>Color:</strong> <span class="pet-icon">🎨</span> ${petData.color || '-'}`;
        panelPetNotes.innerHTML = `<strong>Notas:</strong> <span class="pet-icon">📝</span> ${petData.notes || '-'}`;

        // Display Lost Status
        if (petData.lost === true) {
            panelPetLostStatus.style.display = 'flex'; // Use flex to center content
        } else {
            panelPetLostStatus.style.display = 'none'; // Hide the "Lost" message
        }

        // Display owner data
        panelOwnerName.innerHTML = `<strong>Dueño:</strong> <span class="pet-icon">👤</span> ${petData.owner?.name || '-'}`;

        const phone = petData.owner?.phone || '-';
        // Clear previous content before adding new links/text
        panelOwnerPhone.innerHTML = '<strong>Teléfono:</strong> '; // Start with the label
        if (phone !== '-' && phone.trim() !== '') {
            // Create WhatsApp button link
            const whatsappLink = document.createElement('a');
            const phoneNumberClean = phone.replace(/\D/g, '');
            whatsappLink.href = `https://wa.me/${phoneNumberClean}`;
            whatsappLink.textContent = 'Enviar WhatsApp';
            whatsappLink.target = '_blank';
            whatsappLink.classList.add('panel-button'); // Add a class for styling
            whatsappLink.classList.add('whatsapp-button'); // Specific class for WhatsApp styling
            panelOwnerPhone.appendChild(whatsappLink);
        } else {
            panelOwnerPhone.innerHTML += '-'; // Just display '-' if no phone
        }

        const location = petData.owner?.location || '-';
        // Clear previous content before adding new links/text
        panelOwnerLocation.innerHTML = '<strong>Ubicación:</strong> '; // Start with the label
        if (location !== '-' && location.trim() !== '') {
            // Create location button link
            const locationLink = document.createElement('a');
            locationLink.textContent = 'Ver Ubicación';
            locationLink.target = '_blank';
            locationLink.classList.add('panel-button'); // Add a class for styling
            locationLink.classList.add('location-button'); // Specific class for location styling

            // Check if it's likely a URL (simplified check)
            if (location.startsWith('http://') || location.startsWith('https://') || location.startsWith('www.') || location.includes('google.com/maps')) {
                locationLink.href = location.startsWith('http') ? location : `https://${location}`;
            } else {
                // If not a URL, create a google search link for the text
                locationLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
            }
            panelOwnerLocation.appendChild(locationLink);
        } else {
            panelOwnerLocation.innerHTML += '-'; // Just display '-' if no location
        }

        // Display avatar
        displayAvatar(panelPetAvatarDiv, petData.avatar || null);

        // Add subtle 3D floating pet icons in shared view for the "tarjeta" (opened in another window)
        if (document.body.classList.contains('shared-view')) {
            addFloating3DIcons(panelPetDisplayDiv, petData);
        }
    } else {
        // Show no data message, hide info div and avatar
        showNoPetDataInPanel(); // Call the helper function
        panelPetLostStatus.style.display = 'none'; // Hide the "Lost" message if no data
    }
}

// Helper function to prevent default for disabled links
function handleDisabledLink(event) {
    if (event.currentTarget.classList.contains('link-disabled')) {
        event.preventDefault();
        console.log('Link click prevented: URL not configured.');
        // Optionally alert user here, but a tooltip is usually enough
    }
}

// Helper function to consistently show the "no data" state
async function showNoPetDataInPanel() {
    const panelSection = document.getElementById('panel-section');
    if (!panelSection) return;

    const panelPetAvatarDiv = panelSection.querySelector('#panel-pet-avatar');
    const panelPetName = panelSection.querySelector('#panel-pet-name');
    const panelPetBreed = panelSection.querySelector('#panel-pet-breed');
    const panelPetSex = panelSection.querySelector('#panel-pet-sex');
    const panelPetPedigree = panelSection.querySelector('#panel-pet-pedigree');
    const panelPetSterilized = panelSection.querySelector('#panel-pet-sterilized');
    const panelPetBirthdate = panelSection.querySelector('#panel-pet-birthdate');
    const panelPetAge = panelSection.querySelector('#panel-pet-age');
    const panelPetColor = panelSection.querySelector('#panel-pet-color');
    const panelPetNotes = panelSection.querySelector('#panel-pet-notes');
    const panelPetLostStatus = panelSection.querySelector('#panel-pet-lost-status');
    const panelOwnerName = panelSection.querySelector('#panel-owner-name');
    const panelOwnerPhone = panelSection.querySelector('#panel-owner-phone');
    const panelOwnerLocation = panelSection.querySelector('#panel-owner-location');

    const panelNoDataMsg = panelSection.querySelector('#panel-no-data');
    const panelPetDisplayDiv = panelSection.querySelector('.panel-pet-display');
    const panelWebsiteLink = panelSection.querySelector('#panel-website-link'); // Get the link

    if (!panelNoDataMsg || !panelPetDisplayDiv || !panelPetAvatarDiv || !panelPetName || !panelPetBreed || !panelPetSex || !panelPetPedigree || !panelPetSterilized || !panelPetBirthdate || !panelPetAge || !panelPetColor || !panelPetNotes || !panelOwnerName || !panelOwnerPhone || !panelOwnerLocation || !panelPetLostStatus || !panelWebsiteLink) { // Check for the link
        console.error('Missing panel elements for showing no data state.');
        return;
    }

    panelNoDataMsg.style.display = 'block';
    panelPetDisplayDiv.style.display = 'none';

    panelPetName.innerHTML = `<strong>Nombre:</strong> -`;
    panelPetBreed.innerHTML = `<strong>Raza:</strong> -`;
    panelPetSex.innerHTML = `<strong>Sexo:</strong> -`;
    panelPetPedigree.innerHTML = `<strong>Pedigrí:</strong> -`;
    panelPetSterilized.innerHTML = `<strong>Esterilizado:</strong> -`;
    panelPetBirthdate.innerHTML = `<strong>Fecha de Nacimiento:</strong> -`;
    panelPetAge.innerHTML = `<strong>Edad:</strong> -`;
    panelPetColor.innerHTML = `<strong>Color:</strong> -`;
    panelPetNotes.innerHTML = `<strong>Notas:</strong> -`;
    panelOwnerName.innerHTML = `<strong>Dueño:</strong> -`;
    panelOwnerPhone.innerHTML = `<strong>Teléfono:</strong> -`;
    panelOwnerLocation.innerHTML = `<strong>Ubicación:</strong> -`;
    panelPetLostStatus.style.display = 'none';

    const appConfig = await getAppConfig();
    const currentAppName = appConfig.appName;
    const adminWebsiteURL = appConfig.adminWebsite;

    const logoImg = panelWebsiteLink.querySelector('.header-logo');
    if (logoImg) {
        logoImg.alt = `${currentAppName} Logo`;
    }
    let textNode = Array.from(panelWebsiteLink.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
     if (textNode) {
         textNode.textContent = ` ${currentAppName}`;
     } else {
          let textSpan = panelWebsiteLink.querySelector('span:not(.menu-text)');
          if (!textSpan) {
               textSpan = document.createElement('span');
               panelWebsiteLink.appendChild(textSpan);
          }
          textSpan.textContent = currentAppName;
     }

    if (adminWebsiteURL && adminWebsiteURL.trim() !== '') {
        const safeUrl = adminWebsiteURL.startsWith('http://') || adminWebsiteURL.startsWith('https://') ? adminWebsiteURL : `https://${adminWebsiteURL}`;
        panelWebsiteLink.href = safeUrl;
        panelWebsiteLink.style.cursor = 'pointer';
        panelWebsiteLink.title = `Ir al Sitio Web Principal de ${currentAppName}`;
        panelWebsiteLink.classList.remove('link-disabled');
    } else {
        panelWebsiteLink.href = '#';
        panelWebsiteLink.style.cursor = 'default';
        panelWebsiteLink.title = 'Sitio web principal no configurado';
        panelWebsiteLink.classList.add('link-disabled');
    }
    panelWebsiteLink.removeEventListener('click', handleDisabledLink);
    if (!adminWebsiteURL || adminWebsiteURL.trim() === '') {
        panelWebsiteLink.addEventListener('click', handleDisabledLink);
    }

    displayAvatar(panelPetAvatarDiv, null);
}

// Helper: add/remove floating 3D icons to the panel (used in shared view / tarjeta)
function addFloating3DIcons(container, petData) {
    if (!container) return;

    // Remove any existing icon container to avoid duplicates
    const existing = container.querySelector('.floating-3d-icons');
    if (existing) existing.remove();

    // Create wrapper (positioned relative inside panel)
    const wrapper = document.createElement('div');
    wrapper.className = 'floating-3d-icons';
    wrapper.setAttribute('aria-hidden', 'true');

    // Simple SVG icons (paw, bone, heart) with small differences and delays for natural motion
    const icons = [
        { cls: 'paw', svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 13c-2.8 0-5 2.2-5 5h10c0-2.8-2.2-5-5-5zm-4-6c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" fill="currentColor"/></svg>` },
        { cls: 'bone', svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7a2 2 0 0 0-2-2 2 2 0 0 0-1.4.6L15 7l-2-2-1 1 1 2-4 4-2-2-1 1 2 2-1 1-2-2A2 2 0 1 0 4 17a2 2 0 0 0 2-2l2-2 4 4-1 1 1 1 2-2 1 1 1-1-1-2 2-2A2 2 0 0 0 20 7z" fill="currentColor"/></svg>` },
        { cls: 'heart', svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.35-9-7.06C-1.35 9.18 4 5 7 7c1.77 1.23 5 4.5 5 4.5s3.23-3.27 5-4.5c3-2 8.35 2.18-4 6.94C19 16.65 12 21 12 21z" fill="currentColor"/></svg>` },
        { cls: 'paw-print', svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7.5c0 1.7-1.3 3-2.9 3S0 9.2 0 7.5 1.5 4.5 3.6 4.5 6.5 5.8 6.5 7.5zM12 3.5c1.7 0 3 1.3 3 2.9S13.7 9.3 12 9.3 9 8 9 6.4 10.3 3.5 12 3.5zM19 6.5c0 1.7-1.3 3-2.9 3s-2.6-1.3-2.6-2.9S15.4 4.5 17.5 4.5 19 4.8 19 6.5zM12 11.5c-3.5 0-6 2.8-6 6 0 .8.7 1.5 1.5 1.5h9c.8 0 1.5-.7 1.5-1.5 0-3.2-2.5-6-6-6z" fill="currentColor"/></svg>` }
    ];

    icons.forEach((ic, i) => {
        const el = document.createElement('div');
        el.className = `floating-3d-icon icon-${ic.cls}`;
        // Stagger animation delays for organic motion
        el.style.setProperty('--delay', `${i * 300}ms`);
        el.innerHTML = ic.svg;
        wrapper.appendChild(el);
    });

    // Insert wrapper at the end of the container so it floats above content
    container.appendChild(wrapper);

    // Optional: if the pet is marked as lost, slightly increase intensity of animations
    if (petData && petData.lost) {
        wrapper.classList.add('intense');
    }
}

export function initPanelSection() {
    console.log('Panel section initialized.');
}