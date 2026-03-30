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

        // 2. Handle browser back/forward - SIMPLIFIED: ALWAYS FORCE REFRESH
        window.addEventListener('popstate', () => {
            const path = window.location.pathname + window.location.search;
            routerLog("HISTORY", "Popstate event - FORCING REFRESH", { path });
            
            // Always force refresh for back/forward navigation
            this.handleNavigation(path, false, true);
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
            this.routeRegistry[path] = { componentKey, ...options };
        };

        // 5. Expose router
        window.router = this;

        // 6. Initial route
        const initialPath = window.location.pathname + window.location.search;
        routerLog("INIT", "Initial route detected", { initialPath });

        setTimeout(() => {
            this.handleNavigation(initialPath, false, true); // Force refresh on initial load too
        }, 100);

        this.isInitialized = true;
        routerLog("INIT", "SPA Router initialized ✅");
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
        // Wait until routes are registered
        while (Object.keys(this.routeRegistry).length === 0) {
            routerLog("MATCH", "Waiting for routes to be registered...");
            await sleep(100);
        }

        routerLog("MATCH", "Routes registered, proceeding with match", { url });

        const [path, queryString] = url.split('?');
        const queryParams = {};

        if (queryString) {
            queryString.split('&').forEach(pair => {
                const [k, v] = pair.split('=');
                queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
            });
        }

        // ========================
        // Exact match
        // ========================
        for (const routePath in this.routeRegistry) {
            if (routePath === path) {
                routerLog("MATCH", "Exact match found", routePath);

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
                const match = path.match(regex);

                if (match) {
                    const params = {};
                    keys.forEach((k, i) => params[k] = match[i + 1]);

                    routerLog("MATCH", "Pattern match found", { routePath, params });

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

        routerLog("MATCH", "No route matched ❌");
        return { matched: false };
    },

    // ========================
    // Navigation handler - SIMPLIFIED
    // ========================
    handleNavigation: async function (fullPath, pushState = true, forceRefresh = false) {
        routerLog("NAVIGATION", "Handling navigation", { 
            fullPath, 
            pushState, 
            forceRefresh,
            currentRoute: this.currentRoute 
        });

        this.emit('before-navigate', { path: fullPath, from: this.currentRoute, forceRefresh });

        const match = await this.matchRoute(fullPath);

        console.log("match is", match);

        if (!match.matched) {
            routerLog("ERROR", "Route not found", fullPath);
            this.emit('route-error', { path: fullPath, error: 'Route not found' });

            if (window.__DEFAULT_ROUTE__) {
                routerLog("FALLBACK", "Redirecting to default route");
                this.navigate(window.__DEFAULT_ROUTE__, { replace: true });
            }
            return;
        }

        if (pushState && location.pathname + location.search !== fullPath) {
            routerLog("HISTORY", "Pushing history state", fullPath);
            history.pushState({}, '', fullPath);
        }

        this.currentRoute = match.path;
        this.currentParams = match.params;
        this.currentQuery = match.query;

        routerLog("STATE", "Router state updated", {
            route: this.currentRoute,
            params: this.currentParams,
            query: this.currentQuery
        });

        // ALWAYS request fresh content from server (no cache)
        this.loadRouteComponent(match.componentKey, {
            routeParams: match.params,
            queryParams: match.query,
            path: fullPath,
            routeConfig: match.options.meta || {},
            forceRefresh: true // Always force refresh
        });

        if (match.options.title) {
            document.title = match.options.title;
            routerLog("META", "Document title set", match.options.title);
        }

        setTimeout(() => {
            this.emit('after-navigate', { ...match, forceRefresh: true });
            routerLog("EVENT", "after-navigate emitted", { ...match, forceRefresh: true });
        }, 50);
    },

    // ========================
    // Load component - ALWAYS FRESH
    // ========================
    loadRouteComponent: function (componentKey, props = {}) {
        routerLog("COMPONENT", "Loading component - NO CACHE", { componentKey, props });

        // NEVER use cache - always request from server
        if (window.sendPatch) {
            routerLog("PATCH", "Requesting FRESH component from server", { 
                componentKey, 
                forceRefresh: true 
            });
            window.sendPatch('routeManager', 'loadRoute', {
                componentKey,
                props,
                forceRefresh: true // Always tell server to send fresh content
            });
        } else {
            routerLog("ERROR", "sendPatch not available ❌");
        }
    },

    // ========================
    // Render component
    // ========================
    renderComponent: function (componentKey, props, html = null) {
        routerLog("RENDER", "Rendering component", { componentKey, props });

        const container = document.getElementById('route-manager-container');
        if (!container) {
            routerLog("ERROR", "Route container not found ❌");
            return;
        }

        container.innerHTML = '';

        if (html) {
            routerLog("RENDER", "Injecting HTML from server");
            container.innerHTML = html;

            if (window.__initializeReactiveInputs__) {
                setTimeout(() => {
                    routerLog("REACTIVE", "Initializing reactive inputs");
                    window.__initializeReactiveInputs__();
                }, 10);
            }
        }

        // Still store component for reference, but we won't use it from cache
        this.routeComponents[componentKey] = {
            props,
            renderedAt: Date.now()
        };

        this.emit('route-loaded', { componentKey, props });
        routerLog("EVENT", "route-loaded emitted", componentKey);

        window.scrollTo(0, 0);
    },

    // ========================
    // Programmatic navigation
    // ========================
    navigate: function (path, options = {}) {
        options = { trigger: true, replace: false, ...options };
        const fullPath = path.startsWith('/') ? path : '/' + path;

        routerLog("NAVIGATE", "navigate()", { fullPath, options });

        if (options.replace) {
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
        this.events[event]?.push(callback);
    },

    off: function (event, callback) {
        const list = this.events[event];
        if (!list) return;
        const i = list.indexOf(callback);
        if (i > -1) list.splice(i, 1);
    },

    emit: function (event, data) {
        routerLog("EVENT", "Emitting event", { event, data });
        (this.events[event] || []).forEach(cb => {
            try { cb(data); } catch (e) {
                routerLog("ERROR", "Event handler error", e);
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
            query: this.currentQuery
        };
    },

    reload: function () {
        routerLog("RELOAD", "Reloading current route");
        if (this.currentRoute) {
            this.handleNavigation(location.pathname + location.search, false, true);
        }
    }
};

// ========================
// Bootstrap
// ========================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.__SPA_ROUTER__.init();
    });
} else {
    window.__SPA_ROUTER__.init();
}

window.router = window.__SPA_ROUTER__;