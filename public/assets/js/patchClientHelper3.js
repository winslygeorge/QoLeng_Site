// ========================
// COMPLETE PATCH HANDLERS
// ========================

// Add these patch handlers to your patchClientHelper2.js or patchClient.js

// --- Template Store (if missing) ---
window.TemplateStore = window.TemplateStore || {
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

// --- Render Template Function ---
window.renderTemplate = window.renderTemplate || function(template, data) {
    // Basic template rendering function
    if (typeof template === 'function') {
        return template(data);
    }
    
    if (typeof template === 'string') {
        // Simple variable substitution
        let result = template;
        if (data) {
            Object.keys(data).forEach(key => {
                const value = data[key];
                if (typeof value !== 'object') {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    result = result.replace(regex, String(value));
                }
            });
        }
        return result;
    }
    
    return template;
};

// --- Apply Data Bindings ---
window.applyDataBindings = window.applyDataBindings || function(element, data) {
    if (!element || !data) return;
    
    // Handle data-bind attributes
    const bindElements = element.querySelectorAll('[data-bind]');
    bindElements.forEach(bindEl => {
        const bindPath = bindEl.getAttribute('data-bind');
        if (!bindPath) return;
        
        // Simple path resolution
        const value = data[bindPath];
        
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(bindEl.tagName)) {
            bindEl.value = value != null ? String(value) : "";
        } else {
            bindEl.textContent = value != null ? String(value) : "";
        }
    });
};

