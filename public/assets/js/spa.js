// ========================
// SPA Router Debug Helper
// ========================
window.__SPA_ROUTER_DEBUG__ = true; // 🔥 toggle debug on/off
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function routerLog(step, message, data) {
    if (!window.__SPA_ROUTER_DEBUG__) return;

    const prefix = `%c[SPA-ROUTER] %c${step}`;
    const styles = [
        "color:#60a5fa;font-weight:bold;",
        "color:#22c55e;font-weight:bold;"
    ];

    if (data !== undefined) {
        console.groupCollapsed(prefix + " → " + message, ...styles);
        console.log(data);
        console.groupEnd();
    } else {
        console.log(prefix + " → " + message, ...styles);
    }
}

// ========================
// Client-Side SPA Router
// ========================
window.__SPA_ROUTER__ = {
    // Router state
    currentRoute: null,
    currentParams: {},
    currentQuery: {},
    routeComponents: {},
    routeRegistry: {},
    isInitialized: false,

    // Event system
    events: {
        'before-navigate': [],
        'after-navigate': [],
        'route-loaded': [],
        'route-error': []
    },

    // ========================
    // Initialize router
    // ========================
    init: function () {
        if (this.isInitialized) {
            routerLog("INIT", "Already initialized");
            return;
        }

        routerLog("INIT", "Initializing SPA Router");

        // 1. Intercept link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            routerLog("LINK", "Click detected", { link });

            if (
                link &&
                !link.target &&
                !link.hasAttribute('download') &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.shiftKey &&
                link.href &&
                link.href.startsWith(window.location.origin)
            ) {
                e.preventDefault();
                const path = link.href.substring(window.location.origin.length);
                routerLog("LINK", "Intercepted navigation", { path });
                this.navigate(path, { trigger: true });
            }
        });

        // 2. Handle browser back/forward
        window.addEventListener('popstate', async () => {
            const path = window.location.pathname + window.location.search;
            routerLog("HISTORY", "Popstate event", { path });
            
            // Wait for WebSocket connection if needed
            if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
                routerLog("HISTORY", "WebSocket not ready, waiting...");
                await this.waitForWebSocket();
            }
            
            this.handleNavigation(path, false, false);
        });

        // 3. Programmatic navigation
        window.__navigateTo = (path, options) => {
            routerLog("NAVIGATE", "Programmatic navigation", { path, options });
            this.navigate(path, options);
        };

        window.__navigateBack = () => {
            routerLog("NAVIGATE", "History back");
            history.back();
        };

        window.__navigateForward = () => {
            routerLog("NAVIGATE", "History forward");
            history.forward();
        };

        // 4. Register server routes
        window.__registerRoute = (path, componentKey, options = {}) => {
            routerLog("ROUTE", "Registering route", { path, componentKey, options });
            
            // Ensure path starts with /
            const normalizedPath = path.startsWith('/') ? path : '/' + path;
            
            this.routeRegistry[normalizedPath] = { 
                componentKey, 
                ...options 
            };
            
            routerLog("ROUTE", "Route registered", {
                path: normalizedPath,
                componentKey,
                totalRoutes: Object.keys(this.routeRegistry).length
            });
        };

        // 5. Expose router
        window.router = this;

        // 6. Initial route
        const initialPath = window.location.pathname + window.location.search;
        routerLog("INIT", "Initial route detected", { initialPath });

        // Wait for WebSocket before handling initial navigation
        setTimeout(async () => {
            routerLog("INIT", "Waiting for WebSocket connection...");
            await this.waitForWebSocket();
            routerLog("INIT", "WebSocket ready, handling initial navigation");
            this.handleNavigation(initialPath, false, true);
        }, 100);

        this.isInitialized = true;
        routerLog("INIT", "SPA Router initialized ✅");
    },

    // ========================
    // Wait for WebSocket connection
    // ========================
    waitForWebSocket: function () {
        return new Promise((resolve) => {
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    },

    // ========================
    // Pattern to Regex
    // ========================
    patternToRegex: function (pattern) {
        routerLog("PATTERN", "Converting pattern", pattern);

        const keys = [];
        const regexStr = '^' + pattern
            .replace(/\//g, '\\/')
            .replace(/:([\w-]+)/g, (_, key) => {
                keys.push(key);
                return '([^\\/]+)';
            }) + '$';

        const regex = new RegExp(regexStr);
        routerLog("PATTERN", "Generated regex", { regex, keys });

        return { regex, keys };
    },

    // ========================
    // Route matching
    // ========================
    matchRoute: async function (url) {
        // Clean up the URL
        let cleanUrl = url.split('?')[0];
        if (!cleanUrl.startsWith('/')) {
            cleanUrl = '/' + cleanUrl;
        }
        
        routerLog("MATCH", "Matching route for URL", { original: url, clean: cleanUrl });

        // Get query parameters
        const queryString = url.includes('?') ? url.split('?')[1] : '';
        const queryParams = {};
        
        if (queryString) {
            queryString.split('&').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k) {
                    queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
                }
            });
        }

        routerLog("MATCH", "Query parameters parsed", queryParams);

        // ========================
        // Exact match
        // ========================
        for (const routePath in this.routeRegistry) {
            if (routePath === cleanUrl) {
                routerLog("MATCH", "Exact match found", {
                    routePath,
                    componentKey: this.routeRegistry[routePath].componentKey
                });

                return {
                    matched: true,
                    path: routePath,
                    params: {},
                    query: queryParams,
                    componentKey: this.routeRegistry[routePath].componentKey,
                    options: this.routeRegistry[routePath]
                };
            }
        }

        // ========================
        // Pattern match
        // ========================
        for (const routePath in this.routeRegistry) {
            if (routePath.includes(':')) {
                const { regex, keys } = this.patternToRegex(routePath);
                const match = cleanUrl.match(regex);

                if (match) {
                    const params = {};
                    keys.forEach((k, i) => params[k] = match[i + 1]);

                    routerLog("MATCH", "Pattern match found", {
                        routePath,
                        params,
                        componentKey: this.routeRegistry[routePath].componentKey
                    });

                    return {
                        matched: true,
                        path: routePath,
                        params,
                        query: queryParams,
                        componentKey: this.routeRegistry[routePath].componentKey,
                        options: this.routeRegistry[routePath]
                    };
                }
            }
        }

        routerLog("MATCH", "No route matched ❌", { 
            availableRoutes: Object.keys(this.routeRegistry),
            requestedPath: cleanUrl
        });
        
        return { matched: false };
    },

    // ========================
    // Navigation handler
    // ========================
    handleNavigation: async function (fullPath, pushState = true, forceRefresh = false) {
        routerLog("NAVIGATION", "Handling navigation", { 
            fullPath, 
            pushState, 
            forceRefresh,
            currentRoute: this.currentRoute 
        });

        this.emit('before-navigate', { 
            path: fullPath, 
            from: this.currentRoute, 
            forceRefresh 
        });

        const match = await this.matchRoute(fullPath);

        routerLog("NAVIGATION", "Route match result", match);

        if (!match.matched) {
            routerLog("ERROR", "Route not found", fullPath);
            this.emit('route-error', { 
                path: fullPath, 
                error: 'Route not found' 
            });

            // Try default route
            if (window.__DEFAULT_ROUTE__) {
                routerLog("FALLBACK", "Redirecting to default route");
                this.navigate(window.__DEFAULT_ROUTE__, { replace: true });
            }
            return;
        }

        // Update browser history if needed
        if (pushState && location.pathname + location.search !== fullPath) {
            routerLog("HISTORY", "Pushing history state", fullPath);
            history.pushState({}, '', fullPath);
        }

        // Update router state
        this.currentRoute = match.path;
        this.currentParams = match.params;
        this.currentQuery = match.query;

        routerLog("STATE", "Router state updated", {
            route: this.currentRoute,
            params: this.currentParams,
            query: this.currentQuery
        });

        // Load the route component
        this.loadRouteComponent(match.componentKey, {
            routeParams: match.params,
            queryParams: match.query,
            path: fullPath,
            routeConfig: match.options.meta || {},
            forceRefresh: forceRefresh
        });

        // Update document title if specified
        if (match.options.title) {
            document.title = match.options.title;
            routerLog("META", "Document title set", match.options.title);
        }

        // Update meta tags if specified
        if (match.options.meta) {
            this.updateMetaTags(match.options.meta);
        }

        // Emit after-navigate event
        setTimeout(() => {
            this.emit('after-navigate', { 
                path: match.path,
                params: match.params,
                query: match.query,
                componentKey: match.componentKey,
                forceRefresh: forceRefresh
            });
            routerLog("EVENT", "after-navigate emitted", match);
        }, 50);
    },

    // ========================
    // Update meta tags
    // ========================
    updateMetaTags: function (meta) {
        if (!meta) return;
        
        // Update description
        if (meta.description) {
            let descTag = document.querySelector('meta[name="description"]');
            if (!descTag) {
                descTag = document.createElement('meta');
                descTag.name = 'description';
                document.head.appendChild(descTag);
            }
            descTag.content = meta.description;
        }
        
        // Update keywords
        if (meta.keywords) {
            let keywordsTag = document.querySelector('meta[name="keywords"]');
            if (!keywordsTag) {
                keywordsTag = document.createElement('meta');
                keywordsTag.name = 'keywords';
                document.head.appendChild(keywordsTag);
            }
            keywordsTag.content = meta.keywords;
        }
        
        // Update Open Graph tags
        if (meta.og) {
            Object.entries(meta.og).forEach(([key, value]) => {
                if (value) {
                    let ogTag = document.querySelector(`meta[property="og:${key}"]`);
                    if (!ogTag) {
                        ogTag = document.createElement('meta');
                        ogTag.setAttribute('property', `og:${key}`);
                        document.head.appendChild(ogTag);
                    }
                    ogTag.content = value;
                }
            });
        }
    },

    // ========================
    // Load component
    // ========================
    loadRouteComponent: function (componentKey, props = {}) {
        routerLog("COMPONENT", "Loading component", { 
            componentKey, 
            props,
            hasSendPatch: !!window.sendPatch 
        });

        if (window.sendPatch) {
            routerLog("PATCH", "Requesting component from server", { 
                componentKey, 
                forceRefresh: props.forceRefresh 
            });
            
            // Send patch request to server
            window.sendPatch('routeManager', 'loadRoute', {
                componentKey,
                props,
                forceRefresh: props.forceRefresh
            });
        } else {
            routerLog("ERROR", "sendPatch not available ❌");
            this.emit('route-error', { 
                componentKey, 
                error: 'sendPatch function not available' 
            });
        }
    },

    // ========================
    // Render component from patch
    // ========================
    renderComponent: function (componentKey, props, html = null) {
        routerLog("RENDER", "Rendering component from patch", { 
            componentKey, 
            props,
            hasHtml: !!html 
        });

        const container = document.getElementById('route-manager-container');
        if (!container) {
            routerLog("ERROR", "Route container not found ❌");
            this.emit('route-error', { 
                componentKey, 
                error: 'Route container not found' 
            });
            return;
        }

        // Clear container
        container.innerHTML = '';

        if (html) {
            routerLog("RENDER", "Injecting HTML from server", { 
                htmlLength: html.length 
            });
            
            // Parse and inject HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Inject the body content
            while (doc.body.firstChild) {
                container.appendChild(doc.body.firstChild);
            }
            
            // Initialize reactive components
            if (window.__initializeReactiveInputs__) {
                setTimeout(() => {
                    routerLog("REACTIVE", "Initializing reactive inputs");
                    window.__initializeReactiveInputs__();
                    
                    // Also apply any pending patches
                    if (window.PatchManager) {
                        window.PatchManager.flushNow();
                    }
                }, 50);
            }
        } else {
            routerLog("WARN", "No HTML provided for rendering");
        }

        // Store component info
        this.routeComponents[componentKey] = {
            props,
            renderedAt: Date.now(),
            html: html ? html.substring(0, 100) + '...' : null
        };

        this.emit('route-loaded', { 
            componentKey, 
            props,
            timestamp: Date.now()
        });
        
        routerLog("EVENT", "route-loaded emitted", componentKey);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Update URL in browser if needed (for hash links)
        if (window.location.hash) {
            const element = document.getElementById(window.location.hash.substring(1));
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    },

    // ========================
    // Programmatic navigation
    // ========================
    navigate: async function (path, options = {}) {
        options = { trigger: true, replace: false, ...options };
        const fullPath = path.startsWith('/') ? path : '/' + path;

        routerLog("NAVIGATE", "navigate() called", { 
            fullPath, 
            options,
            currentPath: window.location.pathname + window.location.search
        });

        // Wait for WebSocket if needed
        if (!window.ws || window.ws.readyState !== WebSocket.OPEN) {
            routerLog("NAVIGATE", "Waiting for WebSocket connection...");
            await this.waitForWebSocket();
        }

        if (options.replace) {
            routerLog("HISTORY", "Replacing history state", fullPath);
            history.replaceState({}, '', fullPath);
        }

        if (options.trigger) {
            this.handleNavigation(fullPath, !options.replace);
        }
    },

    // ========================
    // Events
    // ========================
    on: function (event, callback) {
        routerLog("EVENT", "Listener registered", event);
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return () => this.off(event, callback); // Return unsubscribe function
    },

    off: function (event, callback) {
        const list = this.events[event];
        if (!list) return;
        const i = list.indexOf(callback);
        if (i > -1) {
            list.splice(i, 1);
            routerLog("EVENT", "Listener removed", event);
        }
    },

    emit: function (event, data) {
        routerLog("EVENT", "Emitting event", { event, data });
        const listeners = this.events[event] || [];
        listeners.forEach(cb => {
            try { 
                cb(data); 
            } catch (e) {
                routerLog("ERROR", "Event handler error", { event, error: e });
            }
        });
    },

    // ========================
    // Utilities
    // ========================
    getCurrentRoute: function () {
        return {
            path: this.currentRoute,
            params: this.currentParams,
            query: this.currentQuery,
            fullPath: window.location.pathname + window.location.search
        };
    },

    reload: function () {
        routerLog("RELOAD", "Reloading current route");
        if (this.currentRoute) {
            const currentPath = window.location.pathname + window.location.search;
            this.handleNavigation(currentPath, false, true);
        }
    },

    // ========================
    // Route management
    // ========================
    registerRoute: function (path, componentKey, options = {}) {
        return window.__registerRoute(path, componentKey, options);
    },

    unregisterRoute: function (path) {
        if (this.routeRegistry[path]) {
            delete this.routeRegistry[path];
            routerLog("ROUTE", "Route unregistered", path);
            return true;
        }
        return false;
    },

    getRegisteredRoutes: function () {
        return Object.keys(this.routeRegistry).map(path => ({
            path,
            componentKey: this.routeRegistry[path].componentKey,
            options: this.routeRegistry[path]
        }));
    },

    // ========================
    // Navigation helpers
    // ========================
    go: function (delta) {
        routerLog("NAVIGATE", "History go", delta);
        history.go(delta);
    },

    generateUrl: function (path, params = {}, query = {}) {
        let url = path;
        
        // Replace path parameters
        Object.keys(params).forEach(key => {
            url = url.replace(`:${key}`, encodeURIComponent(params[key]));
        });
        
        // Add query parameters
        if (Object.keys(query).length > 0) {
            const queryString = Object.keys(query)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
                .join('&');
            url += '?' + queryString;
        }
        
        return url;
    },

    // ========================
    // Debug utilities
    // ========================
    debug: function () {
        console.group('🚀 SPA Router Debug');
        console.log('📊 Current State:');
        console.table({
            'Current Route': this.currentRoute,
            'Is Initialized': this.isInitialized,
            'Registered Routes': Object.keys(this.routeRegistry).length
        });
        
        console.log('🗺️ Registered Routes:');
        console.table(Object.entries(this.routeRegistry).map(([path, config]) => ({
            Path: path,
            Component: config.componentKey,
            Title: config.title || '(none)'
        })));
        
        console.log('🎯 Current Route Details:');
        console.table({
            'Path': this.currentRoute,
            'Parameters': JSON.stringify(this.currentParams),
            'Query': JSON.stringify(this.currentQuery)
        });
        
        console.log('🔌 WebSocket Status:', window.ws ? 
            `Connected (${window.ws.readyState === 1 ? 'OPEN' : 'CLOSED'})` : 
            'Not available');
        
        console.groupEnd();
    }
};

