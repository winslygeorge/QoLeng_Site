// patchClientHelper.js
// ✅ Helper functions for patchClient.js

// Create namespace for all helper functions
window.__patchHelpers = {};
window.__patchHandlers = {};

// --- Overlay Container with "Clear All" ---
window.__patchHelpers.getOverlayContainer = function() {
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

        // --- Add "Clear All" bar ---
        const clearBar = document.createElement("div");
        clearBar.id = "__dawn_hmr_clear__";
        clearBar.style.display = "none"; // hidden until overlays exist
        clearBar.style.justifyContent = "flex-end";
        clearBar.style.alignItems = "center";
        clearBar.style.padding = "4px 8px";
        clearBar.style.fontSize = "12px";
        clearBar.style.color = "#fff";
        clearBar.style.background = "rgba(50,50,50,0.8)";
        clearBar.style.borderRadius = "4px";
        clearBar.style.cursor = "pointer";
        clearBar.style.fontFamily = "sans-serif";
        clearBar.textContent = "Clear All ✕";

        clearBar.addEventListener("click", () => {
            const toasts = container.querySelectorAll(".__dawn_toast__");
            toasts.forEach(t => t.remove());
            clearBar.style.display = "none";
        });

        container.appendChild(clearBar);
    }
    return container;
};

// --- Main Overlay Function ---
window.__patchHelpers.showHotReloadOverlay = function (message, type = "info", duration = 3000, persist = false, details = null) {
    if (persist) {
        sessionStorage.setItem("__DAWN_LAST_RELOAD__", JSON.stringify({
            message,
            type,
            details,
            time: Date.now()
        }));
    }

    const container = window.__patchHelpers.getOverlayContainer();
    const clearBar = container.querySelector("#__dawn_hmr_clear__");

    // --- Limit overlays to 5 ---
    const MAX_OVERLAYS = 5;
    const toasts = container.querySelectorAll(".__dawn_toast__");
    if (toasts.length >= MAX_OVERLAYS) {
        toasts[0].remove(); // remove oldest
    }

    let overlay = document.createElement("div");
    overlay.className = "__dawn_toast__"; // mark as toast
    overlay.style.background = "rgba(0,0,0,0.7)";
    overlay.style.color = "white";
    overlay.style.padding = "8px 12px";
    overlay.style.fontSize = "14px";
    overlay.style.borderRadius = "6px";
    overlay.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    overlay.style.cursor = details ? "pointer" : "default";
    overlay.style.whiteSpace = "pre-line";
    overlay.style.maxWidth = "300px";
    overlay.style.position = "relative";
    overlay.style.transition = "all 0.4s ease";
    overlay.style.opacity = "0";
    overlay.style.transform = "translateX(100%)";

    // 🎨 Color by type
    switch (type) {
        case "success": overlay.style.background = "rgba(0,200,0,0.9)"; break;
        case "warn": overlay.style.background = "rgba(255,165,0,0.9)"; overlay.style.color = "black"; break;
        case "error": overlay.style.background = "rgba(200,0,0,0.9)"; break;
    }

    // --- Close button (×) ---
    let closeBtn = document.createElement("span");
    closeBtn.textContent = "×";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "4px";
    closeBtn.style.right = "8px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontWeight = "bold";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.color = overlay.style.color === "black" ? "#333" : "#fff";
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        overlay.remove();
        if (container.querySelectorAll(".__dawn_toast__").length === 0) {
            clearBar.style.display = "none";
        }
    });
    overlay.appendChild(closeBtn);

    // --- Summary ---
    let summaryEl = document.createElement("div");
    summaryEl.textContent = message;
    overlay.appendChild(summaryEl);

    // --- Expandable details ---
    if (details) {
        let detailsEl = document.createElement("div");
        detailsEl.style.marginTop = "6px";
        detailsEl.style.fontSize = "12px";
        detailsEl.style.display = "none";
        detailsEl.textContent = details;
        overlay.appendChild(detailsEl);

        overlay.addEventListener("click", (event) => {
            if (event.target !== closeBtn) {
                detailsEl.style.display = detailsEl.style.display === "block" ? "none" : "block";
            }
        });
    }

    // Insert after the Clear All bar
    container.appendChild(overlay);
    clearBar.style.display = "flex";

    // --- Staggered slide-in ---
    const index = container.querySelectorAll(".__dawn_toast__").length - 1;
    const staggerDelay = index * 100;

    setTimeout(() => {
        overlay.style.opacity = "1";
        overlay.style.transform = "translateX(0)";
    }, staggerDelay);

    // --- Auto fade/slide out ---
    setTimeout(() => {
        if (!document.body.contains(overlay)) return;
        overlay.style.opacity = "0";
        overlay.style.transform = "translateX(100%)";
        setTimeout(() => {
            overlay.remove();
            if (container.querySelectorAll(".__dawn_toast__").length === 0) {
                clearBar.style.display = "none";
            }
        }, 400);
    }, duration + staggerDelay);
};

