// browserOps.js - Enhanced version with debugging
(function () {
    const wsConnections = {};
    const intervals = {};
    const rafHandles = {};
    const loadedModules = {};
    let debugMode = false;

    // Global client variable store

    window._clientVars = {}

    // Enable debugging
    window.__enableClientOpsDebug__ = function(enable = true) {
        debugMode = enable;
        console.debug(`Client ops debugging ${enable ? 'enabled' : 'disabled'}`);
    };

    function resolveTemplate(value, ctx = {}) {
        if (typeof value !== "string") return value;

        return value.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
            try {
                // Support nested paths like user.name or order.items[0].price
                const path = expr.split(".");
                let current = ctx;

                for (let part of path) {
                    // Handle array indexes like items[0]
                    const match = part.match(/^(\w+)\[(\d+)\]$/);
                    if (match) {
                        const [, key, index] = match;
                        current = current?.[key]?.[parseInt(index, 10)];
                    } else {
                        current = current?.[part];
                    }

                    if (current === undefined) break;
                }

                return current !== undefined ? current : "";
            } catch (e) {
                console.warn("[resolveTemplate] Failed to resolve", expr, "from ctx", ctx, e);
                return "";
            }
        });
    }

    async function resolveNestedOps(obj, path = 'root', ctx = {}) {
         console.debug(`resolveNestedOps:`, {path, obj});
        
        if (Array.isArray(obj)) {
            const results = [];
            for (let i = 0; i < obj.length; i++) {
                results.push(await resolveNestedOps(obj[i], `${path}[${i}]`, ctx));
            }
            return results;
        }
        
        if (obj && typeof obj === "object") {
            if (obj._op || obj._ops || obj._handler) {
                 console.debug(`Executing client op at ${path}:`, obj);
                return await execClientOp(obj, ctx);
            }
            
            const out = {};
            for (const [k, v] of Object.entries(obj)) {
                out[k] = await resolveNestedOps(v, `${path}.${k}`, ctx);
            }
            return out;
        }
        
        // Resolve templates in strings
        if (typeof obj === "string") {
            return resolveTemplate(obj, ctx);
        }
        
        return obj;
    }

    // 🔎 Shared evaluator for complex/nested conditions (with ! support)
    async function evalCondition(cond, ctx = {}) {
        if (!cond) return false;

        // Handle NOT (unary negation)
        if (cond.operator === "!") {
            if (cond.value) {
                const val = typeof cond.value === "object"
                    ? await evalCondition(cond.value, ctx)
                    : resolveTemplate(cond.value, ctx);
                return !val;
            }
            if (cond.conditions && cond.conditions.length === 1) {
                return !(await evalCondition(cond.conditions[0], ctx));
            }
            console.warn("Invalid NOT condition format:", cond);
            return false;
        }

        // Handle nested logical groups
        if (cond.conditions && cond.operator) {
            const results = [];
            for (const sub of cond.conditions) {
                results.push(await evalCondition(sub, ctx));
            }
            switch (cond.operator) {
                case "&&": return results.every(Boolean);
                case "||": return results.some(Boolean);
                default:
                    console.warn("Unknown logical group operator:", cond.operator);
                    return false;
            }
        }

        // Handle binary condition
        let left = typeof cond.left === "object" ? await execClientOp(cond.left, ctx) : cond.left;
        let right = typeof cond.right === "object" ? await execClientOp(cond.right, ctx) : cond.right;
        
        // Resolve templates in condition values
        if (typeof left === "string") left = resolveTemplate(left, ctx);
        if (typeof right === "string") right = resolveTemplate(right, ctx);

        switch (cond.operator) {
            case "==": return left == right;
            case "===": return left === right;
            case "!=": return left != right;
            case "!==": return left !== right;
            case ">": return left > right;
            case ">=": return left >= right;
            case "<": return left < right;
            case "<=": return left <= right;
            default:
                console.warn("Unknown binary operator in condition:", cond.operator);
                return !!cond;
        }
    }

    function getElements(sel) {
        if (!sel) return [];
        if (Array.isArray(sel)) {
            return sel.flatMap(s => Array.from(document.querySelectorAll(s)));
        }
        return Array.from(document.querySelectorAll(sel));
    }

    async function execClientOp(op, ctx = {}) {
        if (!op || typeof op !== "object") {
             console.warn('Invalid operation:', op);
            return;
        }

         console.debug('Executing operation:', op, 'with context:', ctx);

        // Batch ops
        if (Array.isArray(op._ops)) {
             console.debug('Processing batch of', op._ops.length, 'operations');
            for (const subOp of op._ops) {
                await execClientOp(subOp, ctx);
            }
            return;
        }

        if (op._debounce) {
        const { id, wait = 300, immediate = false } = op._debounce;
        if (id) {
            if (debounceTimers[id]) {
                clearTimeout(debounceTimers[id]);
            }
            return new Promise(resolve => {
                debounceTimers[id] = setTimeout(async () => {
                    const result = await execClientOp(op.op, ctx);
                    resolve(result);
                    delete debounceTimers[id];
                }, wait);
            });
        }
    }

    // Handle throttled operations
    if (op._throttle) {
        const { id, limit = 100 } = op._throttle;
        if (id) {
            const now = Date.now();
            if (!throttleLocks[id] || now - throttleLocks[id] >= limit) {
                throttleLocks[id] = now;
                return execClientOp(op.op, ctx);
            }
            return; // Skip execution if throttled
        }
    }

        // Handler operations (sendPatch, etc.)
        if (op._handler) {
            if (typeof window[op.fn] === 'function') {
                const evaluatedArgs = [];
                
                 console.debug('Processing handler args:', op.args);
                
                for (let i = 0; i < (op.args || []).length; i++) {
                    const arg = op.args[i];
                    if (typeof arg === 'object' && (arg._op || arg._ops || arg._handler)) {
                        evaluatedArgs.push(await execClientOp(arg, ctx));
                    } else if (typeof arg === 'object') {
                        evaluatedArgs.push(await resolveNestedOps(arg, `args[${i}]`, ctx));
                    } else {
                        evaluatedArgs.push(resolveTemplate(arg, ctx));
                    }
                }

                 console.debug('Calling handler:', op.fn, 'with args:', evaluatedArgs);
                
                return window[op.fn].apply(null, evaluatedArgs);
            }
            console.warn(`Function not found for handler: ${op.fn}`);
            return;
        }

        // Resolve selector templates if present
        const resolvedSelector = op.selector ? resolveTemplate(op.selector, ctx) : op.selector;
        const els = getElements(resolvedSelector);
        if (debugMode && resolvedSelector) {
            console.debug(`Selector "${resolvedSelector}" found ${els.length} elements`);
        }

        switch (op._op) {
            // ===== DOM =====

             case "debounce": {
        const { id, wait = 300, immediate = false } = op;
        if (id) {
            if (debounceTimers[id]) {
                clearTimeout(debounceTimers[id]);
            }
            return new Promise(resolve => {
                debounceTimers[id] = setTimeout(async () => {
                    if (op.callback) {
                        const result = await execClientOp(op.callback, ctx);
                        resolve(result);
                    }
                    delete debounceTimers[id];
                }, wait);
            });
        }
        break;
    }
    
    case "throttle": {
        const { id, limit = 100 } = op;
        if (id) {
            const now = Date.now();
            if (!throttleLocks[id] || now - throttleLocks[id] >= limit) {
                throttleLocks[id] = now;
                if (op.callback) {
                    return await execClientOp(op.callback, ctx);
                }
            }
        }
        break;
    }
    
    case "cancelDebounce": {
        const { id } = op;
        if (id && debounceTimers[id]) {
            clearTimeout(debounceTimers[id]);
            delete debounceTimers[id];
        }
        break;
    }
    
    case "cancelThrottle": {
        const { id } = op;
        if (id && throttleLocks[id]) {
            delete throttleLocks[id];
        }
        break;
    }

            case "query": 
                return els[0] || null;
                
            case "getValue": 
                if (els[0]) {
                    const value = els[0].value;
                     console.debug(`getValue("${resolvedSelector}") =`, value);
                    return value;
                }
                 console.warn(`getValue("${resolvedSelector}") - no element found`);
                return undefined;
                
            case "setValue": 
                els.forEach(el => {
                    const resolvedValue = resolveTemplate(op.value, ctx);
                     console.debug(`setValue("${resolvedSelector}", "${resolvedValue}")`);
                    el.value = resolvedValue;
                });
                break;
                
            case "getText": 
                if (els[0]) {
                    const text = els[0].textContent;
                     console.debug(`getText("${resolvedSelector}") =`, text);
                    return text;
                }
                 console.warn(`getText("${resolvedSelector}") - no element found`);
                return undefined;
                
            case "setText": 
                els.forEach(el => {
                    const resolvedValue = resolveTemplate(op.value, ctx);
                     console.debug(`setText("${resolvedSelector}", "${resolvedValue}")`);
                    el.textContent = resolvedValue;
                });
                break;
                
            case "addClass": 
                els.forEach(el => {
                    const resolvedClassName = resolveTemplate(op.className, ctx);
                     console.debug(`addClass("${resolvedSelector}", "${resolvedClassName}")`);
                    el.classList.add(resolvedClassName);
                });
                break;
                
            case "removeClass": 
                els.forEach(el => {
                    const resolvedClassName = resolveTemplate(op.className, ctx);
                     console.debug(`removeClass("${resolvedSelector}", "${resolvedClassName}")`);
                    el.classList.remove(resolvedClassName);
                });
                break;
                
            case "show": 
                els.forEach(el => {
                     console.debug(`show("${resolvedSelector}")`);
                    el.style.display = "block";
                });
                break;
                
            case "hide": 
                els.forEach(el => {
                     console.debug(`hide("${resolvedSelector}")`);
                    el.style.display = "none";
                });
                break;
                
            case "setAttrs":
                els.forEach(el => {
                    if (op.attrs && typeof op.attrs === "object") {
                        for (let [k, v] of Object.entries(op.attrs)) {
                            const resolvedValue = resolveTemplate(v, ctx);
                             console.debug(`setAttr("${resolvedSelector}", "${k}", "${resolvedValue}")`);
                            if (resolvedValue === false || resolvedValue === null) {
                                el.removeAttribute(k);
                            } else if (resolvedValue === true) {
                                el.setAttribute(k, "");
                            } else {
                                el.setAttribute(k, resolvedValue);
                            }
                        }
                    }
                });
                break;

            // ===== Timers =====
            case "setTimeout":
                setTimeout(() => { if (op.callback) execClientOp(op.callback, ctx); }, op.ms);
                break;
            case "setInterval": {
                const id = op.id || String(Date.now());
                intervals[id] = setInterval(() => {
                    if (op.callback) execClientOp(op.callback, ctx);
                }, op.ms);
                break;
            }
            case "clearInterval":
                if (op.id && intervals[op.id]) {
                    clearInterval(intervals[op.id]);
                    delete intervals[op.id];
                }
                break;
            case "requestAnimationFrame": {
                const id = op.id || String(Date.now());
                rafHandles[id] = requestAnimationFrame(() => {
                    if (op.callback) execClientOp(op.callback, ctx);
                });
                break;
            }
            case "cancelAnimationFrame":
                if (op.id && rafHandles[op.id]) {
                    cancelAnimationFrame(rafHandles[op.id]);
                    delete rafHandles[op.id];
                }
                break;

            // ===== WebSocket =====
            case "wsConnect": {
                if (!op.id) throw new Error("wsConnect requires id");
                const resolvedUrl = resolveTemplate(op.url, ctx);
                const ws = new WebSocket(resolvedUrl);
                wsConnections[op.id] = ws;
                if (op.onMessage) {
                    ws.onmessage = e => execClientOp({ ...op.onMessage, data: e.data }, ctx);
                }
                if (op.onOpen) ws.onopen = () => execClientOp(op.onOpen, ctx);
                if (op.onClose) ws.onclose = () => execClientOp(op.onClose, ctx);
                if (op.onError) ws.onerror = () => execClientOp(op.onError, ctx);
                break;
            }
            case "wsSend":
                if (op.id && wsConnections[op.id]) {
                    const resolvedMessage = resolveTemplate(op.message, ctx);
                    wsConnections[op.id].send(resolvedMessage);
                }
                break;
            case "wsClose":
                if (op.id && wsConnections[op.id]) {
                    wsConnections[op.id].close();
                    delete wsConnections[op.id];
                }
                break;

            // ===== Fetch =====
            case "fetch":
                try {
                    const resolvedUrl = resolveTemplate(op.url, ctx);
                    const resolvedOptions = await resolveNestedOps(op.options || {}, 'fetch.options', ctx);
                    const res = await fetch(resolvedUrl, resolvedOptions);
                    const t = op.responseType || "text";
                    const data = await res[t]();
                    if (op.onSuccess) await execClientOp({ ...op.onSuccess, data }, ctx);
                } catch (err) {
                    if (op.onError) await execClientOp({ ...op.onError, error: String(err) }, ctx);
                }
                break;

            // ===== Storage =====
            case "localSet": 
                localStorage.setItem(op.key, resolveTemplate(op.value, ctx)); 
                break;
            case "localGet": return localStorage.getItem(op.key);
            case "localRemove": localStorage.removeItem(op.key); break;
            case "sessionSet": 
                sessionStorage.setItem(op.key, resolveTemplate(op.value, ctx)); 
                break;
            case "sessionGet": return sessionStorage.getItem(op.key);
            case "sessionRemove": sessionStorage.removeItem(op.key); break;

            case "setVar": {
    const val = typeof op.value === "object" ? await execClientOp(op.value, ctx) : resolveTemplate(op.value, ctx);
    
    // Check for nested path
    if (op.name.includes('.')) {
        const keys = op.name.split('.');
        let current = window._clientVars;
        
        // Traverse the object to find the correct nested location
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (typeof current[key] !== 'object' || current[key] === null) {
                // If the path doesn't exist, create an empty object
                current[key] = {};
            }
            current = current[key];
        }
        
        // Set the value at the final key
        current[keys[keys.length - 1]] = val;
        
        console.debug("[setVar] Stored nested variable", op.name, "=", val);
    } else {
        // Handle non-nested variables as before
        window._clientVars[op.name] = val;
        console.debug("[setVar] Stored variable", op.name, "=", val);
    }
    
    break;
}

            // write case to getAttr operation
            case "getAttr":
                if (els[0]) {
                    const attrValue = els[0].getAttribute(op.attr);
                        console.debug(`getAttr("${resolvedSelector}", "${op.attr}") =`, attrValue);
                    return attrValue;
                }
                console.warn(`getAttr("${resolvedSelector}", "${op.attr}") - no element found`);
                return undefined;

            case "getVar": {
    let val;

    // Check for nested path
    if (op.name.includes('.')) {
        const keys = op.name.split('.');
        let current = window._clientVars;

        // Traverse the object
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                // If any part of the path is invalid, the value is undefined
                current = undefined;
                break;
            }
        }
        val = current;
    } else {
        // Handle non-nested variables as before
        val = window._clientVars[op.name];
    }

    console.debug("[getVar] Retrieved variable", op.name, "=", val);
    return val;
}

            // ===== Clipboard =====
            case "copyText": 
                await navigator.clipboard.writeText(resolveTemplate(op.text, ctx)); 
                break;
            case "readText": return await navigator.clipboard.readText();

            // ===== Notifications =====
            case "notify":
                if (typeof Notification !== "undefined") {
                    if (Notification.permission !== "granted") {
                        await Notification.requestPermission();
                    }
                    if (Notification.permission === "granted") {
                        const resolvedTitle = resolveTemplate(op.title || "Notification", ctx);
                        const resolvedBody = resolveTemplate(op.body || "", ctx);
                        new Notification(resolvedTitle, { body: resolvedBody });
                    }
                }
                break;

            // ===== External ES Modules =====
            case "importModule":
                if (!op.name || !op.url) throw new Error("importModule requires name and url");
                const resolvedModuleUrl = resolveTemplate(op.url, ctx);
                loadedModules[op.name] = await import(resolvedModuleUrl);
                break;

                case "callModuleFn": {
    if (!op.fn) throw new Error("callModuleFn requires fn");

    // Resolve module
    let targetModule;
    if (op.module) {
        if (loadedModules[op.module]) {
            targetModule = loadedModules[op.module];
        } else if (typeof window !== "undefined" && window[op.module]) {
            targetModule = window[op.module];
        } else if (typeof globalThis !== "undefined" && globalThis[op.module]) {
            targetModule = globalThis[op.module];
        } else {
            console.warn("[callModuleFn] Module not found:", op.module);
            break;
        }
    } else {
        targetModule = typeof window !== "undefined" ? window : globalThis;
    }

    // Resolve fn path
    const parts = op.fn.split(".");
    let context = targetModule;
    let target;

    for (let i = 0; i < parts.length; i++) {
        if (context == null) {
            console.warn(`[callModuleFn] Path not found: ${op.fn}`);
            target = undefined;
            break;
        }
        if (i === parts.length - 1) {
            target = context[parts[i]];
        } else {
            context = context[parts[i]];
        }
    }

    const action = op.action || "call";
    let result;

    try {
        if (action === "call") {
            if (typeof target !== "function") {
                console.warn(`[callModuleFn] Function not found: ${op.fn} on ${op.module || "global"}`);
                result = undefined;
            } else {
                // Resolve args
                const resolvedArgs = [];
                const timeoutMs = 5000;

                for (const arg of op.args || []) {
                    try {
                        let resolvedArg;
                        if (typeof arg === "object" && (arg._op || arg._ops || arg._handler)) {
                            resolvedArg = await Promise.race([
                                execClientOp(arg, ctx),
                                new Promise((_, reject) => setTimeout(() => reject(new Error("Arg resolution timed out")), timeoutMs))
                            ]);
                        } else if (typeof arg === "object") {
                            resolvedArg = await Promise.race([
                                resolveNestedOps(arg, "callModuleFn.arg", ctx),
                                new Promise((_, reject) => setTimeout(() => reject(new Error("Nested ops resolution timed out")), timeoutMs))
                            ]);
                        } else {
                            resolvedArg = resolveTemplate(arg, ctx);
                        }
                        resolvedArgs.push(resolvedArg);
                    } catch (timeoutErr) {
                        console.error(`[callModuleFn] Arg resolution failed: ${timeoutErr.message}. Using null.`);
                        resolvedArgs.push(null);
                        break; // stop further args but still attempt the call
                    }
                }

                try {
                    result = await target.apply(context, resolvedArgs);
                } catch (applyErr) {
                    console.error(`[callModuleFn] Error calling function ${op.fn}:`, applyErr);
                    result = undefined;
                }
            }

        } else if (action === "set") {
            if (parts.length < 1) {
                console.warn("[callModuleFn] Property path required for 'set'");
            } else {
                let obj = targetModule;
                for (let i = 0; i < parts.length - 1; i++) {
                    const key = parts[i];
                    if (obj[key] == null) {
                        obj[key] = {};
                    } else if (typeof obj[key] !== "object") {
                        console.warn(`[callModuleFn] Cannot traverse into non-object at ${key}`);
                        return;
                    }
                    obj = obj[key];
                }
                const propName = parts[parts.length - 1];
                obj[propName] = op.value;
                result = obj[propName];
            }

        } else if (action === "get") {
            result = target;

        } else {
            console.warn("[callModuleFn] Unknown action:", action);
        }
    } catch (err) {
        console.error(`[callModuleFn] Error executing ${op.fn}:`, err);
        result = undefined;
    }

    if (op.onResult) {
        if (typeof op.onResult === "function") {
            await op.onResult(result, ctx);
        } else {
            await execClientOp({ ...op.onResult, data: result }, ctx);
        }
    }
    break;
}


            case "declareFunction":
                if (!op.name) throw new Error("declareFunction requires a name");
                if (!Array.isArray(op.params)) op.params = [];
                if (typeof op.body === "string") {
                    window[op.name] = new Function(...op.params, op.body);
                } else if (typeof op.body === "object") {
                    // Wrap client ops in a function
                    window[op.name] = function (...args) {
                        if (op.params && op.params.length) {
                            op.params.forEach((p, i) => { window[p] = args[i]; });
                        }
                        window.__clientOp__(op.body);
                    };
                } else {
                    throw new Error("Unsupported function body type");
                }
                break;
                
            case "if_": {
                const condition_result = op._complexCondition
                    ? await evalCondition(op.condition, ctx)
                    : (typeof op.condition === "object" ? await execClientOp(op.condition, ctx) : resolveTemplate(op.condition, ctx));

                if (condition_result) {
                    if (op.then) await execClientOp(op.then, ctx);
                } else {
                    if (op.else) await execClientOp(op.else, ctx);
                }
                break;
            }

            case "trim":
                let trim_op_result = await execClientOp(op.op, ctx);
                return typeof trim_op_result === 'string' ? trim_op_result.trim() : trim_op_result;
                
            // ===== Loop Operations =====
            case "while_loop": {
                let condition_result;
                while (true) {
                    condition_result = await evalCondition(op.condition, ctx);
                    if (!condition_result) break;

                    try {
                        await execClientOp(op.body, ctx);
                    } catch (e) {
                        if (e.__loopControl === "break") break;
                        if (e.__loopControl === "continue") continue;
                        throw e; // real error
                    }
                }
                break;
            }

            case "do_while_loop": {
                let condition_result;
                do {
                    await execClientOp(op.body, ctx);
                    condition_result = await evalCondition(op.condition, ctx);
                } while (condition_result);
                break;
            }

            case "loop_until": {
                let condition_result;
                while (true) {
                    await execClientOp(op.body, ctx);
                    condition_result = await evalCondition(op.condition, ctx);
                    if (condition_result) break;
                }
                break;
            }

            case "for_loop": {
                if (op.init) await execClientOp(op.init, ctx);

                while (true) {
                    const condition_result = op._complexCondition
                        ? await evalCondition(op.condition, ctx)
                        : (typeof op.condition === "object"
                            ? await execClientOp(op.condition, ctx)
                            : resolveTemplate(op.condition, ctx));

                    if (!condition_result) break;

                    try {
                        if (op.body) await execClientOp(op.body, ctx);
                    } catch (e) {
                        if (e.__loopControl === "break") break;
                        if (e.__loopControl === "continue") {
                            if (op.increment) await execClientOp(op.increment, ctx);
                            continue;
                        }
                        throw e;
                    }

                    if (op.increment) await execClientOp(op.increment, ctx);
                }
                break;
            }

            case "foreach_loop": {
                console.debug("[foreach_loop] Starting foreach loop", op);

                let collection;
                
                // Check if collection is a client operation that needs to be executed
                if (op.collection && typeof op.collection === "object" && 
                    (op.collection._op || op.collection._ops || op.collection._handler)) {
                    collection = await execClientOp(op.collection, ctx);
                } else {
                    // It's already a value (array, object, etc.)
                    collection = op.collection;
                }

                if (!collection) {
                    console.debug("[foreach_loop] Collection is null/undefined, skipping loop.");
                    break;
                }

                if (collection instanceof NodeList || collection instanceof HTMLCollection) {
                    console.debug("[foreach_loop] Converting NodeList/HTMLCollection to array, length:", collection.length);
                    collection = Array.from(collection);
                }

                if (Array.isArray(collection)) {
                    console.debug("[foreach_loop] Iterating array, length:", collection.length);
                    for (let i = 0; i < collection.length; i++) {
                        const loopCtx = { ...ctx };
                        if (op.itemVar) loopCtx[op.itemVar] = collection[i];
                        if (op.indexVar) loopCtx[op.indexVar] = i;

                        try {
                            await execClientOp(op.body, loopCtx);
                        } catch (e) {
                            if (e.__loopControl === "break") {
                                console.debug("[foreach_loop] Break triggered, exiting loop at index:", i);
                                break;
                            }
                            if (e.__loopControl === "continue") {
                                console.debug("[foreach_loop] Continue triggered, skipping index:", i);
                                continue;
                            }
                            console.error("[foreach_loop] Error in loop body at index:", i, e);
                            throw e;
                        }
                    }
                } else if (typeof collection === "object") {
                    console.debug("[foreach_loop] Iterating object keys:", Object.keys(collection));
                    for (const [key, value] of Object.entries(collection)) {
                        const loopCtx = { ...ctx };
                        if (op.itemVar) loopCtx[op.itemVar] = value;
                        if (op.indexVar) loopCtx[op.indexVar] = key;

                        try {
                            await execClientOp(op.body, loopCtx);
                        } catch (e) {
                            if (e.__loopControl === "break") {
                                break;
                            }
                            if (e.__loopControl === "continue") {
                                continue;
                            }
                            console.error("[foreach_loop] Error in loop body at key:", key, e);
                            throw e;
                        }
                    }
                } else {
                    console.warn("[foreach_loop] Unsupported collection type:", typeof collection, collection);
                }

                break;
            }

            // add maths module operations --add all operations
            case "math": {
                if (!op.fn) throw new Error("math operation requires fn");
                const args = [];
                for (const arg of op.args || []) {
                    if (typeof arg === 'object' && (arg._op || arg._ops || arg._handler)) {
                        args.push(await execClientOp(arg, ctx));
                    } else if (typeof arg === 'object') {
                        args.push(await resolveNestedOps(arg, 'math.arg', ctx));
                    } else {
                        args.push(resolveTemplate(arg, ctx));
                    }
                }
                switch (op.fn) {
                    case "sum": return args.reduce((a, b) => a + b, 0);
                    case "subtract": return args.reduce((a, b) => a - b);
                    case "multiply": return args.reduce((a, b) => a * b, 1);
                    case "divide": return args.reduce((a, b) => a / b);
                    case "mod": return args[0] % args[1];
                    case "pow": return Math.pow(args[0], args[1]);
                    case "sqrt": return Math.sqrt(args[0]);
                    case "abs": return Math.abs(args[0]);
                    case "min": return Math.min(...args);
                    case "max": return Math.max(...args);
                    case "round": return Math.round(args[0]);
                    case "floor": return Math.floor(args[0]);
                    case "ceil": return Math.ceil(args[0]);
                    case "random": 
                        if (args.length === 2) {
                            const [min, max] = args;
                            return Math.floor(Math.random() * (max - min + 1)) + min;
                        }
                        return Math.random();
                    default:
                        throw new Error("Unknown math function: " + op.fn);
                }
            }

            case "return": {
                const val = op.value
                    ? (typeof op.value === "object" ? await execClientOp(op.value, ctx) : resolveTemplate(op.value, ctx))
                    : undefined;
                throw { __return: true, value: val };
            }

            case "break": {
                throw { __loopControl: "break" };
            }

            case "continue": {
                throw { __loopControl: "continue" };
            }

            // ===== Type Conversion =====
            case "convert": {
                const value = await execClientOp(op.op, ctx);
                switch (op.targetType) {
                    case "string": return String(value);
                    case "number": return Number(value);
                    case "boolean": return Boolean(value);
                    case "json": 
                        try { return JSON.parse(value); } 
                        catch { return null; }
                    case "array": 
                        return Array.isArray(value) ? value : 
                            value ? [value] : [];
                    default: return value;
                }
            }
