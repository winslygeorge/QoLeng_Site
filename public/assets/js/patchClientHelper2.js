// Initialize PatchManager correctly - it's an object, not a function
const PatchManager = window.__patchHelpers.PatchManager;

// --- Core Patch Application ---
window.__patchHelpers.applyPatch = function (patch, retryCount = 0, patchHandlers, isdebug) {
    if (!patch || typeof patch !== 'object' || !patch.type) {
        console.warn("⚠️ Skipping invalid patch:", patch);
        return;
    }

    // Ensure patchHandlers is available
    patchHandlers = patchHandlers || window.__patchHelpers.patchHandlers;
    
    // Ensure isdebug is available
    isdebug = isdebug || window.isdebug || false;

    // Check if it's a CRUD patch
    if (patch.type === "crud") {
        console.debug("Processing CRUD patch:", patch);
        
        // Use selector to find target element
        let target;
        if (patch.selector) {
            target = document.querySelector(patch.selector);
        } else if (patch.varName) {
            // Fallback: find element by data-bind attribute
            target = document.querySelector(`[data-bind="${patch.varName}"]`);
        }
        
        if (!target && retryCount < 5) {
            console.debug(`⏳ Target not found for CRUD patch, retrying... (${retryCount + 1}/5)`);
            setTimeout(() => window.__patchHelpers.applyPatch(patch, retryCount + 1, patchHandlers, isdebug), 100 * (retryCount + 1));
            return;
        }
        
        if (!target) {
            console.warn(`⚠️ Target not found for CRUD patch:`, patch);
            
            // Still update reactive variable even if DOM element not found
            if (patch.varName && patch.value !== undefined) {
                // Use __patchHelpers version of updateReactiveVar
                window.__patchHelpers.updateReactiveVar(patch.varName, patch.value);
            }
            return;
        }
        
        // Apply the CRUD patch
        if (patchHandlers && patchHandlers.crud) {
            patchHandlers.crud(target, patch);
        } else {
            console.warn("CRUD handler not available in patchHandlers");
        }
        return;
    }
    
    // Handle update-var patches
    if (patch.type === "update-var") {
        if (isdebug) {
            window.__patchHelpers.showHotReloadOverlay(
                `🔄 Updating variable: ${patch.varName}`,
                "info",
                3000,
                false,
                `New value: ${patch.value}`
            );
        }
        // Use __patchHelpers version
        window.__patchHelpers.updateReactiveVar(patch.varName, patch.value);
        return;
    }

    const handler = patchHandlers ? patchHandlers[patch.type] : null;
    if (handler && typeof handler === 'function') {
        // Handle ":scope" selector specially
        let target;
        if (patch.selector !== ":scope") {
            target = document.querySelector(patch.selector);
        } else {
            // For ":scope" selector, use the element itself
            console.warn("⚠️ :scope selector not fully supported in patchHelpers");
            return;
        }

        // 🔄 RETRY LOGIC: If element not found, retry a few times
        if (!target && retryCount < 10) {
            console.debug(`⏳ Element not found for "${patch.selector}", retrying... (${retryCount + 1}/5)`);
            setTimeout(() => window.__patchHelpers.applyPatch(patch, retryCount + 1, patchHandlers, isdebug), 500 * (retryCount + 1));
            return;
        }

        if (!target) {
            console.debug("⚠️ Target not found for selector after retries:", patch.selector);
            return;
        }

        handler(target, patch);
        
        if (isdebug && window.__patchHelpers.showHotReloadOverlay) {
            window.__patchHelpers.showHotReloadOverlay(
                `🔄 Applying patch: ${patch.type}`,
                "info",
                3000,
                false,
                `Patch details: ${JSON.stringify(patch)}`
            );
        }
    } else {
        console.warn(`⚠️ Unknown patch type or handler not available: ${patch.type}`);
    }
};

// --- Hydration ---
window.__patchHelpers.waitForReactiveInstance = function (retries = 10, delay = 100) {
    if (window.__reactiveComponentInstance__) return Promise.resolve(window.__reactiveComponentInstance__);
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const timer = setInterval(() => {
            if (window.__reactiveComponentInstance__) {
                clearInterval(timer);
                resolve(window.__reactiveComponentInstance__);
            } else if (++attempts >= retries) {
                clearInterval(timer);
                reject("Timeout waiting for __reactiveComponentInstance__");
            }
        }, delay);
    });
};

