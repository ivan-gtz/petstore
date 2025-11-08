// Control Section - Admin can change global upload limits and inspect per-user usage
import { isAdmin } from './loginHandler.js';
import {
    saveAdminGalleryLimit,
    loadAdminGalleryLimit,
    saveUserGalleryLimit,
    loadUserGalleryLimit
} from './storage.js'; // Keep gallery functions for now
import { db } from './firebase-init.js';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const DEFAULT_DOC_LIMIT = 10; // A fallback default

// Helper to get document count for a user from Firestore
async function getUserDocCount(userId) {
    if (!userId) return 0;
    const q = query(collection(db, "documents"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
}

// Helper to get the global doc limit from Firestore
async function getGlobalDocLimit() {
    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && settingsSnap.data().docLimit) {
        return settingsSnap.data().docLimit;
    }
    return DEFAULT_DOC_LIMIT; // Fallback
}

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

    if (!isAdmin()) {
        controlSection.style.display = 'none';
        return;
    } else {
        controlSection.style.display = 'block';
    }

    // Populate current limits into inputs from Firestore
    async function populateInitialLimits() {
        galleryInput.value = loadAdminGalleryLimit(); // Keep using local storage for gallery for now
        docsInput.value = await getGlobalDocLimit();
    }
    populateInitialLimits();

    // Populate users dropdown
    async function refreshUserList() {
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        userSelect.innerHTML = '<option value="">-- Selecciona --</option>';
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.email || u.id;
            userSelect.appendChild(opt);
        });
    }
    refreshUserList();

    // Update selected user's usage and show per-user limits
    async function updateSelectedUserUsage(userId) {
        const globalDocLimit = await getGlobalDocLimit();
        if (!userId) {
            galleryCountP.textContent = 'Fotos: —';
            docsCountP.textContent = 'Documentos: —';
            galleryInput.value = loadAdminGalleryLimit();
            docsInput.value = globalDocLimit;
            return;
        }

        // Fetch user data to get their specific limit
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const docCount = await getUserDocCount(userId);
        const userDocLimit = userData.docLimit || globalDocLimit;

        docsCountP.innerHTML = `Documentos: ${docCount} / ${userDocLimit}`;
        docsInput.value = userDocLimit;

        // Gallery part (still using local storage for now)
        const galleryDocRef = doc(db, "galleries", userId);
        const galleryDocSnap = await getDoc(galleryDocRef);
        const gallery = galleryDocSnap.exists() ? galleryDocSnap.data().images || [] : [];
        const gLimitUser = loadUserGalleryLimit(userId);
        const gLimit = Number.isInteger(gLimitUser) && gLimitUser > 0 ? gLimitUser : loadAdminGalleryLimit();
        galleryCountP.innerHTML = `Fotos: ${gallery.length} / ${gLimit}`;
        galleryInput.value = gLimit;
    }

    userSelect.addEventListener('change', () => updateSelectedUserUsage(userSelect.value));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const g = parseInt(galleryInput.value, 10);
        const d = parseInt(docsInput.value, 10);
        if (!Number.isInteger(g) || g < 1 || !Number.isInteger(d) || d < 1) {
            errorMsg.textContent = 'Introduce valores válidos (enteros ≥ 1).';
            errorMsg.style.display = 'block';
            successMsg.style.display = 'none';
            return;
        }

        const selectedUserId = userSelect.value;
        try {
            if (selectedUserId) {
                // Save per-user limits
                saveUserGalleryLimit(selectedUserId, g); // Keep local storage for gallery
                const userRef = doc(db, "users", selectedUserId);
                await updateDoc(userRef, { docLimit: d });
                successMsg.textContent = `Límites guardados para el usuario.`;
            } else {
                // Save global limits
                saveAdminGalleryLimit(g); // Keep local storage for gallery
                const settingsRef = doc(db, "settings", "globalLimits");
                await setDoc(settingsRef, { docLimit: d }, { merge: true });
                successMsg.textContent = `Límites globales guardados.`;
            }
            successMsg.style.display = 'block';
            errorMsg.style.display = 'none';
            updateSelectedUserUsage(selectedUserId);
            setTimeout(() => successMsg.style.display = 'none', 3500);
        } catch (err) {
            console.error("Error saving limits:", err);
            errorMsg.textContent = 'Error al guardar los límites.';
            errorMsg.style.display = 'block';
            successMsg.style.display = 'none';
        }
    });
}

export function loadControlSection() {
    const userSelect = document.getElementById('control-user-select');
    if (userSelect) {
        userSelect.dispatchEvent(new Event('change'));
    }
}