// ===== File Reading =====
case "readFileAsDataURL":
case "readFileAsText":
case "readFileAsJSON":
case "readFileAsAudio":
case "readFileAsVideo": {
    const input = getElements(op.selector)[0];
    if (input && input.files && input.files.length > 0) {
        for (const file of input.files) {
            const reader = new FileReader();

            const fileDetails = {
                name: file.name,
                length: file.size,
                type: op._op.replace('readFileAs', ''), // Extracts 'Text', 'DataURL', etc.
                path: `C:/fakepath/${file.name}`,
                mimeType: file.type
            };

            reader.onload = async e => {
                let result = e.target.result;
                if (op._op === "readFileAsJSON") {
                    try {
                        result = JSON.parse(result);
                    } catch {
                        console.warn("[readFileAsJSON] invalid JSON");
                    }
                }

                // ✅ Store multiple files as an array
                const storeName = op.name || input.name;
                if (storeName) {
                    if (!window._clientVars[storeName]) window._clientVars[storeName] = [];
                    window._clientVars[storeName].push({
                        details: fileDetails,
                        content: result
                    });
                }

                // === Handle onResult chain
                const injectValue = obj => {
                    if (typeof obj === "string" && obj === "__VALUE__") return result;
                    if (Array.isArray(obj)) return obj.map(injectValue);
                    if (obj && typeof obj === "object") {
                        const copy = {};
                        for (const [k, v] of Object.entries(obj)) copy[k] = injectValue(v);
                        return copy;
                    }
                    return obj;
                };

                if (op.onResult) {
                    const ops = Array.isArray(op.onResult) ? op.onResult : [op.onResult];
                    for (const child of ops) {
                        await execClientOp(injectValue(child), { value: result, file });
                    }
                }

                // === Media preview (audio/video)
                if (op._op === "readFileAsAudio" || op._op === "readFileAsVideo") {
                    if (op.target) {
                        const url = URL.createObjectURL(file);
                        getElements(op.target).forEach(el => { el.src = url; el.load(); });
                    }
                }
            };

            if (op._op === "readFileAsDataURL") reader.readAsDataURL(file);
            if (op._op === "readFileAsText" || op._op === "readFileAsJSON") reader.readAsText(file);
            if (op._op === "readFileAsAudio" || op._op === "readFileAsVideo") reader.readAsArrayBuffer(file);
        }
    }
    break;
}