// ========================
// Bootstrap
// ========================
// Wait for all dependencies to be loaded
function initializeRouter() {
    // Check if patchClient helpers are loaded
    if (!window.__patchHelpers || !window.sendPatch) {
        routerLog("BOOTSTRAP", "Waiting for patchClient helpers...");
        setTimeout(initializeRouter, 100);
        return;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            routerLog("BOOTSTRAP", "DOM loaded, initializing router");
            window.__SPA_ROUTER__.init();
        });
    } else {
        routerLog("BOOTSTRAP", "DOM already loaded, initializing router");
        window.__SPA_ROUTER__.init();
    }
}

// Start initialization
initializeRouter();

// Global router reference
window.router = window.__SPA_ROUTER__;

// ========================
// Patch integration for route loading
// ========================
// Listen for route patches from server (compatibility layer)
if (window.__SPA_ROUTER__) {
    // Extend the router to handle patch-based updates
    window.__SPA_ROUTER__.handlePatch = function(patch) {
        routerLog("PATCH", "Handling route patch", patch);
        
        if (patch.type === 'load_route') {
            this.renderComponent(
                patch.componentKey,
                patch.props || {},
                patch.html || null
            );
        } else if (patch.type === 'navigate_to') {
            this.navigate(patch.path, patch.options || {});
        } else if (patch.type === 'route_error') {
            this.emit('route-error', {
                componentKey: patch.componentKey,
                error: patch.error
            });
        }
    };
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.__SPA_ROUTER__;
}