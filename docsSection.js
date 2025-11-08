import { db } from './firebase-init.js';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getLoginState } from './loginHandler.js';

const DEFAULT_DOC_LIMIT = 10; // Fallback default limit

export function initDocsSection() {
    const docsUploadInput = document.getElementById('docs-upload');
    const docsListDiv = document.getElementById('docs-list');
    const docsCountMessage = document.getElementById('docs-count-message');

    if (docsUploadInput && docsListDiv && docsCountMessage) {
        docsUploadInput.addEventListener('change', async function(event) {
            const files = event.target.files;
            const currentUser = getLoginState();

            if (!currentUser || !currentUser.uid) {
                alert('Error: Debes iniciar sesión para subir documentos.');
                docsUploadInput.value = '';
                return;
            }

            const userDocLimit = await getUserDocLimit(currentUser.uid);
            const currentCount = await getUserDocCount(currentUser.uid);
            const availableSlots = userDocLimit - currentCount;

            if (files.length > availableSlots) {
                alert(`No puedes subir más de ${availableSlots} archivo(s) a la vez. Límite de ${userDocLimit} alcanzado.`);
                docsUploadInput.value = '';
                return;
            }

            for (const file of files) {
                const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
                if (file.size > MAX_UPLOAD_BYTES) {
                    alert(`El archivo "${file.name}" excede el tamaño máximo permitido de 2 MB y no fue subido.`);
                    continue;
                }

                if (file.type !== 'application/pdf') {
                    const errorMsg = document.createElement('div');
                    errorMsg.textContent = `Error: "${file.name}" no es un archivo PDF y fue omitido.`;
                    errorMsg.style.cssText = 'color: red; margin-bottom: 5px; padding: 10px; background-color: #f8d7da; border-color: #f5c6cb;';
                    docsListDiv.appendChild(errorMsg);
                    continue;
                }

                const reader = new FileReader();
                reader.onload = async function(e) {
                    const dataUrl = e.target.result;

                    const sizeInBytes = dataUrl.length;
                    if (sizeInBytes > MAX_UPLOAD_BYTES * 1.4) {
                        alert(`El archivo "${file.name}" es demasiado grande para guardarlo directamente. Límite de 2MB.`);
                        return;
                    }

                    try {
                        const docRef = await addDoc(collection(db, "documents"), {
                            userId: currentUser.uid,
                            name: file.name,
                            dataUrl: dataUrl,
                            createdAt: new Date()
                        });

                        displayDocItem({ id: docRef.id, name: file.name, dataUrl: dataUrl }, docsListDiv);
                        updateDocsCountMessage(currentUser.uid);

                    } catch (error) {
                        console.error("Error saving document to Firestore:", error);
                        alert(`Error al guardar "${file.name}".`);
                    }
                };
                reader.readAsDataURL(file);
            }
            docsUploadInput.value = '';
        });
        console.log('Documents upload input listener initialized for Firestore.');
    } else {
        console.warn('Document elements not found. Document upload not initialized.');
    }
}

