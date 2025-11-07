// --- Usuarios Section Logic ---
import { saveUsersToLocalStorage, loadUsersFromLocalStorage, loadPetFromLocalStorage, loadAppName } from './storage.js'; // Ensure correct imports including loadPetFromLocalStorage
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
// Modified to accept filter and searchTerm explicitly
export function displayUsersList(filter = currentUserFilter, searchTerm = currentUserSearchTerm) {
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

    if (!userListDiv || !userForm || !usersAdminOnlyDiv || !accessDeniedDiv || filterButtons.length === 0 || !searchInput || !searchButton) { // Add searchInput and searchButton check
        console.error('Users section elements not fully found. Cannot display/manage users.');
        // Log missing elements for debugging
        if (!userListDiv) console.error('#user-list missing');
        if (!userForm) console.error('#user-form missing');
        if (!usersAdminOnlyDiv) console.error('#users-admin-only missing');
        if (!accessDeniedDiv) console.error('#users-access-denied missing');
        if (filterButtons.length === 0) console.error('Filter buttons missing (container .users-filter-controls or buttons within).');
        if (!searchInput) console.error('#user-search-input missing'); // Log missing search input
        if (!searchButton) console.error('#user-search-button missing'); // Log missing search button - NEW

        return;
    }

    // Check if the current user is admin
    if (!isAdmin()) {
        usersAdminOnlyDiv.style.display = 'none'; // Hide the form and list
        accessDeniedDiv.style.display = 'block'; // Show the access denied message
        console.log('Access denied to Users section: Not Admin.');
        return;
    } else {
        usersAdminOnlyDiv.style.display = 'block';
        accessDeniedDiv.style.display = 'none';
        console.log(`Access granted to Users section: Admin. Displaying users with filter "${currentUserFilter}" and search term "${currentUserSearchTerm}".`);
    }

    let allUsers = loadUsersFromLocalStorage(); // Load all users
    userListDiv.innerHTML = ''; // Clear current list

    // Update active class on filter buttons
    filterButtons.forEach(button => {
        if (button.dataset.filter === currentUserFilter) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Set the value of the search input to the current search term state
    searchInput.value = currentUserSearchTerm;

    // Sort users alphabetically by name for easier management
    allUsers.sort((a, b) => a.name.localeCompare(b.name));

    // --- Apply Status Filter ---
    let filteredUsersByStatus = allUsers;
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    if (currentUserFilter === 'inactive') {
        filteredUsersByStatus = allUsers.filter(user => user.active === false);
    } else if (currentUserFilter === 'expired') {
        filteredUsersByStatus = allUsers.filter(user => user.expiryDate && user.expiryDate !== '' && user.expiryDate < today);
    }
    // 'all' filter uses the original 'allUsers' array

    // --- Apply Search Term Filter ---
    // Filter the results from the status filter based on the search term
    const finalFilteredUsers = filteredUsersByStatus.filter(user => {
        const searchTermLower = currentUserSearchTerm.toLowerCase();
        // Check if the username (case-insensitive) includes the search term
        return user.name.toLowerCase().includes(searchTermLower);
    });

    const listHeading = document.createElement('h3');
    listHeading.textContent = 'Usuarios Registrados';
    listHeading.style.cssText = 'margin-top: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px; font-size: 1.2rem; color: var(--text-color);'; // Use variables
    userListDiv.appendChild(listHeading);

    if (finalFilteredUsers.length === 0) {
        const msg = document.createElement('p');
        let messageText = '';
        if (currentUserSearchTerm && currentUserFilter !== 'all') {
             messageText = `No se encontraron usuarios "${currentUserFilter}" que coincidan con "${escapeHTML(currentUserSearchTerm)}".`;
        } else if (currentUserSearchTerm) {
             messageText = `No se encontraron usuarios que coincidan con "${escapeHTML(currentUserSearchTerm)}".`;
        } else if (currentUserFilter === 'all') {
             messageText = 'No hay usuarios registrados.';
         } else if (currentUserFilter === 'inactive') {
             messageText = 'No hay usuarios inactivos.';
         } else if (currentUserFilter === 'expired') {
             messageText = 'No hay usuarios caducados.';
         } else {
             messageText = 'No se encontraron usuarios con este filtro.'; // Fallback
         }

        msg.textContent = messageText;
        msg.style.cssText = 'width: 100%; text-align: center; color: var(--text-color-secondary);'; // Center message, use variable
        userListDiv.appendChild(msg);
        console.log(`No users found matching filter "${currentUserFilter}" and search term "${currentUserSearchTerm}".`);

    } else {
        finalFilteredUsers.forEach((user) => {
            const userEntry = document.createElement('div');
            userEntry.classList.add('user-entry');
            // Add a dedicated avatar container for nicer user cards
            const avatarWrapper = document.createElement('div');
            avatarWrapper.classList.add('user-avatar');
            const avatarInner = document.createElement('div');
            avatarInner.classList.add('avatar');
            avatarWrapper.appendChild(avatarInner);
            userEntry.appendChild(avatarWrapper);

            const userInfo = document.createElement('div');
            userInfo.classList.add('user-info'); // Add class for styling user details
            // Format dates for display (YYYY-MM-DD)
            const startDateDisplay = user.startDate ? new Date(user.startDate).toLocaleDateString('es-ES') : '-';
            const expiryDateDisplay = user.expiryDate ? new Date(user.expiryDate).toLocaleDateString('es-ES') : '-';

            // Determine if the user is expired for display
            const isExpired = user.expiryDate && user.expiryDate !== '' && user.expiryDate < today;
            const statusText = isExpired ? 'Caducado' : (user.active ? 'Activo' : 'Inactivo');
            const statusColor = isExpired ? 'var(--error-color)' : (user.active ? 'var(--success-color)' : 'var(--warning-color)');

            userInfo.innerHTML = `
                <p><strong>Usuario:</strong> ${escapeHTML(user.name)} <span class="user-status-indicator" style="color: ${statusColor}; font-weight: normal; font-size: 0.9em;">(${statusText})</span></p>
                <p><strong>Email:</strong> ${escapeHTML(user.email || '-')}</p>
                <p><strong>Inicio:</strong> ${startDateDisplay}</p>
                <p><strong>Caducidad:</strong> ${expiryDateDisplay}</p>
            `;
            userEntry.appendChild(userInfo);

            // --- Add Pet Info Preview or Link ---
            const petInfoDiv = document.createElement('div');
            petInfoDiv.classList.add('user-pet-preview'); // Add class for styling
            const petData = loadPetFromLocalStorage(user.name);

            if (petData && petData.name && petData.owner?.name) {
                // Create a mini pet card preview (or just link)
                const petLink = document.createElement('button'); // Use a button styled as a link
                petLink.textContent = `Ver Mascota: ${escapeHTML(petData.name)}`;
                petLink.classList.add('link-button'); // Custom class for link styling
                petLink.style.cssText = 'background: none; border: none; color: var(--accent-color); text-decoration: underline; cursor: pointer; padding: 0; font-size: 0.9em; margin-top: 5px; text-align: left;'; // Use variable, left align text

                petLink.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent click from triggering the general userEntry click if we added one later
                    displayUserPetModal(user.name); // Open modal for this user's pet
                });
                petInfoDiv.appendChild(petLink);

                // Display pet/avatar thumbnail in the user card (if available)
                try {
                    // avatarInner was added to userEntry; displayAvatar will fall back to default SVG if missing
                    displayAvatar(avatarInner, petData.avatar || null);
                } catch (e) {
                    console.warn('Could not display avatar for user card', e);
                }

            } else {
                const noPetMsg = document.createElement('p');
                noPetMsg.textContent = 'Sin mascota registrada';
                noPetMsg.style.cssText = 'font-size: 0.9em; color: var(--text-color-secondary); margin-top: 5px; text-align: left;'; // Use variable, left align text
                petInfoDiv.appendChild(noPetMsg);
            }
            userEntry.appendChild(petInfoDiv);
            // --- End Pet Info Preview --

            // Add buttons container
            const buttonsContainer = document.createElement('div');
            buttonsContainer.classList.add('user-buttons'); // Add class for styling
            buttonsContainer.style.cssText = 'flex-shrink: 0; display: flex; gap: 5px; margin-left: 10px;'; // Flex container for buttons

            // Add Activate/Deactivate button (only for non-admin)
            if (user.name !== 'adminmas') {
                const toggleButton = document.createElement('button');
                toggleButton.classList.add('toggle-user-status-btn');
                toggleButton.textContent = user.active ? 'Desactivar' : 'Activar';
                toggleButton.classList.add(user.active ? 'deactivate-btn' : 'activate-btn'); // Add specific classes for styling

                // Add toggle event listener
                toggleButton.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent click from triggering any parent click events
                    toggleUserStatus(user.name); // Call toggle function with username
                });
                buttonsContainer.appendChild(toggleButton);
            }

             // --- Add Edit Password Button (only for non-admin) ---
            if (user.name !== 'adminmas') {
                 const editPasswordButton = document.createElement('button');
                 editPasswordButton.classList.add('edit-user-password-btn'); // Add a specific class
                 editPasswordButton.textContent = 'Editar Contraseña';
                  // Add click event listener
                 editPasswordButton.addEventListener('click', function(e) {
                     e.stopPropagation(); // Prevent click from triggering any parent click events
                     editUserPasswordModal(user.name); // Call the new edit password modal function
                 });
                 buttonsContainer.appendChild(editPasswordButton); // Append edit password button
             }
            // --- End Add Edit Password Button ---

            // --- Add Edit Dates Button (only for non-admin) ---
            if (user.name !== 'adminmas') {
                const editButton = document.createElement('button');
                editButton.classList.add('edit-user-dates-btn'); // Add a specific class
                editButton.textContent = 'Editar Fecha';
                editButton.style.cssText = `
                    background-color: var(--accent-color);
                    color: #222;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: background-color 0.2s ease, transform 0.1s ease;
                    flex-shrink: 0;
                `;
                editButton.onmouseover = () => { editButton.style.backgroundColor = '#ffc34d'; }; // Slightly darker accent
                editButton.onmouseout = () => { editButton.style.backgroundColor = 'var(--accent-color)'; };

                // Add click event listener
                editButton.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent click from triggering any parent click events
                    editUserDatesModal(user.name); // Call the new edit dates modal function
                });
                buttonsContainer.appendChild(editButton); // Append edit button
            }
            // --- End Add Edit Dates Button ---

            // Add delete button (only for non-admin)
            if (user.name !== 'adminmas') {
                const deleteButton = document.createElement('button');
                deleteButton.classList.add('delete-user-btn');
                deleteButton.textContent = 'Eliminar';
                // Add delete event listener directly here
                deleteButton.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent click from triggering any parent click events
                    deleteUser(user.name); // Call deleteUser function with username
                });
                buttonsContainer.appendChild(deleteButton); // Append delete button to buttons container
            }

            if (buttonsContainer.hasChildNodes()) { // Only append the container if it has buttons
                userEntry.appendChild(buttonsContainer);
            }

            userListDiv.appendChild(userEntry);
        });
        console.log(`Displayed ${finalFilteredUsers.length} users for filter "${currentUserFilter}" and search term "${currentUserSearchTerm}".`);
    }
}