// ===== Store Variable =====
case "storeVar": {
    if (op.name) {
        window._clientVars[op.name] = op.value;
         {
            console.debug(`[clientOps] Stored variable '${op.name}'`);
        }
    }
    break;
}

// ===== Streaming (Chunked Upload) =====
case "streamFile": {
    const input = getElements(op.selector)[0];
    if (input && input.files && input.files.length > 0) {
        for (const file of input.files) {
            const chunkSize = op.chunkSize || 64 * 1024;
            let offset = 0;

            // 🎬 Setup preview immediately
            if (op.targetPreview) {
                const url = URL.createObjectURL(file);
                getElements(op.targetPreview).forEach(el => { el.src = url; el.load(); el.classList.remove("hidden"); });
            }

            while (offset < file.size) {
                const slice = file.slice(offset, offset + chunkSize);
                const buf = await slice.arrayBuffer();
                offset += chunkSize;

                if (op.targetProgress) {
                    const percent = Math.min(100, Math.round((offset / file.size) * 100));
                    getElements(op.targetProgress).forEach(el => {
                        el.value = percent;
                        el.textContent = percent + "%";
                        el.classList.remove("hidden");
                    });
                }

                if (op.onChunk) {
                    await execClientOp({ ...op.onChunk, data: buf }, { file, offset, size: file.size });
                }
            }

            if (op.onComplete) {
                await execClientOp(op.onComplete, { file, size: file.size });
            }
        }
    }
    break;
}

