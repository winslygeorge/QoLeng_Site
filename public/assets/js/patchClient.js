// patchClient.js
// ✅ Reactive HTML Client-Side Patching & Hydration with WS Subscription & Ping Support
// 🔄 Modified to process all patch types using the 'selector' field.
// 🔄 Enhanced with deep nested state support for paths like "assignedTo.name", "assignedTo.role.name"
// 🔄 Updated to handle new CRUD patch structure with displayType and operations

// Add near the WebSocket setup
window._routes = new Map();

// Register a route
window.__register = function(path, config) {
    const routeKey = config.componentKey || path.replace(/[^a-zA-Z0-9]/g, '_');
    
    window._routes.set(path, {
        ...config,
        routeKey,
        pattern: this.pathToPattern(path)
    });
    
    console.log(`Registered route: ${path} -> ${routeKey}`);
}

// --- Main Overlay Function ---
function showHotReloadOverlay(message, type = "info", duration = 3000, persist = false, details = null) {
    return window.__patchHelpers.showHotReloadOverlay(message, type, duration, persist, details);
}

let currentComponentKey = null;
let isdebug = false;

function previewImageFn(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.getElementById('preview');
            img.src = e.target.result;
            img.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

window._getUploadStatus_ = function (inputName, onUpdate, interval = 500) {
    return window.__patchHelpers.getUploadStatus(inputName, onUpdate, interval);
};

window.__reactiveComponentInstance__ = { state: { __shared: window.__INITIAL_STATE__ || {}, __client: {} } };

// --- Debounce & Throttle Utilities ---
window.__debounce = function (func, wait, immediate = false) {
    return window.__patchHelpers.debounce(func, wait, immediate);
};

window.__throttle = function (func, limit) {
    return window.__patchHelpers.throttle(func, limit);
};

// Helper for creating VDOM nodes (Kept for compatibility)
function h(tag, attrs, children) {
    return window.__patchHelpers.h(tag, attrs, children);
}

// --- VDOM to HTML Renderer (NEW) ---
function renderToString(vnode) {
    return window.__patchHelpers.renderToString(vnode);
}

// --- Reactive Variable Updates (Primary Patch Handler) ---
function isEmptyValue(value) {
    return window.__patchHelpers.isEmptyValue(value);
}

// --- Helper function to get nested value from an object ---
function getNestedValue(obj, path) {
    return window.__patchHelpers.getNestedValue(obj, path);
}

// --- Enhanced applyDataBindings for deep nested properties ---
function applyDataBindings(element, data) {
    return window.__patchHelpers.applyDataBindings(element, data);
}

// Update the main reactive variable handler
window.__updateReactiveVar__ = function (varName, value) {
    console.log("Updating reactive variable:", varName, "with value:", value);
    return window.__patchHelpers.updateReactiveVar(varName, value);
};

// --- Debounced Input Handling ---
window.__initializeReactiveInputs__ = function () {
    return window.__patchHelpers.initializeReactiveInputs();
};

// Update renderTemplate to use enhanced function
function renderTemplate(template, data) {
    return window.__patchHelpers.renderTemplate(template, data);
}

// --- Core Patch Handlers ---
const patchHandlers = {
    "attr": (target, patch) => {
        if (patch.key && patch.value !== undefined) target.setAttribute(patch.key, patch.value);
    },
    "remove-attr": (target, patch) => {
        if (patch.key) target.removeAttribute(patch.key);
    },
    "text": (target, patch) => {
        if (!target.hasAttribute('data-bind')) {
            target.textContent = patch.content != null ? String(patch.content) : "";
        }
    },
    "replace": (target, patch) => {
        let newHTML;
        if (patch.newHTML) {
            newHTML = patch.newHTML;
        } else if (patch.new) {
            newHTML = window.__patchHelpers.renderToString(patch.new);
        } else {
            console.warn("Replace patch missing newHTML or new property");
            return;
        }

        const parser = new DOMParser();
        const newEl = parser.parseFromString(newHTML || '', "text/html").body.firstElementChild;
        if (newEl) target.replaceWith(newEl);
    },
    "remove": (target) => {
        target.remove();
    },
    "list": (target, patch) => {
        console.log("Applying list target patch:", patch, "to target:", target);
        return window.__patchHandlers.list(target, patch);
    },
    "object": (target, patch) => {
        return window.__patchHandlers.object(target, patch);
    },
    "nested": (target, patch) => {
        return window.__patchHandlers.nested(target, patch);
    },
    "crud": (target, patch) => {
        return window.__patchHandlers.crud(target, patch);
    }
};

// Update the CRUD operation handlers reference
window.__patchHandlers = {
    list: (target, patch) => window.__patchHelpers.handleListPatch(target, patch),
    object: (target, patch) => window.__patchHelpers.handleObjectPatch(target, patch),
    nested: (target, patch) => window.__patchHelpers.handleNestedPatch(target, patch),
    crud: (target, patch) => window.__patchHelpers.handleCrudPatch(target, patch)
};

// --- Core Patch Application ---
function applyPatch(patch, retryCount = 0) {
    return window.__patchHelpers.applyPatch(patch, retryCount, patchHandlers, isdebug);
}

// --- Hydration ---
function waitForReactiveInstance(retries = 10, delay = 100) {
    return window.__patchHelpers.waitForReactiveInstance(retries, delay);
}

async function applyInitialState(globalState = {}, clientState = {}) {
    return window.__patchHelpers.applyInitialState(globalState, clientState, isdebug);
}

// --- Local State Management ---
function useLocalState(initialState) {
    return window.__patchHelpers.useLocalState(initialState);
}
window.__useLocalState__ = useLocalState;

let userId = window.__USER_ID__ || "guest-" + Math.random().toString(36).slice(2);

// Initialize upload tracking objects
window.__pendingFileUploads = {};
window.__pendingBatches = {};
window._clientVars = window._clientVars || {};
window._clientVars.uploadProgress = {};

// === 🔄 sendPatch with batch waiting ===
window.sendPatch = async function (component_key, methodName, args = {}) {
    return window.__patchHelpers.sendPatch(component_key, methodName, args, userId);
};

// --- WebSocket Setup ---
const WS_URL = 'ws://' + window.location.host + '/ws?user_id=' + encodeURIComponent(userId);
let ws;
let subscribed = false;

function connectWebSocket() {
    return window.__patchHelpers.connectWebSocket(WS_URL, userId);
}

// --- Debug State Display ---
window.showDebugState = function () {
    return window.__patchHelpers.showDebugState();
};

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    window.__setInitialState__ = applyInitialState;

    if (window.localStorage.getItem('client_token') != "" && window.localStorage.getItem('client_token') != undefined) {
        userId = window.localStorage.getItem('client_token')
    } else {
        window.localStorage.setItem("client_token", userId)
    }

    connectWebSocket();
    if (window.__INITIAL_STATE__) {
        applyInitialState(window.__INITIAL_STATE__);
    }

    // 🔄 Automatically wrap <input type="file" multiple>
    const debouncedFileChangeHandler = window.__debounce(async (e) => {
        const input = e.target;
        if (input.type === "file" && input.multiple && input.files.length > 0) {
            const files = await window.__patchHelpers.buildFileObjects(input.files);
            input.__fileObjects = files;
        } else if (input.type === "file" && input.files.length === 1) {
            const files = await window.__patchHelpers.buildFileObjects(input.files);
            input.__fileObjects = files[0];
        }
    }, 500);

    document.body.addEventListener("change", debouncedFileChangeHandler);

    window._setupModalDragging = function (modalId) {
        return window.__patchHelpers.setupModalDragging(modalId);
    };
});