window.__patchHelpers.applyInitialState = async function (globalState = {}, clientState = {}, isdebug) {
    console.debug("Hydrating state → global:", globalState, "client:", clientState);
    try {
        const instance = await window.__patchHelpers.waitForReactiveInstance();
        instance.state.__shared = instance.state.__shared || {};
        instance.state.__client = instance.state.__client || {};

        // Merge new state
        Object.assign(instance.state.__shared, globalState);
        Object.assign(instance.state.__client, clientState);

        // Update all reactive variables
        for (const varName in instance.state.__shared) {
            window.__patchHelpers.updateReactiveVar(varName, instance.state.__shared[varName]);
        }
        for (const varName in instance.state.__client) {
            window.__patchHelpers.updateReactiveVar(`${varName}`, instance.state.__client[varName]);
        }

        // Initialize input handlers
        if (window.__initializeReactiveInputs__) {
            window.__initializeReactiveInputs__();
        }

        // Call hydration complete callback
        if (window.__onHydrationComplete__) {
            window.__onHydrationComplete__();
        }

        // Show debug state if enabled
        if (isdebug && window.showDebugState) {
            window.showDebugState();
        }

    } catch (e) {
        console.error("Hydration failed:", e);
    }
};

// --- Local State Management ---
window.__patchHelpers.useLocalState = function (initialState) {
    let state = initialState;
    const listeners = [];
    function setState(newState) {
        state = { ...state, ...newState };
        listeners.forEach(listener => listener(state));
    }
    function subscribe(listener) {
        listeners.push(listener);
    }
    return [state, setState, subscribe];
};

// File upload helpers
window.__patchHelpers.logStatus = function (data, style) {
    console.debug(data);
};

const CHUNK_SIZE = 1024 * 10; // 10 KB

// === 🔄 File Helpers ===
window.__patchHelpers.fileToBase64 = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Convert FileList into array of fileObjects
window.__patchHelpers.buildFileObjects = async function (fileList) {
    return Promise.all(Array.from(fileList).map(async file => ({
        content: await window.__patchHelpers.fileToBase64(file),
        details: {
            name: file.name,
            size: file.size,
            mimeType: file.type
        }
    })));
};

// Ensure getOverlayContainer is available
window.__patchHelpers.getOverlayContainer = function() {
    if (window.getOverlayContainer) {
        return window.getOverlayContainer();
    }
    
    // Fallback implementation
    let container = document.querySelector("#__dawn_hmr_overlay__");
    if (!container) {
        container = document.createElement("div");
        container.id = "__dawn_hmr_overlay__";
        container.style.position = "fixed";
        container.style.top = "10px";
        container.style.right = "10px";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "6px";
        container.style.zIndex = "9999";
        document.body.appendChild(container);
    }
    return container;
};

// Ensure showHotReloadOverlay is available
window.__patchHelpers.showHotReloadOverlay = function(message, type = "info", duration = 3000, persist = false, details = null) {
    if (window.showHotReloadOverlay) {
        return window.showHotReloadOverlay(message, type, duration, persist, details);
    }
    
    // Fallback implementation
    console.log(`[HOT RELOAD] ${type.toUpperCase()}: ${message}`, details);
};

