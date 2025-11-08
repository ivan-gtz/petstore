// --- Usuarios Section Logic ---
import { db } from './firebase-init.js';
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { isAdmin } from './loginHandler.js';

// Module-level variables to store the current filter state
let currentUserFilter = 'all';
let currentUserSearchTerm = '';

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Function to display users list with inline editing, filtering, and searching
export async function displayUsersList() {
    const userListDiv = document.getElementById('user-list');
    const usersAdminOnlyDiv = document.getElementById('users-admin-only');
    const accessDeniedDiv = document.getElementById('users-access-denied');
    const filterButtons = document.querySelectorAll('.users-filter-controls .filter-button');
    const searchInput = document.getElementById('user-search-input');

    if (!userListDiv || !usersAdminOnlyDiv || !accessDeniedDiv) {
        console.error('Users section elements not fully found.');
        return;
    }

    if (!isAdmin()) {
        usersAdminOnlyDiv.style.display = 'none';
        accessDeniedDiv.style.display = 'block';
        return;
    }

    usersAdminOnlyDiv.style.display = 'block';
    accessDeniedDiv.style.display = 'none';

    // Update active state on filter buttons
    filterButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.filter === currentUserFilter);
    });
    // Set search input value
    if (searchInput) {
        searchInput.value = currentUserSearchTerm;
    }

    const usersCollection = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollection);
    let allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // --- Filtering and Searching Logic ---
    const today = new Date().toISOString().split('T')[0];
    let filteredUsers = allUsers;

    // Apply status filter
    if (currentUserFilter === 'inactive') {
        filteredUsers = allUsers.filter(user => user.active === false);
    } else if (currentUserFilter === 'expired') {
        filteredUsers = allUsers.filter(user => user.expiryDate && user.expiryDate < today);
    }

    // Apply search term filter
    const searchTerm = currentUserSearchTerm.toLowerCase();
    if (searchTerm) {
        filteredUsers = filteredUsers.filter(user => {
            const name = (user.name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return name.includes(searchTerm) || email.includes(searchTerm);
        });
    }
    // --- End Filtering and Searching ---

    userListDiv.innerHTML = ''; // Clear previous list

    const listHeading = document.createElement('h3');
    listHeading.textContent = 'Gestionar Usuarios';
    listHeading.style.cssText = 'margin-top: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px;';
    userListDiv.appendChild(listHeading);

    if (filteredUsers.length === 0) {
        userListDiv.innerHTML += '<p>No se encontraron usuarios que coincidan con los criterios.</p>';
        return;
    }

    filteredUsers.sort((a, b) => (a.email || '').localeCompare(b.email || ''));

    filteredUsers.forEach(user => {
        const userEntry = document.createElement('div');
        userEntry.classList.add('user-entry-edit');
        userEntry.dataset.userId = user.id;

        const userEmail = escapeHTML(user.email || 'N/A');
        const userName = escapeHTML(user.name || '');
        const userExpiry = user.expiryDate || '';
        const userRole = escapeHTML(user.role || 'client');
        const userIsActive = user.active === true;

        userEntry.innerHTML = `
            <div class="user-field">
                <label>Email</label>
                <input type="text" value="${userEmail}" readonly class="readonly-input">
            </div>
            <div class="user-field">
                <label for="name-${user.id}">Nombre</label>
                <input type="text" id="name-${user.id}" value="${userName}">
            </div>
            <div class="user-field">
                <label for="expiry-${user.id}">Caducidad</label>
                <input type="date" id="expiry-${user.id}" value="${userExpiry}">
            </div>
            <div class="user-field">
                <label for="role-${user.id}">Rol</label>
                <select id="role-${user.id}">
                    <option value="client" ${userRole === 'client' ? 'selected' : ''}>Cliente</option>
                    <option value="admin" ${userRole === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="user-field-checkbox">
                <label for="active-${user.id}">Activo</label>
                <input type="checkbox" id="active-${user.id}" ${userIsActive ? 'checked' : ''}>
            </div>
            <div class="user-buttons">
                <button class="save-user-btn">Guardar</button>
                <button class="delete-user-btn">Eliminar</button>
            </div>
        `;

        userListDiv.appendChild(userEntry);
    });

    // Add event listeners for all save and delete buttons
    userListDiv.querySelectorAll('.save-user-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const userEntry = e.target.closest('.user-entry-edit');
            const userId = userEntry.dataset.userId;
            
            const name = userEntry.querySelector(`#name-${userId}`).value;
            const expiryDate = userEntry.querySelector(`#expiry-${userId}`).value;
            const role = userEntry.querySelector(`#role-${userId}`).value;
            const active = userEntry.querySelector(`#active-${userId}`).checked;

            const userDocRef = doc(db, "users", userId);
            try {
                await updateDoc(userDocRef, { name, expiryDate, role, active });
                alert(`Usuario ${userEntry.querySelector('input[type="text"]').value} actualizado.`);
            } catch (error) {
                console.error("Error updating user:", error);
                alert(`Error al actualizar el usuario.`);
            }
        });
    });

    userListDiv.querySelectorAll('.delete-user-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const userEntry = e.target.closest('.user-entry-edit');
            const userId = userEntry.dataset.userId;
            const userEmail = userEntry.querySelector('input[type="text"]').value;

            const confirmed = await window.showConfirmDialog(
                'Eliminar Usuario',
                `¿Confirmar para eliminar el usuario "${userEmail}"? Esto es permanente y solo borra el perfil, no la autenticación.`,
                { confirmText: 'Eliminar', danger: true }
            );

            if (confirmed) {
                try {
                    await deleteDoc(doc(db, "users", userId));
                    await deleteDoc(doc(db, "pets", userId)); // Also delete associated pet data
                    userEntry.remove();
                    alert('Perfil de usuario eliminado.');
                } catch (error) {
                    console.error("Error deleting user:", error);
                    alert('Error al eliminar el usuario.');
                }
            }
        });
    });
}

export function initUsersSection() {
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.style.display = 'none';
        const formTitle = document.querySelector('#users-admin-only h3');
        if(formTitle) {
            const disabledMsg = document.createElement('p');
            disabledMsg.innerHTML = 'La creación de usuarios se gestiona directamente en <strong>Firebase Authentication</strong>.';
            disabledMsg.style.textAlign = 'center';
            formTitle.insertAdjacentElement('afterend', disabledMsg);
        }
    }

    // --- Initialize Filter and Search Listeners ---
    const filterButtons = document.querySelectorAll('.users-filter-controls .filter-button');
    const searchInput = document.getElementById('user-search-input');
    const searchButton = document.getElementById('user-search-button');

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            currentUserFilter = this.dataset.filter;
            displayUsersList();
        });
    });

    const performSearch = () => {
        currentUserSearchTerm = searchInput.value;
        displayUsersList();
    };

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }
    // --- End Listeners ---

    console.log('Users section initialized with search and filter.');
}
