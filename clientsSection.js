// --- Clients Section Logic (Displaying all pets) ---
import { db } from './firebase-init.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getLoginState } from './loginHandler.js';
import { displayAvatar } from './avatarHandler.js'; // Need avatar logic for cards

// Variable to hold the current filter state
let currentFilter = 'all'; // Default filter

/**
 * Creates the HTML elements for a single pet card.
 * This function can be reused in different sections (Clients list, Users modal).
 * @param {object} petData - The pet data object loaded from storage.
 * @returns {HTMLElement} The pet card div element.
 */
export function createPetCardElement(petData) {
     const petCard = document.createElement('div');
     petCard.classList.add('pet-card'); // Add a class for styling

     // Add 'lost' class if the pet is marked as lost
     if (petData.lost) {
         petCard.classList.add('lost');
     }

     // Create avatar container
     const avatarContainer = document.createElement('div');
     avatarContainer.classList.add('pet-card-avatar');
     const avatarDiv = document.createElement('div');
     avatarDiv.classList.add('avatar'); // Use existing avatar class
     avatarContainer.appendChild(avatarDiv);

     // Create info section
     const infoDiv = document.createElement('div');
     infoDiv.classList.add('pet-card-info');
     infoDiv.innerHTML = `
         <h3>${escapeHTML(petData.name || 'Sin Nombre')}</h3>
         <p><strong>Dueño:</strong> ${escapeHTML(petData.owner?.name || '-')}</p>
         <!-- Optional: Display breed -->
         ${petData.breed ? `<p><strong>Raza:</strong> ${escapeHTML(petData.breed)}</p>` : ''}
         ${petData.lost ? `<p style="color: var(--lost-status-color); font-weight: bold;">¡PERDIDA!</p>` : ''}
     `;


     petCard.appendChild(avatarContainer);
     petCard.appendChild(infoDiv);

     // Return the card element and the specific avatar div within it
     // We need to return the card element so it can be appended to the DOM
     // and the specific avatarDiv within it so we can display the avatar image.
     return { petCard, avatarDiv };
}

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str; // Return non-strings as is
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}


// Renamed function to reflect filtering capability
export async function displayPetsWithFilter(filter = currentFilter) { // Default to current filter
    currentFilter = filter; // Update the module's current filter state

    const clientsSection = document.getElementById('clients-section');
    const petCardContainer = clientsSection ? clientsSection.querySelector('.pet-card-container') : null;
    const filterButtons = clientsSection ? clientsSection.querySelectorAll('.filter-button') : [];


    if (!clientsSection || !petCardContainer) {
        console.error('Clients section or pet card container element not found.');
        return;
    }

    // Update active class on filter buttons
    filterButtons.forEach(button => {
        if (button.dataset.filter === currentFilter) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });


    // Clear previous list and any existing messages
    petCardContainer.innerHTML = '';
     const existingMsg = clientsSection.querySelector('.no-pets-message');
     if (existingMsg) {
         existingMsg.remove();
     }

    const petsCollection = collection(db, "pets");
    const petsSnapshot = await getDocs(petsCollection);
    const allPets = petsSnapshot.docs.map(doc => doc.data());

    // Now filter the loaded pets based on the selected filter
    const filteredPets = allPets.filter(pet => {
        if (currentFilter === 'all') {
            return true; // Include all pets
        } else if (currentFilter === 'lost') {
            return pet.lost === true; // Include only pets marked as lost
        }
        return false; // Should not happen with current filters
    });


    if (filteredPets.length === 0) {
        const noPetsMsg = document.createElement('p');
        noPetsMsg.classList.add('no-pets-message');
        noPetsMsg.style.cssText = 'text-align: center; color: var(--text-color-secondary); width: 100%;'; // Use variable
        if (currentFilter === 'all') {
            noPetsMsg.textContent = 'No hay mascotas registradas aún.';
        } else if (currentFilter === 'lost') {
             noPetsMsg.textContent = 'No hay mascotas marcadas como perdidas.';
        }
        petCardContainer.appendChild(noPetsMsg);
        console.log(`No pets matched the filter "${currentFilter}".`);
        return;
    }

    // Display the filtered pets
    filteredPets.forEach(petData => {
        const { petCard, avatarDiv } = createPetCardElement(petData);

        // Append the card to the DOM first
        petCardContainer.appendChild(petCard);

        // Then display the avatar in the attached avatar div
        displayAvatar(avatarDiv, petData.avatar || null);
    });

     console.log(`Displayed ${filteredPets.length} pets for filter "${currentFilter}".`);
}

// Initialization function for the Clients section
export function initClientsSection() {
    console.log('Clients section initialized.');

    const clientsSection = document.getElementById('clients-section');
    const filterButtons = clientsSection ? clientsSection.querySelectorAll('.filter-button') : [];

    if (clientsSection && filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.dataset.filter;
                displayPetsWithFilter(filter); // Display pets with the selected filter
            });
        });
        console.log('Clients section filter listeners initialized.');
    } else {
         console.warn('Clients section or filter buttons not found. Filter listeners not initialized.');
    }

    // Initial display is now handled by the navigation callback, which calls displayPetsWithFilter
}