// --- Usuarios Section Logic ---
import { db } from './firebase-init.js';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { isAdmin } from './loginHandler.js'; // Import isAdmin check
import { createPetCardElement } from './clientsSection.js'; // Import the shared pet card creation function
import { displayAvatar } from './avatarHandler.js'; // Import avatar display function

// Module-level variable to store the current filter state and search term
let currentUserFilter = 'all'; // Default status filter
let currentUserSearchTerm = ''; // Default search term

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str; // Return non-strings as is
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Function to display users list based on filter and search term
export async function displayUsersList(filter = currentUserFilter, searchTerm = currentUserSearchTerm) {
    currentUserFilter = filter; // Update the module's current filter state
    currentUserSearchTerm = searchTerm; // Update the module's current search term

    const userListDiv = document.getElementById('user-list');
    const userForm = document.getElementById('user-form'); // Keep reference to the form
    const usersAdminOnlyDiv = document.getElementById('users-admin-only');
    const accessDeniedDiv = document.getElementById('users-access-denied');
    const filterControlsDiv = usersAdminOnlyDiv ? usersAdminOnlyDiv.querySelector('.users-filter-controls') : null; // Find within admin div
    const filterButtons = filterControlsDiv ? filterControlsDiv.querySelectorAll('.filter-button') : []; // Get filter buttons from container
    const searchInput = document.getElementById('user-search-input'); // Get the search input
    const searchButton = usersAdminOnlyDiv ? usersAdminOnlyDiv.querySelector('#user-search-button') : null;

    if (!userListDiv || !userForm || !usersAdminOnlyDiv || !accessDeniedDiv || filterButtons.length === 0 || !searchInput || !searchButton) {
        console.error('Users section elements not fully found. Cannot display/manage users.');
        return;
    }

    if (!isAdmin()) {
        usersAdminOnlyDiv.style.display = 'none';
        accessDeniedDiv.style.display = 'block';
        return;
    } else {
        usersAdminOnlyDiv.style.display = 'block';
        accessDeniedDiv.style.display = 'none';
    }

    const usersCollection = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollection);
    let allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    userListDiv.innerHTML = '';

    filterButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.filter === currentUserFilter);
    });

    searchInput.value = currentUserSearchTerm;

    allUsers.sort((a, b) => a.email.localeCompare(b.email));

    let filteredUsersByStatus = allUsers;
    const today = new Date().toISOString().split('T')[0];

    if (currentUserFilter === 'inactive') {
        filteredUsersByStatus = allUsers.filter(user => user.active === false);
    } else if (currentUserFilter === 'expired') {
        filteredUsersByStatus = allUsers.filter(user => user.expiryDate && user.expiryDate < today);
    }

    const finalFilteredUsers = filteredUsersByStatus.filter(user => {
        const searchTermLower = currentUserSearchTerm.toLowerCase();
        return user.email.toLowerCase().includes(searchTermLower);
    });

    const listHeading = document.createElement('h3');
    listHeading.textContent = 'Usuarios Registrados';
    listHeading.style.cssText = 'margin-top: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px; font-size: 1.2rem; color: var(--text-color);';
    userListDiv.appendChild(listHeading);

    if (finalFilteredUsers.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = 'No se encontraron usuarios.';
        msg.style.cssText = 'width: 100%; text-align: center; color: var(--text-color-secondary);';
        userListDiv.appendChild(msg);
    } else {
        const petsCollection = collection(db, "pets");
        const petsSnapshot = await getDocs(petsCollection);
        const allPets = {};
        petsSnapshot.forEach(doc => {
            allPets[doc.id] = doc.data();
        });

        finalFilteredUsers.forEach((user) => {
            const userEntry = document.createElement('div');
            userEntry.classList.add('user-entry');
            
            const avatarWrapper = document.createElement('div');
            avatarWrapper.classList.add('user-avatar');
            const avatarInner = document.createElement('div');
            avatarInner.classList.add('avatar');
            avatarWrapper.appendChild(avatarInner);
            userEntry.appendChild(avatarWrapper);

            const userInfo = document.createElement('div');
            userInfo.classList.add('user-info');
            
            const startDateDisplay = user.startDate ? new Date(user.startDate).toLocaleDateString('es-ES') : '-';
            const expiryDateDisplay = user.expiryDate ? new Date(user.expiryDate).toLocaleDateString('es-ES') : '-';
            const isExpired = user.expiryDate && user.expiryDate < today;
            const statusText = isExpired ? 'Caducado' : (user.active ? 'Activo' : 'Inactivo');
            const statusColor = isExpired ? 'var(--error-color)' : (user.active ? 'var(--success-color)' : 'var(--warning-color)');

            userInfo.innerHTML = `
                <p><strong>Usuario:</strong> ${escapeHTML(user.email)} <span class="user-status-indicator" style="color: ${statusColor}; font-weight: normal; font-size: 0.9em;">(${statusText})</span></p>
                <p><strong>Inicio:</strong> ${startDateDisplay}</p>
                <p><strong>Caducidad:</strong> ${expiryDateDisplay}</p>
            `;
            userEntry.appendChild(userInfo);

            const petInfoDiv = document.createElement('div');
            petInfoDiv.classList.add('user-pet-preview');
            const petData = allPets[user.id];

            if (petData && petData.name) {
                const petLink = document.createElement('button');
                petLink.textContent = `Ver Mascota: ${escapeHTML(petData.name)}`;
                petLink.classList.add('link-button');
                petLink.style.cssText = 'background: none; border: none; color: var(--accent-color); text-decoration: underline; cursor: pointer; padding: 0; font-size: 0.9em; margin-top: 5px; text-align: left;';

                petLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    displayUserPetModal(user.id);
                });
                petInfoDiv.appendChild(petLink);
                displayAvatar(avatarInner, petData.avatar || null);
            } else {
                const noPetMsg = document.createElement('p');
                noPetMsg.textContent = 'Sin mascota registrada';
                noPetMsg.style.cssText = 'font-size: 0.9em; color: var(--text-color-secondary); margin-top: 5px; text-align: left;';
                petInfoDiv.appendChild(noPetMsg);
            }
            userEntry.appendChild(petInfoDiv);

            const buttonsContainer = document.createElement('div');
            buttonsContainer.classList.add('user-buttons');
            buttonsContainer.style.cssText = 'flex-shrink: 0; display: flex; gap: 5px; margin-left: 10px;';

            if (user.role !== 'admin') {
                const toggleButton = document.createElement('button');
                toggleButton.classList.add('toggle-user-status-btn', user.active ? 'deactivate-btn' : 'activate-btn');
                toggleButton.textContent = user.active ? 'Desactivar' : 'Activar';
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleUserStatus(user.id, !user.active);
                });
                buttonsContainer.appendChild(toggleButton);

                const editDatesButton = document.createElement('button');
                editDatesButton.classList.add('edit-user-dates-btn');
                editDatesButton.textContent = 'Editar Fecha';
                editDatesButton.style.cssText = 'background-color: var(--accent-color); color: #222; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;';
                editDatesButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editUserDatesModal(user.id);
                });
                buttonsContainer.appendChild(editDatesButton);

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('delete-user-btn');
                deleteButton.textContent = 'Eliminar';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteUser(user.id, user.email);
                });
                buttonsContainer.appendChild(deleteButton);
            }

            if (buttonsContainer.hasChildNodes()) {
                userEntry.appendChild(buttonsContainer);
            }

            userListDiv.appendChild(userEntry);
        });
    }
}