window.__patchHelpers.getOrCreateProgressOverlay = function (fileId, fileName) {
    let overlay = document.querySelector(`.__dawn_toast_progress__[data-file-id="${fileId}"]`);
    if (!overlay) {
        // Create the main overlay toast
        overlay = document.createElement("div");
        overlay.className = "__dawn_toast__ __dawn_toast_progress__";
        overlay.setAttribute("data-file-id", fileId);
        overlay.style.background = "rgba(44, 62, 80, 0.9)";
        overlay.style.color = "white";
        overlay.style.padding = "10px 14px";
        overlay.style.fontSize = "14px";
        overlay.style.borderRadius = "6px";
        overlay.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
        overlay.style.whiteSpace = "pre-line";
        overlay.style.maxWidth = "300px";
        overlay.style.position = "relative";
        overlay.style.transition = "all 0.4s ease";
        overlay.style.opacity = "0";
        overlay.style.transform = "translateX(100%)";

        // Add file name text
        const text = document.createElement("div");
        text.textContent = `Uploading: ${fileName}`;
        overlay.appendChild(text);

        // Create and add progress bar
        const progressBarContainer = document.createElement("div");
        progressBarContainer.style.height = "5px";
        progressBarContainer.style.background = "rgba(255,255,255,0.2)";
        progressBarContainer.style.borderRadius = "2px";
        progressBarContainer.style.marginTop = "6px";

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar-fill";
        progressBar.style.width = "0%";
        progressBar.style.height = "100%";
        progressBar.style.background = "#2ecc71";
        progressBar.style.borderRadius = "2px";
        progressBar.style.transition = "width 0.2s ease-in-out";
        progressBarContainer.appendChild(progressBar);

        overlay.appendChild(progressBarContainer);

        const container = window.__patchHelpers.getOverlayContainer();
        container.appendChild(overlay);
        
        // Ensure clear bar exists
        const clearBar = container.querySelector("#__dawn_hmr_clear__");
        if (clearBar) {
            clearBar.style.display = "flex";
        }

        // Animate in
        setTimeout(() => {
            overlay.style.opacity = "1";
            overlay.style.transform = "translateX(0)";
        }, 100);
    }
    return overlay;
};

// === 🔄 Stream uploader ===
window.__patchHelpers.streamAndAwaitUpload = function (fileObject, { batchId, fileKey, displayProgressBar, isFinalFile = false } = {}) {
    return new Promise((resolve, reject) => {
        const base64Content = fileObject.content.split(',')[1];
        const fileId = crypto.randomUUID();
        const filename = fileObject.details.name;

        // Initialize global tracking objects if they don't exist
        if (!window.__pendingFileUploads) {
            window.__pendingFileUploads = {};
        }
        if (!window._clientVars) {
            window._clientVars = { uploadProgress: {} };
        }
        if (!window._clientVars.uploadProgress) {
            window._clientVars.uploadProgress = {};
        }

        // Initialize progress status in the global variable or display overlay
        if (displayProgressBar) {
            window.__patchHelpers.getOrCreateProgressOverlay(fileId, filename);
        } else {
            // Initialize the entry for the file input name
            if (!window._clientVars.uploadProgress[fileKey]) {
                window._clientVars.uploadProgress[fileKey] = [];
            }
            window._clientVars.uploadProgress[fileKey].push({
                fileId: fileId,
                fileName: filename,
                progress: 0,
                status: "uploading"
            });
        }

        let offset = 0, chunkId = 0;

        const sendNextChunk = () => {
            if (offset >= base64Content.length) {
                // Finalize progress for this file
                if (displayProgressBar) {
                    const progressOverlay = document.querySelector(`.__dawn_toast_progress__[data-file-id="${fileId}"]`);
                    if (progressOverlay) {
                        const progressBar = progressOverlay.querySelector(".progress-bar-fill");
                        if (progressBar) {
                            progressBar.style.width = `100%`;
                        }
                    }
                }
                return;
            }

            const chunk = base64Content.slice(offset, offset + CHUNK_SIZE);
            const isLastChunk = (offset + CHUNK_SIZE) >= base64Content.length;

            const chunkPayload = {
                topic: "patch",
                event: "process_upload_file_chunk",
                payload: {
                    method: "upload_file_chunk",
                    args: {
                        fileId,
                        chunkId,
                        isLastChunk,
                        isFinalFile,
                        batchId,
                        fileObject: {
                            name: filename,
                            details: fileObject.details,
                            content: `data:${fileObject.details.mimeType};base64,${chunk}`
                        }
                    },
                    component_key: "file_uploader"
                },
            };

            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                window.ws.send(JSON.stringify(chunkPayload));
            } else {
                console.warn("WebSocket not open, cannot send chunk");
            }
            window.__patchHelpers.logStatus(`📤 Sent chunk ${chunkId} for ${filename}`, "text-yellow-600");

            // Calculate and update progress
            const progress = Math.min(100, Math.round((offset / base64Content.length) * 100));

            if (displayProgressBar) {
                const progressOverlay = document.querySelector(`.__dawn_toast_progress__[data-file-id="${fileId}"]`);
                if (progressOverlay) {
                    const progressBar = progressOverlay.querySelector(".progress-bar-fill");
                    if (progressBar) {
                        progressBar.style.width = `${progress}%`;
                    }
                }
            } else {
                const fileEntry = window._clientVars.uploadProgress[fileKey].find(f => f.fileId === fileId);
                if (fileEntry) {
                    fileEntry.progress = progress;
                }
            }

            offset += CHUNK_SIZE;
            chunkId++;
        };

        // Register per-file
        window.__pendingFileUploads[fileId] = {
            resolve,
            reject,
            sendNextChunk,
            fileKey,
            displayProgressBar
        };

        sendNextChunk();
    });
};

