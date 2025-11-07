// --- Documentos Section Logic ---
import { saveDocItemToLocalStorage, loadDocsFromLocalStorage, deleteDocItemFromLocalStorage, MAX_DOC_ITEMS, loadUserDocLimit, loadAdminDocLimit } from './storage.js'; // Use per-user/admin limits
import { getLoginState } from './loginHandler.js'; // Import getLoginState

// Modal elements are now handled in app.js for opening/closing,
// but this section will no longer use the modal for document clicks.

export function initDocsSection() {
    const docsUploadInput = document.getElementById('docs-upload');
    const docsListDiv = document.getElementById('docs-list');
    const docsCountMessage = document.getElementById('docs-count-message'); // Get the count message element


    if (docsUploadInput && docsListDiv && docsCountMessage) {
        docsUploadInput.addEventListener('change', function(event) {
            const files = event.target.files;
            const currentUser = getLoginState(); // Get current user on file selection
            if (!currentUser || !currentUser.name) {
                 alert('Error: No user is logged in. Cannot save document.');
                 console.error('Documents upload failed: No logged-in user.');
                  // Clear the file input after processing
                 docsUploadInput.value = '';
                 return;
             }

             const currentItems = loadDocsFromLocalStorage(currentUser.name);
             const userLimit = loadUserDocLimit(currentUser.name);
             const effectiveLimit = Number.isInteger(userLimit) && userLimit > 0 ? userLimit : loadAdminDocLimit();
             const availableSlots = effectiveLimit - currentItems.length;

             if (files.length > availableSlots) {
                 alert(`No puedes subir más de ${availableSlots} archivo(s) a la vez. Límite de ${effectiveLimit} alcanzado.`);
                 // Clear the file input after processing
                 docsUploadInput.value = '';
                 return;
             }
             if (currentItems.length >= effectiveLimit) {
                 alert(`Has alcanzado el límite de ${effectiveLimit} documentos.`);
                 // Clear the file input after processing
                 docsUploadInput.value = '';
                 return;
             }


            // Process files
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
                if (file.size > MAX_UPLOAD_BYTES) {
                    alert(`El archivo \"${file.name}\" excede el tamaño máximo permitido de 2 MB y no fue subido.`);
                    continue;
                }
                if (file.type === 'application/pdf') {
                     // Read the file as a Data URL to store it
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const dataUrl = e.target.result;
                        const item = { name: file.name, type: file.type, dataUrl: dataUrl }; // Store Data URL

                         // Check limit again for each file in case multiple files were dropped
                         const currentCount = loadDocsFromLocalStorage(currentUser.name).length;
                         if (currentCount >= effectiveLimit) {
                              console.warn(`Skipping "${file.name}": Document limit reached.`);
                              const skippedMsg = document.createElement('div');
                              skippedMsg.textContent = `"${file.name}" no se guardó: Has alcanzado el límite de ${effectiveLimit} documentos.`;
                               skippedMsg.style.cssText = 'color: orange; margin-bottom: 5px; padding: 10px; background-color: #fff3cd; border-color: #ffeeba;';
                              docsListDiv.appendChild(skippedMsg);
                             // Update the count message even for skipped items within a batch
                             updateDocsCountMessage(currentUser.name);
                             return; // Stop processing this file
                         }


                        // Check Data URL size limitations (rough estimate)
                        const sizeInBytes = dataUrl.length * 0.75; // Base64 is ~1.33x size, * 0.75 inverse
                        const sizeInMB = sizeInBytes / (1024 * 1024);
                        // Final enforcement: don't accept saved data URLs exceeding 2 MB
                        const FINAL_MAX_MB = 2;
                        if (sizeInMB > FINAL_MAX_MB) {
                            const errMsg = document.createElement('div');
                            errMsg.textContent = `\"${file.name}\" es demasiado grande después de procesarlo (${sizeInMB.toFixed(2)} MB). Límite 2 MB.`;
                            errMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: #f8d7da; border-color: #f5c6cb;';
                            docsListDiv.appendChild(errMsg);
                            updateDocsCountMessage(currentUser.name);
                            return;
                        }

                        const localStorageLimitEstimate = 5; // Estimate localStorage limit in MB
                        if (sizeInMB > localStorageLimitEstimate * 0.5) { // Warn if larger than half the estimated limit
                             console.warn(`PDF file \"${file.name}\" is approximately ${sizeInMB.toFixed(2)} MB. Saving to localStorage may fail due to size limits.`);
                             // Optionally show a warning message to the user
                             const sizeWarningMsg = document.createElement('div');
                             sizeWarningMsg.textContent = `Advertencia: El archivo \"${file.name}\" (${sizeInMB.toFixed(2)} MB) es grande y podría no guardarse correctamente en el almacenamiento del navegador.`;
                             sizeWarningMsg.style.cssText = 'color: orange; margin-bottom: 5px; padding: 10px; background-color: #fff3cd; border-color: #ffeeba;';
                              docsListDiv.appendChild(sizeWarningMsg);
                         }

                        const saved = saveDocItemToLocalStorage(currentUser.name, item); // Pass username and item with dataUrl

                         if (saved) {
                             // Display the newly added item
                             displayDocItem(currentUser.name, item, docsListDiv); // Pass username and item
                             // Update the count message immediately after saving
                             updateDocsCountMessage(currentUser.name);
                         } else {
                             // This case should be caught by the initial check, but keep for robustness
                             console.warn(`Failed to save "${item.name}". Limit might be reached.`);
                              const failedMsg = document.createElement('div');
                              failedMsg.textContent = `Error al guardar "${item.name}". El límite de ${effectiveLimit} documentos podría haberse alcanzado.`;
                              failedMsg.style.cssText = 'color: orange; margin-bottom: 5px; padding: 10px; background-color: #fff3cd; border-color: #ffeeba;';
                              docsListDiv.appendChild(failedMsg);
                         }
                    };
                    reader.readAsDataURL(file); // Read as Data URL

                } else {
                    const errorMsg = document.createElement('div');
                    errorMsg.textContent = `Error: "${file.name}" no es un archivo PDF y fue omitido.`;
                     errorMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: #f8d7da; border-color: #f5c6cb;';
                    docsListDiv.appendChild(errorMsg);
                }
            }
             // Clear the file input after processing
             docsUploadInput.value = '';
        });
         console.log('Documents upload input listener initialized.');
    } else {
        console.warn('Document elements not found. Document upload not initialized.');
    }
}

