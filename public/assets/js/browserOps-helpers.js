// browserOps-helpers.js
const debounceTimers = {};
const throttleLocks = {};

// Global client variable store
window._clientVars = window._clientVars || {};

// Helper function to get element key for set operations
function __clientOp_getKey(element, mode = "outerHTML") {
    switch (mode) {
        case "text": return element.textContent.trim();
        case "html": return element.innerHTML.trim();
        case "id": return element.id;
        case "className": return element.className;
        case "tagName": return element.tagName;
        case "outerHTML": 
        default: return element.outerHTML;
    }
}

function resolveModule(op, loadedModules) {
    if (op.module) {
        return (
            loadedModules[op.module] ||
            (typeof window !== "undefined" && window[op.module]) ||
            (typeof globalThis !== "undefined" && globalThis[op.module]) ||
            null
        );
    }
    return typeof window !== "undefined" ? window : globalThis;
}

// browserOps-helpers.js - Improved resolvePath function for ALL nested paths
function resolvePath(base, path) {
    const parts = path.split(".");
    let ctx = base;
    let target = base;
    
    // Handle empty path
    if (parts.length === 0) {
        return { ctx: base, target: base, key: '' };
    }
    
    for (let i = 0; i < parts.length; i++) {
        if (target == null || target === undefined) {
            return { ctx, target: undefined, key: parts[i] };
        }
        
        // Store the context before moving to the next part
        ctx = target;
        target = target[parts[i]];
        
        if (i === parts.length - 1) {
            return { ctx, target, key: parts[i] };
        }
    }
    return { ctx, target, key: parts[parts.length - 1] };
}

async function resolveArgs(args, ctx) {
    const out = [];
    for (const arg of args || []) {
        if (typeof arg === "object" && (arg._op || arg._ops || arg._handler)) {
            out.push(await window.__clientOps__(arg, ctx));
        } else if (typeof arg === "object") {
            out.push(await resolveNestedOps(arg, "callModuleFn.arg", ctx));
        } else {
            out.push(resolveTemplate(arg, ctx));
        }
    }
    return out;
}

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
            return await window.__clientOps__(obj, ctx);
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
    let left = typeof cond.left === "object" ? await window.__clientOps__(cond.left, ctx) : cond.left;
    let right = typeof cond.right === "object" ? await window.__clientOps__(cond.right, ctx) : cond.right;
    
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

// Export helpers for use in browserOps.js
window.__clientOpsHelpers = {
    __clientOp_getKey,
    resolveModule,
    resolvePath,
    resolveArgs,
    resolveTemplate,
    resolveNestedOps,
    evalCondition,
    getElements,
    debounceTimers,
    throttleLocks
};