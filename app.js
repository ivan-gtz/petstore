// Main entry point for the application
// Coordinates initialization of different modules
import './firebase-init.js'; // Import Firebase configuration first
import { initNavigation, showSection } from './navigation.js';
import { initPetSection, loadPetForEditing } from './petSection.js';
// Removed displayPetInPanel from panelSection import as it's only used by the callback map
import { initPanelSection } from './panelSection.js';
import { initUsersSection, displayUsersList } from './usersSection.js';
import { initGallerySection, displayGalleryItems } from './gallerySection.js';
import { initDocsSection, displayDocsItems } from './docsSection.js';
// Import applyTheme and loadThemePreference from settingsSection
import { initSettingsSection, loadSettings, applyTheme, loadThemePreference } from './settingsSection.js';
import { initLoginHandler, getLoginState, clearLoginState, isAdmin } from './loginHandler.js';
import { initClientsSection, displayPetsWithFilter } from './clientsSection.js';
// Import displayPetInPanel specifically for use in the section callback map
import { displayPetInPanel } from './panelSection.js';

import { initControlSection, loadControlSection } from './controlSection.js'; // <-- new import

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { db } from './firebase-init.js';

document.addEventListener('DOMContentLoaded', async () => {

    const appConfigRef = doc(db, "settings", "appConfig");
    async function getAppConfig() {
        try {
            const docSnap = await getDoc(appConfigRef);
            if (docSnap.exists() && docSnap.data().appName) {
                return docSnap.data();
            }
            return { appName: 'Caneko' }; // Default
        } catch (error) {
            console.error("Error fetching app config:", error);
            return { appName: 'Caneko' }; // Default
        }
    }

    const appConfig = await getAppConfig();
    const appName = appConfig.appName;

    // --- Custom confirm dialog helper (returns a Promise<boolean>) ---
    window.showConfirmDialog = function(title, message, opts = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            if (!modal) {
                // Fallback to native confirm if modal missing
                resolve(confirm(message));
                return;
            }
            const titleEl = modal.querySelector('.confirm-title');
            const msgEl = modal.querySelector('.confirm-message');
            const yesBtn = modal.querySelector('.confirm-yes');
            const noBtn = modal.querySelector('.confirm-no');

            titleEl.innerHTML = `<span class="confirm-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 13c-2.8 0-5 2.2-5 5h10c0-2.8-2.2-5-5-5z" fill="currentColor"></path>
                    <path d="M7 7c0 1.7-1.3 3-3 3S1 8.7 1 7 2.3 4 4 4s3 1.3 3 3zM21 7c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3zM17 4c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3z" fill="currentColor"></path>
                </svg></span><span>${title || 'Confirmar'}</span>`;
            msgEl.textContent = message || '';
            yesBtn.textContent = opts.confirmText || 'Eliminar';
            noBtn.textContent = opts.cancelText || 'Cancelar';

            // Visual state for danger actions
            if (opts.danger) yesBtn.classList.add('danger-btn'); else yesBtn.classList.remove('danger-btn');

            // Show modal
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');

            // Handlers
            const cleanup = () => {
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
                modal.removeEventListener('click', onOutside);
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            };
            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };
            const onOutside = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };

            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
            modal.addEventListener('click', onOutside);
        });
    };
    // --- end confirm helper ---

    const urlParams = new URLSearchParams(window.location.search);
    const isSharedView = urlParams.get('view') === 'shared';
    const petOwnerUsername = urlParams.get('user');

    // --- Apply Theme on Load (Do this BEFORE any UI rendering) ---
    // Load the user's theme preference and apply it immediately
    if (!isSharedView) { // Only apply theme preference in the normal app view
        const savedTheme = loadThemePreference();
        applyTheme(savedTheme);
        console.log(`Initial theme applied: ${savedTheme}`);
    } else {
         // For shared view, we might want a consistent default theme or no theme toggle.
         // The current CSS defaults to light, which is fine. No need to explicitly call applyTheme.
          console.log('Theme preference not applied in shared view.');
    }
    // --- End Apply Theme on Load ---

    // Ensure login heading displays the configured app name
    try {
        const loginHeadingSpan = document.getElementById('app-name');
        if (loginHeadingSpan) loginHeadingSpan.textContent = appName;
        // Keep document title consistent
        document.title = appName;
    } catch (e) {
        console.warn('Could not set login app name dynamically.', e);
    }

    function initLogin3DParallax() {
        const wrapper = document.getElementById('login-wrapper');
        const icons = document.querySelectorAll('.login-3d-icon');
        if (!wrapper || icons.length === 0) return;
        wrapper.addEventListener('mousemove', (e) => {
            const r = wrapper.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width - 0.5;
            const ny = (e.clientY - r.top) / r.height - 0.5;
            icons.forEach((el, i) => {
                const depth = (i + 1) * 6;
                el.style.transform = `translate3d(${nx * depth}px, ${ny * depth}px, ${12 + i * 6}px) rotateY(${nx * 8}deg) rotateX(${ -ny * 6}deg)`;
            });
        });
        wrapper.addEventListener('mouseleave', () => icons.forEach(el => el.style.transform = 'translate3d(0,0,0)'));
    }
    initLogin3DParallax();

    // --- Shared View Logic ---
    // If 'view=shared' is in the URL AND a 'user' is specified
    if (isSharedView && petOwnerUsername) {
        console.log(`Attempting shared view for user: ${petOwnerUsername}`);
        document.body.classList.add('shared-view');

        // Update the document title for the shared view tab
        document.title = `appName - Tarjeta de Mascota`;

        // Hide the login wrapper and show the app wrapper structure
        const loginWrapper = document.getElementById('login-wrapper');
        const appWrapper = document.getElementById('app-wrapper');
        if (loginWrapper && appWrapper) {
            loginWrapper.style.display = 'none';
            appWrapper.style.display = 'flex'; // Ensure app wrapper is visible
        } else {
             console.error('Login or app wrapper missing during shared view setup.');
             return; // Stop if core wrappers are missing
        }

        // Explicitly hide all sections and show only the panel placeholder area
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });
        const panelSection = document.getElementById('panel-section');
        if (!panelSection) {
             console.error('Panel section not found during shared view setup.');
             return; // Stop if panel section is missing
        }
        panelSection.style.display = 'block';
        panelSection.classList.add('active');

        // Find the container where panel content goes
        const panelContentArea = panelSection.querySelector('.panel-pet-display') || panelSection.querySelector('.container');
        const panelNoDataMsg = panelSection.querySelector('#panel-no-data');

         if (!panelContentArea || !panelNoDataMsg) {
              console.error('Panel content area or no-data message missing during shared view setup.');
              return; // Stop if crucial panel parts are missing
         }

        // Clear initial panel content/messages
        panelContentArea.style.display = 'none'; // Hide the default display structure
        panelNoDataMsg.style.display = 'none'; // Hide the "No data" message

        // --- Shared View: Check User Active Status ---
        // This part needs to be migrated to Firebase
        console.warn("Shared view user status check is not yet migrated to Firebase.");
        // For now, we will assume the user is active if they have a shared link.
        // This will be updated later.
        panelContentArea.style.display = 'flex';
        displayPetInPanel(petOwnerUsername);


        // Crucially, DO NOT initialize the login handler or navigation listeners
        // in shared view, as the user is not logged in and navigation is disabled.
        // Also, DO NOT initialize modal listeners in shared view.
        console.log('Shared view setup complete. Login, navigation, and modal listeners bypassed.');
        return; // Exit the DOMContentLoaded listener early for shared view

    }
    // --- End Shared View Logic ---

    // --- Normal App View Logic (Requires Login) ---
    console.log('Entering normal app view logic.');

    // Initialize sections (event listeners, etc.) - safe to attach now
    initPanelSection();
    initPetSection(); // Pet section needs avatar input init
    initUsersSection(); // Users section needs form submit init
    initGallerySection(); // Gallery needs upload input init
    initDocsSection(); // Docs needs upload input init
    initSettingsSection(); // Settings needs form submit init AND theme toggle init
    initClientsSection(); // Clients has no specific init listeners currently
    initControlSection(); // <-- initialize admin control section

    // Get the modal elements and add close listeners once here (ONLY in normal view)
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    const modalDocContent = document.getElementById("modalDocument");
    const span = document.getElementsByClassName("close")[0];

    if (span && modal && modalImg && modalDocContent) { // Ensure all exist
        span.onclick = function() {
          modal.style.display = "none";
          modalImg.style.display = "none";
          modalDocContent.style.display = "none";
           // Clear modal content if necessary, especially for documents and pet cards
          modalDocContent.innerHTML = '';
           // Also remove the specific modal pet card container class
          const modalPetCardContainer = modalDocContent.querySelector('.modal-pet-card-container');
           if(modalPetCardContainer) {
               modalPetCardContainer.remove(); // Remove the whole container
           }
        }

        window.onclick = function(event) {
          // Check if the click was directly on the modal background, not inside the content
          if (event.target === modal) {
            modal.style.display = "none";
            modalImg.style.display = "none";
            modalDocContent.style.display = "none";
            // Clear modal content if necessary
             modalDocContent.innerHTML = '';
             // Also remove the specific modal pet card container class
            const modalPetCardContainer = modalDocContent.querySelector('.modal-pet-card-container');
            if(modalPetCardContainer) {
                modalPetCardContainer.remove(); // Remove the whole container
            }
          }
        }
        console.log('Modal close listeners initialized.');
    } else {
        console.warn('Modal elements not fully found. Modal close listeners not initialized.');
    }

    // Define logout callback (only relevant for normal app view)
     const handleLogout = () => {
        console.log('Handling logout...');
         clearLoginState();
         const loginWrapper = document.getElementById('login-wrapper');
         const appWrapper = document.getElementById('app-wrapper');
         if (loginWrapper && appWrapper) {
              appWrapper.style.display = 'none';
              loginWrapper.style.display = 'flex';
         }
         // Optional: Clear hash and query parameters from URL on logout
         // Use hash to avoid adding logout to browser history
         window.location.hash = ''; // Clear the hash
         console.log('Logout complete. Showing login screen.');

         // Clear any loaded data in sections for the previous user (optional but good practice)
         // For simplicity in this demo, we rely on the next section activation to load new user data.
         // If we needed to clear data immediately, we'd add specific clear functions to each module.
     };

    // Define callbacks for each section to load/display data when activated
    // These callbacks retrieve the current username from the login state
    const sectionCallbacks = {
        'panel-section': () => {
            const currentUser = getLoginState();
            if (currentUser?.uid) {
                displayPetInPanel(currentUser.uid); // Use logged-in user's UID
            } else {
                 console.warn('Panel section activated but no user logged in.');
                 // Fallback: show no data message if panel is somehow accessed without login state
                 const panelSection = document.getElementById('panel-section');
                 const panelNoDataMsg = panelSection ? panelSection.querySelector('#panel-no-data') : null;
                 const panelPetDisplayDiv = panelSection ? panelSection.querySelector('.panel-pet-display') : null;
                 // Removed shareButton check
                 const panelPetLostStatus = panelSection ? panelSection.querySelector('#panel-pet-lost-status') : null;

                 if(panelNoDataMsg && panelPetDisplayDiv && panelPetLostStatus) { // Adjusted check
                     panelNoDataMsg.style.display = 'block';
                     panelPetDisplayDiv.style.display = 'none';
                     panelPetLostStatus.style.display = 'none'; // Also hide lost status in no-data state
                 } else {
                      console.error('Failed to show no-data message in panel during normal app activation.');
                 }
            }
        },
        'pets-section': () => {
            const currentUser = getLoginState();
            if (currentUser?.uid) loadPetForEditing(currentUser.uid); // Use logged-in user's UID
             else console.warn('Cannot load pet for editing: No user logged in.');
        },
        'users-section': () => {
             const currentUser = getLoginState();
             // displayUsersList checks isAdmin internally
             if (currentUser?.uid) displayUsersList();
             else console.warn('Cannot display users: No user logged in.');

        },
        'gallery-section': () => {
            const currentUser = getLoginState();
            if (currentUser?.uid) displayGalleryItems(currentUser.uid); // Use logged-in user's UID
            else console.warn('Cannot display gallery: No user logged in.');
        },
        'docs-section': () => {
            const currentUser = getLoginState();
            if (currentUser?.uid) displayDocsItems(currentUser.uid); // Use logged-in user's UID
            else console.warn('Cannot display documents: No user logged in.');
        },
        'settings-section': loadSettings, // Settings doesn't strictly need username passed if it loads user data itself
        'clients-section': () => {
             console.log('Clients section activated.');
             // displayAllPets does NOT need a specific username, it iterates all users
             // Use the renamed function displayPetsWithFilter and default to 'all' filter
             displayPetsWithFilter('all');
        },
        'control-section': loadControlSection
    };

    // Get the new "Tarjeta" link (only relevant for normal app view)
    const openCardLink = document.getElementById('open-card-link');
    if (openCardLink) {
        openCardLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default link behavior

            const currentUser = getLoginState();
            if (!currentUser || !currentUser.uid) {
                alert('Por favor, inicia sesión para ver la tarjeta de tu mascota.');
                console.warn('Attempted to open pet card link without logged-in user.');
                return;
            }

            // This part needs to be migrated to Firebase
            console.warn("'Tarjeta' link user status check is not yet migrated to Firebase.");
            // For now, we will assume the user is active if they have a shared link.
            // This will be updated later.
            const baseUrl = window.location.origin;
            const cardUrl = `${baseUrl}?view=shared&user=${encodeURIComponent(currentUser.uid)}`;

            window.open(cardUrl, '_blank');
            console.log(`Opened shared view for user: ${currentUser.uid}`);

            // After opening, navigate the main app back to the panel
            showSection('panel-section', sectionCallbacks);
            window.location.hash = '#/panel-section';
        });
        console.log('"Tarjeta" link listener initialized.');
    } else {
        console.warn('"Tarjeta" link (#open-card-link) not found.');
    }

    // Define setupMainApp function
    // This function will be called on successful login OR if user is already logged in
    const setupMainApp = () => {
        console.log('Setting up main app UI...');
        const loginWrapper = document.getElementById('login-wrapper');
        const appWrapper = document.getElementById('app-wrapper');

        if (loginWrapper && appWrapper) {
            loginWrapper.style.display = 'none';
            appWrapper.style.display = 'flex';

            // --- Admin Menu Visibility ---
            // Find all menu items marked as admin-only
            const adminOnlyMenuItems = document.querySelectorAll('.sidebar nav li.admin-only');

            adminOnlyMenuItems.forEach(item => {
                if (isAdmin()) {
                     item.style.display = 'list-item'; // Show for admin
                } else {
                     item.style.display = 'none'; // Hide for non-admin
                }
            });

            if (isAdmin()) {
                console.log('Admin: Admin-only menu items shown.');
            } else {
                 console.log('Non-admin: Admin-only menu items hidden.');
            }
            // --- End Admin Menu Visibility ---

            // Initialize navigation (including hash handling and sidebar links)
            // This function itself checks if shared view is active, but we've already exited
            // for shared view above, so it should proceed normally here.
            initNavigation(sectionCallbacks, handleLogout);
            console.log('Main app UI setup complete. Navigation initialized.');

            // The initial section is now correctly handled by initNavigation based on the URL hash.

            // Attach logout listeners (only needed in main app view)
            const settingsLogoutButton = document.getElementById('settings-logout-button');

            if (settingsLogoutButton) {
                // Remove existing listener to prevent duplicates
                settingsLogoutButton.removeEventListener('click', handleLogout);
                settingsLogoutButton.addEventListener('click', handleLogout);
                console.log('Settings logout listener attached.');
            } else {
                console.warn('Settings logout button (#settings-logout-button) not found.');
            }
        } else {
            console.error('Login or app wrapper elements not found during setup.');
        }
    };

    // Initialize login handler for the login form
    initLoginHandler(setupMainApp);

    // Check login state on initial load (if not in shared view)
    if (!isSharedView && getLoginState()) { // Added check for shared view
        console.log('User already logged in, setting up main app.');
        setupMainApp();
    } else if (!isSharedView) { // Only log this if not in shared view
        console.log('No user found in session.');
    }
});