// --- Upload Status Helper ---
window.__patchHelpers.getUploadStatus = function (inputName, onUpdate, interval = 500) {
    if (typeof onUpdate !== 'function') {
        console.error("❌ onUpdate callback is required.");
        return;
    }

    let isMonitoring = true;
    const monitorInterval = setInterval(() => {
        if (!isMonitoring) {
            clearInterval(monitorInterval);
            return;
        }

        const files = window._clientVars?.uploadProgress?.[inputName];
        if (!files) {
            // No files found for this input, but continue monitoring in case an upload starts later
            onUpdate({
                files: [],
                aggregate: { progress: 0, status: "idle" }
            });
            return;
        }

        let totalProgress = 0;
        let isUploading = false;
        let hasFailed = false;

        const fileStatuses = files.map(file => {
            if (file.status === "uploading") {
                isUploading = true;
            }
            if (file.status === "failed") {
                hasFailed = true;
            }
            totalProgress += file.progress;
            return {
                fileName: file.fileName,
                progress: file.progress,
                status: file.status
            };
        });

        const aggregateProgress = files.length > 0 ? Math.round(totalProgress / files.length) : 0;
        let aggregateStatus = "completed";
        if (hasFailed) {
            aggregateStatus = "failed";
        } else if (isUploading) {
            aggregateStatus = "uploading";
        }

        const statusData = {
            files: fileStatuses,
            aggregate: {
                progress: aggregateProgress,
                status: aggregateStatus
            }
        };

        onUpdate(statusData);

        // Check if monitoring should stop
        if (aggregateStatus === "completed" || aggregateStatus === "failed") {
            isMonitoring = false;
            clearInterval(monitorInterval);
        }

    }, interval);

    // Return a stop function to allow the developer to clean up
    return {
        stop: () => {
            isMonitoring = false;
            clearInterval(monitorInterval);
        }
    };
};

// --- Debounce & Throttle Utilities ---
window.__patchHelpers.debounce = function (func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
};