// Function to display a single document item (modified to include Data URL link)
function displayDocItem(username, item, containerDiv) {
     if (!username) {
        console.error('Cannot display document item: username is missing.');
        return;
     }

    // Create a container for the link and button
     const docEntryWrapper = document.createElement('div');
     docEntryWrapper.classList.add('doc-card');

     // Create the link element
     const docLink = document.createElement('a');
     docLink.href = item.dataUrl || '#';
     docLink.target = '_blank';
     docLink.title = `Abrir \"${item.name}\"`;

     // Left part with icon + name
     const docLeft = document.createElement('div');
     docLeft.className = 'doc-left';
     const docIcon = document.createElement('span');
     docIcon.className = 'doc-icon';
     docIcon.textContent = '📄';
     docLeft.appendChild(docIcon);
     // Show full file name (no truncation) in the link text
     docLink.textContent = item.name;
     docLink.className = 'doc-name';
     docLeft.appendChild(docLink);
     docEntryWrapper.appendChild(docLeft);

     // Actions (buttons)
     const actionsDiv = document.createElement('div');
     actionsDiv.className = 'doc-actions';

     // Preview button - opens modal with embedded PDF preview and full filename
     const previewButton = document.createElement('button');
     previewButton.textContent = 'Vista previa';
     previewButton.style.cssText = `
         background-color: rgba(0,123,255,0.9);
         color: white;
         border: none;
         border-radius: 6px;
         padding: 6px 10px;
         cursor: pointer;
         font-size: 0.8rem;
         margin-right: 8px;
     `;
     previewButton.onclick = (e) => {
         e.stopPropagation();
         const modal = document.getElementById('myModal');
         const modalImg = document.getElementById('modalImage');
         const modalDocContent = document.getElementById('modalDocument');
         if (!modal || !modalDocContent) {
             window.open(item.dataUrl, '_blank');
             return;
         }
         // Clear image view and prepare document container
         if (modalImg) modalImg.style.display = 'none';
         modalDocContent.style.display = 'block';
         modalDocContent.innerHTML = `
             <div class="modal-pet-card-container" style="display:flex;flex-direction:column;gap:12px;align-items:stretch;">
                 <div style="display:flex;justify-content:space-between;align-items:center;">
                     <strong style="font-size:1rem;word-break:break-word;">${item.name}</strong>
                     <button id="modal-download-doc" style="background:transparent;border:none;color:var(--accent-color);cursor:pointer;font-weight:700;">Descargar</button>
                 </div>
                 <div style="width:100%;height:540px;border-radius:8px;overflow:hidden;background:var(--surface-color);">
                     <iframe src="${item.dataUrl}" style="width:100%;height:100%;border:0;" title="${item.name}"></iframe>
                 </div>
             </div>
         `;
         // Attach download behavior
         const downloadBtn = document.getElementById('modal-download-doc');
         if (downloadBtn) {
             downloadBtn.onclick = () => {
                 const a = document.createElement('a');
                 a.href = item.dataUrl;
                 a.download = item.name;
                 document.body.appendChild(a);
                 a.click();
                 a.remove();
             };
         }
         modal.style.display = 'block';
     };
     actionsDiv.appendChild(previewButton);

     const deleteButton = document.createElement('button');
     deleteButton.textContent = 'X';
     deleteButton.style.cssText = `
         background-color: rgba(220, 53, 69, 0.7);
         color: white;
         border: none;
         border-radius: 4px;
         padding: 2px 6px;
         cursor: pointer;
         font-size: 0.7rem;
         line-height: 1;
         margin-left: 10px;
         flex-shrink: 0;
          transition: background-color 0.2s ease;
     `;
     deleteButton.onmouseover = () => { deleteButton.style.backgroundColor = 'rgba(220, 53, 69, 1)'; };
     deleteButton.onmouseout = () => { deleteButton.style.backgroundColor = 'rgba(220, 53, 69, 0.7)'; };
     deleteButton.onclick = (e) => {
         e.stopPropagation();
         window.showConfirmDialog('Eliminar Documento', `¿Estás seguro de que quieres eliminar el documento \"${item.name}\"?`, { confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true })
             .then(confirmed => {
                 if (!confirmed) return;
                 deleteDocItemFromLocalStorage(username, item);
                 docEntryWrapper.remove();
                 updateDocsCountMessage(username);
             });
     };
     actionsDiv.appendChild(deleteButton);
     docEntryWrapper.appendChild(actionsDiv);

     containerDiv.appendChild(docEntryWrapper);
}