/* ---------- insert / remove / replace ---------- */
case "append":
    els.forEach(el => el.insertAdjacentHTML("beforeend", resolveTemplate(op.value, ctx)));
    break;

case "prepend":
    console.log("calling prepend...", els)
    els.forEach(el => {
        const html = resolveTemplate(op.value, ctx);
        console.debug("Prepending into", el, "HTML:", html);
        el.insertAdjacentHTML("afterbegin", html);
    });
    break;


case "remove":
    els.forEach(el => el.remove());
    break;

case "replace":
    els.forEach(el => { el.innerHTML = resolveTemplate(op.value, ctx); });
    break;

case "replaceWith":
    els.forEach(el => { el.outerHTML = resolveTemplate(op.value, ctx); });
    break;

case "clear":
    els.forEach(el => { el.innerHTML = ""; });
    break;

case "insertBefore":
    els.forEach(el => el.insertAdjacentHTML("beforebegin", resolveTemplate(op.value, ctx)));
    break;

case "insertAfter":
    els.forEach(el => el.insertAdjacentHTML("afterend", resolveTemplate(op.value, ctx)));
    break;

/* ---------- wrap / unwrap ---------- */
/* ---------- wrap / unwrap ---------- */
case "wrap":
    els.forEach(el => {
        const wrapper = document.createElement(op.tag || "div");

        // Apply attributes
        if (op.attributes) {
            Object.entries(op.attributes).forEach(([key, val]) => {
                if (val != null && val !== "") wrapper.setAttribute(key, val);
            });
        }

        const parent = el.parentNode;
        if (parent) {
            parent.insertBefore(wrapper, el);
            wrapper.appendChild(el);
            console.log("wrap → replaced", el, "with wrapper:", wrapper);
        }
    });
    break;

