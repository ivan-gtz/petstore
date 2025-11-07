// --- Galería Section Logic ---
import { saveGalleryItemToLocalStorage, loadGalleryFromLocalStorage, deleteGalleryItemFromLocalStorage, MAX_GALLERY_ITEMS, loadUserGalleryLimit, loadAdminGalleryLimit } from './storage.js'; // Use per-user/admin limits
import { getLoginState } from './loginHandler.js'; // Import getLoginState

// Get the modal elements (assuming these are global or managed elsewhere, like app.js)
// The modal is handled centrally in app.js for opening/closing

export function initGallerySection() {
    const galleryUploadInput = document.getElementById('gallery-upload');
    const galleryPreviewsDiv = document.getElementById('gallery-previews');
    const galleryCountMessage = document.getElementById('gallery-count-message'); // Get the count message element

    if (galleryUploadInput && galleryPreviewsDiv && galleryCountMessage) {
        // Add clear button behavior (cancel selection)
        const clearBtn = document.getElementById('gallery-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                galleryUploadInput.value = '';
                galleryUploadInput.blur();
                // optional: brief visual feedback
                clearBtn.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 220 });
            });
        }

        galleryUploadInput.addEventListener('change', function(event) {
            const files = event.target.files;
            const currentUser = getLoginState(); // Get current user on file selection
            if (!currentUser || !currentUser.name) {
                alert('Error: No user is logged in. Cannot save gallery item.');
                console.error('Gallery upload failed: No logged-in user.');
                // Clear the file input after processing
                galleryUploadInput.value = '';
                return;
            }

            const currentItems = loadGalleryFromLocalStorage(currentUser.name);
            const userLimit = loadUserGalleryLimit(currentUser.name);
            const effectiveLimit = Number.isInteger(userLimit) && userLimit > 0 ? userLimit : loadAdminGalleryLimit();
            const availableSlots = effectiveLimit - currentItems.length;

            if (files.length > availableSlots) {
                alert(`No puedes subir más de ${availableSlots} archivo(s) a la vez. Límite de ${effectiveLimit} alcanzado.`);
                // Clear the file input after processing
                galleryUploadInput.value = '';
                return;
            }
            if (currentItems.length >= effectiveLimit) {
                alert(`Has alcanzado el límite de ${effectiveLimit} fotos.`);
                // Clear the file input after processing
                galleryUploadInput.value = '';
                return;
            }

            // Process files and add previews
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
                if (file.size > MAX_UPLOAD_BYTES) {
                    alert(`El archivo "${file.name}" excede el tamaño máximo permitido de 2 MB y no fue subido.`);
                    continue;
                }
                if (file.type.startsWith('image/')) {

                    // Check limit again for each file before processing
                    const currentCount = loadGalleryFromLocalStorage(currentUser.name).length;
                    if (currentCount >= effectiveLimit) {
                        console.warn(`Skipping "${file.name}": Gallery limit reached.`);
                        const skippedMsg = document.createElement('div'); // Use div for consistency with docs messages
                        skippedMsg.textContent = `"${file.name}" no se guardó: Has alcanzado el límite de ${effectiveLimit} fotos.`;
                        skippedMsg.style.cssText = 'color: orange; margin-bottom: 5px; padding: 10px; background-color: var(--info-bg-warning); border-color: var(--info-border-warning); border-left: 4px solid var(--warning-color); border-radius: 4px;'; // Use variables
                        galleryPreviewsDiv.appendChild(skippedMsg);
                        continue; // Skip to the next file
                    }

                    const reader = new FileReader();

                    reader.onload = function(e) {
                        const img = new Image();

                        img.onload = function() {
                            const maxWidth = 1200; // Increased max width
                            const maxHeight = 1200; // Increased max height
                            let width = img.width;
                            let height = img.height;

                            // Calculate resizing dimensions while maintaining aspect ratio
                            if (width > maxWidth || height > maxHeight) {
                                if (width > height) {
                                    height *= maxWidth / width;
                                    width = maxWidth;
                                } else {
                                    width *= maxHeight / height;
                                    height = maxHeight;
                                }
                            }
                            // No need to upscale if image is smaller than max dimensions.
                            // The image is drawn with current width/height if it's already small.

                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');

                            // Draw the image on the canvas
                            ctx.drawImage(img, 0, 0, width, height);

                            // Get the compressed image as a Data URL (JPEG, quality 0.8 = 80%)
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8); // Changed quality to 0.8

                            // Estimate the binary size of the Data URL (Base64 overhead ~1.33x)
                            const sizeInBytes = compressedDataUrl.length * 0.75; // Approximate size
                            const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB in bytes

                            // Final enforcement: ensure processed image also does not exceed 2 MB
                            const FINAL_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
                            if (sizeInBytes <= FINAL_MAX_BYTES) {
                                // Create item with compressed data URL
                                const item = { name: file.name, type: 'image/jpeg', dataUrl: compressedDataUrl }; // Save as jpeg type

                                // Save the item to localStorage
                                const saved = saveGalleryItemToLocalStorage(currentUser.name, item); // save function returns boolean

                                if (saved) {
                                    displayGalleryItem(currentUser.name, item, galleryPreviewsDiv); // Display the saved item
                                    // Update the count message immediately after saving
                                    updateGalleryCountMessage(currentUser.name);
                                } else {
                                    // This case handles QuotaExceededError from storage.js
                                    console.warn(`Failed to save "${item.name}". Storage limit might be reached.`);
                                    const failedMsg = document.createElement('div');
                                    failedMsg.textContent = `Error al guardar "${item.name}". El almacenamiento del navegador está lleno.`;
                                    failedMsg.style.cssText = 'color: orange; margin-bottom: 5px; padding: 10px; background-color: var(--info-bg-warning); border-color: var(--info-border-warning); border-left: 4px solid var(--warning-color); border-radius: 4px;'; // Use variables
                                    galleryPreviewsDiv.appendChild(failedMsg);
                                    // Update count message even if save failed (limit still affects available slots)
                                    updateGalleryCountMessage(currentUser.name);
                                }
                            } else {
                                // File is still too large after compression/resizing
                                console.warn(`Skipping "${file.name}": Image size (${(sizeInBytes / 1024 / 1024).toFixed(2)} MB) exceeds 2MB limit after processing.`);
                                const sizeExceedsMsg = document.createElement('div');
                                sizeExceedsMsg.textContent = `"${file.name}" es demasiado grande (${(sizeInBytes / 1024 / 1024).toFixed(2)} MB) y no se guardó. El límite es 2 MB.`;
                                sizeExceedsMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: var(--info-bg-error); border-color: var(--info-border-error); border-left: 4px solid var(--error-color); border-radius: 4px;'; // Use error styles
                                galleryPreviewsDiv.appendChild(sizeExceedsMsg);
                                // Update count message even if save failed
                                updateGalleryCountMessage(currentUser.name); // This will not increment the count, but might be needed if we added a placeholder
                            }
                        };

                        img.onerror = function() {
                            console.error(`Error loading image for processing: ${file.name}`);
                            const errorMsg = document.createElement('div');
                            errorMsg.textContent = `Error al procesar la imagen "${file.name}". Asegúrate de que es un archivo de imagen válido.`;
                            errorMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: var(--info-bg-error); border-color: var(--info-border-error); border-left: 4px solid var(--error-color); border-radius: 4px;';
                            galleryPreviewsDiv.appendChild(errorMsg);
                            updateGalleryCountMessage(currentUser.name); // Update count message even on error
                        };

                        // Read the file as a Data URL for the Image object
                        img.src = e.target.result;
                    };

                    reader.onerror = function() {
                        console.error(`Error reading file: ${file.name}`);
                        const errorMsg = document.createElement('div');
                        errorMsg.textContent = `Error al leer el archivo "${file.name}".`;
                        errorMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: var(--info-bg-error); border-color: var(--info-border-error); border-left: 4px solid var(--error-color); border-radius: 4px;';
                        galleryPreviewsDiv.appendChild(errorMsg);
                        updateGalleryCountMessage(currentUser.name); // Update count message even on error
                    };

                    // Start reading the file
                    reader.readAsDataURL(file);
                } else {
                    console.warn(`Skipped non-image file: ${file.name}`);
                    // Optionally display a message for skipped files
                    const skippedMsg = document.createElement('div'); // Use div
                    skippedMsg.textContent = `Error: "${file.name}" no es una imagen válida y fue omitido.`;
                    skippedMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: var(--info-bg-error); border-color: var(--info-border-error); border-left: 4px solid var(--error-color); border-radius: 4px;'; // Use error styles
                    galleryPreviewsDiv.appendChild(skippedMsg);
                    updateGalleryCountMessage(currentUser.name); // Update count message for skipped files
                }
            }
            // Clear the file input after processing all files
            galleryUploadInput.value = '';
        });
        console.log('Gallery upload input listener initialized with image processing.');
    } else {
        console.warn('Gallery elements not found. Gallery upload not initialized.');
    }
}

