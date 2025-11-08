// --- Documentos Section Logic ---
import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getLoginState } from './loginHandler.js';

const FALLBACK_DOC_LIMIT = 10;

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Firestore Helper Functions ---

// Fetches the effective document limit for the current user
async function getDocLimitForCurrentUser() {
    const currentUser = getLoginState();
    if (!currentUser || !currentUser.uid) {
        return FALLBACK_DOC_LIMIT;
    }

    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && typeof userSnap.data().docLimit === 'number') {
        return userSnap.data().docLimit;
    }

    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && typeof settingsSnap.data().docLimit === 'number') {
        return settingsSnap.data().docLimit;
    }

    return FALLBACK_DOC_LIMIT;
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
        
        const effectiveLimit = await getDocLimitForCurrentUser();
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

    const docLink = document.createElement('a');
    docLink.href = item.dataUrl;
    docLink.target = '_blank';
    docLink.title = `Abrir "${item.name}"`;
    docLink.textContent = escapeHTML(item.name);
    docLink.className = 'doc-name';
    docLeft.appendChild(docLink);
    
    docEntryWrapper.appendChild(docLeft);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'doc-actions';

    const previewButton = document.createElement('button');
    previewButton.className = 'preview-btn';
    previewButton.textContent = 'Vista previa';
    previewButton.onclick = (e) => {
        e.stopPropagation();
        const modal = document.getElementById('myModal');
        const modalDocContent = document.getElementById('modalDocument');
        const modalImg = document.getElementById('modalImage');

        if (!modal || !modalDocContent || !modalImg) {
            console.error("Modal elements not found, opening in new tab as fallback.");
            window.open(item.dataUrl, '_blank');
            return;
        }
        
        modalImg.style.display = 'none';
        modalDocContent.style.display = 'block';
        modalDocContent.innerHTML = `<iframe src="${item.dataUrl}" style="width:100%;height:100%;border:0;" title="${escapeHTML(item.name)}"></iframe>`;
        modal.style.display = 'block';
    };
    actionsDiv.appendChild(previewButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Eliminar';
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

    containerDiv.appendChild(docEntryWrapper);
}

export async function displayDocsItems(userId) {
    const docsListDiv = document.getElementById('docs-list');
    if (!docsListDiv) return;

    docsListDiv.innerHTML = '<h3>Documentos Guardados</h3>';
    if (!userId) {
        docsListDiv.innerHTML += '<p>Inicia sesión para ver tus documentos.</p>';
        updateDocsCountMessage(null);
        return;
    }

    const docRef = doc(db, "documents", userId);
    const docSnap = await getDoc(docRef);
    const docItems = docSnap.exists() ? docSnap.data().docs || [] : [];

    updateDocsCountMessage(userId);

    if (docItems.length === 0) {
        docsListDiv.innerHTML += '<p>Aún no hay documentos guardados.</p>';
    } else {
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
    
    const effectiveLimit = await getDocLimitForCurrentUser();
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