window.router = window.__SPA_ROUTER__ || null;

// Initialize SPA routing
document.addEventListener('DOMContentLoaded', function() {
    // Wait for WebSocket connection
    const checkRouter = setInterval(() => {
        if (window.__SPA_ROUTER__ && ws && ws.readyState === WebSocket.OPEN ) {
            clearInterval(checkRouter);
            
            // Initialize router
            window.__SPA_ROUTER__.init();
            
            // Setup link interception (already done in router, but ensure it's working)
            document.addEventListener('click', function(e) {
                const link = e.target.closest('a[href]');
                if (link && 
                    !link.target && 
                    !link.hasAttribute('download') && 
                    !e.ctrlKey && 
                    !e.metaKey && 
                    !e.shiftKey &&
                    link.href &&
                    link.href.startsWith(window.location.origin) &&
                    !link.href.includes('#') &&
                    link.getAttribute('data-spa-ignore') !== 'true') {
                    
                    e.preventDefault();
                    const path = link.href.substring(window.location.origin.length);
                    window.__SPA_ROUTER__.navigate(path, { trigger: true });
                }
            });
            
            console.log('✅ Client-side router initialized');
        }
    }, 100);
});

// Global navigation helpers
window.__navigateTo = function(path, options = {}) {
    return window.__SPA_ROUTER__?.navigate(path, options);
};

window.__navigateBack = function() {
    return window.history.back();
};

window.__navigateForward = function() {
    return window.history.forward();
};

window.__getCurrentRoute = function() {
    return window.__SPA_ROUTER__?.getCurrentRoute();
};