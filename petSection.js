// --- Mascotas (Add/View/Edit Pet) Section Logic ---
import { db } from './firebase-init.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { displayAvatar, initAvatarInput, getCurrentAvatarDataUrl, loadAvatarDataUrl } from './avatarHandler.js';
import { displayPetInPanel } from './panelSection.js'; // Import panel display function
import { getLoginState } from './loginHandler.js'; // Import getLoginState to get current user

export async function loadPetForEditing(username) {
    if (!username) {
         console.error('loadPetForEditing requires a username.');
         return;
    }

    const petForm = document.getElementById('pet-form');
    const petNameInput = document.getElementById('pet-name');
    const petBreedInput = document.getElementById('pet-breed');
    const petSexSelect = document.getElementById('pet-sex');
    const petPedigreeSelect = document.getElementById('pet-pedigree');
    const petSterilizedSelect = document.getElementById('pet-sterilized');
    const petBirthdateInput = document.getElementById('pet-birthdate');
    const petAgeInput = document.getElementById('pet-age');
    const petColorInput = document.getElementById('pet-color');
    const petNotesInput = document.getElementById('pet-notes');
    const ownerNameInput = document.getElementById('owner-name');
    const ownerPhoneInput = document.getElementById('owner-phone');
    const ownerLocationInput = document.getElementById('owner-location');
    const petLostCheckbox = document.getElementById('pet-lost'); // Get the new checkbox

    const petAvatarDiv = document.getElementById('pet-avatar');

    if (!petForm || !petNameInput || !petBreedInput || !petAgeInput || !petColorInput || !petNotesInput || !petAvatarDiv ||
        !petSexSelect || !petPedigreeSelect || !petSterilizedSelect || !petBirthdateInput || !ownerNameInput || !ownerPhoneInput || !ownerLocationInput || !petLostCheckbox) { // Check for the new element
         console.warn('Pet form elements not fully available for loading.');
         return;
    }

    const petDocRef = doc(db, "pets", username);
    const petDoc = await getDoc(petDocRef);
    const petData = petDoc.exists() ? petDoc.data() : null;

    if (petData) {
        petNameInput.value = petData.name || '';
        petBreedInput.value = petData.breed || '';
        petSexSelect.value = petData.sex || '';
        petPedigreeSelect.value = petData.pedigree || 'no';
        petSterilizedSelect.value = petData.sterilized || 'no';
        petBirthdateInput.value = petData.birthdate || '';
        petAgeInput.value = petData.age || '';
        petColorInput.value = petData.color || '';
        petNotesInput.value = petData.notes || '';
        petLostCheckbox.checked = petData.lost === true; // Set the checkbox state

        // Load owner data
        ownerNameInput.value = petData.owner?.name || '';
        ownerPhoneInput.value = petData.owner?.phone || '';
        ownerLocationInput.value = petData.owner?.location || '';

        loadAvatarDataUrl(petData.avatar || '');
        displayAvatar(petAvatarDiv, petData.avatar || null);
    } else {
        // Clear form if no data found for this user
        petForm.reset();
        // Set default values for selects and the new checkbox
        petSexSelect.value = '';
        petPedigreeSelect.value = 'no';
        petSterilizedSelect.value = 'no';
        petLostCheckbox.checked = false; // Default to not lost
        loadAvatarDataUrl('');
        displayAvatar(petAvatarDiv, null);
    }
     console.log(`Pet data loaded for editing for user "${username}".`);
}