// Function to toggle user active status
function toggleUserStatus(usernameToToggle) {
    // Re-check admin status before performing action
     if (!isAdmin()) {
         alert('Acceso denegado para cambiar estado del usuario.');
         console.warn('Attempted to toggle user status without admin privileges.');
         return;
     }

    let users = loadUsersFromLocalStorage();
    const userIndex = users.findIndex(user => user.name === usernameToToggle);

    if (userIndex !== -1 && users[userIndex].name !== 'adminmas') { // Ensure user exists and isn't admin
        users[userIndex].active = !users[userIndex].active;
        saveUsersToLocalStorage(users); // Save updated list
        console.log(`User "${usernameToToggle}" status toggled to ${users[userIndex].active ? 'active' : 'inactive'}.`);
        // Refresh the displayed list, maintaining the current filter and search term
        displayUsersList(currentUserFilter, currentUserSearchTerm);
    } else if (userIndex === -1) {
        console.error(`User "${usernameToToggle}" not found for status toggle.`);
    } else {
        console.warn(`Attempted to toggle admin user status.`);
    }
}

// Function to open modal and display form for editing user dates
function editUserDatesModal(username) {
     // Re-check admin status before performing action
     if (!isAdmin()) {
         alert('Acceso denegado para editar fechas de usuario.');
         console.warn('Attempted to edit user dates without admin privileges.');
         return;
     }

    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    const modalDocContent = document.getElementById("modalDocument");

    if (!modal || !modalImg || !modalDocContent) {
        console.error('Modal elements not found for editUserDatesModal.');
        return;
    }

    // Hide image, show document content area
    modalImg.style.display = "none";
    modalDocContent.style.display = "block";
    modalDocContent.innerHTML = ''; // Clear previous content

    // Load user data
    const users = loadUsersFromLocalStorage();
    const targetUserIndex = users.findIndex(user => user.name === username); // Find index to update correctly
    const targetUser = users[targetUserIndex];

    if (!targetUser) {
        modalDocContent.innerHTML = `<p style="color: var(--error-color);">Error: Usuario "${escapeHTML(username)}" no encontrado.</p>`;
        modal.style.display = "block";
        console.error(`User "${username}" not found for date editing.`);
        return;
    }
     // Prevent editing admin user dates
     if (targetUser.name === 'adminmas') {
          modalDocContent.innerHTML = `<p style="color: var(--warning-color);">No se pueden editar las fechas del usuario administrador.</p>`;
          modal.style.display = "block";
          console.warn('Attempted to edit admin user dates.');
          return;
     }

    // Create a wrapper div inside modalDocContent for better structure and styling
    const modalContentWrapper = document.createElement('div');
    modalContentWrapper.classList.add('modal-form-content'); // Add a class for styling
    modalContentWrapper.style.cssText = 'width: 100%; max-width: 400px; margin: 0 auto; text-align: center;';
    modalDocContent.appendChild(modalContentWrapper); // Append the wrapper

    // Create the form structure inside the wrapper
    const formHtml = `
        <h3 style="margin-top: 0;">Editar Fechas de Usuario: ${escapeHTML(targetUser.name)}</h3>
        <form id="edit-user-dates-form" class="simple-form" style="max-width: none; margin: 20px 0;">
            <div class="form-group">
                <label for="modal-start-date">Fecha de Inicio</label>
                <input type="date" id="modal-start-date" value="${targetUser.startDate || ''}">
            </div>
            <div class="form-group">
                <label for="modal-expiry-date">Fecha de Caducidad</label>
                <input type="date" id="modal-expiry-date" value="${targetUser.expiryDate || ''}">
            </div>
            <button type="submit" class="save-btn" style="width: 100%;">Guardar Cambios</button>
            <button type="button" class="save-btn danger-btn" id="modal-cancel-button" style="width: 100%; margin-top: 10px;">Cancelar</button>
        </form>
    `;

    modalContentWrapper.innerHTML = formHtml; // Put the form inside the wrapper

    // Get the form and buttons from the modal content wrapper
    const editDatesForm = modalContentWrapper.querySelector('#edit-user-dates-form');
    const startDateInput = modalContentWrapper.querySelector('#modal-start-date');
    const expiryDateInput = modalContentWrapper.querySelector('#modal-expiry-date');
    const cancelButton = modalContentWrapper.querySelector('#modal-cancel-button');

    if (editDatesForm && startDateInput && expiryDateInput && cancelButton) {
        // Add submit listener to the form
        editDatesForm.addEventListener('submit', function(event) {
            event.preventDefault();

            // Get the new dates
            const newStartDate = startDateInput.value;
            const newExpiryDate = expiryDateInput.value;

            // Update the user data in the array at the specific index
            if (targetUserIndex !== -1) { // Double check index is still valid
                 users[targetUserIndex].startDate = newStartDate;
                 users[targetUserIndex].expiryDate = newExpiryDate;

                 // Save the updated users array back to localStorage
                 saveUsersToLocalStorage(users);

                 console.log(`Dates updated for user "${username}": Start=${newStartDate}, Expiry=${newExpiryDate}`);

                 // Refresh the users list display (using the current filter and search term)
                 displayUsersList(currentUserFilter, currentUserSearchTerm);

             } else {
                  console.error(`User index for "${username}" not found during form submit.`);
                  // Maybe display error message in modal?
             }

            // Close the modal
            modal.style.display = "none";
        });

        // Add click listener to the cancel button
        cancelButton.addEventListener('click', function() {
            modal.style.display = "none"; // Just close the modal
        });

    } else {
        console.error('Modal form elements not found after rendering.');
    }

    // Display the modal
    modal.style.display = "block";
    console.log(`Edit dates modal opened for user: ${username}`);
}