// === 🔄 sendPatch with batch waiting ===
window.__patchHelpers.sendPatch = async function (component_key, methodName, args = {}, userId) {
    console.debug(`📤 Sending patch: ${methodName}`, args, "for component:", component_key);

    if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
        window.__patchHelpers.logStatus("❌ WebSocket not open. Cannot send.", "text-red-600");
        return;
    }

    const fileEntries = Object.entries(args).filter(([key, value]) =>
        (Array.isArray(value) && value.every(v => v?.content && v?.details)) ||
        (typeof value === 'object' && value?.content && value?.details)
    );

    console.log("Detected file entries:", fileEntries, "count: ", fileEntries.length);

    if (fileEntries.length > 0) {
        window.__patchHelpers.logStatus("📁 File(s) detected → uploading in parallel...", "text-purple-600");

        try {
            const uploadedFiles = {};
            const batchId = crypto.randomUUID();

            // Initialize batch tracking
            if (!window.__pendingBatches) {
                window.__pendingBatches = {};
            }

            // Track batch promise
            const batchPromise = new Promise((resolve, reject) => {
                window.__pendingBatches[batchId] = { resolve, reject };
            });

            // Launch uploads
            const uploadTasks = fileEntries.map(async ([fileKey, value]) => {
                const fileInput = document.querySelector(`input[type="file"][name="${fileKey}"]`);
                console.log("File input element for", fileKey, ":", fileInput);
                const displayProgressBar = !fileInput || fileInput.getAttribute("data-display-default-progress-bar") !== "false";

                console.log(`Starting upload for ${fileKey}, displayProgressBar: ${displayProgressBar}`);

                if (Array.isArray(value)) {
                    const results = await Promise.all(
                        value.map((fileObj, idx) =>
                            window.__patchHelpers.streamAndAwaitUpload(fileObj, {
                                batchId,
                                fileKey,
                                displayProgressBar,
                                isFinalFile: idx === value.length - 1
                            })
                        )
                    );
                    uploadedFiles[fileKey] = results.map((filePath, i) => ({
                        path: filePath,
                        name: value[i].details.name
                    }));
                } else {
                    const filePath = await window.__patchHelpers.streamAndAwaitUpload(value, {
                        batchId,
                        fileKey,
                        displayProgressBar,
                        isFinalFile: true
                    });
                    uploadedFiles[fileKey] = {
                        path: filePath,
                        name: value.details.name
                    };
                }
            });

            // Wait until server confirms batch is complete
            await Promise.all(uploadTasks);
            await batchPromise;

            const finalArgs = { ...args, ...uploadedFiles };
            const finalPayload = {
                topic: "patch",
                event: "process_client_action",
                payload: {
                    method: methodName,
                    args: finalArgs,
                    component_key: component_key,
                    client_token: userId
                },
            };

            window.ws.send(JSON.stringify(finalPayload));
            window.__patchHelpers.logStatus("✅ Final payload sent with all uploaded file references.", "text-green-600");

        } catch (error) {
            window.__patchHelpers.logStatus(`❌ File upload failed: ${error.message}`, "text-red-600");
            console.error("File upload failed:", error);
        }
    } else {
        const payload = {
            topic: "patch",
            event: "process_client_action",
            payload: { method: methodName, args, component_key, client_token: userId }
        };
        window.ws.send(JSON.stringify(payload));
        window.__patchHelpers.logStatus(`📤 Sent message (${(JSON.stringify(payload).length / 1024).toFixed(2)} KB)`, "text-blue-600");
    }
};