// --- Empty Value Check ---
window.isEmptyValue = window.isEmptyValue || function(value) {
    if (value == null) return true; // null or undefined
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

// ========================
// CORE PATCH HANDLERS OBJECT
// ========================
window.patchHandlers = window.patchHandlers || {
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
            // Simple VDOM to HTML conversion
            newHTML = JSON.stringify(patch.new); // Simplified
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

    // === LIST PATCH ===
    "list": (target, patch) => {
        if (window.isEmptyValue(patch.items)) {
            target.innerHTML = '';
            return;
        }

        const newItems = patch.items || [];
        const template = window.TemplateStore.get(patch.template);

        console.debug("Applying list patch:", patch, "Template found:", !!template);

        if (!template) {
            console.warn("List template not found or invalid.");
            return;
        }

        const animationClasses = patch.classes || ["transition", "duration-300", "opacity-0"];
        const staggerDelay = patch.staggerDelay || 0;

        const existingItemsMap = new Map();
        Array.from(target.children).forEach(el => {
            const key = el.getAttribute("data-key");
            if (key) {
                existingItemsMap.set(key, el);
            }
        });

        const usedKeys = new Set();

        newItems.forEach((item, index) => {
            const keyStr = String(item.key || item.id || item._id || index);
            usedKeys.add(keyStr);

            const existingEl = existingItemsMap.get(keyStr);

            if (existingEl) {
                // Update existing element with new data
                window.applyDataBindings(existingEl, item);

                // Move to correct position if needed
                if (target.children[index] !== existingEl) {
                    console.debug(`🔄 Moving element with key ${keyStr} to position ${index}`);
                    target.insertBefore(existingEl, target.children[index] || null);
                }
            } else {
                // Create new element from template
                const renderedItem = window.renderTemplate(template, item);
                if (renderedItem) {
                    if (typeof renderedItem === 'string') {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = renderedItem;
                        const actualElement = tempDiv.firstElementChild;
                        if (actualElement) {
                            actualElement.setAttribute('data-key', keyStr);
                            actualElement.classList.add(...animationClasses);
                            target.insertBefore(actualElement, target.children[index] || null);
                            setTimeout(() => actualElement.classList.remove(...animationClasses), staggerDelay * index);
                        }
                    } else if (renderedElement instanceof Element) {
                        renderedElement.setAttribute('data-key', keyStr);
                        renderedElement.classList.add(...animationClasses);
                        target.insertBefore(renderedElement, target.children[index] || null);
                        setTimeout(() => renderedElement.classList.remove(...animationClasses), staggerDelay * index);
                    }
                }
            }
        });

        // Remove items that are no longer in the list
        Array.from(target.children).forEach(el => {
            const key = el.getAttribute("data-key");
            if (key && !usedKeys.has(key)) {
                console.debug(`🗑️ Removing item with key ${key}`);
                el.remove();
            }
        });
    },

    // === OBJECT PATCH ===
    "object": (target, patch) => {
        if (window.isEmptyValue(patch.object)) {
            target.innerHTML = '';
            return;
        }

        const template = window.TemplateStore.get(patch.template) || patch.template;
        if (!template) {
            console.warn("Object template not found or invalid.");
            return;
        }

        const renderedObject = window.renderTemplate(template, patch.object);
        if (renderedObject) {
            target.innerHTML = '';
            if (typeof renderedObject === 'string') {
                target.innerHTML = renderedObject;
            } else if (renderedObject instanceof Element) {
                target.appendChild(renderedObject);
            }
        }
    },
    
    // === NESTED PATCH ===
    "nested": (target, patch) => {
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
                nestedEl.value = value != null ? String(value) : "";
            } else {
                nestedEl.textContent = value != null ? String(value) : "";
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
    },
    
    // === CRUD PATCH ===
    "crud": (target, patch) => {
        console.debug("Applying CRUD patch:", patch.type, patch.operation, patch.displayType);
        
        // Handle based on displayType
        switch (patch.displayType) {
            case "list":
                handleCrudList(patch, target);
                break;
            case "object":
                handleCrudObject(patch, target);
                break;
            case "nested":
            case "update-var":
                handleCrudNested(patch, target);
                break;
            default:
                console.warn(`Unknown CRUD displayType: ${patch.displayType}`, patch);
        }
    }
};

// ========================
// CRUD OPERATION HANDLERS
// ========================

function getItemKey(item) {
    return String(item.key || item.id || item._id || Math.random().toString(36).substr(2, 9));
}

// In patchClientHelper3.js, find and replace the handleCrudList function

// Complete updated handleCrudList function for patchClientHelper3.js

function handleCrudList(patch, target) {
    if (!patch.operation) {
        console.warn("CRUD list patch missing operation:", patch);
        return;
    }
    
    const varName = patch.varName || patch.bindingPath;
    const templateId = patch.template;
    
    console.debug(`Handling CRUD list operation: ${patch.operation} for ${varName}`, patch);
    
    // Update the reactive state first
    if (patch.value !== undefined && window.__updateReactiveVar__) {
        window.__updateReactiveVar__(varName, patch.value);
    }
    
    // If we have a template and items, handle the DOM update
    if (templateId && (patch.items !== undefined || patch.value !== undefined)) {
        const template = window.TemplateStore.get(templateId);
        if (!template) {
            console.warn(`Template not found: ${templateId}`);
            return;
        }
        
        // Determine the items to work with
        const items = patch.items || patch.value || [];
        
        switch (patch.operation) {
            case "append":
            case "push":
                // Append items to the end
                console.debug(`Appending ${items.length} items to ${varName}`);
                items.forEach((item, index) => {
                    // Check if item already exists to avoid duplicates
                    const key = getItemKey(item);
                    const existingEl = target.querySelector(`[data-key="${key}"]`);
                    
                    if (!existingEl) {
                        // Use the list handler for consistent rendering
                        if (window.patchHandlers && window.patchHandlers.list) {
                            // Create a temporary container for this single item
                            const tempContainer = document.createElement('div');
                            window.patchHandlers.list(tempContainer, {
                                type: "list",
                                items: [item],
                                template: templateId,
                                classes: patch.classes,
                                staggerDelay: 0
                            });
                            
                            // Move the rendered element to the target
                            const renderedEl = tempContainer.firstElementChild;
                            if (renderedEl) {
                                renderedEl.setAttribute('data-key', key);
                                target.appendChild(renderedEl);
                                
                                // Apply animations if needed
                                if (patch.classes) {
                                    setTimeout(() => {
                                        renderedEl.classList.remove(...patch.classes);
                                    }, patch.staggerDelay * index || 0);
                                }
                            }
                        } else {
                            // Fallback to manual rendering
                            const renderedItem = window.renderTemplate(template, item);
                            if (renderedItem && typeof renderedItem === 'string') {
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = renderedItem;
                                const element = tempDiv.firstElementChild;
                                if (element) {
                                    element.setAttribute('data-key', key);
                                    target.appendChild(element);
                                    
                                    if (window.applyDataBindings) {
                                        window.applyDataBindings(element, item);
                                    }
                                }
                            }
                        }
                    }
                });
                break;
                
            case "prepend":
            case "unshift":
                // Prepend items at the beginning
                console.debug(`Prepending ${items.length} items to ${varName}`);
                [...items].reverse().forEach((item, index) => {
                    const key = getItemKey(item);
                    const existingEl = target.querySelector(`[data-key="${key}"]`);
                    
                    if (!existingEl) {
                        if (window.patchHandlers && window.patchHandlers.list) {
                            const tempContainer = document.createElement('div');
                            window.patchHandlers.list(tempContainer, {
                                type: "list",
                                items: [item],
                                template: templateId,
                                classes: patch.classes,
                                staggerDelay: 0
                            });
                            
                            const renderedEl = tempContainer.firstElementChild;
                            if (renderedEl) {
                                renderedEl.setAttribute('data-key', key);
                                target.insertBefore(renderedEl, target.firstChild);
                                
                                if (patch.classes) {
                                    setTimeout(() => {
                                        renderedEl.classList.remove(...patch.classes);
                                    }, patch.staggerDelay * index || 0);
                                }
                            }
                        } else {
                            const renderedItem = window.renderTemplate(template, item);
                            if (renderedItem && typeof renderedItem === 'string') {
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = renderedItem;
                                const element = tempDiv.firstElementChild;
                                if (element) {
                                    element.setAttribute('data-key', key);
                                    target.insertBefore(element, target.firstChild);
                                    
                                    if (window.applyDataBindings) {
                                        window.applyDataBindings(element, item);
                                    }
                                }
                            }
                        }
                    }
                });
                break;
                
            case "set":
            case "create":
                // Clear and set new content - using the working list handler
                console.debug(`SET operation: clearing and setting ${items.length} items for ${varName}, template: ${templateId}, TARGET:`, target);
                
                // Clear the container
                // target.innerHTML = '';
                
                // Reuse the working list handler from __updateReactiveVar__
                if (window.patchHandlers && window.patchHandlers.list) {
                    window.patchHandlers.list(target, {
                        type: "list",
                        items: items,
                        template: templateId,
                        classes: patch.classes,
                        staggerDelay: patch.staggerDelay || 0
                    });
                } else {
                    // Fallback to manual rendering if list handler isn't available
                    console.warn("patchHandlers.list not available, using fallback");
                    items.forEach(item => {
                        const renderedItem = window.renderTemplate(template, item);
                        if (renderedItem && typeof renderedItem === 'string') {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = renderedItem;
                            const element = tempDiv.firstElementChild;
                            if (element) {
                                element.setAttribute('data-key', getItemKey(item));
                                target.appendChild(element);
                                
                                if (window.applyDataBindings) {
                                    window.applyDataBindings(element, item);
                                }
                            }
                        }
                    });
                }
                break;
                
            case "update":
                // Update existing items
                console.debug(`Updating items in ${varName}`);
                items.forEach(item => {
                    const key = getItemKey(item);
                    const existingEl = target.querySelector(`[data-key="${key}"]`);
                    
                    if (existingEl) {
                        // Update data bindings on existing element
                        if (window.applyDataBindings) {
                            window.applyDataBindings(existingEl, item);
                        } else {
                            // Manual update of data-bind attributes
                            const bindElements = existingEl.querySelectorAll('[data-bind]');
                            bindElements.forEach(bindEl => {
                                const bindPath = bindEl.getAttribute('data-bind');
                                if (bindPath) {
                                    const parts = bindPath.split('.');
                                    let value = item;
                                    for (const part of parts) {
                                        if (value && typeof value === 'object') {
                                            value = value[part];
                                        } else {
                                            value = undefined;
                                            break;
                                        }
                                    }
                                    
                                    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(bindEl.tagName)) {
                                        bindEl.value = value != null ? String(value) : "";
                                    } else {
                                        bindEl.textContent = value != null ? String(value) : "";
                                    }
                                }
                            });
                        }
                    }
                });
                break;
                
            case "delete":
            case "remove":
                // Remove specific items
                console.debug(`Removing items from ${varName}`);
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
                } else if (items.length > 0) {
                    // If we have a full items list, do a full replace
                    target.innerHTML = '';
                    if (window.patchHandlers && window.patchHandlers.list) {
                        window.patchHandlers.list(target, {
                            type: "list",
                            items: items,
                            template: templateId,
                            classes: patch.classes,
                            staggerDelay: patch.staggerDelay || 0
                        });
                    }
                }
                break;
                
            case "pop":
                // Remove last item
                console.debug(`Popping last item from ${varName}`);
                if (target.lastChild) {
                    target.lastChild.remove();
                }
                break;
                
            case "shift":
                // Remove first item
                console.debug(`Shifting first item from ${varName}`);
                if (target.firstChild) {
                    target.firstChild.remove();
                }
                break;
                
            case "insert":
                // Insert at specific position
                if (patch.index !== undefined) {
                    console.debug(`Inserting ${items.length} items at position ${patch.index} in ${varName}`);
                    const referenceNode = target.children[patch.index] || null;
                    
                    items.forEach((item, offset) => {
                        const key = getItemKey(item);
                        const existingEl = target.querySelector(`[data-key="${key}"]`);
                        
                        if (!existingEl) {
                            if (window.patchHandlers && window.patchHandlers.list) {
                                const tempContainer = document.createElement('div');
                                window.patchHandlers.list(tempContainer, {
                                    type: "list",
                                    items: [item],
                                    template: templateId,
                                    classes: patch.classes,
                                    staggerDelay: 0
                                });
                                
                                const renderedEl = tempContainer.firstElementChild;
                                if (renderedEl) {
                                    renderedEl.setAttribute('data-key', key);
                                    const insertPoint = referenceNode ? 
                                        target.children[patch.index + offset] || null : 
                                        null;
                                    target.insertBefore(renderedEl, insertPoint);
                                }
                            }
                        }
                    });
                }
                break;
                
            case "clear":
                // Clear all items
                console.debug(`Clearing all items from ${varName}`);
                target.innerHTML = '';
                break;
                
            default:
                console.warn(`Unknown CRUD list operation: ${patch.operation}`, patch);
        }
    }
}