async function toggleUserStatus(userId, newStatus) {
    if (!isAdmin()) {
        alert('Acceso denegado.');
        return;
    }
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { active: newStatus });
    displayUsersList(currentUserFilter, currentUserSearchTerm);
}

async function editUserDatesModal(userId) {
    // This function needs to be updated to use Firestore
    console.log("editUserDatesModal not implemented yet for Firestore");
}

async function deleteUser(userId, userEmail) {
    if (!isAdmin()) {
        alert('Acceso denegado.');
        return;
    }
    const confirmed = await window.showConfirmDialog(
        'Eliminar Usuario',
        `¿Confirmar para eliminar el usuario "${userEmail}"? Esto es permanente.`,
        { confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true }
    );
    if (confirmed) {
        await deleteDoc(doc(db, "users", userId));
        await deleteDoc(doc(db, "pets", userId));
        // Note: Deleting from Firebase Auth requires a backend function.
        // This will only delete the user from Firestore.
        alert('Usuario eliminado de la base de datos (no de Firebase Auth).');
        displayUsersList(currentUserFilter, currentUserSearchTerm);
    }
}

export function initUsersSection() {
    const userForm = document.getElementById('user-form');
    const userNameInput = document.getElementById('user-name-input');
    const userPasswordInput = document.getElementById('user-password-input');
    const usersAdminOnlyDiv = document.getElementById('users-admin-only');

    if (userForm && userNameInput && userPasswordInput) {
        userForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            if (!isAdmin()) {
                alert('Acceso denegado para añadir usuarios.');
                userForm.reset();
                return;
            }

            const name = userNameInput.value.trim();
            const password = userPasswordInput.value.trim();
            const emailInput = document.getElementById('user-email-input');
            const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

            if (!name || !password || !email) {
                alert('Por favor, introduce correo, nombre de usuario y contraseña.');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Por favor, introduce un correo electrónico válido.');
                return;
            }
            
            // This part needs to be updated to create user in Firebase Auth
            // and then add user to firestore 'users' collection.
            // For now, this form is broken.
            alert("La creación de usuarios desde la aplicación aún no está implementada con Firebase.");

        });
        console.log('User form listener initialized.');
    }

    const filterControlsDiv = usersAdminOnlyDiv ? usersAdminOnlyDiv.querySelector('.users-filter-controls') : null;
    const filterButtons = filterControlsDiv ? filterControlsDiv.querySelectorAll('.filter-button') : [];

    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.dataset.filter;
                displayUsersList(filter);
            });
        });
        console.log('Users section filter listeners initialized.');
    }

    const searchInput = document.getElementById('user-search-input');
    const searchButton = usersAdminOnlyDiv ? usersAdminOnlyDiv.querySelector('#user-search-button') : null;
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                displayUsersList(currentUserFilter, searchInput.value.trim());
            }
        });
    }
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            displayUsersList(currentUserFilter, searchInput ? searchInput.value.trim() : '');
        });
    }
}