// Function to display a single gallery item (modified to accept username)
function displayGalleryItem(username, item, containerDiv) {
    // Get modal elements here just before potentially opening the modal
    const modal = document.getElementById("myModal");
    const modalImg = document.getElementById("modalImage");
    const modalDocContent = document.getElementById("modalDocument"); // Needed to hide it

    if (!username) {
        console.error('Cannot display gallery item: username is missing.');
        return;
    }

    if (item.dataUrl && modal && modalImg && modalDocContent) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'gallery-item';
        const img = document.createElement('img');
        img.src = item.dataUrl;
        img.alt = item.name || 'Gallery Image';
        imgContainer.appendChild(img);

        // Meta overlay with name and (approx) size
        const meta = document.createElement('div');
        meta.className = 'meta';
        const sizeMB = item.dataUrl ? ((item.dataUrl.length * 0.75) / (1024 * 1024)).toFixed(2) : '-';
        meta.innerHTML = `<span class="name">${item.name || 'Imagen'}</span><span class="size">${sizeMB} MB</span>`;
        imgContainer.appendChild(meta);

        // Add click listener to open modal
        imgContainer.onclick = function() {
            modal.style.display = "block";
            modalImg.style.display = "block"; // Show image part of modal
            modalDocContent.style.display = "none"; // Hide doc part of modal
            modalImg.src = item.dataUrl;
            // Optional: add caption #caption.innerHTML = item.name;
        }

        // nicer delete button appended to meta area for accessibility
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.title = 'Eliminar imagen';
        deleteButton.textContent = 'Eliminar';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            window.showConfirmDialog('Eliminar Imagen', `¿Eliminar "${item.name}"?`, { confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true })
                .then(confirmed => {
                    if (!confirmed) return;
                    deleteGalleryItemFromLocalStorage(username, item);
                    imgContainer.remove();
                    updateGalleryCountMessage(username);
                });
        };
        // place delete inside the meta so it shows on hover
        meta.appendChild(deleteButton);

        containerDiv.appendChild(imgContainer);

        // Add pop-in animation class briefly when inserted
        imgContainer.classList.add('pop-in');
        imgContainer.addEventListener('animationend', function handler() {
            imgContainer.classList.remove('pop-in');
            imgContainer.removeEventListener('animationend', handler);
        });
    } else if (!modal || !modalImg || !modalDocContent) {
        console.error('Modal elements not fully found. Cannot display gallery items with modal functionality.');
    } else {
        console.warn('Gallery item data URL missing, cannot display.');
    }
}