case "wrapAll":
    if (els.length > 0) {
        const wrapper = document.createElement(op.tag || "div");

        if (op.attributes) {
            Object.entries(op.attributes).forEach(([key, val]) => {
                if (val != null && val !== "") wrapper.setAttribute(key, val);
            });
        }

        const first = els[0];
        const parent = first.parentNode;
        if (parent) {
            parent.insertBefore(wrapper, first);
            els.forEach(el => wrapper.appendChild(el));
            console.log("wrapAll → replaced elements with wrapper:", wrapper);
        }
    }
    break;

/* ---------- clone / replaceChildren / move / swap ---------- */
case "clone":
    els.forEach(el => {
        const clone = el.cloneNode(!!op.deep);
        el.parentNode.insertBefore(clone, el.nextSibling);
    });
    break;

case "replaceChildren":
    els.forEach(el => {
        const resolvedValue = resolveTemplate(op.value, ctx);
        el.replaceChildren();
        if (resolvedValue) el.insertAdjacentHTML("afterbegin", resolvedValue);
    });
    break;

case "move": {
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length) break;
    const target = targetEls[0];
    const position = op.position || "beforeend";
    els.forEach(el => target.insertAdjacentElement(position, el));
    break;
}

case "swap": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    if (elsA.length && elsB.length) {
        const elA = elsA[0], elB = elsB[0];
        const parentA = elA.parentNode, siblingA = elA.nextSibling;
        elB.parentNode.insertBefore(elA, elB);
        if (siblingA) parentA.insertBefore(elB, siblingA); else parentA.appendChild(elB);
    }
    break;
}