async function displayUserPetModal(userId) {
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    const modalDocContent = document.getElementById("modalDocument");

    if (!modal || !modalImg || !modalDocContent) {
        console.error('Modal elements not found for displayUserPetModal.');
        return;
    }

    modalImg.style.display = "none";
    modalDocContent.style.display = "block";
    modalDocContent.innerHTML = '';

    const modalContentWrapper = document.createElement('div');
    modalContentWrapper.classList.add('modal-user-pet-details');
    modalContentWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 100%;';
    modalDocContent.appendChild(modalContentWrapper);

    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    const userDetailsDiv = document.createElement('div');
    userDetailsDiv.classList.add('modal-user-details');
    userDetailsDiv.style.cssText = 'width: 100%; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed var(--border-color-dashed); text-align: center;';
    
    if (userDoc.exists()) {
        const targetUser = userDoc.data();
        const today = new Date().toISOString().split('T')[0];
        const startDateDisplay = targetUser.startDate ? new Date(targetUser.startDate).toLocaleDateString('es-ES') : '-';
        const expiryDateDisplay = targetUser.expiryDate ? new Date(targetUser.expiryDate).toLocaleDateString('es-ES') : '-';
        const isExpired = targetUser.expiryDate && targetUser.expiryDate < today;
        const statusText = isExpired ? 'Caducada' : (targetUser.active ? 'Activa' : 'Inactiva');
        const statusColor = isExpired ? 'var(--error-color)' : (targetUser.active ? 'var(--success-color)' : 'var(--warning-color)');

        userDetailsDiv.innerHTML = `
            <h3 style="margin-top: 0;">Cuenta de Usuario</h3>
            <p><strong>Usuario:</strong> <span class="pet-icon">👤</span> ${escapeHTML(targetUser.email)}</p>
            <p><strong>Estado:</strong> <span style="color: ${statusColor};">${statusText}</span></p>
            <p><strong>Inicio:</strong> ${startDateDisplay}</p>
            <p><strong>Caducidad:</strong> ${expiryDateDisplay}</p>
        `;
    } else {
        userDetailsDiv.innerHTML = `<h3 style="margin-top: 0;">Cuenta de Usuario</h3><p>Datos de usuario no encontrados.</p>`;
    }
    modalContentWrapper.appendChild(userDetailsDiv);

    const petDetailsDiv = document.createElement('div');
    petDetailsDiv.classList.add('modal-pet-card-container');

    const petDocRef = doc(db, "pets", userId);
    const petDoc = await getDoc(petDocRef);

    if (petDoc.exists()) {
        const petData = petDoc.data();
        const petCard = document.createElement('div');
        petCard.classList.add('pet-card');
        if (petData.lost) {
            petCard.classList.add('lost');
        }
        petCard.style.cssText = 'flex-direction: column; align-items: center; text-align: center; width: 100%; max-width: 350px; margin-bottom: 15px;';

        const avatarContainer = document.createElement('div');
        avatarContainer.classList.add('pet-card-avatar');
        avatarContainer.style.cssText = 'width: 100px; height: 100px;';
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar');
        avatarDiv.style.cssText = 'width: 100%; height: 100%; border: 3px solid var(--accent-color);';
        avatarContainer.appendChild(avatarDiv);
        petCard.appendChild(avatarContainer);
        
        setTimeout(() => {
            displayAvatar(avatarDiv, petData.avatar || null);
        }, 0);

        const infoDiv = document.createElement('div');
        infoDiv.classList.add('pet-card-info');
        infoDiv.style.cssText = 'width: 100%;';
        infoDiv.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 1.2rem; border-bottom: none; padding-bottom: 0;"><span class="pet-icon">🐾</span> ${escapeHTML(petData.name || 'Sin Nombre')}</h3>
            ${petData.breed ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Raza:</strong> <span class="pet-icon">🐶</span> ${escapeHTML(petData.breed)}</p>` : ''}
            <h4 style="margin-top: 15px; margin-bottom: 10px; font-size: 1.1rem; border-bottom: 1px dashed var(--border-color-dashed); padding-bottom: 5px;">Información del Dueño</h4>
             <p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Dueño:</strong> ${escapeHTML(petData.owner?.name || '-')}</p>
        `;
        petCard.appendChild(infoDiv);
        petDetailsDiv.appendChild(petCard);

    } else {
        const noPetMsg = document.createElement('p');
        noPetMsg.textContent = 'Sin mascota registrada';
        noPetMsg.style.cssText = 'font-size: 0.9em; color: var(--text-color-secondary);';
        petDetailsDiv.appendChild(noPetMsg);
    }
    modalContentWrapper.appendChild(petDetailsDiv);

    modalDocContent.appendChild(modalContentWrapper);

    modal.style.display = "block";
}
