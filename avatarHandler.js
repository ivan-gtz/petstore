// --- Avatar Handling Logic ---
let currentAvatarDataUrl = ''; // Variable to hold the current avatar Data URL

export function displayAvatar(targetDiv, dataUrl) {
    if (!targetDiv) {
        console.error('displayAvatar called with a null targetDiv.');
        return;
    }

    // Remove existing avatar elements (img or svg)
    while (targetDiv.firstChild) {
        targetDiv.removeChild(targetDiv.firstChild);
    }

    if (dataUrl) {
        const imgElement = document.createElement('img');
        imgElement.alt = 'Pet Avatar';
        imgElement.src = dataUrl;
        targetDiv.appendChild(imgElement);
        currentAvatarDataUrl = dataUrl; // Update the module's state
    } else {
        // Use default SVG - need to get the correct one based on targetDiv ID
        const defaultSvgId = targetDiv.id === 'pet-avatar' ? 'default-avatar' : 'default-avatar-panel';
        const defaultSvgTemplate = document.getElementById(defaultSvgId);

        if (defaultSvgTemplate) {
            const defaultSvg = defaultSvgTemplate.cloneNode(true);
            defaultSvg.style.display = 'block';
            targetDiv.appendChild(defaultSvg);
            currentAvatarDataUrl = ''; // Clear the module's state if using default
        } else {
            console.error(`Default SVG template not found for ID: ${defaultSvgId}. Cannot display default avatar.`);
        }
    }
}

// Function to set up the file input listener for a specific avatar element
export function initAvatarInput(avatarInputId, avatarDisplayDivId) {
    const avatarInput = document.getElementById(avatarInputId);
    const avatarDisplayDiv = document.getElementById(avatarDisplayDivId);

    if (avatarInput && avatarDisplayDiv) {
        avatarInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    displayAvatar(avatarDisplayDiv, e.target.result);
                };
                reader.readAsDataURL(file);
            } else {
                // If file selection is cancelled, display default
                displayAvatar(avatarDisplayDiv, null);
            }
        });
    } else {
        console.warn(`Avatar elements not found: input=${avatarInputId}, display=${avatarDisplayDivId}. Avatar input listener not initialized.`);
    }
}

// Export the current avatar data URL state (read-only access)
export function getCurrentAvatarDataUrl() {
    return currentAvatarDataUrl;
}

// Function to load an avatar Data URL into the handler's state
export function loadAvatarDataUrl(dataUrl) {
    currentAvatarDataUrl = dataUrl || '';
}