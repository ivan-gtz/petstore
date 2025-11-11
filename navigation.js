// --- Section Navigation Logic ---
import { isAdmin } from './loginHandler.js'; // Import isAdmin

export function showSection(targetId, sectionCallbacks = {}) {
    // If the body has the 'shared-view' class, navigation is disabled
    if (document.body.classList.contains('shared-view')) {
        console.log('Navigation disabled in shared view.');
        // In shared view, we *only* show the panel, so don't try to navigate elsewhere
        const panelSection = document.getElementById('panel-section');
        if (panelSection && targetId !== 'panel-section') {
             // If trying to navigate to something other than panel in shared view, do nothing.
             return;
        } else if (panelSection && targetId === 'panel-section') {
             // Allow explicitly calling showSection('panel-section') even in shared view,
             // but ensure only panel is shown.
            document.querySelectorAll('.content-section').forEach(section => {
                 section.classList.remove('active');
                 section.style.display = 'none';
             });
             panelSection.classList.add('active');
             panelSection.style.display = 'block';
             // Still trigger the panel callback in shared view
             if (sectionCallbacks[targetId] && typeof sectionCallbacks[targetId] === 'function') {
                 sectionCallbacks[targetId]();
             }
             return; // Stop further navigation logic
        } else if (!panelSection) {
             console.error('Panel section not found.');
             return;
        }
    }

    // --- Access Control Check ---
    // Check if the target section is admin-only and the user is not admin
    const adminOnlySections = ['clients-section', 'users-section', 'control-section']; 
    if (adminOnlySections.includes(targetId) && !isAdmin()) {
        console.warn(`Access denied to ${targetId} section: User is not admin.`);
        alert('Acceso denegado. Esta sección es solo para administradores.'); // Provide user feedback

        // Redirect to the panel section
         const panelSection = document.getElementById('panel-section');
         if (panelSection) {
              // Use history.replaceState to prevent the denied section from being in the history
              window.history.replaceState(null, '', `/panel-section`);
              showSection('panel-section', sectionCallbacks); // Redirect to panel
         } else {
               // Fallback if panel is also missing
               console.error('Panel section not found for redirection after access denied.');
         }
        return; // Stop further execution
    }
    // --- End Access Control Check ---


    const contentSections = document.querySelectorAll('.content-section');

    contentSections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none'; // Explicitly hide non-active sections
    });

    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block'; // Explicitly show active section

        // Trigger specific section callback if provided
        if (sectionCallbacks[targetId] && typeof sectionCallbacks[targetId] === 'function') {
            sectionCallbacks[targetId]();
        } else {
            console.warn(`No specific callback registered for section: ${targetId}`);
        }
    } else {
        console.error(`Target section not found: ${targetId}`);
    }
}

export function initNavigation(sectionCallbacks = {}, handleLogout = () => {}) {
    // If the body has the 'shared-view' class, navigation initialization is skipped
    if (document.body.classList.contains('shared-view')) {
        console.log('Navigation initialization skipped in shared view.');
        // In shared view, we don't initialize sidebar navigation or popstate handling.
        return;
    }

    const sidebarLinks = document.querySelectorAll('.sidebar nav a');
    const initialActiveSection = document.querySelector('.content-section.active');
    const defaultSectionId = 'panel-section'; // Default section to show

    // Ensure all content sections are initially hidden (controlled by CSS .content-section)
    // This might be redundant if handled by shared-view check, but safe to keep
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });


    // Add click listeners to sidebar links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            // Check shared view again in case the class was added dynamically (unlikely but safe)
            if (document.body.classList.contains('shared-view')) {
                 event.preventDefault(); // Prevent default link behavior
                 console.log('Sidebar link click ignored in shared view.');
                 return;
            }
            event.preventDefault();
            const targetId = event.currentTarget.dataset.target;

            if (targetId === 'logout') {
                handleLogout();
                return;
            }

            // Check admin status before allowing navigation click for admin-only sections
            const adminOnlySections = ['clients-section', 'users-section', 'control-section']; 
            if (adminOnlySections.includes(targetId) && !isAdmin()) {
                 console.warn(`Sidebar link "${targetId}" clicked but user is not admin.`);
                 alert('Acceso denegado. Esta sección es solo para administradores.');
                 return; // Prevent navigation
            }


            if (targetId) {
                // Update URL with a path-based approach
                const newPath = `/${targetId}`;
                history.pushState(null, '', newPath);
                showSection(targetId, sectionCallbacks);
            }
        });
    });

    // Determine and show initial active section based on path or default
    const path = window.location.pathname;
    let initialSectionId = path.substring(1) || (initialActiveSection ? initialActiveSection.id : defaultSectionId);

    // If the path is just '/', default to the defaultSectionId
    if (path === '/') {
        initialSectionId = defaultSectionId;
    }

    // Check if the initial path points to an admin-only section and the user is not admin, redirect to panel
    const adminOnlySections = ['clients-section', 'users-section', 'control-section']; 
    if (adminOnlySections.includes(initialSectionId) && !isAdmin()) {
         console.warn(`Redirecting non-admin user from ${initialSectionId} section on initial load.`);
         initialSectionId = defaultSectionId; // Change target to panel
         // Update URL to reflect the redirect
         window.history.replaceState(null, '', `/${initialSectionId}`);
    }


    // Call showSection directly for the initial section, which will also run its callback
    // Ensure the initial display respects the shared view state if it was set before initNavigation
    // (Handled in app.js by bypassing initNavigation and calling showSection directly)
     showSection(initialSectionId, sectionCallbacks);


    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
        // Check shared view again on popstate
         if (document.body.classList.contains('shared-view')) {
              console.log('Popstate ignored in shared view.');
              return;
         }
        const path = window.location.pathname;
        let targetId = path.substring(1) || defaultSectionId;

        // Check admin status on popstate for admin-only sections
         const adminOnlySections = ['clients-section', 'users-section', 'control-section']; 
         if (adminOnlySections.includes(targetId) && !isAdmin()) {
              console.warn(`Popstate to ${targetId} section blocked: User is not admin.`);
              // Redirect popstate back to panel
              targetId = defaultSectionId;
              window.history.replaceState(null, '', `/${targetId}`); // Replace state to prevent infinite loop
         }

        showSection(targetId, sectionCallbacks);
    });
}