/* ---------- sort / unique / shuffle / reverse ---------- */
case "sort":
    els.forEach(el => {
        const children = Array.from(el.children);
        const compareMode = op.compare || "text";
        let getter;
        if (compareMode === "text") getter = n => n.textContent.trim();
        else if (compareMode.startsWith("attr:")) {
            const attr = compareMode.split(":")[1];
            getter = n => n.getAttribute(attr) || "";
        } else if (compareMode === "html") getter = n => n.innerHTML.trim();
        else if (compareMode === "reverse") { children.reverse(); getter = null; }

        if (getter) children.sort((a, b) => getter(a).localeCompare(getter(b)));
        children.forEach(c => el.appendChild(c));
    });
    break;

case "unique":
    els.forEach(el => {
        const mode = op.mode || "text";
        const seen = new Set();
        Array.from(el.children).forEach(child => {
            let key = "";
            if (mode === "text") key = child.textContent.trim();
            else if (mode.startsWith("attr:")) key = child.getAttribute(mode.split(":")[1]) || "";
            if (seen.has(key)) child.remove(); else seen.add(key);
        });
    });
    break;

case "shuffle":
    els.forEach(el => {
        const children = Array.from(el.children);
        for (let i = children.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [children[i], children[j]] = [children[j], children[i]];
        }
        children.forEach(c => el.appendChild(c));
    });
    break;

case "reverse":
    els.forEach(el => {
        const children = Array.from(el.children).reverse();
        children.forEach(c => el.appendChild(c));
    });
    break;

/* ---------- map / filter / reduce / partition / flatten / nest / split / slice /splice ---------- */
case "map":
    els.forEach(el => {
        const rule = op.transform || "";
        Array.from(el.children).forEach(child => {
            if (rule.startsWith("text:")) child.textContent = rule.slice(5);
            else if (rule.startsWith("attr:")) {
                const [attr, val] = rule.slice(5).split("=");
                child.setAttribute(attr, val);
            } else if (rule.startsWith("wrap:")) {
                const parts = rule.slice(5).split("|");
                child.insertAdjacentHTML("beforebegin", parts[0] || "");
                child.insertAdjacentHTML("afterend", parts[1] || "");
            } else if (rule.startsWith("html:")) {
                child.innerHTML = rule.slice(5);
            }
        });
    });
    break;

case "filter":
    els.forEach(el => {
        const cond = op.condition || "";
        Array.from(el.children).forEach(child => {
            let keep = true;
            if (cond.startsWith("text:")) {
                keep = child.textContent.toLowerCase().includes(cond.slice(5).toLowerCase());
            } else if (cond.startsWith("attr:")) {
                const [attr, val] = cond.slice(5).split("=");
                keep = child.getAttribute(attr) === val;
            } else if (cond.startsWith("not:")) {
                const inner = cond.slice(4);
                if (inner.startsWith("text:")) keep = !child.textContent.toLowerCase().includes(inner.slice(5).toLowerCase());
                else if (inner.startsWith("attr:")) {
                    const [attr, val] = inner.slice(5).split("=");
                    keep = !(child.getAttribute(attr) === val);
                }
            }
            if (!keep) child.remove();
        });
    });
    break;

case "reduce":
    els.forEach(el => {
        const acc = op.accumulator || "";
        const children = Array.from(el.children);
        let result = "";
        if (acc.startsWith("text:join:")) { const sep = acc.slice(10); result = children.map(c => c.textContent.trim()).join(sep); }
        else if (acc.startsWith("attr:")) { const parts = acc.split(":"); const name = parts[1]; const sep = parts[2] && parts[2].startsWith("join:") ? parts[2].slice(5) : ","; result = children.map(c => c.getAttribute(name) || "").join(sep); }
        else if (acc === "count") result = String(children.length);
        else if (acc.startsWith("html:join:")) { const sep = acc.slice(10); result = children.map(c => c.innerHTML.trim()).join(sep); }
        el.replaceChildren(result);
    });
    break;

case "partition":
    els.forEach(el => {
        const cond = op.condition || "";
        const matches = [], nonMatches = [];
        Array.from(el.children).forEach(child => {
            let keep = false;
            if (cond.startsWith("text:")) keep = child.textContent.toLowerCase().includes(cond.slice(5).toLowerCase());
            else if (cond.startsWith("attr:")) { const [attr, val] = cond.slice(5).split("="); keep = child.getAttribute(attr) === val; }
            else if (cond.startsWith("not:")) {
                const inner = cond.slice(4);
                if (inner.startsWith("text:")) keep = !child.textContent.toLowerCase().includes(inner.slice(5).toLowerCase());
                else if (inner.startsWith("attr:")) { const [attr, val] = inner.slice(5).split("="); keep = !(child.getAttribute(attr) === val); }
            }
            (keep ? matches : nonMatches).push(child);
        });
        el.replaceChildren();
        const g1 = document.createElement("div"); g1.setAttribute("data-partition", "matches"); matches.forEach(c => g1.appendChild(c));
        const g2 = document.createElement("div"); g2.setAttribute("data-partition", "non-matches"); nonMatches.forEach(c => g2.appendChild(c));
        el.appendChild(g1); el.appendChild(g2);
    });
    break;

case "flatten":
    els.forEach(el => {
        Array.from(el.children).forEach(child => {
            if (child.children.length > 0) {
                Array.from(child.children).forEach(gc => el.insertBefore(gc, child));
                child.remove();
            }
        });
    });
    break;

case "nest":
    els.forEach(el => {
        const wrapperTag = op.tag || "div";
        const levels = op.levels || 1;
        let outer = document.createElement(wrapperTag);
        let current = outer;
        for (let i = 1; i < levels; i++) { const newWrap = document.createElement(wrapperTag); current.appendChild(newWrap); current = newWrap; }
        while (el.firstChild) current.appendChild(el.firstChild);
        el.appendChild(outer);
    });
    break;

case "split":
    els.forEach(el => {
        const size = op.size || 2;
        const children = Array.from(el.children);
        el.replaceChildren();
        for (let i = 0; i < children.length; i += size) {
            const group = document.createElement("div");
            group.setAttribute("data-chunk", String(Math.floor(i / size) + 1));
            children.slice(i, i + size).forEach(c => group.appendChild(c));
            el.appendChild(group);
        }
    });
    break;

case "slice":
    els.forEach(el => {
        const children = Array.from(el.children);
        const sliced = (typeof op.finish === "number") ? children.slice(op.start, op.finish) : children.slice(op.start || 0);
        el.replaceChildren();
        sliced.forEach(c => el.appendChild(c));
    });
    break;

case "splice":
    els.forEach(el => {
        const children = Array.from(el.children);
        const start = Math.max(0, op.start || 0);
        const deleteCount = Math.max(0, op.deleteCount || 0);
        const toRemove = children.slice(start, start + deleteCount);
        toRemove.forEach(c => c.remove());
        if (op.value) {
            const resolvedValue = resolveTemplate(op.value, ctx);
            const referenceNode = el.children[start] || null;
            if (referenceNode) referenceNode.insertAdjacentHTML("beforebegin", resolvedValue);
            else el.insertAdjacentHTML("beforeend", resolvedValue);
        }
    });
    break;

