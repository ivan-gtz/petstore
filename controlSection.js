// Control Section - Admin can change global upload limits and inspect per-user usage
import { isAdmin, getLoginState } from './loginHandler.js';
import { db } from './firebase-init.js';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const FALLBACK_LIMITS = { docLimit: 10, galleryLimit: 15 };

// --- Firestore Helper Functions ---

// Fetches global limits from settings/globalLimits
async function getGlobalLimits() {
    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        return { ...FALLBACK_LIMITS, ...settingsSnap.data() };
    }
    return FALLBACK_LIMITS;
}

// Gets the count of documents for a specific user
async function getUserDocCount(userId) {
    if (!userId) return 0;
    // Documents are stored with the user's UID as the document ID in the 'documents' collection
    const docRef = doc(db, "documents", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().docs) {
        return docSnap.data().docs.length;
    }
    return 0;
}

// Gets the count of gallery images for a specific user
async function getUserGalleryCount(userId) {
    if (!userId) return 0;
    const galleryRef = doc(db, "galleries", userId);
    const gallerySnap = await getDoc(galleryRef);
    if (gallerySnap.exists() && gallerySnap.data().images) {
        return gallerySnap.data().images.length;
    }
    return 0;
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
    }
    controlSection.style.display = 'block';

    // Populate current global limits into inputs on load
    async function populateInitialLimits() {
        const limits = await getGlobalLimits();
        galleryInput.value = limits.galleryLimit;
        docsInput.value = limits.docLimit;
    }
    populateInitialLimits();

    // Populate users dropdown
    async function refreshUserList() {
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        userSelect.innerHTML = '<option value="">-- Global (Todos los usuarios) --</option>';
        users.sort((a, b) => (a.email || '').localeCompare(b.email || '')).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.email || u.id;
            userSelect.appendChild(opt);
        });
    }
    refreshUserList();

    // Update selected user's usage and show their specific limits
    async function updateSelectedUserUsage(userId) {
        console.log(`Updating view for user ID: ${userId || 'Global'}`);
        const globalLimits = await getGlobalLimits();
        
        if (!userId) { // Global view
            galleryCountP.textContent = 'Fotos: N/A (Global)';
            docsCountP.textContent = 'Documentos: N/A (Global)';
            galleryInput.value = globalLimits.galleryLimit;
            docsInput.value = globalLimits.docLimit;
            console.log('Showing global limits.', globalLimits);
            return;
        }

        // Fetch user data to get their specific limit overrides
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const docCount = await getUserDocCount(userId);
        const userDocLimit = userData.docLimit ?? globalLimits.docLimit;
        docsCountP.innerHTML = `Documentos: <b>${docCount}</b> / ${userDocLimit}`;
        docsInput.value = userDocLimit;

        const galleryCount = await getUserGalleryCount(userId);
        const userGalleryLimit = userData.galleryLimit ?? globalLimits.galleryLimit;
        galleryCountP.innerHTML = `Fotos: <b>${galleryCount}</b> / ${userGalleryLimit}`;
        galleryInput.value = userGalleryLimit;

        console.log('Showing limits for selected user:', {
            userId,
            userData,
            finalDocLimit: userDocLimit,
            finalGalleryLimit: userGalleryLimit
        });
    }

    userSelect.addEventListener('change', () => updateSelectedUserUsage(userSelect.value));

    // Handle form submission to save limits
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const galleryLimit = parseInt(galleryInput.value, 10);
        const docLimit = parseInt(docsInput.value, 10);

        if (!Number.isInteger(galleryLimit) || galleryLimit < 0 || !Number.isInteger(docLimit) || docLimit < 0) {
            errorMsg.textContent = 'Introduce valores válidos (enteros ≥ 0).';
            errorMsg.style.display = 'block';
            successMsg.style.display = 'none';
            return;
        }

        const selectedUserId = userSelect.value;
        try {
            if (selectedUserId) {
                // Save per-user limits
                const userRef = doc(db, "users", selectedUserId);
                await updateDoc(userRef, { galleryLimit, docLimit });
                successMsg.textContent = `Límites guardados para el usuario.`;
            } else {
                // Save global limits and overwrite all individual user limits
                const newLimits = { galleryLimit, docLimit };

                // 1. Update the global settings document
                const settingsRef = doc(db, "settings", "globalLimits");
                await setDoc(settingsRef, newLimits, { merge: true });

                // 2. Overwrite all individual user limits
                const usersCollection = collection(db, "users");
                const usersSnapshot = await getDocs(usersCollection);
                const batch = writeBatch(db);
                usersSnapshot.forEach(userDoc => {
                    const userRef = doc(db, "users", userDoc.id);
                    batch.update(userRef, {
                        galleryLimit: newLimits.galleryLimit,
                        docLimit: newLimits.docLimit
                    });
                });
                await batch.commit();
                
                successMsg.textContent = `Límites globales guardados y aplicados a todos los usuarios.`;
            }
            successMsg.style.display = 'block';
            errorMsg.style.display = 'none';
            updateSelectedUserUsage(selectedUserId); // Refresh view
            setTimeout(() => successMsg.style.display = 'none', 3500);
        } catch (err) {
            console.error("Error saving limits:", err);
            errorMsg.textContent = 'Error al guardar los límites.';
            errorMsg.style.display = 'block';
            successMsg.style.display = 'none';
        }
    });
}

export async function loadControlSection() {
    const galleryInput = document.getElementById('gallery-limit-input');
    const docsInput = document.getElementById('docs-limit-input');
    const userSelect = document.getElementById('control-user-select');

    // Reset dropdown to show global view
    if (userSelect) {
        userSelect.value = "";
    }

    // Directly populate the inputs with global limits
    if (galleryInput && docsInput) {
        try {
            const limits = await getGlobalLimits();
            galleryInput.value = limits.galleryLimit;
            docsInput.value = limits.docLimit;
        } catch (error) {
            console.error("Failed to load global limits into control section inputs:", error);
            // Optionally show an error message to the user
        }
    }
    
    // Also refresh the user stats display for the global view
    const galleryCountP = document.getElementById('control-user-gallery-count');
    const docsCountP = document.getElementById('control-user-docs-count');
    if (galleryCountP && docsCountP) {
        galleryCountP.textContent = 'Fotos: N/A (Global)';
        docsCountP.textContent = 'Documentos: N/A (Global)';
    }
}