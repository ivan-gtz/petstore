// --- Documentos Section Logic ---
import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getLoginState } from './loginHandler.js';

const FALLBACK_DOC_LIMIT = 10;
const MAX_DOC_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Firestore Helper Functions ---

// Fetches the global document limit
async function getGlobalLimits() {
    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && typeof settingsSnap.data().docLimit === 'number') {
        return { docLimit: settingsSnap.data().docLimit };
    }
    // Return just the fallback if the document doesn't exist or limit is not a number
    return { docLimit: FALLBACK_DOC_LIMIT };
}

// Fetches the effective document limit for a given user, falling back to global if not set
async function getEffectiveDocLimit(userId) {
    const globalLimits = await getGlobalLimits();
    if (!userId) {
        return globalLimits.docLimit;
    }

    const userRef = doc(db, "users", userId);
    // Force a server read to bypass the cache and get the latest limits
    const userSnap = await getDoc(userRef, { source: 'server' });
    const userData = userSnap.exists() ? userSnap.data() : {};

    return userData.docLimit ?? globalLimits.docLimit;
}

export function initDocsSection() {
    const docsUploadInput = document.getElementById('docs-upload');
    const docsListDiv = document.getElementById('docs-list');
    const docsCountMessage = document.getElementById('docs-count-message');

    if (!docsUploadInput || !docsListDiv || !docsCountMessage) {
        console.warn('Document elements not found. Document upload not initialized.');
        return;
    }

    docsUploadInput.addEventListener('change', async function(event) {
        const files = event.target.files;
        const currentUser = getLoginState();
        if (!currentUser || !currentUser.uid) {
            alert('Error: Debes iniciar sesión para subir documentos.');
            docsUploadInput.value = '';
            return;
        }

        const docRef = doc(db, "documents", currentUser.uid);
        const docSnap = await getDoc(docRef);
        const currentDocs = docSnap.exists() ? docSnap.data().docs || [] : [];
        
        const effectiveLimit = await getEffectiveDocLimit(currentUser.uid);
        const availableSlots = effectiveLimit - currentDocs.length;

        if (files.length > availableSlots) {
            alert(`No puedes subir más de ${availableSlots} archivo(s). Límite de ${effectiveLimit} alcanzado.`);
            docsUploadInput.value = '';
            return;
        }

        for (const file of files) {
            if (file.type !== 'application/pdf') {
                alert(`Error: "${file.name}" no es un archivo PDF y fue omitido.`);
                continue;
            }

            if (file.size > MAX_DOC_SIZE_BYTES) {
                alert(`Error: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) excede el tamaño máximo permitido de 1 MB y fue omitido.`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = (e) => processAndUploadDoc(e.target.result, file.name, currentUser.uid, effectiveLimit);
            reader.readAsDataURL(file);
        }
        docsUploadInput.value = '';
    });
    console.log('Documents upload input listener initialized with Firestore limits.');
}

async function processAndUploadDoc(dataUrl, fileName, userId, limit) {
    const item = { name: fileName, dataUrl: dataUrl, createdAt: new Date().toISOString() };
    const docRef = doc(db, "documents", userId);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            if (docSnap.data().docs.length < limit) {
                await updateDoc(docRef, { docs: arrayUnion(item) });
            } else {
                throw new Error("Limit exceeded just before final write.");
            }
        } else {
            await setDoc(docRef, { docs: [item] });
        }
        console.log(`Document item saved for user "${userId}"`);
        displayDocItem(userId, item, document.getElementById('docs-list'));
        updateDocsCountMessage(userId);
    } catch (e) {
        console.error("Error saving document item:", e);
        alert('Error al guardar el documento. El límite de almacenamiento puede haber sido alcanzado.');
        updateDocsCountMessage(userId);
    }
}