/* ---------- push/pop/unshift/shift ---------- */
case "push":
    els.forEach(el => el.insertAdjacentHTML("beforeend", resolveTemplate(op.value, ctx)));
    break;
case "pop":
    els.forEach(el => { if (el.lastElementChild) el.lastElementChild.remove(); });
    break;
case "unshift":
    els.forEach(el => el.insertAdjacentHTML("afterbegin", resolveTemplate(op.value, ctx)));
    break;
case "shift":
    els.forEach(el => { if (el.firstElementChild) el.firstElementChild.remove(); });
    break;

/* ---------- concat / zip / zipWith / cartesian / cartesianN ---------- */
case "concat": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length) break;
    const target = targetEls[0];
    elsA.forEach(container => Array.from(container.children).forEach(child => target.appendChild(child.cloneNode(true))));
    elsB.forEach(container => Array.from(container.children).forEach(child => target.appendChild(child.cloneNode(true))));
    break;
}

case "zip": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !elsA.length || !elsB.length) break;
    const childrenA = Array.from(elsA[0].children);
    const childrenB = Array.from(elsB[0].children);
    const len = Math.min(childrenA.length, childrenB.length);
    const target = targetEls[0];
    for (let i = 0; i < len; i++) {
        const wrapper = document.createElement("div"); wrapper.setAttribute("data-zip-index", i+1);
        wrapper.appendChild(childrenA[i].cloneNode(true));
        wrapper.appendChild(childrenB[i].cloneNode(true));
        target.appendChild(wrapper);
    }
    break;
}

case "zipWith": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !elsA.length || !elsB.length) break;
    const childrenA = Array.from(elsA[0].children);
    const childrenB = Array.from(elsB[0].children);
    const target = targetEls[0];
    const len = Math.min(childrenA.length, childrenB.length);
    for (let i = 0; i < len; i++) {
        const aHTML = childrenA[i].outerHTML;
        const bHTML = childrenB[i].outerHTML;
        let filled = op.template || "<div>{{a}} {{b}}</div>";
        filled = filled.replace(/{{a}}/g, aHTML).replace(/{{b}}/g, bHTML);
        target.insertAdjacentHTML("beforeend", filled);
    }
    break;
}

case "cartesian": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !elsA.length || !elsB.length) break;
    const childrenA = Array.from(elsA[0].children);
    const childrenB = Array.from(elsB[0].children);
    const target = targetEls[0];
    for (let i = 0; i < childrenA.length; i++) {
        for (let j = 0; j < childrenB.length; j++) {
            const aHTML = childrenA[i].outerHTML;
            const bHTML = childrenB[j].outerHTML;
            let filled = op.template || "<div>{{a}} × {{b}}</div>";
            filled = filled.replace(/{{a}}/g, aHTML).replace(/{{b}}/g, bHTML);
            target.insertAdjacentHTML("beforeend", filled);
        }
    }
    break;
}

case "cartesianN": {
    const selectorList = op.selectors || [];
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length) break;
    const allChildren = selectorList.map(sel => {
        const elsL = getElements(resolveTemplate(sel, ctx));
        return elsL.length ? Array.from(elsL[0].children) : [];
    });
    if (allChildren.some(arr => arr.length === 0)) break;
    const target = targetEls[0];
    (function buildCombination(level, current) {
        if (level === allChildren.length) {
            let filled = op.template || "<div>" + current.map((_, i) => `{{${i}}}`).join(" ") + "</div>";
            current.forEach((elHTML, idx) => { filled = filled.replace(new RegExp(`{{${idx}}}`, "g"), elHTML); });
            target.insertAdjacentHTML("beforeend", filled);
            return;
        }
        allChildren[level].forEach(child => buildCombination(level + 1, [...current, child.outerHTML]));
    })(0, []);
    break;
}

/* ---------- combinations / permutations / combinationsWithReplacement / permutationsWithReplacement / powerSet ---------- */
case "combinations": {
    const els = getElements(resolveTemplate(op.selector, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !els.length) break;
    const children = Array.from(els[0].children);
    const k = op.k || 2;
    const target = targetEls[0];
    (function combine(start, chosen) {
        if (chosen.length === k) {
            let filled = op.template || "<div>" + chosen.map((_, i) => `{{${i}}}`).join(" ") + "</div>";
            chosen.forEach((html, idx) => { filled = filled.replace(new RegExp(`{{${idx}}}`, "g"), html); });
            target.insertAdjacentHTML("beforeend", filled);
            return;
        }
        for (let i = start; i < children.length; i++) combine(i + 1, [...chosen, children[i].outerHTML]);
    })(0, []);
    break;
}

case "permutations": {
    const els = getElements(resolveTemplate(op.selector, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !els.length) break;
    const children = Array.from(els[0].children);
    const k = op.k || children.length;
    const target = targetEls[0];
    (function permute(available, chosen) {
        if (chosen.length === k) {
            let filled = op.template || "<div>" + chosen.map((_, i) => `{{${i}}}`).join(" ") + "</div>";
            chosen.forEach((html, idx) => { filled = filled.replace(new RegExp(`{{${idx}}}`, "g"), html); });
            target.insertAdjacentHTML("beforeend", filled);
            return;
        }
        for (let i = 0; i < available.length; i++) {
            const next = available[i];
            const rest = [...available.slice(0, i), ...available.slice(i + 1)];
            permute(rest, [...chosen, next.outerHTML]);
        }
    })(Array.from(children), []);
    break;
}

case "combinationsWithReplacement": {
    const els = getElements(resolveTemplate(op.selector, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !els.length) break;
    const children = Array.from(els[0].children);
    const n = children.length;
    const k = op.k || 2;
    const target = targetEls[0];
    (function generate(start, chosen) {
        if (chosen.length === k) {
            let filled = op.template || "<div>" + chosen.map((_, i) => `{{${i}}}`).join(" ") + "</div>";
            chosen.forEach((html, idx) => { filled = filled.replace(new RegExp(`{{${idx}}}`, "g"), html); });
            target.insertAdjacentHTML("beforeend", filled);
            return;
        }
        for (let i = start; i < n; i++) generate(i, [...chosen, children[i].outerHTML]);
    })(0, []);
    break;
}

case "permutationsWithReplacement": {
    const els = getElements(resolveTemplate(op.selector, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length || !els.length) break;
    const children = Array.from(els[0].children);
    const n = children.length;
    const k = op.k || 2;
    const target = targetEls[0];
    (function generate(chosen) {
        if (chosen.length === k) {
            let filled = op.template || "<div>" + chosen.map((_, i) => `{{${i}}}`).join(" ") + "</div>";
            chosen.forEach((html, idx) => { filled = filled.replace(new RegExp(`{{${idx}}}`, "g"), html); });
            target.insertAdjacentHTML("beforeend", filled);
            return;
        }
        for (let i = 0; i < n; i++) generate([...chosen, children[i].outerHTML]);
    })([]);
    break;
}

case "powerSet": {
    const els = getElements(resolveTemplate(op.selector, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!(els.length && targetEls.length)) break;
    const target = targetEls[0];
    const keyMode = op.key || "outerHTML";
    const children = Array.from(els[0].children);
    const n = children.length;
    if (n > 15) { console.warn(`powerSet aborted: too many elements (n=${n})`); break; }
    target.innerHTML = "";
    const total = 1 << n;
    for (let mask = 0; mask < total; mask++) {
        const ul = document.createElement("ul");
        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                const li = document.createElement("li");
                li.appendChild(children[i].cloneNode(true));
                ul.appendChild(li);
            }
        }
        target.appendChild(ul);
    }
    break;
}

/* ---------- deduplicate / intersect / union / difference / symmetricDifference / relativeComplement ---------- */
case "deduplicate": {
    const elsList = getElements(resolveTemplate(op.selector, ctx));
    if (!elsList.length) break;
    const el = elsList[0];
    const keyMode = op.key || "outerHTML";
    const seen = new Set();
    Array.from(el.children).forEach(child => {
        const key = __clientOp_getKey(child, keyMode);
        if (seen.has(key)) child.remove(); else seen.add(key);
    });
    break;
}

case "intersect": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!(elsA.length && elsB.length && targetEls.length)) break;
    const keyMode = op.key || "outerHTML";
    const setB = new Set(Array.from(elsB[0].children).map(c => __clientOp_getKey(c, keyMode)));
    const target = targetEls[0];
    Array.from(elsA[0].children).forEach(child => { if (setB.has(__clientOp_getKey(child, keyMode))) target.appendChild(child.cloneNode(true)); });
    break;
}

case "union": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!targetEls.length) break;
    const keyMode = op.key || "outerHTML";
    const seen = new Set();
    const target = targetEls[0];
    function addChildrenFrom(sourceEls) {
        if (!sourceEls.length) return;
        Array.from(sourceEls[0].children).forEach(child => {
            const key = __clientOp_getKey(child, keyMode);
            if (!seen.has(key)) { seen.add(key); target.appendChild(child.cloneNode(true)); }
        });
    }
    addChildrenFrom(elsA); addChildrenFrom(elsB);
    break;
}