window.__patchHelpers.throttle = function (func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Helper for creating VDOM nodes
window.__patchHelpers.h = function (tag, attrs, children) {
    const node = { tag, attrs: attrs || {} };
    if (typeof children === 'string' || typeof children === 'number') {
        node.content = String(children);
    } else if (Array.isArray(children)) {
        node.children = children;
    }
    return node;
};

// --- VDOM to HTML Renderer ---
window.__patchHelpers.renderToString = function (vnode) {
    if (typeof vnode === 'string' || typeof vnode === 'number') {
        return String(vnode);
    }

    if (!vnode || !vnode.tag) return '';

    const { tag, attrs = {}, children = [], content } = vnode;

    // Handle text content
    if (content !== undefined) {
        return content;
    }

    // Build attributes string
    const attrsStr = Object.entries(attrs)
        .map(([key, value]) => {
            if (value === null || value === undefined) return '';
            return ` ${key}="${String(value).replace(/"/g, '&quot;')}"`;
        })
        .filter(attr => attr !== '')
        .join('');

    // Handle self-closing tags
    const selfClosingTags = ['input', 'img', 'br', 'hr', 'meta', 'link'];
    if (selfClosingTags.includes(tag.toLowerCase())) {
        return `<${tag}${attrsStr} />`;
    }

    // Render children
    const childrenStr = children
        .map(child => window.__patchHelpers.renderToString(child))
        .join('');

    return `<${tag}${attrsStr}>${childrenStr}</${tag}>`;
};

// --- Reactive Variable Updates ---
window.__patchHelpers.isEmptyValue = function (value) {
    if (value == null) return true; // null or undefined
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

// --- Helper function to get nested value from an object ---
window.__patchHelpers.getNestedValue = function (obj, path) {
    if (!obj || !path) return undefined;
    
    // Handle paths with "cs." prefix
    if (path.startsWith("cs.")) {
        path = path.substring(3); // Remove "cs." prefix
    }
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    
    return current;
};

// --- Enhanced applyDataBindings for deep nested properties ---
window.__patchHelpers.applyDataBindings = function (element, data) {
    // Handle regular data-bind attributes including deep nested paths
    const bindElements = element.querySelectorAll('[data-bind]');
    
    bindElements.forEach(bindEl => {
        const bindPath = bindEl.getAttribute('data-bind');
        if (!bindPath) return;
        
        const value = window.__patchHelpers.getNestedValue(data, bindPath);
        
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(bindEl.tagName)) {
            bindEl.value = value != null ? String(value) : "";
        } else {
            bindEl.textContent = value != null ? String(value) : "";
        }
    });

    // Handle conditional classes
    element.querySelectorAll('[data-bind-class-hidden]').forEach(el => {
        const conditionKey = el.getAttribute('data-bind-class-hidden');
        if (conditionKey === "editing") {
            // Show element when NOT editing, hide when editing
            el.style.display = data.editing ? 'none' : '';
        } else if (conditionKey === "not-editing") {
            // Show element when editing, hide when NOT editing
            el.style.display = data.editing ? '' : 'none';
        }
    });

    // Handle data-bind-action attributes for interactive elements
    if (data.editing !== undefined) {
        element.querySelectorAll('[data-bind-action-edit]').forEach(el => {
            el.style.display = data.editing ? 'none' : '';
        });
        element.querySelectorAll('[data-bind-action-save]').forEach(el => {
            el.style.display = data.editing ? '' : 'none';
        });
        element.querySelectorAll('[data-bind-action-cancel]').forEach(el => {
            el.style.display = data.editing ? '' : 'none';
        });
    }

    // Handle data-bind-classes for dynamic classes
    element.querySelectorAll('[data-bind="data-bind-classes"]').forEach(el => {
        if (data.editing) {
            el.classList.add('border-blue-300', 'bg-blue-50');
        } else {
            el.classList.remove('border-blue-300', 'bg-blue-50');
        }
    });
};

// --- Enhanced renderTemplate for conditional classes and deep bindings ---
window.__patchHelpers.renderTemplateWithConditionals = function (template, data) {
    let html = template;

    // Replace template variables (simple ones)
    for (const key in data) {
        if (typeof data[key] !== 'object' || data[key] === null) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, data[key] != null ? String(data[key]) : "");
        }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const element = doc.body.firstChild;

    if (!element) return null;

    // Apply data bindings including conditional classes and deep nested properties
    window.__patchHelpers.applyDataBindings(element, data);

    return element;
};

// Helper function to get unique key for an item
window.__patchHelpers.getItemKey = function (item) {
    return String(item.key || item.id || item._id || Math.random().toString(36).substr(2, 9));
};

// Helper function to ensure list items are in correct order
window.__patchHelpers.ensureListOrder = function (container, items) {
    if (!Array.isArray(items)) return;
    
    const children = Array.from(container.children);
    const childMap = new Map();
    
    children.forEach(child => {
        const key = child.getAttribute('data-key');
        if (key) childMap.set(key, child);
    });
    
    // Reorder based on items array
    items.forEach((item, index) => {
        const key = window.__patchHelpers.getItemKey(item);
        const child = childMap.get(key);
        if (child && container.children[index] !== child) {
            container.insertBefore(child, container.children[index] || null);
        }
    });
};