// --- NEW: Function to open modal and display form for editing user password ---
function editUserPasswordModal(username) {
     // Re-check admin status before performing action
     if (!isAdmin()) {
         alert('Acceso denegado para cambiar contraseña del usuario.');
         console.warn('Attempted to edit user password without admin privileges.');
         return;
     }

    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    const modalDocContent = document.getElementById("modalDocument");

    if (!modal || !modalImg || !modalDocContent) {
        console.error('Modal elements not found for editUserPasswordModal.');
        return;
    }

    // Hide image, show document content area
    modalImg.style.display = "none";
    modalDocContent.style.display = "block";
    modalDocContent.innerHTML = ''; // Clear previous content

    // Load user data
    const users = loadUsersFromLocalStorage();
    const targetUserIndex = users.findIndex(user => user.name === username); // Find index to update correctly
    const targetUser = users[targetUserIndex];

    if (!targetUser) {
        modalDocContent.innerHTML = `<p style="color: var(--error-color);">Error: Usuario "${escapeHTML(username)}" no encontrado.</p>`;
        modal.style.display = "block";
        console.error(`User "${username}" not found for password editing.`);
        return;
    }

    // Create a wrapper div inside modalDocContent for better structure and styling
    const modalContentWrapper = document.createElement('div');
    modalContentWrapper.classList.add('modal-form-content'); // Add a class for styling
    modalContentWrapper.style.cssText = 'width: 100%; max-width: 400px; margin: 0 auto; text-align: center;';
    modalDocContent.appendChild(modalContentWrapper); // Append the wrapper

    // Create the form structure inside the wrapper
    const formHtml = `
        <h3 style="margin-top: 0;">Editar Contraseña de Usuario: ${escapeHTML(targetUser.name)}</h3>
        <form id="edit-user-password-form" class="simple-form" style="max-width: none; margin: 20px 0;">
            <div class="form-group">
                <label for="modal-new-password">Nueva Contraseña</label>
                <input type="password" id="modal-new-password" required>
            </div>
            <div class="form-group">
                <label for="modal-confirm-password">Confirmar Contraseña</label>
                <input type="password" id="modal-confirm-password" required>
            </div>
            <button type="submit" class="save-btn" style="width: 100%;">Guardar Cambios</button>
            <button type="button" class="save-btn danger-btn" id="modal-cancel-button" style="width: 100%; margin-top: 10px;">Cancelar</button>
        </form>
    `;

    modalContentWrapper.innerHTML = formHtml; // Put the form inside the wrapper

    // Get the form and buttons from the modal content wrapper
    const editPasswordForm = modalContentWrapper.querySelector('#edit-user-password-form');
    const newPasswordInput = modalContentWrapper.querySelector('#modal-new-password');
    const confirmPasswordInput = modalContentWrapper.querySelector('#modal-confirm-password');
    const cancelButton = modalContentWrapper.querySelector('#modal-cancel-button');

    if (editPasswordForm && newPasswordInput && confirmPasswordInput && cancelButton) {
        // Add submit listener to the form
        editPasswordForm.addEventListener('submit', function(event) {
            event.preventDefault();

            // Get the new password and confirmation
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword !== confirmPassword) {
                alert('Las contraseñas no coinciden.');
                return;
            }

            // Update the user password in the array at the specific index
            if (targetUserIndex !== -1) { // Double check index is still valid
                users[targetUserIndex].password = newPassword;

                // Save the updated users array back to localStorage
                saveUsersToLocalStorage(users);

                console.log(`Password updated for user "${username}".`);

                // Refresh the users list display (using the current filter and search term)
                displayUsersList(currentUserFilter, currentUserSearchTerm);

            } else {
                console.error(`User index for "${username}" not found during form submit.`);
                // Maybe display error message in modal?
            }

            // Close the modal
            modal.style.display = "none";
        });

        // Add click listener to the cancel button
        cancelButton.addEventListener('click', function() {
            modal.style.display = "none"; // Just close the modal
        });

    } else {
        console.error('Modal form elements not found after rendering.');
    }

    // Display the modal
    modal.style.display = "block";
    console.log(`Edit password modal opened for user: ${username}`);
}