function handleCrudObject(patch, target) {
    const varName = patch.varName || patch.bindingPath;
    const templateId = patch.template;
    
    // Update reactive state
    if (patch.value !== undefined && window.__updateReactiveVar__) {
        window.__updateReactiveVar__(varName, patch.value);
    }
    
    // Update DOM if template is provided
    if (templateId && patch.object !== undefined) {
        window.patchHandlers.object(target, {
            type: "object",
            object: patch.object || patch.value,
            template: templateId
        });
    }
}

function handleCrudNested(patch, target) {
    const varName = patch.varName || patch.bindingPath;
    const value = patch.value;
    
    // Update reactive state
    if (window.__updateReactiveVar__) {
        window.__updateReactiveVar__(varName, value);
    }
    
    // Also update DOM directly if target is found
    if (target) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
            target.value = value != null ? String(value) : "";
        } else {
            target.textContent = value != null ? String(value) : "";
        }
    }
}

// ========================
// PATCH MANAGER
// ========================
window.PatchManager = window.PatchManager || (() => {
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
                window.applyPatch(patch);
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
            return queue.length;
        },
        
        flushNow: flush,
        
        getQueueSize() {
            return queue.length;
        },
        
        clearQueue() {
            queue = [];
            return true;
        }
    };
})();

// ========================
// APPLY PATCH FUNCTION
// ========================
window.applyPatch = window.applyPatch || function(patch, retryCount = 0) {
    if (!patch || typeof patch !== 'object' || !patch.type) {
        console.warn("⚠️ Skipping invalid patch:", patch);
        return;
    }

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
            setTimeout(() => window.applyPatch(patch, retryCount + 1), 100 * (retryCount + 1));
            return;
        }
        
        if (!target) {
            console.warn(`⚠️ Target not found for CRUD patch:`, patch);
            
            // Still update reactive variable even if DOM element not found
            if (patch.varName && patch.value !== undefined && window.__updateReactiveVar__) {
                window.__updateReactiveVar__(patch.varName, patch.value);
            }
            return;
        }
        
        // Apply the CRUD patch
        if (window.patchHandlers && window.patchHandlers.crud) {
            window.patchHandlers.crud(target, patch);
        }
        return;
    }
    
    // Handle update-var patches
    if (patch.type === "update-var") {
        if (window.__updateReactiveVar__) {
            window.__updateReactiveVar__(patch.varName, patch.value);
        }
        return;
    }

    const handler = window.patchHandlers ? window.patchHandlers[patch.type] : null;
    if (handler) {
        // Handle ":scope" selector specially
        let target;
        if (patch.selector !== ":scope") {
            target = document.querySelector(patch.selector);
        }

        // 🔄 RETRY LOGIC: If element not found, retry a few times
        if (!target && retryCount < 10) {
            console.debug(`⏳ Element not found for "${patch.selector}", retrying... (${retryCount + 1}/5)`);
            setTimeout(() => window.applyPatch(patch, retryCount + 1), 500 * (retryCount + 1));
            return;
        }

        if (!target) {
            console.debug("⚠️ Target not found for selector after retries:", patch.selector);
            return;
        }

        handler(target, patch);
    } else {
        console.warn(`⚠️ Unknown patch type: ${patch.type}`);
    }
};