// Update the main reactive variable handler
window.__patchHelpers.updateReactiveVar = function (varName, value) {
    // Skip rendering if value exists but is empty
    console.log("Updating reactive variable:", varName, "with value:", value);
    if (window.__patchHelpers.isEmptyValue(value)) {
        const elements = document.querySelectorAll(`[data-bind="${varName}"]`);
        elements.forEach(el => el.innerHTML = '');
        return;
    }

    console.log("varName : ", varName, value);

    // Handle client state prefix (cs:)
    const isClientState = varName.startsWith('cs.');
    const cleanVarName = varName;
    
    // Get all elements with this data-bind attribute
    console.log(`Looking for elements with data-bind="${cleanVarName}"`);
    const elements = document.querySelectorAll(`[data-bind="${cleanVarName}"]`);

    // Also check for elements with component prefix
    // const allElements = document.querySelectorAll(`[data-bind$="${cleanVarName}"]`);

    const allTargets = Array.from(elements);

    console.log(`Found ${allTargets} elements bound to variable: ${cleanVarName}`);

    allTargets.forEach(el => {
        console.log("Updating element:", el, "with value:", value);
        if (Array.isArray(value)) {
            const templateId = el.getAttribute('data-template-id') || el.getAttribute('data-template');
            if (!templateId) {
                console.warn(`No template ID found for list variable: ${cleanVarName}`);
                return;
            }
            console.log(`Rendering list for variable: ${cleanVarName} with template: ${templateId}`, value);
            window.__patchHandlers.list(el, {
                type: "list",
                items: value,
                template: templateId
            });
            return;
        }

        if (value && typeof value === 'object') {
            const templateId = el.getAttribute('data-template-id') || el.getAttribute('data-template');
            if (!templateId) {
                console.warn(`No template ID found for object variable: ${cleanVarName}`);
                return;
            }
            window.__patchHandlers.object(el, {
                type: "object",
                object: value,
                template: templateId
            });
            return;
        }

        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            el.value = value != null ? String(value) : "";
        } else {
            el.textContent = value != null ? String(value) : "";
        }
    });
    
    // Update reactive component instance state
    const instance = window.__reactiveComponentInstance__;
    if (instance && instance.state) {
        if (isClientState) {
            const clientVarName = varName;
            if (!instance.state.__client) instance.state.__client = {};
            instance.state.__client[clientVarName] = value;
        } else {
            if (!instance.state.__shared) instance.state.__shared = {};
            instance.state.__shared[cleanVarName] = value;
        }
    }
};

// --- Debounced Input Handling ---
window.__patchHelpers.initializeReactiveInputs = function () {
    if (window.__reactiveInputsInitialized__) return;
    window.__reactiveInputsInitialized__ = true;

    // Debounced input handler (300ms delay)
    const debouncedInputHandler = window.__debounce(function (event) {
        const target = event.target;
        const bindName = target.getAttribute('data-bind');
        if (bindName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            const key = window.__DEFAULT_COMPONENT_KEY__ || 'counterApp';
            if (window.sendPatch) {
                // window.sendPatch(key, 'setFormField', [bindName, target.value]);
            } else {
                console.warn("window.sendPatch not defined.");
            }
        }
    }, 300);

    // Throttled scroll/resize handlers (100ms interval)
    const throttledScrollHandler = window.__throttle(function (event) {
        // Handle scroll events if needed
        if (window.__onScrollHandlers && window.__onScrollHandlers.length > 0) {
            window.__onScrollHandlers.forEach(handler => handler(event));
        }
    }, 100);

    const throttledResizeHandler = window.__throttle(function (event) {
        // Handle resize events if needed
        if (window.__onResizeHandlers && window.__onResizeHandlers.length > 0) {
            window.__onResizeHandlers.forEach(handler => handler(event));
        }
    }, 100);

    document.body.addEventListener('input', debouncedInputHandler);
    window.addEventListener('scroll', throttledScrollHandler);
    window.addEventListener('resize', throttledResizeHandler);
};

// --- Template Store & Renderer ---
window.__patchHelpers.TemplateStore = {
    cache: {},
    get(templateIdOrHTML) {
        if (!templateIdOrHTML) return null;

        // If it's already HTML, return it
        if (typeof templateIdOrHTML === "string" && templateIdOrHTML.trim().startsWith("<")) {
            return templateIdOrHTML;
        }

        // Check cache
        if (this.cache[templateIdOrHTML]) {
            return this.cache[templateIdOrHTML];
        }

        // Try to find template in DOM
        const templateEl = document.querySelector(`template[data-template-id="${templateIdOrHTML}"]`);
        if (templateEl) {
            const template = templateEl.innerHTML;
            this.cache[templateIdOrHTML] = template;
            return template;
        }

        // Also check for template elements that might be nested
        const allTemplates = document.querySelectorAll('template');
        for (const tpl of allTemplates) {
            if (tpl.getAttribute('data-template-id') === templateIdOrHTML) {
                const template = tpl.innerHTML;
                this.cache[templateIdOrHTML] = template;
                return template;
            }
        }

        console.warn(`Template not found: ${templateIdOrHTML}`);
        return null;
    }
};