function displayUserPetModal(username) {
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    const modalDocContent = document.getElementById("modalDocument");

    if (!modal || !modalImg || !modalDocContent) {
        console.error('Modal elements not found for displayUserPetModal.');
        return;
    }

    // Hide image, show document content area
    modalImg.style.display = "none";
    modalDocContent.style.display = "block";
    modalDocContent.innerHTML = ''; // Clear previous content

    // Create a container specifically for the pet card within the modal content div
    const modalContentWrapper = document.createElement('div');
    modalContentWrapper.classList.add('modal-user-pet-details'); // Specific class for styling this modal type
    modalContentWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 100%;'; // Add flex styles
    modalDocContent.appendChild(modalContentWrapper); // Append the wrapper

    // --- Display User Account Details ---
    const users = loadUsersFromLocalStorage();
    const targetUser = users.find(user => user.name === username);

    const userDetailsDiv = document.createElement('div');
    userDetailsDiv.classList.add('modal-user-details');
    userDetailsDiv.style.cssText = 'width: 100%; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed var(--border-color-dashed); text-align: center;'; // Add styles, center text
    if (targetUser) {
        // Format dates for display (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];
        const startDateDisplay = targetUser.startDate ? new Date(targetUser.startDate).toLocaleDateString('es-ES') : '-';
        const expiryDateDisplay = targetUser.expiryDate ? new Date(targetUser.expiryDate).toLocaleDateString('es-ES') : '-';

        const isExpired = targetUser.expiryDate && targetUser.expiryDate !== '' && targetUser.expiryDate < today;
        const statusText = isExpired ? 'Caducada' : (targetUser.active ? 'Activa' : 'Inactiva');
        const statusColor = isExpired ? 'var(--error-color)' : (targetUser.active ? 'var(--success-color)' : 'var(--warning-color)');

        // Prepend the app name to the modal header for clear branding
        const appName = loadAppName();
        userDetailsDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--text-color-secondary);"><span class="pet-icon">🐾</span> ${escapeHTML(appName)}</h4>
            <h3 style="margin-top: 0;">Cuenta de Usuario</h3>
            <p><strong>Usuario:</strong> <span class="pet-icon">👤</span> ${escapeHTML(targetUser.name)}</p>
            <p><strong>Estado:</strong> <span style="color: ${statusColor};">${statusText}</span></p>
            <p><strong>Inicio:</strong> ${startDateDisplay}</p>
            <p><strong>Caducidad:</strong> ${expiryDateDisplay}</p>
        `;
    } else {
        userDetailsDiv.innerHTML = `<h3 style="margin-top: 0;">Cuenta de Usuario</h3><p>Datos de usuario no encontrados.</p>`;
    }
    modalContentWrapper.appendChild(userDetailsDiv);

    // --- Display Pet Details (if available) ---
    const petDetailsDiv = document.createElement('div');
    petDetailsDiv.classList.add('modal-pet-card-container'); // Reuse this class name for styling

    const petData = loadPetFromLocalStorage(username);

    if (petData && petData.name) { // Pet data exists if it has a name
        // Create the pet card structure manually here to include phone/location links specific to the modal
        const petCard = document.createElement('div');
        petCard.classList.add('pet-card'); // Use existing pet-card class for styling
         // Add 'lost' class if the pet is marked as lost
         if (petData.lost) {
             petCard.classList.add('lost');
         }
         petCard.style.cssText = 'flex-direction: column; align-items: center; text-align: center; width: 100%; max-width: 350px; margin-bottom: 15px;'; // Override flex direction for modal view

        // Avatar
        const avatarContainer = document.createElement('div');
        avatarContainer.classList.add('pet-card-avatar');
        avatarContainer.style.cssText = 'width: 100px; height: 100px;'; // Set size
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar'); // Use existing avatar class
        avatarDiv.style.cssText = 'width: 100%; height: 100%; border: 3px solid var(--accent-color);'; // Ensure size within container and border
        avatarContainer.appendChild(avatarDiv);
        petCard.appendChild(avatarContainer);
        // Display the avatar *after* the div is added to the DOM
         // Append the avatar container to the petCard first, then display the avatar
        setTimeout(() => { // Use a small timeout to ensure the div is fully in the DOM before displaying SVG/Image
            displayAvatar(avatarDiv, petData.avatar || null);
        }, 0);

        // Info
        const infoDiv = document.createElement('div');
        infoDiv.classList.add('pet-card-info');
        infoDiv.style.cssText = 'width: 100%;'; // Take full width within flex column
        infoDiv.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 1.2rem; border-bottom: none; padding-bottom: 0;"><span class="pet-icon">🐾</span> ${escapeHTML(petData.name || 'Sin Nombre')}</h3>
            ${petData.breed ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Raza:</strong> <span class="pet-icon">🐶</span> ${escapeHTML(petData.breed)}</p>` : ''}
             ${petData.sex ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Sexo:</strong> <span class="pet-icon">⚥</span> ${escapeHTML(petData.sex)}</p>` : ''}
             ${petData.pedigree ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Pedigrí:</strong> <span class="pet-icon">🏷️</span> ${escapeHTML(petData.pedigree)}</p>` : ''}
             ${petData.sterilized ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Esterilizado:</strong> <span class="pet-icon">✂️</span> ${escapeHTML(petData.sterilized)}</p>` : ''}
             ${petData.birthdate ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Fecha de Nacimiento:</strong> <span class="pet-icon">🎂</span> ${new Date(petData.birthdate).toLocaleDateString('es-ES')}</p>` : ''}
             ${petData.age ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Edad:</strong> <span class="pet-icon">🕒</span> ${escapeHTML(petData.age)}</p>` : ''}
             ${petData.color ? `<p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Color:</strong> <span class="pet-icon">🎨</span> ${escapeHTML(petData.color)}</p>` : ''}
             ${petData.notes ? `<p style="margin: 0 0 10px 0; font-size: 1rem;"><strong>Notas:</strong> <span class="pet-icon">📝</span> ${escapeHTML(petData.notes)}</p>` : ''}

            ${petData.lost ? `<p style="color: var(--lost-status-color); font-weight: bold; margin-bottom: 10px;">¡PERDIDA!</p>` : ''}

            <h4 style="margin-top: 15px; margin-bottom: 10px; font-size: 1.1rem; border-bottom: 1px dashed var(--border-color-dashed); padding-bottom: 5px;">Información del Dueño</h4>
             <p style="margin: 0 0 5px 0; font-size: 1rem;"><strong>Dueño:</strong> ${escapeHTML(petData.owner?.name || '-')}</p>
        `;
        petCard.appendChild(infoDiv);

         // Separate Phone and Location to add buttons
         const phone = petData.owner?.phone || '-';
         const ownerPhoneParagraph = document.createElement('p');
         ownerPhoneParagraph.style.cssText = 'margin: 0 0 5px 0; font-size: 1rem; text-align: center;';
         ownerPhoneParagraph.innerHTML = `<strong>Teléfono:</strong> ${escapeHTML(phone)}`;
         if (phone !== '-' && phone.trim() !== '') {
             const whatsappLink = document.createElement('a');
             const phoneNumberClean = phone.replace(/\D/g, ''); // Clean non-digits
             whatsappLink.href = `https://wa.me/${phoneNumberClean}`;
             whatsappLink.textContent = 'Enviar WhatsApp';
             whatsappLink.target = '_blank';
             whatsappLink.classList.add('panel-button'); // Reuse panel button styles
             whatsappLink.classList.add('whatsapp-button');
              whatsappLink.style.cssText += ' margin-left: 10px; display: inline-block; font-size: 0.9rem; padding: 4px 8px;'; // Add specific styles for modal
             ownerPhoneParagraph.appendChild(whatsappLink);
         }
         petCard.appendChild(ownerPhoneParagraph); // Add to petCard

         const location = petData.owner?.location || '-';
         const ownerLocationParagraph = document.createElement('p');
         ownerLocationParagraph.style.cssText = 'margin: 0 0 5px 0; font-size: 1rem; text-align: center;';
         ownerLocationParagraph.innerHTML = `<strong>Ubicación:</strong> ${escapeHTML(location)}`;
         if (location !== '-' && location.trim() !== '') {
             const locationLink = document.createElement('a');
             locationLink.textContent = 'Ver Ubicación';
             locationLink.target = '_blank';
             locationLink.classList.add('panel-button');
             locationLink.classList.add('location-button');
              locationLink.style.cssText += ' margin-left: 10px; display: inline-block; font-size: 0.9rem; padding: 4px 8px;'; // Add specific styles for modal

             // Check if it's likely a URL (simplified check)
             if (location.startsWith('http://') || location.startsWith('https://') || location.startsWith('www.') || location.includes('google.com/maps')) {
                 locationLink.href = location.startsWith('http') ? location : `https://${location}`;
             } else {
                 // If not a URL, create a google search link for the text
                 locationLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
             }
             ownerLocationParagraph.appendChild(locationLink);
         }
         petCard.appendChild(ownerLocationParagraph); // Add to petCard

        petDetailsDiv.appendChild(petCard); // Append the full pet card to the pet details div

    } else {
        const noPetMsg = document.createElement('p');
        noPetMsg.textContent = 'Sin mascota registrada';
        noPetMsg.style.cssText = 'font-size: 0.9em; color: var(--text-color-secondary);';
        petDetailsDiv.appendChild(noPetMsg);
    }
    modalContentWrapper.appendChild(petDetailsDiv); // Append pet details container to the modal content wrapper

    modalDocContent.appendChild(modalContentWrapper); // Add the main content wrapper to the modal content area

    // Display the modal
    modal.style.display = "block";
    console.log(`User pet modal opened for user: ${username}`);
}

