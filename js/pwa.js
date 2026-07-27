
// =========================================================================
// PWA.JS
// Handles Service Worker registration, updates, and installation prompts.
// =========================================================================

let deferredInstallPrompt = null;
let pwaAction = null; // 'install' or 'update'

function updatePwaButton() {
    const btn = document.getElementById('pwaActionBtn');
    if (!btn) return;

    if (pwaAction === 'update') {
        btn.textContent = 'Update App (New Version)';
        btn.classList.remove('hidden');
        btn.style.display = 'block';
    } else if (pwaAction === 'install') {
        btn.textContent = 'Install App';
        btn.classList.remove('hidden');
        btn.style.display = 'block';
    } else {
        btn.classList.add('hidden');
        btn.style.display = 'none';
    }
}

function handlePwaAction() {
    if (pwaAction === 'install') {
        installPWA();
    } else if (pwaAction === 'update') {
        applyUpdate();
    }
}

function handlePwaUninstall() {
    if (confirm('Uninstall App and Reset? This will unregister the Service Worker and clear cache.')) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (let registration of registrations) {
                registration.unregister();
            }
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
            alert('App uninstalled. Reloading...');
            window.location.reload();
        });
    }
}

// URL Parameter Cache Reset Check
if (window.location.search.includes('clear_cache=1') || window.location.search.includes('reset=1')) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) registration.unregister();
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
                console.log('[PWA] Purged all service worker registrations & caches!');
                window.location.href = window.location.pathname;
            });
        });
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=3.0')
            .then(registration => {
                console.log('[PWA] Service Worker registered:', registration.scope);
                registration.update(); // Force check for sw.js updates on every page load

                // Check if update is waiting
                if (registration.waiting) {
                    console.log('[PWA] Service worker waiting -> auto applying update');
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    pwaAction = 'update';
                    updatePwaButton();
                }

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('[PWA] New service worker found. State:', newWorker.state);

                    newWorker.addEventListener('statechange', () => {
                        console.log('[PWA] New worker state changed to:', newWorker.state);
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('[PWA] Update installed. Applying skipWaiting...');
                                if (newWorker) newWorker.postMessage({ type: 'SKIP_WAITING' });
                                pwaAction = 'update';
                                updatePwaButton();
                            }
                        }
                    });
                });
            })
            .catch(err => {
                console.error('[PWA] Service Worker registration failed:', err);
            });
    });

    // Detect controller change (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Controller changed, reloading page for fresh assets...');
        window.location.reload();
    });
}

// --- 2. Install Prompt Handling ------------------------------------------

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] App install available');

    if (pwaAction !== 'update') {
        pwaAction = 'install';
        updatePwaButton();
    }
});

window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    deferredInstallPrompt = null;
    if (pwaAction === 'install') {
        pwaAction = null;
        updatePwaButton();
    }
});

// --- 3. Actions -----------------------------------------------------

function installPWA() {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();

    deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted the install prompt');
        } else {
            console.log('[PWA] User dismissed the install prompt');
        }
        deferredInstallPrompt = null;
        if (pwaAction === 'install') {
            pwaAction = null;
            updatePwaButton();
        }
    });
}

function applyUpdate() {
    if (!navigator.serviceWorker) return;

    sessionStorage.setItem('pwa_update_initiated', 'true');

    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            window.location.reload();
        }
    });
}

// DOM READY CHECK
window.addEventListener('DOMContentLoaded', () => {
    updatePwaButton();
});

// Receive Version from SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'VERSION') {
            const verStr = event.data.version.replace('patchnotes-', 'v');
            const el = document.getElementById('appVersion');
            if (el) el.textContent = verStr;
            console.log('[PWA] Version synced:', verStr);
        }
    });
}