// ========================
// REACTIVE VARIABLE UPDATE
// ========================
window.__updateReactiveVar__ = window.__updateReactiveVar__ || function(varName, value) {
    // Skip rendering if value exists but is empty
    if (window.isEmptyValue && window.isEmptyValue(value)) {
        const elements = document.querySelectorAll(`[data-bind="${varName}"]`);
        elements.forEach(el => el.innerHTML = '');
        return;
    }

    console.log("varName : ", varName, value);

    // Handle client state prefix (cs:)
    const isClientState = varName.startsWith('cs.');
    const cleanVarName = varName;
    
    // Get all elements with this data-bind attribute
    const elements = document.querySelectorAll(`[data-bind="${cleanVarName}"]`);

    elements.forEach(el => {
        if (Array.isArray(value)) {
            const templateId = el.getAttribute('data-template-id') || el.getAttribute('data-template');
            if (!templateId) {
                console.warn(`No template ID found for list variable: ${cleanVarName}`);
                return;
            }
            if (window.patchHandlers && window.patchHandlers.list) {
                window.patchHandlers.list(el, {
                    type: "list",
                    items: value,
                    template: templateId
                });
            }
            return;
        }

        if (value && typeof value === 'object') {
            const templateId = el.getAttribute('data-template-id') || el.getAttribute('data-template');
            if (!templateId) {
                console.warn(`No template ID found for object variable: ${cleanVarName}`);
                return;
            }
            if (window.patchHandlers && window.patchHandlers.object) {
                window.patchHandlers.object(el, {
                    type: "object",
                    object: value,
                    template: templateId
                });
            }
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
            // Remove "cs:" prefix for state storage
            const clientVarName = varName
            if (!instance.state.__client) instance.state.__client = {};
            instance.state.__client[clientVarName] = value;
        } else {
            if (!instance.state.__shared) instance.state.__shared = {};
            instance.state.__shared[cleanVarName] = value;
        }
    }
};

console.log("✅ Core patch system initialized");