case "difference": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!(elsA.length && elsB.length && targetEls.length)) break;
    const keyMode = op.key || "outerHTML";
    const setB = new Set(Array.from(elsB[0].children).map(c => __clientOp_getKey(c, keyMode)));
    const target = targetEls[0];
    Array.from(elsA[0].children).forEach(child => { if (!setB.has(__clientOp_getKey(child, keyMode))) target.appendChild(child.cloneNode(true)); });
    break;
}

case "relativeComplement": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!(elsA.length && elsB.length && targetEls.length)) break;
    const keyMode = op.key || "outerHTML";
    const setA = new Set(Array.from(elsA[0].children).map(c => __clientOp_getKey(c, keyMode)));
    const target = targetEls[0];
    Array.from(elsB[0].children).forEach(child => { if (!setA.has(__clientOp_getKey(child, keyMode))) target.appendChild(child.cloneNode(true)); });
    break;
}

case "symmetricDifference": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    const targetEls = getElements(resolveTemplate(op.target, ctx));
    if (!(elsA.length && elsB.length && targetEls.length)) break;
    const keyMode = op.key || "outerHTML";
    const setA = new Map(Array.from(elsA[0].children).map(c => [__clientOp_getKey(c, keyMode), c]));
    const setB = new Map(Array.from(elsB[0].children).map(c => [__clientOp_getKey(c, keyMode), c]));
    const target = targetEls[0];
    setA.forEach((ch, key) => { if (!setB.has(key)) target.appendChild(ch.cloneNode(true)); });
    setB.forEach((ch, key) => { if (!setA.has(key)) target.appendChild(ch.cloneNode(true)); });
    break;
}

/* ---------- boolean checks: isSubset / isSuperset / isDisjoint / isEqual / cardinality ---------- */
case "isSubset": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    if (!(elsA.length && elsB.length)) return false;
    const keyMode = op.key || "outerHTML";
    const setB = new Set(Array.from(elsB[0].children).map(c => __clientOp_getKey(c, keyMode)));
    return Array.from(elsA[0].children).every(ch => setB.has(__clientOp_getKey(ch, keyMode)));
}

case "isSuperset": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    if (!(elsA.length && elsB.length)) return false;
    const keyMode = op.key || "outerHTML";
    const setA = new Set(Array.from(elsA[0].children).map(c => __clientOp_getKey(c, keyMode)));
    return Array.from(elsB[0].children).every(ch => setA.has(__clientOp_getKey(ch, keyMode)));
}

case "isDisjoint": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    if (!(elsA.length && elsB.length)) return true;
    const keyMode = op.key || "outerHTML";
    const setA = new Set(Array.from(elsA[0].children).map(c => __clientOp_getKey(c, keyMode)));
    return Array.from(elsB[0].children).every(ch => !setA.has(__clientOp_getKey(ch, keyMode)));
}

case "isEqual": {
    const elsA = getElements(resolveTemplate(op.a, ctx));
    const elsB = getElements(resolveTemplate(op.b, ctx));
    if (!(elsA.length && elsB.length)) return false;
    const keyMode = op.key || "outerHTML";
    const setA = new Set(Array.from(elsA[0].children).map(c => __clientOp_getKey(c, keyMode)));
    const setB = new Set(Array.from(elsB[0].children).map(c => __clientOp_getKey(c, keyMode)));
    return setA.size === setB.size && [...setA].every(k => setB.has(k));
}

case "cardinality": {
    const elsList = getElements(resolveTemplate(op.selector, ctx));
    if (!elsList.length) return 0;
    const el = elsList[0];
    const keyMode = op.key || "outerHTML";
    const set = new Set(Array.from(el.children).map(c => __clientOp_getKey(c, keyMode)));
    return set.size;
}



            // ===== Console Logging =====
            case "console": {
                
                const message = typeof op.message === 'object' ? 
                            await execClientOp(op.message, ctx) : 
                            resolveTemplate(op.message, ctx);                console.log("console message : ", message, op)
                switch (op.level) {
                    case "error": console.error(message); break;
                    case "warn": console.warn(message); break;
                    case "info": console.info(message); break;
                    case "debug": console.debug(message); break;
                    default: console.debug(message);
                }
                break;
            }

            default:
                console.warn("Unknown client operation:", op);
        }
    }

    // Expose globally
    window.__clientOp__ = execClientOp;
    
    // Auto-enable debug if URL has debug parameter
    if (window.location.search.includes('debug=clientops')) {
        window.__enableClientOpsDebug__(true);
    }
})();