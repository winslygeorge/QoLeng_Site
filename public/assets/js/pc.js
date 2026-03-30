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