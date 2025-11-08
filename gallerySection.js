// --- Galería Section Logic ---
import { getLoginState } from './loginHandler.js';
import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const FALLBACK_GALLERY_LIMIT = 15;

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Firestore Helper Functions ---

// Fetches the effective gallery limit for the current user
async function getGalleryLimitForCurrentUser() {
    const currentUser = getLoginState();
    if (!currentUser || !currentUser.uid) {
        return FALLBACK_GALLERY_LIMIT;
    }

    // Fetch user-specific limit
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && typeof userSnap.data().galleryLimit === 'number') {
        return userSnap.data().galleryLimit;
    }

    // Fetch global limit if no user-specific one is found
    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && typeof settingsSnap.data().galleryLimit === 'number') {
        return settingsSnap.data().galleryLimit;
    }

    return FALLBACK_GALLERY_LIMIT;
}

export function initGallerySection() {
    const galleryUploadInput = document.getElementById('gallery-upload');
    const galleryPreviewsDiv = document.getElementById('gallery-previews');
    const galleryCountMessage = document.getElementById('gallery-count-message');

    if (!galleryUploadInput || !galleryPreviewsDiv || !galleryCountMessage) {
        console.warn('Gallery elements not found. Gallery upload not initialized.');
        return;
    }

    const clearBtn = document.getElementById('gallery-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            galleryUploadInput.value = '';
        });
    }

    galleryUploadInput.addEventListener('change', async function(event) {
        const files = event.target.files;
        const currentUser = getLoginState();
        if (!currentUser || !currentUser.uid) {
            alert('Error: No hay un usuario logueado. No se puede guardar la imagen.');
            galleryUploadInput.value = '';
            return;
        }

        const galleryDocRef = doc(db, "galleries", currentUser.uid);
        const galleryDocSnap = await getDoc(galleryDocRef);
        const currentItems = galleryDocSnap.exists() ? galleryDocSnap.data().images || [] : [];
        
        const effectiveLimit = await getGalleryLimitForCurrentUser();
        const availableSlots = effectiveLimit - currentItems.length;

        if (files.length > availableSlots) {
            alert(`No puedes subir más de ${availableSlots} archivo(s). Límite de ${effectiveLimit} alcanzado.`);
            galleryUploadInput.value = '';
            return;
        }

        for (const file of files) {
            // Re-check limit before processing each file
            const updatedGalleryDocSnap = await getDoc(galleryDocRef);
            const updatedCurrentItems = updatedGalleryDocSnap.exists() ? updatedGalleryDocSnap.data().images || [] : [];
            if (updatedCurrentItems.length >= effectiveLimit) {
                alert(`Límite de ${effectiveLimit} fotos alcanzado. No se subirán más archivos.`);
                break; // Exit loop
            }

            if (!file.type.startsWith('image/')) {
                alert(`Error: "${file.name}" no es una imagen válida y fue omitido.`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = (e) => processAndUploadImage(e.target.result, file.name, currentUser.uid, effectiveLimit);
            reader.readAsDataURL(file);
        }
        galleryUploadInput.value = '';
    });
    console.log('Gallery upload input listener initialized with Firestore limits.');
}

async function processAndUploadImage(dataUrl, fileName, userId, limit) {
    const img = new Image();
    img.onload = async () => {
        const maxWidth = 1200, maxHeight = 1200;
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
            if (width > height) {
                height *= maxWidth / width;
                width = maxWidth;
            } else {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

        const item = { name: fileName, type: 'image/jpeg', dataUrl: compressedDataUrl };
        const galleryDocRef = doc(db, "galleries", userId);

        try {
            const docSnap = await getDoc(galleryDocRef);
            if (docSnap.exists()) {
                if (docSnap.data().images.length < limit) {
                    await updateDoc(galleryDocRef, { images: arrayUnion(item) });
                } else {
                    throw new Error("Limit exceeded just before final write.");
                }
            } else {
                await setDoc(galleryDocRef, { images: [item] });
            }
            console.log(`Gallery item saved for user "${userId}"`);
            displayGalleryItem(userId, item, document.getElementById('gallery-previews'));
            updateGalleryCountMessage(userId);
        } catch (e) {
            console.error("Error saving gallery item:", e);
            alert('Error al guardar la imagen. El límite de almacenamiento puede haber sido alcanzado.');
            updateGalleryCountMessage(userId);
        }
    };
    img.src = dataUrl;
}

function displayGalleryItem(userId, item, containerDiv) {
    if (!item.dataUrl) return; // Only guard against missing dataUrl

    const imgContainer = document.createElement('div');
    imgContainer.className = 'gallery-item';
    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = item.name || 'Gallery Image';
    imgContainer.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const sizeMB = ((item.dataUrl.length * 0.75) / (1024 * 1024)).toFixed(2);
    meta.innerHTML = `<span class="name">${escapeHTML(item.name) || 'Imagen'}</span><span class="size">${sizeMB} MB</span>`;
    imgContainer.appendChild(meta);

    imgContainer.onclick = () => {
        const modal = document.getElementById("myModal");
        const modalImg = document.getElementById("modalImage");
        const modalDocContent = document.getElementById("modalDocument");
        if (!modal || !modalImg || !modalDocContent) {
            console.error("Modal elements not found. Cannot open image.");
            return;
        }
        modal.style.display = "block";
        modalImg.style.display = "block";
        modalDocContent.style.display = "none";
        modalImg.src = item.dataUrl;
    };

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.title = 'Eliminar imagen';
    deleteButton.textContent = 'Eliminar';
    deleteButton.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await window.showConfirmDialog('Eliminar Imagen', `¿Eliminar "${item.name}"?`, { danger: true });
        if (!confirmed) return;
        
        const galleryDocRef = doc(db, "galleries", userId);
        try {
            await updateDoc(galleryDocRef, { images: arrayRemove(item) });
            imgContainer.remove();
            updateGalleryCountMessage(userId);
        } catch (err) {
            console.error("Error deleting gallery item:", err);
            alert('Error al eliminar la imagen.');
        }
    };
    meta.appendChild(deleteButton);
    containerDiv.appendChild(imgContainer);
}

export async function displayGalleryItems(userId) {
    const galleryPreviewsDiv = document.getElementById('gallery-previews');
    if (!galleryPreviewsDiv) return;

    galleryPreviewsDiv.innerHTML = '<h3>Imágenes Guardadas</h3>';
    if (!userId) {
        galleryPreviewsDiv.innerHTML += '<p>Error: Usuario no especificado.</p>';
        return;
    }

    const galleryDocRef = doc(db, "galleries", userId);
    const galleryDocSnap = await getDoc(galleryDocRef);
    const galleryItems = galleryDocSnap.exists() ? galleryDocSnap.data().images || [] : [];

    updateGalleryCountMessage(userId);

    if (galleryItems.length === 0) {
        galleryPreviewsDiv.innerHTML += '<p>Aún no hay imágenes en la galería.</p>';
    } else {
        galleryItems.forEach(item => displayGalleryItem(userId, item, galleryPreviewsDiv));
    }
}

export async function updateGalleryCountMessage(userId) {
    const galleryCountMessage = document.getElementById('gallery-count-message');
    const uploadInput = document.getElementById('gallery-upload');
    if (!galleryCountMessage || !uploadInput) return;

    if (!userId) {
        galleryCountMessage.textContent = '';
        uploadInput.disabled = true;
        return;
    }

    const galleryDocRef = doc(db, "galleries", userId);
    const galleryDocSnap = await getDoc(galleryDocRef);
    const count = galleryDocSnap.exists() ? (galleryDocSnap.data().images || []).length : 0;
    
    const effectiveLimit = await getGalleryLimitForCurrentUser();
    const remaining = effectiveLimit - count;

    if (count >= effectiveLimit) {
        galleryCountMessage.textContent = `Límite alcanzado: ${count} de ${effectiveLimit} fotos.`;
        galleryCountMessage.className = 'limit-message limit-reached';
        uploadInput.disabled = true;
    } else {
        galleryCountMessage.textContent = `Tienes ${count} de ${effectiveLimit} fotos. Puedes subir ${remaining} más.`;
        galleryCountMessage.className = 'limit-message limit-remaining';
        uploadInput.disabled = false;
    }
}