// --- WebSocket Setup ---
window.__patchHelpers.connectWebSocket = function (WS_URL, userId) {
    if (window.ws && window.ws.readyState === WebSocket.OPEN) return;
    
    // Initialize tracking variables
    if (!window.__pendingFileUploads) window.__pendingFileUploads = {};
    if (!window.__pendingBatches) window.__pendingBatches = {};
    if (!window._clientVars) window._clientVars = { uploadProgress: {} };
    if (!window.subscribed) window.subscribed = false;
    
    window.ws = new WebSocket(WS_URL);

    // Initialize
    window.ws.onopen = () => {
        console.log("✅ WebSocket connected");
        window.ws.send(JSON.stringify({
            topic: "patch",
            event: "subscribe",
            payload: {
                component_key: window.__DEFAULT_COMPONENT_KEY__ || "counterApp",
                path: null,
                client_token: userId
            },
            user_id: userId
        }));
        window.subscribed = true;

        if (performance.getEntriesByType("navigation")[0].type === "reload") {
            console.log("Page was refreshed!");
            const key = window.__DEFAULT_COMPONENT_KEY__ || 'counterApp';
            console.log("key : ", key);

            // Use the patchHelpers version of sendPatch
            if (window.__patchHelpers.sendPatch) {
                window.__patchHelpers.sendPatch(key, 'navigateToCurrent', [], userId);
            }
        }
    };

 // Update the WebSocket onmessage handler in patchClientHelper2.js

 // Add this to your patchClientHelper2.js if __clientOp__ is not defined
window.__clientOp__ = window.__clientOp__ || function(operation) {
    console.debug("Executing client operation:", operation);
    
    if (!operation) return;
    
    // Handle callModuleFn operations
    if (operation._op === 'callModuleFn') {
        const { module: moduleName, fn: functionName, args = [] } = operation;
        
        try {
            // Get the module
            let targetModule = window;
            if (moduleName && moduleName !== 'window') {
                targetModule = window[moduleName];
                if (!targetModule) {
                    console.warn(`Module not found: ${moduleName}`);
                    return;
                }
            }
            
            // Get the function
            const func = targetModule[functionName];
            if (typeof func !== 'function') {
                console.warn(`Function not found: ${functionName} in ${moduleName}`);
                return;
            }
            
            // Call the function with arguments
            const result = func.apply(targetModule, args);
            console.debug(`Called ${moduleName}.${functionName}`, args, "Result:", result);
            return result;
            
        } catch (error) {
            console.error(`Error executing ${moduleName}.${functionName}:`, error);
            throw error;
        }
    }
    
    // Handle other operation types as needed
    console.warn("Unhandled operation type:", operation);
};

window.ws.onmessage = (event) => {
    try {
        const message = JSON.parse(event.data);

        // 🔥 FIX: Handle when message is directly an array of patches
        if (Array.isArray(message)) {
            console.debug("📦 Received direct array of patches:", message.length, "patches");
            if (window.PatchManager && window.PatchManager.enqueueBatch) {
                window.PatchManager.enqueueBatch(message);
            } else if (window.__patchHelpers && window.__patchHelpers.PatchManager && window.__patchHelpers.PatchManager.enqueueBatch) {
                window.__patchHelpers.PatchManager.enqueueBatch(message);
            }
            return;
        }

        // Handle regular message types
        switch (message.type) {
            // ========================
            // NOTIFICATION MESSAGES
            // ========================
            case 'notification':
                console.log(`🔔 System notification [${message.event || 'unknown'}]:`, message.payload, message);
                
                // Handle subscribed_to_patches event
                if (message.event === 'subscribed_to_patches') {
                    console.debug("✅ Subscribed to patches with component:", message.payload?.component_key);
                    
                    // Call onClientReady if onSuscribe is true
                    if (message.payload?.onSuscribe) {
                        const key = message.payload.component_key || window.__DEFAULT_COMPONENT_KEY__ || 'counterApp';
                        if (window.sendPatch) {
                            window.sendPatch(key, 'onClientReady', []);
                        } else if (window.__patchHelpers && window.__patchHelpers.sendPatch) {
                            window.__patchHelpers.sendPatch(key, 'onClientReady', [], window.userId);
                        } else {
                            console.warn("sendPatch not defined.");
                        }
                    }
                }
                break;
                
            // ========================
            // BROWSER OPERATIONS
            // ========================
            case 'browser_ops':
                console.debug("📱 Received browserOps operation:", message);
                
                // Execute the browserOps operation
                if (message.ops && window.__clientOp__) {
                    // Handle _ops array
                    if (message.ops._ops && Array.isArray(message.ops._ops)) {
                        message.ops._ops.forEach(op => {
                            window.__clientOp__(op);
                        });
                    } else {
                        // Handle single op
                        window.__clientOp__(message.ops);
                    }
                } else if (message.op && window.__clientOp__) {
                    window.__clientOp__(message.op);
                } else {
                    console.warn("Browser ops received but __clientOp__ not available:", message);
                }
                break;
                
            // ========================
            // ROUTE MANAGEMENT
            // ========================
            case 'register_route':
                if (message.path && message.componentKey) {
                    if (window.__registerRoute) {
                        window.__registerRoute(message.path, message.componentKey, message.options || {});
                    } else if (window.__SPA_ROUTER__ && window.__SPA_ROUTER__.registerRoute) {
                        window.__SPA_ROUTER__.registerRoute(message.path, message.componentKey, message.options || {});
                    }
                }
                break;
                
            case 'navigate_to':
                if (message.path) {
                    if (window.__SPA_ROUTER__ && window.__SPA_ROUTER__.navigate) {
                        window.__SPA_ROUTER__.navigate(message.path, message.options || {});
                    } else if (window.__navigateTo) {
                        window.__navigateTo(message.path, message.options || {});
                    }
                }
                break;
                
            case 'load_route':
                if (message.componentKey && message.props) {
                    if (window.__SPA_ROUTER__ && window.__SPA_ROUTER__.renderComponent) {
                        window.__SPA_ROUTER__.renderComponent(message.componentKey, message.props, message.html);
                    }
                }
                break;
                
            case 'route_error':
                console.error('Route error:', message.error);
                if (window.__SPA_ROUTER__) {
                    window.__SPA_ROUTER__.emit('route-error', {
                        componentKey: message.componentKey,
                        error: message.error
                    });
                }
                break;
                
            // ========================
            // CLIENT VARS
            // ========================
            case "getClientVars":
                if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                    window.ws.send(JSON.stringify({
                        topic: "patch",
                        event: "client_vars",
                        payload: { 
                            vars: window._clientVars || {},
                            userId: window.userId
                        },
                        user_id: window.userId
                    }));
                }
                break;
                
            // ========================
            // FILE UPLOAD HANDLING
            // ========================
            case "file_upload_error": {
                const upload = window.__pendingFileUploads?.[message.payload.fileId];
                if (upload) {
                    upload.reject(new Error(message.payload.message));
                    delete window.__pendingFileUploads[message.payload.fileId];

                    // Update global state or remove overlay
                    if (upload.displayProgressBar) {
                        const progressOverlay = document.querySelector(`.__dawn_toast_progress__[data-file-id="${message.payload.fileId}"]`);
                        if (progressOverlay) {
                            progressOverlay.remove();
                        }
                        // Use patchHelpers version if available
                        if (window.__patchHelpers && window.__patchHelpers.showHotReloadOverlay) {
                            window.__patchHelpers.showHotReloadOverlay(`❌ Upload Failed: ${message.payload.fileName}`, "error", 5000, false, message.payload.message);
                        } else if (window.showHotReloadOverlay) {
                            window.showHotReloadOverlay(`❌ Upload Failed: ${message.payload.fileName}`, "error", 5000, false, message.payload.message);
                        }
                    } else {
                        const fileEntry = window._clientVars.uploadProgress[upload.fileKey]?.find(f => f.fileId === message.payload.fileId);
                        if (fileEntry) {
                            fileEntry.status = "failed";
                            fileEntry.error = message.payload.message;
                        }
                    }
                }
                break;
            }
            
            case "file_upload_finished": {
                const upload = window.__pendingFileUploads?.[message.payload.fileId];
                if (upload) {
                    console.log(`✅ Finished file: ${message.payload.fileName}`);
                    upload.resolve(message.payload.filePath);
                    delete window.__pendingFileUploads[message.payload.fileId];

                    // Update global state or remove overlay
                    if (upload.displayProgressBar) {
                        const progressOverlay = document.querySelector(`.__dawn_toast_progress__[data-file-id="${message.payload.fileId}"]`);
                        if (progressOverlay) {
                            progressOverlay.style.opacity = "0";
                            progressOverlay.style.transform = "translateX(100%)";
                            setTimeout(() => progressOverlay.remove(), 400);
                        }
                        // Use patchHelpers version if available
                        if (window.__patchHelpers && window.__patchHelpers.showHotReloadOverlay) {
                            window.__patchHelpers.showHotReloadOverlay(`✅ Uploaded: ${message.payload.fileName}`, "success", 3000);
                        } else if (window.showHotReloadOverlay) {
                            window.showHotReloadOverlay(`✅ Uploaded: ${message.payload.fileName}`, "success", 3000);
                        }
                    } else {
                        const fileEntry = window._clientVars.uploadProgress[upload.fileKey]?.find(f => f.fileId === message.payload.fileId);
                        if (fileEntry) {
                            fileEntry.progress = 100;
                            fileEntry.status = "completed";
                            fileEntry.path = message.payload.filePath; // Add the final path
                        }
                    }
                }
                break;
            }
            
            case "batch_upload_complete": {
                const batch = window.__pendingBatches?.[message.payload.batchId];
                if (batch) {
                    console.log("🎉 Batch complete");
                    batch.resolve();
                    delete window.__pendingBatches[message.payload.batchId];
                }
                break;
            }

            case "chunk_received": {
                const upload = window.__pendingFileUploads?.[message.payload.fileId];
                if (upload && typeof upload.sendNextChunk === "function") {
                    console.log(`🟢 Ack for chunk ${message.payload.chunkId}, sending next...`);
                    upload.sendNextChunk();
                }
                break;
            }
            
            // ========================
            // PATCHES
            // ========================
            case 'patches': {
                const patches = Array.isArray(message.data) ? message.data : [message.data];
                if (window.PatchManager && window.PatchManager.enqueueBatch) {
                    window.PatchManager.enqueueBatch(patches);
                } else if (window.__patchHelpers && window.__patchHelpers.PatchManager && window.__patchHelpers.PatchManager.enqueueBatch) {
                    window.__patchHelpers.PatchManager.enqueueBatch(patches);
                }
                break;
            }
            
            // ========================
            // COMPONENT KEY
            // ========================
            case "set-component-key": {
                window.__DEFAULT_COMPONENT_KEY__ = message.key;
                console.debug("Component key set to", window.__DEFAULT_COMPONENT_KEY__);
                break;
            }
            
            // ========================
            // STATE MANAGEMENT
            // ========================
            case 'set-state':
                console.log("Set state message received:", message);
                // Use patchHelpers version if available
                if (window.__patchHelpers && window.__patchHelpers.applyInitialState) {
                    window.__patchHelpers.applyInitialState(
                        message.payload?.state || {},
                        message.payload?.client_state || {},
                        window.isdebug
                    );
                } else if (window.applyInitialState) {
                    window.applyInitialState(
                        message.payload?.state || {},
                        message.payload?.client_state || {}
                    );
                }
                break;
                
            case 'update-var':
                if (window.__updateReactiveVar__) {
                    window.__updateReactiveVar__(message.varName, message.value);
                } else if (window.__patchHelpers && window.__patchHelpers.updateReactiveVar) {
                    window.__patchHelpers.updateReactiveVar(message.varName, message.value);
                }
                break;
                
            // ========================
            // EXECUTION
            // ========================
            case 'execute-js':
                try {
                    new Function(message.data)();
                } catch (e) {
                    console.error("Error executing JS:", e);
                }
                break;
                
            // ========================
            // PING/PONG
            // ========================
            case 'pong':
                console.debug("🟢 Pong received:", message.payload?.time);
                break;
                
            case 'subscribed_to_patches':
                console.debug("🔔 Subscribed with filters:", message.payload?.filters, message);
                break;
                
            case 'ping':
                console.debug("📡 Ping received from server");
                if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                    window.ws.send(JSON.stringify({
                        topic: '__default__',
                        event: 'pong',
                        type: 'pong',
                        payload: { time: Date.now() }
                    }));
                }
                break;
                
            // ========================
            // RELOAD
            // ========================
            case 'reload':
                console.log("🔄 Reload requested by server");
                if (window.__patchHelpers && window.__patchHelpers.showHotReloadOverlay) {
                    window.__patchHelpers.showHotReloadOverlay(
                        'Page is reloading...',
                        'info',
                        3000,
                        false,
                        JSON.stringify(message.files, null, 2)
                    );
                } else if (window.showHotReloadOverlay) {
                    window.showHotReloadOverlay(
                        'Page is reloading...',
                        'info',
                        3000,
                        false,
                        JSON.stringify(message.files, null, 2)
                    );
                }
                setTimeout(() => {
                    location.reload();
                }, 100);
                break;
                
            // ========================
            // DAWN ERROR
            // ========================
            case 'dawn_error':
                console.error("❌ Server error:", message.payload?.reason || message.payload);
                if (window.__patchHelpers && window.__patchHelpers.showHotReloadOverlay) {
                    window.__patchHelpers.showHotReloadOverlay(
                        `Server Error: ${message.payload?.reason || 'Unknown error'}`,
                        'error',
                        5000,
                        true,
                        JSON.stringify(message.payload, null, 2)
                    );
                } else if (window.showHotReloadOverlay) {
                    window.showHotReloadOverlay(
                        `Server Error: ${message.payload?.reason || 'Unknown error'}`,
                        'error',
                        5000,
                        true,
                        JSON.stringify(message.payload, null, 2)
                    );
                }
                break;
                
            default:
                console.warn("⚠️ Unknown message type:", message.type, message);
        }
    } catch (e) {
        console.error("WebSocket message error:", e, event.data);
    }
};

    window.ws.onclose = () => {
        console.warn("⚠️ WebSocket closed. Reconnecting...");
        window.subscribed = false;
        setTimeout(() => {
            window.__patchHelpers.connectWebSocket(WS_URL, userId);
        }, 2000);
    };

    window.ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        if (window.ws) {
            window.ws.close();
        }
    };
};