function deleteUser(usernameToDelete) {
    let users = loadUsersFromLocalStorage();
    const userIndex = users.findIndex(user => user.name === usernameToDelete);

    if (userIndex !== -1 && users[userIndex].name !== 'adminmas') { // Ensure user exists and isn't admin
        // Use custom confirm dialog for a nicer UX
        window.showConfirmDialog(
            'Eliminar Usuario',
            `¿Confirmar para eliminar el usuario "${usernameToDelete}"? Esto eliminará también todos los datos asociados (mascota, galería, documentos, intentos de inicio de sesión).`,
            { confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true }
        ).then(confirmed => {
            if (!confirmed) return;
            try {
                localStorage.removeItem('petProfileData_' + usernameToDelete);
                localStorage.removeItem('galleryData_' + usernameToDelete);
                localStorage.removeItem('docsData_' + usernameToDelete);
                localStorage.removeItem('loginAttempts_' + usernameToDelete); // Also clear login attempt data
                console.log(`Deleted data for user: ${usernameToDelete}`);
            } catch (e) {
                console.error(`Error deleting user data for ${usernameToDelete} from localStorage:`, e);
            }
            users.splice(userIndex, 1); // Remove user at index
            saveUsersToLocalStorage(users); // Save updated list
            alert('Usuario eliminado.');
            displayUsersList(currentUserFilter, currentUserSearchTerm);
        });
    } else if (userIndex === -1) {
        console.error(`User "${usernameToDelete}" not found for deletion.`);
    } else {
        console.warn(`Attempted to delete admin user.`);
    }
}