window.__patchHelpers.renderTemplate = function (template, data) {
    if (!template || !data) {
        console.warn("renderTemplate called with missing template or data");
        return null;
    }
    
    // Ensure data has required fields
    if (!data.id && !data.title) {
        console.warn("Item missing required fields:", data);
    }
    
    const rendered = window.__patchHelpers.renderTemplateWithConditionals(template, data);
    
    // Validate the rendered element
    if (rendered && rendered instanceof Element) {
        // Check if the element has any content
        const hasContent = rendered.textContent.trim().length > 0;
        if (!hasContent) {
            console.warn("Rendered element is empty:", rendered);
            return null;
        }
        return rendered;
    }
    
    return null;
};

// === CRUD Operation Handlers ===
window.__patchHelpers.handleCrudList = function (patch, target) {
    if (!patch.operation) {
        console.warn("CRUD list patch missing operation:", patch);
        return;
    }
    
    const varName = patch.varName || patch.bindingPath;
    const templateId = patch.template;
    
    console.debug(`Handling CRUD list operation: ${patch.operation} for ${varName}`, patch);
    
    // Update state WITHOUT triggering render
    const instance = window.__reactiveComponentInstance__;
    if (instance && instance.state) {
        if (varName.startsWith('cs.')) {
            if (!instance.state.__client) instance.state.__client = {};
            instance.state.__client[varName] = patch.value;
        } else {
            if (!instance.state.__shared) instance.state.__shared = {};
            instance.state.__shared[varName] = patch.value;
        }
    }
    
    // Handle the DOM update based on operation
    if (templateId) {
        switch (patch.operation) {
            case "append":
            case "push":
                // ONLY append the new items, don't use the full value
                if (patch.items && Array.isArray(patch.items)) {
                    window.__patchHelpers.handleAppendOperation({
                        ...patch,
                        items: patch.items,
                        value: undefined  // Don't pass full value to avoid second render
                    }, target, templateId);
                }
                break;
                
            case "set":
            case "create":
                // For set/create, use the full list
                print("Setting full list for variable:", varName, "with items:", patch.items || patch.value);
                window.__patchHandlers.list(target, {
                    type: "list",
                    items: patch.items || patch.value || [],
                    template: templateId
                });
                break;
                
            default:
                // For other operations, use the full value
                if (patch.value) {
                    window.__patchHandlers.list(target, {
                        type: "list",
                        items: patch.value,
                        template: templateId
                    });
                }
        }
    }
};

window.__patchHelpers.handleAppendOperation = function (patch, target, templateId) {
    const items = patch.items || [];
    
    if (!Array.isArray(items) || items.length === 0) {
        console.debug("No items to append");
        return;
    }
    
    const template = window.__patchHelpers.TemplateStore.get(templateId);
    if (!template) {
        console.warn(`Template not found: ${templateId}`);
        return;
    }
    
    const animationClasses = ["transition", "duration-300", "opacity-0"];
    const staggerDelay = 50;
    
    items.forEach((item, index) => {
        const key = window.__patchHelpers.getItemKey(item);
        
        // Check if item already exists (shouldn't for append)
        const existingEl = target.querySelector(`[data-key="${key}"]`);
        
        if (!existingEl) {
            const renderedItem = window.__patchHelpers.renderTemplate(template, item);
            if (renderedItem && renderedItem instanceof Element) {
                renderedItem.setAttribute('data-key', key);
                renderedItem.classList.add(...animationClasses);
                target.appendChild(renderedItem);
                
                setTimeout(() => {
                    renderedItem.classList.remove(...animationClasses);
                }, staggerDelay * index);
            }
        }
    });
    
    // REMOVED ensureListOrder - it causes duplicates!
};

window.__patchHelpers.handlePrependOperation = function (patch, target, templateId) {
    const items = patch.items || [];
    const value = patch.value || [];
    
    if (!Array.isArray(items) || items.length === 0) {
        console.debug("No items to prepend");
        return;
    }
    
    const template = window.__patchHelpers.TemplateStore.get(templateId);
    if (!template) {
        console.warn(`Template not found: ${templateId}`);
        return;
    }
    
    const animationClasses = ["transition", "duration-300", "opacity-0"];
    const staggerDelay = 50;
    
    // Reverse items for prepend (insert at beginning in order)
    [...items].reverse().forEach((item, index) => {
        const key = window.__patchHelpers.getItemKey(item);
        const existingEl = target.querySelector(`[data-key="${key}"]`);
        
        if (!existingEl) {
            const renderedItem = window.__patchHelpers.renderTemplate(template, item);
            if (renderedItem) {
                renderedItem.setAttribute('data-key', key);
                renderedItem.classList.add(...animationClasses);
                target.insertBefore(renderedItem, target.firstChild);
                
                setTimeout(() => {
                    renderedItem.classList.remove(...animationClasses);
                }, staggerDelay * index);
            }
        } else {
            window.__patchHelpers.applyDataBindings(existingEl, item);
            // Move to beginning if needed
            if (target.firstChild !== existingEl) {
                target.insertBefore(existingEl, target.firstChild);
            }
        }
    });
    
    window.__patchHelpers.ensureListOrder(target, value || []);
};