// --- PDF.js Rendering Logic ---

// Configure the PDF.js worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
}

/**
 * Renders a PDF inside a dedicated container using <canvas> elements.
 * @param {string} pdfUrl - The URL of the PDF file to render.
 */
async function renderPdfInCanvas(pdfUrl) {
    const viewerContainer = document.getElementById('pdf-viewer-container');
    const pagesContainer = document.getElementById('pdf-pages');

    // Clean up previous content and show the viewer
    pagesContainer.innerHTML = '';
    viewerContainer.style.display = 'block';

    try {
        // Show a loading indicator
        pagesContainer.innerHTML = '<p style="color: white; text-align: center;">Cargando PDF...</p>';

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        // Clear the loading message
        pagesContainer.innerHTML = '';

        // Loop through each page and render it
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            const scale = 1.5;
            const viewport = page.getViewport({ scale: scale });

            // Create a canvas for each page
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.display = 'block';
            canvas.style.marginBottom = '10px';

            // Append the canvas to the container
            pagesContainer.appendChild(canvas);

            // Render the page into the canvas
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
        }

    } catch (error) {
        console.error('Error rendering PDF:', error);
        pagesContainer.innerHTML = `<p style="color: white; text-align: center;">Error al cargar el PDF. Por favor, intenta de nuevo. Detalles: ${error.message}</p>`;
    }
}

// Make the function globally available so other modules can call it
window.renderPdfInCanvas = renderPdfInCanvas;

// Add event listener for the close button on the PDF viewer
const closePdfButton = document.getElementById('close-pdf-viewer');
if (closePdfButton) {
    closePdfButton.addEventListener('click', () => {
        const viewerContainer = document.getElementById('pdf-viewer-container');
        if (viewerContainer) {
            viewerContainer.style.display = 'none';
            // Also clear the pages to free up memory
            const pagesContainer = document.getElementById('pdf-pages');
            if(pagesContainer) {
                pagesContainer.innerHTML = '';
            }
        }
    });
}