export function initUsersSection() {
    const userForm = document.getElementById('user-form');
    const userNameInput = document.getElementById('user-name-input');
    const userPasswordInput = document.getElementById('user-password-input');
    const usersAdminOnlyDiv = document.getElementById('users-admin-only'); // Needed to find filter buttons

    // Listener setup should only happen once, regardless of admin status
    // Access check happens inside displayUsersList and the submit listener itself
    if (userForm && userNameInput && userPasswordInput) {
        userForm.addEventListener('submit', function(event) {
            event.preventDefault();

            // Re-check admin status on submit
            if (!isAdmin()) {
                alert('Acceso denegado para añadir usuarios.');
                userForm.reset(); // Clear form
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

            // Basic email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Por favor, introduce un correo electrónico válido.');
                return;
            }

            // Basic check for duplicate name or email (optional but good practice)
            let users = loadUsersFromLocalStorage(); // Use let because we might modify it
            // Also prevent adding a user with the admin name
            if (users.some(user => user.name === name) || name === 'adminmas') {
                alert(`El usuario "${name}" ya existe o es un nombre reservado.`);
                return;
            }
            if (users.some(user => user.email && user.email.toLowerCase() === email)) {
                alert(`El correo "${email}" ya está en uso.`);
                return;
            }

            // Add new user with active: true status
            const newUser = { name: name, email: email, password: password, active: true, startDate: new Date().toISOString().split('T')[0], expiryDate: '' }; // New users are active by default

            users.push(newUser);
            saveUsersToLocalStorage(users);

            alert(`Usuario "${name}" añadido y activado!`);

            userForm.reset(); // Reset the form inputs
            displayUsersList(); // Refresh the displayed list of users immediately
        });
        console.log('User form listener initialized.');
    } else {
        console.warn('User form (#user-form) or some required inputs not found. User section submit logic not fully initialized.');
    }

    // --- Add filter button listeners ---
    // Find the filter controls container *within* usersAdminOnlyDiv if it exists
    const filterControlsDiv = usersAdminOnlyDiv ? usersAdminOnlyDiv.querySelector('.users-filter-controls') : null;
    const filterButtons = filterControlsDiv ? filterControlsDiv.querySelectorAll('.filter-button') : [];

    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                const filter = this.dataset.filter; // Get the filter value from data-filter attribute
                displayUsersList(filter); // Call displayUsersList with the selected filter
            });
        });
        console.log('Users section filter listeners initialized.'); // Add a log
    } else {
        console.warn('User section filter buttons not found within .users-filter-controls. Filter listeners not initialized.'); // Add a log
    }
    // --- End Add filter button listeners ---

    // Wire up search input and button to refresh the list (improves UX)
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