export function initPetSection() {
    const petForm = document.getElementById('pet-form');
    const petNameInput = document.getElementById('pet-name');
    const petBreedInput = document.getElementById('pet-breed');
    const petSexSelect = document.getElementById('pet-sex');
    const petPedigreeSelect = document.getElementById('pet-pedigree');
    const petSterilizedSelect = document.getElementById('pet-sterilized');
    const petBirthdateInput = document.getElementById('pet-birthdate');
    const petAgeInput = document.getElementById('pet-age');
    const petColorInput = document.getElementById('pet-color');
    const petNotesInput = document.getElementById('pet-notes');
    const ownerNameInput = document.getElementById('owner-name');
    const ownerPhoneInput = document.getElementById('owner-phone');
    const ownerLocationInput = document.getElementById('owner-location');
    const petLostCheckbox = document.getElementById('pet-lost'); // Get the new checkbox

    // Avatar input initialization is handled by initAvatarInput

    if (petForm && petNameInput && petBreedInput && petAgeInput && petColorInput && petNotesInput &&
        petSexSelect && petPedigreeSelect && petSterilizedSelect && petBirthdateInput && ownerNameInput && ownerPhoneInput && ownerLocationInput && petLostCheckbox) { // Check for new element

        petForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const currentUser = getLoginState();
            if (!currentUser || !currentUser.uid) {
                 alert('Error: No user is logged in.');
                 console.error('Pet form submit failed: No logged-in user.');
                 return;
            }

            const petData = {
                name: petNameInput.value.trim(),
                breed: petBreedInput.value.trim(),
                sex: petSexSelect.value,
                pedigree: petPedigreeSelect.value,
                sterilized: petSterilizedSelect.value,
                birthdate: petBirthdateInput.value,
                age: petAgeInput.value.trim(),
                color: petColorInput.value.trim(),
                notes: petNotesInput.value.trim(),
                avatar: getCurrentAvatarDataUrl(),
                lost: petLostCheckbox.checked, // Include the new status
                 owner: {
                    name: ownerNameInput.value.trim(),
                    phone: ownerPhoneInput.value.trim(),
                    location: ownerLocationInput.value.trim()
                 }
            };

            // Simple validation (name, breed, age still required)
            if (!petData.name || !petData.breed || !petData.age) {
                 alert('Por favor, completa los campos obligatorios: Nombre, Raza, y Edad.');
                 return;
            }

            const petDocRef = doc(db, "pets", currentUser.uid);
            await setDoc(petDocRef, petData);
            
            showSavePopup(petData.name || 'sin nombre', currentUser.email);

            // After saving, update the panel section display for the current user
            displayPetInPanel(currentUser.uid);
        });
         console.log('Pet form listener initialized.');
    } else {
        console.warn('Pet form (#pet-form) or some required inputs not found. Pet section submit logic not fully initialized.');
    }

    // Initialize the avatar input specifically for the pets section
    initAvatarInput('avatar-input', 'pet-avatar');
    console.log('Pet section avatar input initialized.');

    // Initial load is now handled by the navigation callback loadPetForEditing(username)
}

/* New: nicer animated save popup (auto-dismiss & accessible) */
function showSavePopup(petName, ownerName) {
    // create nodes
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.setAttribute('role', 'status');
    modal.setAttribute('aria-live', 'polite');
    modal.innerHTML = `
        <div class="confirm-box" aria-modal="true">
            <div class="confirm-title">
                <div class="confirm-icon" aria-hidden>🐶</div>
                <div>
                    <div style="font-size:1.05rem">Mascota guardada</div>
                    <div style="font-size:0.92rem; color:var(--text-color-secondary); margin-top:6px">\"${escapeHtml(petName)}\" para ${escapeHtml(ownerName)}</div>
                </div>
            </div>
            <div class="confirm-actions">
                <button class="save-btn" id="popup-ok">Aceptar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const removePopup = () => {
        modal.classList.add('closing');
        modal.style.animation = 'confirm-backdrop 180ms reverse';
        // small exit animation then remove
        setTimeout(() => { modal.remove(); }, 220);
    };

    // auto-dismiss after 2.6s
    const timer = setTimeout(removePopup, 2600);

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.id === 'popup-ok') {
            clearTimeout(timer);
            removePopup();
        }
    });

    // prevent focus loss; focus OK for accessibility
    const okBtn = modal.querySelector('#popup-ok');
    if (okBtn) { okBtn.focus(); }
}

/* tiny helper to avoid injection when inserting names */
function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}