window.__patchHelpers.handleInsertOperation = function (patch, target, templateId) {
    const items = patch.items || [];
    const index = patch.index || 0;
    
    if (!Array.isArray(items) || items.length === 0) {
        console.debug("No items to insert");
        return;
    }
    
    const template = window.__patchHelpers.TemplateStore.get(templateId);
    if (!template) {
        console.warn(`Template not found: ${templateId}`);
        return;
    }
    
    const animationClasses = ["transition", "duration-300", "opacity-0"];
    const staggerDelay = 50;
    
    // Find the reference element at insertion point
    const referenceEl = target.children[index] || null;
    
    items.forEach((item, itemIndex) => {
        const key = window.__patchHelpers.getItemKey(item);
        const existingEl = target.querySelector(`[data-key="${key}"]`);
        
        if (!existingEl) {
            const renderedItem = window.__patchHelpers.renderTemplate(template, item);
            if (renderedItem) {
                renderedItem.setAttribute('data-key', key);
                renderedItem.classList.add(...animationClasses);
                
                // Insert at correct position
                if (referenceEl) {
                    const insertIndex = index + itemIndex;
                    const nextEl = target.children[insertIndex] || null;
                    target.insertBefore(renderedItem, nextEl);
                } else {
                    target.appendChild(renderedItem);
                }
                
                setTimeout(() => {
                    renderedItem.classList.remove(...animationClasses);
                }, staggerDelay * itemIndex);
            }
        } else {
            window.__patchHelpers.applyDataBindings(existingEl, item);
        }
    });
};

window.__patchHelpers.handleUpdateOperation = function (patch, target, templateId) {
    const value = patch.value || [];
    
    if (!Array.isArray(value)) {
        console.debug("Update operation requires array value");
        return;
    }
    
    // Use existing list handler for full update
    window.__patchHandlers.list(target, {
        type: "list",
        items: value,
        template: templateId
    });
};

window.__patchHelpers.handleDeleteOperation = function (patch, target, templateId) {
    const value = patch.value || [];
    const operation = patch.operation;
    
    switch (operation) {
        case "delete":
        case "remove":
            if (patch.key) {
                // Remove by key
                const key = patch.key;
                const elToRemove = target.querySelector(`[data-key="${key}"]`);
                if (elToRemove) {
                    elToRemove.remove();
                }
            } else if (patch.index !== undefined) {
                // Remove by index
                const children = Array.from(target.children);
                if (children[patch.index]) {
                    children[patch.index].remove();
                }
            } else if (patch.matchValue) {
                // Remove by matching value
                const children = Array.from(target.children);
                children.forEach(child => {
                    const key = child.getAttribute('data-key');
                    if (key === String(patch.matchValue)) {
                        child.remove();
                    }
                });
            } else {
                // Full list update with remaining items
                window.__patchHandlers.list(target, {
                    type: "list",
                    items: value,
                    template: templateId
                });
            }
            break;
            
        case "pop":
            // Remove last child
            if (target.lastChild) {
                target.lastChild.remove();
            }
            break;
            
        case "shift":
            // Remove first child
            if (target.firstChild) {
                target.firstChild.remove();
            }
            break;
            
        case "splice":
            // Complex splice operation
            const start = patch.index || 0;
            const count = patch.count || 0;
            const children = Array.from(target.children);
            
            // Remove items
            for (let i = 0; i < count && children[start + i]; i++) {
                if (children[start + i]) {
                    children[start + i].remove();
                }
            }
            
            // If we have new items to insert
            if (patch.items && Array.isArray(patch.items) && patch.items.length > 0) {
                window.__patchHelpers.handleInsertOperation(patch, target, templateId);
            }
            break;
    }
};

