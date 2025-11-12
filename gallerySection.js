// --- Galería Section Logic ---
import { getLoginState } from './loginHandler.js';
import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const FALLBACK_GALLERY_LIMIT = 15;
const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

// Helper function to escape HTML for safe display
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Firestore Helper Functions ---

// Fetches the global gallery limit
async function getGlobalLimits() {
    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && typeof settingsSnap.data().galleryLimit === 'number') {
        return { galleryLimit: settingsSnap.data().galleryLimit };
    }
    return { galleryLimit: FALLBACK_GALLERY_LIMIT };
}

// Fetches the effective gallery limit for a given user, falling back to global if not set
async function getEffectiveGalleryLimit(userId) {
    const globalLimits = await getGlobalLimits();
    if (!userId) {
        return globalLimits.galleryLimit;
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    return userData.galleryLimit ?? globalLimits.galleryLimit;
}

// --- UI Helper Functions ---

function createUploadingPlaceholder(file) {
    const placeholderId = `placeholder-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const placeholder = document.createElement('div');
    placeholder.id = placeholderId;
    placeholder.className = 'upload-placeholder';
    placeholder.innerHTML = `
        <div class="loader"></div>
        <div class="placeholder-filename">${escapeHTML(file.name)}</div>
        <div class="error-indicator" style="display:none;">❌</div>
    `;
    return { placeholder, placeholderId };
}


export function initGallerySection() {
    const galleryUploadInput = document.getElementById('gallery-upload');
    const galleryPreviewsDiv = document.getElementById('gallery-previews');
    const galleryCountMessage = document.getElementById('gallery-count-message');

    if (!galleryUploadInput || !galleryPreviewsDiv || !galleryCountMessage) {
        console.warn('Gallery elements not found. Gallery upload not initialized.');
        return;
    }

    // Add a visual reminder for image size limit
    const sizeReminderSpan = document.createElement('span');
    sizeReminderSpan.textContent = ` (Máx. ${(MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB por imagen)`;
    sizeReminderSpan.style.fontSize = '0.8em';
    sizeReminderSpan.style.color = '#888';
    if (galleryUploadInput.parentNode) {
        galleryUploadInput.parentNode.insertBefore(sizeReminderSpan, galleryUploadInput.nextSibling);
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
        
        const effectiveLimit = await getEffectiveGalleryLimit(currentUser.uid);
        const availableSlots = effectiveLimit - currentItems.length;

        if (files.length > availableSlots) {
            alert(`No puedes subir más de ${availableSlots} archivo(s). Límite de ${effectiveLimit} alcanzado.`);
            galleryUploadInput.value = '';
            return;
        }

        for (const file of files) {
            const acceptedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

            if (!acceptedMimeTypes.includes(file.type) && !acceptedExtensions.includes(fileExtension)) {
                alert(`Error: "${file.name}" no es un tipo de imagen válido y fue omitido.`);
                continue;
            }

            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                alert(`Error: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) excede el tamaño máximo permitido de 1 MB y fue omitido.`);
                continue;
            }

            const { placeholder, placeholderId } = createUploadingPlaceholder(file);
            galleryPreviewsDiv.appendChild(placeholder);

            const reader = new FileReader();
            reader.onload = (e) => processAndUploadImage(e.target.result, file, currentUser.uid, effectiveLimit, placeholderId);
            reader.readAsDataURL(file);
        }
        galleryUploadInput.value = '';
    });
    console.log('Gallery upload input listener initialized with placeholder logic.');
}

async function processAndUploadImage(dataUrl, file, userId, limit, placeholderId) {
    const placeholder = document.getElementById(placeholderId);
    try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

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

        const item = { name: file.name, type: 'image/jpeg', dataUrl: compressedDataUrl };
        const galleryDocRef = doc(db, "galleries", userId);

        const docSnap = await getDoc(galleryDocRef);
        if (docSnap.exists()) {
            const existingImages = docSnap.data().images || [];
            if (existingImages.length >= limit) {
                throw new Error("Limit exceeded just before final write.");
            }
            await updateDoc(galleryDocRef, { images: arrayUnion(item) });
        } else {
            await setDoc(galleryDocRef, { images: [item] });
        }

        console.log(`Gallery item saved for user "${userId}"`);
        
        const newImageCard = displayGalleryItem(userId, item);
        newImageCard.classList.add('upload-success');
        
        placeholder.replaceWith(newImageCard);
        
        updateGalleryCountMessage(userId);

    } catch (e) {
        console.error("Error saving gallery item:", e);
        if (placeholder) {
            placeholder.classList.add('upload-error');
            const errorIndicator = placeholder.querySelector('.error-indicator');
            if(errorIndicator) errorIndicator.style.display = 'block';
            const filenameDiv = placeholder.querySelector('.placeholder-filename');
            if(filenameDiv) filenameDiv.textContent = 'Error al subir';
        }
        updateGalleryCountMessage(userId);
    }
}

function displayGalleryItem(userId, item) {
    if (!item.dataUrl) return null;

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
    
    return imgContainer;
}

export async function displayGalleryItems(userId) {
    const galleryPreviewsDiv = document.getElementById('gallery-previews');
    if (!galleryPreviewsDiv) return;

    let html = '<h3>Imágenes Guardadas</h3>';

    if (!userId) {
        html += '<p>Error: Usuario no especificado.</p>';
        galleryPreviewsDiv.innerHTML = html;
        return;
    }

    const galleryDocRef = doc(db, "galleries", userId);
    const galleryDocSnap = await getDoc(galleryDocRef);
    const galleryItems = galleryDocSnap.exists() ? galleryDocSnap.data().images || [] : [];

    updateGalleryCountMessage(userId);

    if (galleryItems.length === 0) {
        html += '<p>Aún no hay imágenes en la galería.</p>';
    }
    
    galleryPreviewsDiv.innerHTML = html;

    if (galleryItems.length > 0) {
        galleryItems.forEach(item => {
            const itemElement = displayGalleryItem(userId, item);
            if(itemElement) galleryPreviewsDiv.appendChild(itemElement);
        });
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
    
    const effectiveLimit = await getEffectiveGalleryLimit(userId);
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
