// Control Section - Admin can change global upload limits and inspect per-user usage
import { isAdmin } from './loginHandler.js';
import {
    loadDocsFromLocalStorage,
    saveAdminGalleryLimit,
    loadAdminGalleryLimit,
    saveAdminDocLimit,
    loadAdminDocLimit,
    saveUserGalleryLimit,
    loadUserGalleryLimit,
    saveUserDocLimit,
    loadUserDocLimit
} from './storage.js';
import { db } from './firebase-init.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export function initControlSection() {
    const controlSection = document.getElementById('control-section');
    if (!controlSection) return;

    const galleryInput = document.getElementById('gallery-limit-input');
    const docsInput = document.getElementById('docs-limit-input');
    const form = document.getElementById('admin-limit-form');
    const successMsg = document.getElementById('control-success-msg');
    const errorMsg = document.getElementById('control-error-msg');
    const userSelect = document.getElementById('control-user-select');
    const galleryCountP = document.getElementById('control-user-gallery-count');
    const docsCountP = document.getElementById('control-user-docs-count');

    // Access control: hide section for non-admins
    if (!isAdmin()) {
        controlSection.style.display = 'none';
        return;
    } else {
        controlSection.style.display = 'block';
    }

    // Populate current limits into inputs
    galleryInput.value = loadAdminGalleryLimit();
    docsInput.value = loadAdminDocLimit();

    // Populate users dropdown
    async function refreshUserList() {
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        userSelect.innerHTML = '';
        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.textContent = '-- Selecciona --';
        userSelect.appendChild(placeholderOpt);
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id; // Use UID as value
            opt.textContent = u.email; // Display email
            userSelect.appendChild(opt);
        });

        // Also populate a visual user list to the side for faster selection
        const visualListContainerId = 'control-users-visual-list';
        let visualList = document.getElementById(visualListContainerId);
        if (!visualList) {
            visualList = document.createElement('div');
            visualList.id = visualListContainerId;
            visualList.style.cssText = 'margin-top:18px; display:flex; flex-direction:column; gap:8px;';
            userSelect.parentNode.appendChild(visualList);
        }
        visualList.innerHTML = '';
        users.forEach(u => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'control-user-card';
            card.textContent = `${u.email} ${u.active? '•' : '✕'}`;
            card.title = `Seleccionar ${u.email}`;
            card.onclick = () => { userSelect.value = u.id; userSelect.dispatchEvent(new Event('change')); };
            visualList.appendChild(card);
        });
    }
    refreshUserList();

    // Update selected user's usage and show per-user limits when selected
    async function updateSelectedUserUsage(userId) {
        if (!userId) {
            galleryCountP.textContent = 'Fotos: —';
            docsCountP.textContent = 'Documentos: —';
            // restore inputs to global defaults
            galleryInput.value = loadAdminGalleryLimit();
            docsInput.value = loadAdminDocLimit();
            return;
        }

        const galleryDocRef = doc(db, "galleries", userId);
        const galleryDocSnap = await getDoc(galleryDocRef);
        const gallery = galleryDocSnap.exists() ? galleryDocSnap.data().images || [] : [];

        // TODO: Migrate docs section and replace loadDocsFromLocalStorage
        const docs = loadDocsFromLocalStorage(userId) || []; 
        
        const gLimitUser = loadUserGalleryLimit(userId);
        const dLimitUser = loadUserDocLimit(userId);
        const gLimit = Number.isInteger(gLimitUser) && gLimitUser > 0 ? gLimitUser : loadAdminGalleryLimit();
        const dLimit = Number.isInteger(dLimitUser) && dLimitUser > 0 ? dLimitUser : loadAdminDocLimit();
        galleryCountP.innerHTML = `Fotos: ${gallery.length} / ${gLimit}`;
        docsCountP.innerHTML = `Documentos: ${docs.length} / ${dLimit}`;
        // set inputs to the effective per-user limit (or global if none)
        galleryInput.value = gLimit;
        docsInput.value = dLimit;
    }

    userSelect.addEventListener('change', () => updateSelectedUserUsage(userSelect.value));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // simple validation
        const g = parseInt(galleryInput.value, 10);
        const d = parseInt(docsInput.value, 10);
        if (!Number.isInteger(g) || g < 1 || !Number.isInteger(d) || d < 1) {
            errorMsg.style.display = 'block'; successMsg.style.display = 'none';
            errorMsg.textContent = 'Introduce valores válidos (enteros ≥ 1).';
            return;
        }

        // If a user is selected, save per-user limits; otherwise save global admin defaults
        const selectedUser = userSelect.value;
        if (selectedUser) {
            saveUserGalleryLimit(selectedUser, g);
            saveUserDocLimit(selectedUser, d);
            successMsg.style.display = 'block'; errorMsg.style.display = 'none';
            successMsg.textContent = `Límites por usuario guardados para "${selectedUser}": fotos ${g}, documentos ${d}.`;
        } else {
            saveAdminGalleryLimit(g);
            saveAdminDocLimit(d);
            successMsg.style.display = 'block'; errorMsg.style.display = 'none';
            successMsg.textContent = `Límites globales guardados: fotos ${g}, documentos ${d}.`;
        }

        // Visual feedback: brief pulse animation
        successMsg.classList.remove('pop-success');
        // force reflow
        void successMsg.offsetWidth;
        successMsg.classList.add('pop-success');

        // Refresh current user usage display (if any)
        updateSelectedUserUsage(userSelect.value);
        // hide message after a short delay
        setTimeout(() => successMsg.style.display = 'none', 3500);
    });
}

export function loadControlSection() {
    // small helper in case other modules want to refresh user list or stats in the future
    const userSelect = document.getElementById('control-user-select');
    if (userSelect) {
        // trigger rebuild
        const ev = new Event('change');
        userSelect.dispatchEvent(ev);
    }
}