function displayDocItem(item, containerDiv) {
    const docEntryWrapper = document.createElement('div');
    docEntryWrapper.classList.add('doc-card');
    docEntryWrapper.setAttribute('data-doc-id', item.id);

    const docLink = document.createElement('a');
    docLink.href = item.dataUrl;
    docLink.target = '_blank';
    docLink.title = `Abrir "${item.name}"`;

    const docLeft = document.createElement('div');
    docLeft.className = 'doc-left';
    const docIcon = document.createElement('span');
    docIcon.className = 'doc-icon';
    docIcon.textContent = '📄';
    docLeft.appendChild(docIcon);
    docLink.textContent = item.name;
    docLink.className = 'doc-name';
    docLeft.appendChild(docLink);
    docEntryWrapper.appendChild(docLeft);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'doc-actions';

    const previewButton = document.createElement('button');
    previewButton.textContent = 'Vista previa';
    previewButton.style.cssText = `...`; // Styles remain the same
    previewButton.onclick = (e) => {
        e.stopPropagation();
        const modal = document.getElementById('myModal');
        const modalDocContent = document.getElementById('modalDocument');
        if (!modal || !modalDocContent) {
            window.open(item.dataUrl, '_blank');
            return;
        }
        document.getElementById('modalImage').style.display = 'none';
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
        document.getElementById('modal-download-doc').onclick = () => {
            const a = document.createElement('a');
            a.href = item.dataUrl;
            a.download = item.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
        };
        modal.style.display = 'block';
    };
    actionsDiv.appendChild(previewButton);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'X';
    deleteButton.style.cssText = `...`; // Styles remain the same
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        window.showConfirmDialog('Eliminar Documento', `¿Estás seguro de que quieres eliminar "${item.name}"?`, { confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true })
            .then(async confirmed => {
                if (!confirmed) return;
                try {
                    await deleteDoc(doc(db, "documents", item.id));
                    docEntryWrapper.remove();
                    const currentUser = getLoginState();
                    if (currentUser && currentUser.uid) {
                        updateDocsCountMessage(currentUser.uid);
                    }
                } catch (error) {
                    console.error("Error deleting document from Firestore:", error);
                    alert(`Error al eliminar "${item.name}".`);
                }
            });
    };
    actionsDiv.appendChild(deleteButton);
    docEntryWrapper.appendChild(actionsDiv);

    containerDiv.appendChild(docEntryWrapper);
}

export async function displayDocsItems(userId) {
    const docsListDiv = document.getElementById('docs-list');
    if (!docsListDiv) {
        console.error('Documents list element not found.');
        return;
    }

    docsListDiv.innerHTML = '';
    const listHeading = document.createElement('h3');
    listHeading.textContent = 'Documentos Guardados';
    listHeading.style.cssText = '...';
    docsListDiv.appendChild(listHeading);

    if (!userId) {
        const msg = document.createElement('p');
        msg.textContent = 'Inicia sesión para ver tus documentos.';
        docsListDiv.appendChild(msg);
        updateDocsCountMessage(null, true);
        return;
    }

    try {
        const q = query(collection(db, "documents"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        updateDocsCountMessage(userId);

        if (querySnapshot.empty) {
            const msg = document.createElement('p');
            msg.textContent = 'Aún no hay documentos guardados.';
            docsListDiv.appendChild(msg);
        } else {
            querySnapshot.forEach((doc) => {
                displayDocItem({ id: doc.id, ...doc.data() }, docsListDiv);
            });
        }
        console.log(`Document items displayed for user "${userId}" from Firestore.`);
    } catch (error) {
        console.error("Error fetching documents from Firestore:", error);
        const msg = document.createElement('p');
        msg.textContent = 'Error al cargar los documentos.';
        msg.style.color = 'red';
        docsListDiv.appendChild(msg);
    }
}

async function updateDocsCountMessage(userId, clear = false) {
    const docsCountMessage = document.getElementById('docs-count-message');
    if (!docsCountMessage) return;

    if (clear || !userId) {
        docsCountMessage.textContent = '';
        return;
    }

    const count = await getUserDocCount(userId);
    const limit = await getUserDocLimit(userId);
    const remaining = limit - count;

    if (count >= limit) {
        docsCountMessage.textContent = `Límite alcanzado: ${count} de ${limit} documentos.`;
        docsCountMessage.classList.add('limit-reached');
    } else {
        docsCountMessage.textContent = `Tienes ${count} de ${limit} documentos. Puedes subir ${remaining} más.`;
        docsCountMessage.classList.remove('limit-reached');
    }
}

async function getUserDocCount(userId) {
    if (!userId) return 0;
    const q = query(collection(db, "documents"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
}

async function getUserDocLimit(userId) {
    if (!userId) return DEFAULT_DOC_LIMIT;

    // 1. Check for a user-specific limit
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().docLimit) {
        return userSnap.data().docLimit;
    }

    // 2. Fallback to global limit
    const settingsRef = doc(db, "settings", "globalLimits");
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && settingsSnap.data().docLimit) {
        return settingsSnap.data().docLimit;
    }

    // 3. Fallback to the default constant
    return DEFAULT_DOC_LIMIT;
}