function displayDocItem(userId, item, containerDiv) {
    if (!item || !item.dataUrl) return;

    const docEntryWrapper = document.createElement('div');
    docEntryWrapper.classList.add('doc-card');

    const docLeft = document.createElement('div');
    docLeft.className = 'doc-left';
    
    const docIcon = document.createElement('span');
    docIcon.className = 'doc-icon';
    docIcon.textContent = '📄';
    docLeft.appendChild(docIcon);

    const docName = document.createElement('span');
    docName.textContent = escapeHTML(item.name);
    docName.className = 'doc-name';
    docLeft.appendChild(docName);
    
    docEntryWrapper.appendChild(docLeft);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'doc-actions';

    const previewButton = document.createElement('button');
    previewButton.className = 'preview-btn';
    previewButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span class="btn-text">Vista previa</span>`;
    
    previewButton.onclick = (e) => {
        e.stopPropagation();
        // Call the global PDF renderer function, which is now responsible for the UI
        if (window.renderPdfInCanvas) {
            window.renderPdfInCanvas(item.dataUrl);
        } else {
            console.error("PDF renderer function not found. Make sure app.js is loaded.");
            // Fallback for safety, though it might not work on mobile
            window.open(item.dataUrl, '_blank');
        }
    };
    actionsDiv.appendChild(previewButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg><span class="btn-text">Eliminar</span>`;
    deleteButton.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await window.showConfirmDialog('Eliminar Documento', `¿Eliminar "${escapeHTML(item.name)}"?`, { danger: true });
        if (!confirmed) return;

        const docRef = doc(db, "documents", userId);
        try {
            await updateDoc(docRef, { docs: arrayRemove(item) });
            docEntryWrapper.remove();
            updateDocsCountMessage(userId);
        } catch (err) {
            console.error("Error deleting document:", err);
            alert('Error al eliminar el documento.');
        }
    };
    actionsDiv.appendChild(deleteButton);
    docEntryWrapper.appendChild(actionsDiv);

    docEntryWrapper.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    containerDiv.appendChild(docEntryWrapper);
}

export async function displayDocsItems(userId) {
    const docsListDiv = document.getElementById('docs-list');
    if (!docsListDiv) return;

    let html = '<h3>Documentos Guardados</h3>';

    if (!userId) {
        html += '<p>Inicia sesión para ver tus documentos.</p>';
        docsListDiv.innerHTML = html;
        updateDocsCountMessage(null);
        return;
    }

    const docRef = doc(db, "documents", userId);
    const docSnap = await getDoc(docRef);
    const docItems = docSnap.exists() ? docSnap.data().docs || [] : [];

    updateDocsCountMessage(userId);

    if (docItems.length === 0) {
        html += '<p>Aún no hay documentos guardados.</p>';
    }
    
    docsListDiv.innerHTML = html;

    if (docItems.length > 0) {
        docItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(item => {
            displayDocItem(userId, item, docsListDiv);
        });
    }
}

async function updateDocsCountMessage(userId) {
    const docsCountMessage = document.getElementById('docs-count-message');
    const uploadInput = document.getElementById('docs-upload');
    if (!docsCountMessage || !uploadInput) return;

    if (!userId) {
        docsCountMessage.textContent = '';
        uploadInput.disabled = true;
        return;
    }

    const docRef = doc(db, "documents", userId);
    const docSnap = await getDoc(docRef);
    const count = docSnap.exists() ? (docSnap.data().docs || []).length : 0;
    
    const effectiveLimit = await getEffectiveDocLimit(userId);
    const remaining = effectiveLimit - count;

    if (count >= effectiveLimit) {
        docsCountMessage.textContent = `Límite alcanzado: ${count} de ${effectiveLimit} documentos.`;
        docsCountMessage.className = 'limit-message limit-reached';
        uploadInput.disabled = true;
    } else {
        docsCountMessage.textContent = `Tienes ${count} de ${effectiveLimit} documentos. Puedes subir ${remaining} más.`;
        docsCountMessage.className = 'limit-message limit-remaining';
        uploadInput.disabled = false;
    }
}