window.__patchHelpers.handleCrudObject = function (patch, target) {
    const varName = patch.varName || patch.bindingPath;
    const templateId = patch.template;
    
    // Update reactive state
    if (patch.value !== undefined) {
        window.__updateReactiveVar__(varName, patch.value);
    }
    
    // Update DOM if template is provided
    if (templateId && patch.object !== undefined) {
        window.__patchHandlers.object(target, {
            type: "object",
            object: patch.object || patch.value,
            template: templateId
        });
    }
};

window.__patchHelpers.handleCrudNested = function (patch, target) {
    const varName = patch.varName || patch.bindingPath;
    const value = patch.value;
    
    // Update reactive state
    window.__updateReactiveVar__(varName, value);
    
    // Also update DOM directly if target is found
    if (target) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            target.value = value != null ? String(value) : "";
        } else {
            target.textContent = value != null ? String(value) : "";
        }
    }
};

// === LIST PATCH ===
window.__patchHelpers.handleListPatch = function (target, patch) {
    if (window.__patchHelpers.isEmptyValue(patch.items)) {
        target.innerHTML = '';
        return;
    }

    const newItems = patch.items || [];
    const template = window.__patchHelpers.TemplateStore.get(patch.template);

    console.debug("Applying list patch:", patch, "Template found:", !!template);

    if (!template) {
        console.warn("List template not found or invalid.");
        return;
    }

    const animationClasses = patch.classes || ["transition", "duration-300", "opacity-0"];
    const staggerDelay = patch.staggerDelay || 0;

    // STEP 1: COMPLETELY CLEAR AND REBUILD if there are duplicate keys
    // This is the safest approach when duplicates are detected
    const keySet = new Set();
    let hasDuplicates = false;
    
    Array.from(target.children).forEach(el => {
        const key = el.getAttribute("data-key");
        if (key) {
            if (keySet.has(key)) {
                hasDuplicates = true;
            }
            keySet.add(key);
        }
    });

    // If duplicates exist, just clear and rebuild completely
    if (hasDuplicates) {
        console.debug("⚠️ Duplicate keys detected, clearing and rebuilding");
        target.innerHTML = '';
        
        newItems.forEach((item, index) => {
            const keyStr = window.__patchHelpers.getItemKey(item);
            const renderedItem = window.__patchHelpers.renderTemplate(template, item);
            
            if (renderedItem && renderedItem instanceof Element) {
                renderedItem.setAttribute('data-key', keyStr);
                renderedItem.classList.add(...animationClasses);
                target.appendChild(renderedItem);
                
                setTimeout(() => {
                    renderedItem.classList.remove(...animationClasses);
                }, staggerDelay * index);
            }
        });
        
        return;
    }

    // STEP 2: If no duplicates, proceed with normal update
    // Build map of existing elements
    const existingItemsMap = new Map();
    Array.from(target.children).forEach(el => {
        const key = el.getAttribute("data-key");
        if (key) {
            existingItemsMap.set(key, el);
        }
    });

    const usedKeys = new Set();

    // Process each new item
    newItems.forEach((item, index) => {
        const keyStr = window.__patchHelpers.getItemKey(item);
        usedKeys.add(keyStr);

        const existingEl = existingItemsMap.get(keyStr);

        if (existingEl) {
            // Update existing element
            window.__patchHelpers.applyDataBindings(existingEl, item);

            // Move to correct position
            if (target.children[index] !== existingEl) {
                console.debug(`🔄 Moving element with key ${keyStr} to position ${index}`);
                target.insertBefore(existingEl, target.children[index] || null);
            }
        } else {
            // Create new element
            const renderedItem = window.__patchHelpers.renderTemplate(template, item);
            if (renderedItem && renderedItem instanceof Element) {
                renderedItem.setAttribute('data-key', keyStr);
                renderedItem.classList.add(...animationClasses);
                
                const referenceNode = target.children[index] || null;
                target.insertBefore(renderedItem, referenceNode);
                
                setTimeout(() => renderedItem.classList.remove(...animationClasses), staggerDelay * index);
                console.debug(`➕ Inserted new item with key ${keyStr}`);
            }
        }
    });

    // Remove items not in the new list
    Array.from(target.children).forEach(el => {
        const key = el.getAttribute("data-key");
        if (key && !usedKeys.has(key)) {
            console.debug(`🗑️ Removing item with key ${key}`);
            el.remove();
        }
    });

    // STEP 3: Final cleanup - remove any elements that are clearly empty/broken
    Array.from(target.children).forEach(el => {
        const titleEl = el.querySelector('[data-bind="title"]');
        const idEl = el.querySelector('[data-bind="id"]');
        
        // If element has no content, remove it
        if ((!titleEl || !titleEl.textContent.trim()) && 
            (!idEl || !idEl.textContent.trim()) &&
            el.textContent.trim() === '') {
            console.debug("🗑️ Removing empty element");
            el.remove();
        }
    });

    const domKeys = Array.from(target.children).map(el => el.getAttribute("data-key"));
    console.debug("🔍 DOM keys after patch:", domKeys, "| Patch keys:", Array.from(usedKeys));
};