// --- Debug State Display ---
window.__patchHelpers.showDebugState = function () {
    const instance = window.__reactiveComponentInstance__;
    if (!instance || !instance.state) return console.warn("No state available yet.");
    const debugEl = document.querySelector("#__debug_state__");
    if (!debugEl) return console.warn("Debug panel not found.");
    const stateDump = {
        shared: instance.state.__shared || {},
        client: instance.state.__client || {}
    };
    debugEl.textContent = JSON.stringify(stateDump, null, 2);
};

// --- Modal Dragging Setup ---
window.__patchHelpers.setupModalDragging = function (modalId) {
    const modalElement = document.querySelector(`[data-modal-id="${modalId}"]`);
    const modalContainer = document.querySelector(`#modal-container-${modalId}`);

    console.log("Dragging setup for", modalId, modalElement, modalContainer);

    if (!modalElement || !modalContainer) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    const dragHandle = modalElement.querySelector('.modal-header') || modalElement;
    dragHandle.style.cursor = 'move';

    function startDrag(e) {
        if (e.button !== 0) return;
        console.log("Drag start", modalId);

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = modalContainer.getBoundingClientRect();
        initialLeft = parseInt(modalContainer.style.left, 10);
        initialTop = parseInt(modalContainer.style.top, 10);
        if (isNaN(initialLeft)) initialLeft = rect.left;
        if (isNaN(initialTop)) initialTop = rect.top;

        if (window.__clientOp__) {
            window.__clientOp__({
                _handler: true,
                fn: 'sendPatch',
                args: [
                    modalContainer.getAttribute('data-parent-key'),
                    modalContainer.getAttribute('data-component-key') || '',
                    'bringToFront',
                    { modalId }
                ]
            });
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;
        modalContainer.style.left = initialLeft + (e.clientX - startX) + 'px';
        modalContainer.style.top = initialTop + (e.clientY - startY) + 'px';
    }

    function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        console.log("Drag stop", modalId);

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);

        const rect = modalContainer.getBoundingClientRect();
        if (window.__clientOp__) {
            window.__clientOp__({
                _handler: true,
                fn: 'sendPatch',
                args: [
                    modalContainer.getAttribute('data-parent-key'),
                    modalContainer.getAttribute('data-component-key') || '',
                    'updateModalPosition',
                    { modalId, top: rect.top, left: rect.left }
                ]
            });
        }
    }

    dragHandle.addEventListener('mousedown', startDrag);
};

// Initialize the patch system
console.debug("✅ Patch helpers initialized successfully");