// Function to display all saved gallery items for a specific user (modified)
export function displayGalleryItems(username) {
    const galleryPreviewsDiv = document.getElementById('gallery-previews');
    const galleryCountMessage = document.getElementById('gallery-count-message'); // Get the count message element

    if (galleryPreviewsDiv && galleryCountMessage) {
        galleryPreviewsDiv.innerHTML = ''; // Clear current previews

        const listHeading = document.createElement('h3');
        listHeading.textContent = 'Imágenes Guardadas';
        listHeading.style.cssText = 'margin-top: 0; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px; font-size: 1.2rem; color: var(--text-color); width: 100%;'; // Added width: 100% and used variables
        galleryPreviewsDiv.appendChild(listHeading);

        if (!username) {
            const msg = document.createElement('p');
            msg.textContent = 'Error: Usuario no especificado para cargar la galería.';
            msg.style.cssText = 'width: 100%; text-align: center; color: var(--error-color);'; // Use variable
            galleryPreviewsDiv.appendChild(msg);
            console.error('displayGalleryItems called without username.');
            updateGalleryCountMessage(username, true); // Clear count message
            return;
        }

        const galleryItems = loadGalleryFromLocalStorage(username); // Load specific user's items

        // Update the count message before displaying items
        updateGalleryCountMessage(username);

        if (galleryItems.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'Aún no hay imágenes en la galería para este usuario.';
            msg.style.cssText = 'width: 100%; text-align: center; color: var(--text-color-secondary);'; // Center message, use variable
            galleryPreviewsDiv.appendChild(msg);
        } else {
            galleryItems.forEach(item => {
                displayGalleryItem(username, item, galleryPreviewsDiv); // Pass username
            });
        }
        console.log(`Gallery items displayed for user "${username}".`);
    } else {
        console.error('Gallery previews or count message element not found.');
    }
}

// Function to update the gallery count message
function updateGalleryCountMessage(username, clear = false) {
    const galleryCountMessage = document.getElementById('gallery-count-message');
    const uploadInput = document.getElementById('gallery-upload'); // Get the upload input to potentially disable it

    if (!galleryCountMessage) return;

    if (clear || !username) {
        galleryCountMessage.textContent = '';
        if(uploadInput) uploadInput.disabled = false; // Re-enable upload if clearing
        return;
    }

    const currentItems = loadGalleryFromLocalStorage(username);
    const count = currentItems.length;
    const userLimit = loadUserGalleryLimit(username);
    const effectiveLimit = Number.isInteger(userLimit) && userLimit > 0 ? userLimit : loadAdminGalleryLimit();
    const remaining = effectiveLimit - count;

    if (count >= effectiveLimit) {
        galleryCountMessage.textContent = `Límite alcanzado: ${count} de ${effectiveLimit} fotos. Elimina fotos para subir más.`;
        galleryCountMessage.classList.add('limit-reached');
        galleryCountMessage.classList.remove('limit-remaining');
        if(uploadInput) uploadInput.disabled = true; // Disable upload button
    } else {
        galleryCountMessage.textContent = `Tienes ${count} de ${effectiveLimit} fotos guardadas. Puedes subir ${remaining} foto(s) más.`;
        galleryCountMessage.classList.add('limit-remaining');
        galleryCountMessage.classList.remove('limit-reached');
        if(uploadInput) uploadInput.disabled = false; // Enable upload button
    }
}

// Note: deleteGalleryItem logic is now inside the displayGalleryItem function's click listener
// and uses deleteGalleryItemFromLocalStorage from storage.js