// === OBJECT PATCH ===
window.__patchHelpers.handleObjectPatch = function (target, patch) {
    if (window.__patchHelpers.isEmptyValue(patch.object)) {
        target.innerHTML = '';
        return;
    }

    const template = window.__patchHelpers.TemplateStore.get(patch.template) || patch.template;
    if (!template) {
        console.warn("Object template not found or invalid.");
        return;
    }

    const renderedObject = window.__patchHelpers.renderTemplate(template, patch.object);
    if (renderedObject) {
        target.innerHTML = '';
        target.appendChild(renderedObject);
    }
};

// === NESTED PATCH ===
window.__patchHelpers.handleNestedPatch = function (target, patch) {
    const path = patch.path;
    const value = patch.value;

    let nestedEl;

    if (patch.selector === ":scope") {
        // For ":scope", look for the element with data-bind attribute
        nestedEl = document.querySelector(`[data-bind="${path}"]`);
    } else {
        // Check if the selector itself already matches the data-bind we're looking for
        if (patch.selector.includes(`[data-bind="${path}"]`)) {
            // If the selector already includes the data-bind attribute, use it directly
            nestedEl = document.querySelector(patch.selector);
        } else {
            // Otherwise, look for the data-bind element within the selector
            const nestedSelector = `${patch.selector} [data-bind="${path}"]`;
            nestedEl = document.querySelector(nestedSelector);
        }
    }

    if (nestedEl) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(nestedEl.tagName)) {
            nestedEl.value = value;
        } else {
            nestedEl.textContent = value;
        }
    } else {
        console.warn(`Nested element not found for path: ${path} with selector: ${patch.selector}`);
        // Try a fallback: look for any element with this data-bind
        const fallbackEl = document.querySelector(`[data-bind="${path}"]`);
        if (fallbackEl) {
            console.debug(`Found fallback element for ${path}`);
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(fallbackEl.tagName)) {
                fallbackEl.value = value;
            } else {
                fallbackEl.textContent = value;
            }
        }
    }
};

// === CRUD PATCH ===
window.__patchHelpers.handleCrudPatch = function (target, patch) {
    console.debug("Applying CRUD patch:", patch.type, patch.operation, patch.displayType);
    
    // Handle based on displayType
    switch (patch.displayType) {
        case "list":
            window.__patchHelpers.handleCrudList(patch, target);
            break;
        case "object":
            window.__patchHelpers.handleCrudObject(patch, target);
            break;
        case "nested":
        case "update-var":
            window.__patchHelpers.handleCrudNested(patch, target);
            break;
        default:
            console.warn(`Unknown CRUD displayType: ${patch.displayType}`, patch);
    }
};

// --- Patch Manager ---
window.__patchHelpers.PatchManager = (() => {
    let queue = [];
    let scheduled = false;
    let lastFlushTime = 0;
    const FLUSH_THROTTLE_MS = 16; // ~60fps

    function flush() {
        const now = Date.now();
        if (now - lastFlushTime < FLUSH_THROTTLE_MS) {
            // Too soon to flush again, reschedule
            scheduled = false;
            scheduleFlush();
            return;
        }

        scheduled = false;
        lastFlushTime = now;

        document.body.classList.add("patching");
        const patchesToProcess = [...queue];
        queue = [];

        patchesToProcess.forEach(patch => {
            try {
                applyPatch(patch);
            } catch (err) {
                console.error("Failed to apply patch:", patch, err);
            }
        });

        requestAnimationFrame(() => {
            document.body.classList.remove("patching");
        });
    }

    function scheduleFlush() {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(flush);
        }
    }

    return {
        enqueueBatch(patches) {
            if (Array.isArray(patches)) {
                queue.push(...patches);
            } else if (patches) {
                queue.push(patches);
            }
            scheduleFlush();
        },
        flushNow: flush
    };
})();