// Function to display all saved document items for a specific user (modified)
export function displayDocsItems(username) {
    const docsListDiv = document.getElementById('docs-list');
    const docsCountMessage = document.getElementById('docs-count-message'); // Get the count message element

    if (docsListDiv && docsCountMessage) {
         docsListDiv.innerHTML = ''; // Clear current list
         const listHeading = document.createElement('h3');
         listHeading.textContent = 'Documentos Guardados';
         listHeading.style.cssText = 'margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; font-size: 1.2rem; color: #333;';
         docsListDiv.appendChild(listHeading);

         if (!username) {
             const msg = document.createElement('p');
             msg.textContent = 'Error: Usuario no especificado para cargar documentos.';
             msg.style.cssText = 'width: 100%; text-align: center; color: red;';
             docsListDiv.appendChild(msg);
              updateDocsCountMessage(username, true); // Clear count message
             console.error('displayDocsItems called without username.');
             return;
         }


         const docItems = loadDocsFromLocalStorage(username); // Load specific user's items

         // Update the count message before displaying items
         updateDocsCountMessage(username);


         if (docItems.length === 0) {
             const msg = document.createElement('p');
             msg.textContent = 'Aún no hay documentos guardados para este usuario.';
             docsListDiv.appendChild(msg);
         } else {
             docItems.forEach(item => {
                 // Check if item has the dataUrl property (for backward compatibility if needed)
                 if (item.dataUrl) {
                      displayDocItem(username, item, docsListDiv); // Pass username and item
                 } else {
                      console.warn(`Skipping document "${item.name}" display - missing dataUrl.`);
                      // Optionally display a message for items that couldn't be loaded
                      const skippedMsg = document.createElement('div');
                      skippedMsg.textContent = `Error al cargar "${item.name}". Puede que el archivo original no se guardara correctamente.`;
                      skippedMsg.style.cssText = 'color: orange; margin-bottom: 5px; padding: 10px; background-color: #fff3cd; border-color: #ffeeba;';
                      docsListDiv.appendChild(skippedMsg);
                 }
             });
         }
         console.log(`Document items displayed for user "${username}".`);
    } else {
         console.error('Documents list or count message element not found.');
    }
}


// Function to update the documents count message
function updateDocsCountMessage(username, clear = false) {
     const docsCountMessage = document.getElementById('docs-count-message');
     if (!docsCountMessage) return;

     if (clear || !username) {
         docsCountMessage.textContent = '';
         return;
     }

     const currentItems = loadDocsFromLocalStorage(username);
     const count = currentItems.length;
     const userLimit = loadUserDocLimit(username);
     const effectiveLimit = Number.isInteger(userLimit) && userLimit > 0 ? userLimit : loadAdminDocLimit();
     const remaining = effectiveLimit - count;

     if (count >= effectiveLimit) {
         docsCountMessage.textContent = `Límite alcanzado: ${count} de ${effectiveLimit} documentos. Elimina documentos para subir más.`;
         docsCountMessage.classList.add('limit-reached');
         docsCountMessage.classList.remove('limit-remaining');
     } else {
         docsCountMessage.textContent = `Tienes ${count} de ${effectiveLimit} documentos guardados. Puedes subir ${remaining} documento(s) más.`;
         docsCountMessage.classList.add('limit-remaining');
         docsCountMessage.classList.remove('limit-reached');
     }
}