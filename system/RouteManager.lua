-- RouteManager.lua - Optimized Enhanced Navigation management system
local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")
local cjson = require("dkjson")
local try = require("utils.try")

local RouteManager = FunctionalComponent:extends()
RouteManager:setReactiveView()

-- RouteManager.lua - Client-Side SPA Routing

-- -----------------------
-- Private State
-- -----------------------
RouteManager.routeRegistry = {}
RouteManager.defaultRoute = nil
RouteManager.currentRoute = nil
RouteManager.currentParams = {}
RouteManager.currentBrowserRouteUrl = nil
RouteManager.clientRouterInitialized = false

-- -----------------------
-- Public API / Methods
-- -----------------------
function RouteManager.generateRouteId(routeName)
    return "route_" .. routeName
end

function RouteManager.registerRoute(name, routeComponent, options, ws_id)
    options = options or {}
    local path = options.path or ("/" .. name:lower())

    local pattern = nil
    if path:match(":") then
        pattern = path
    end

    RouteManager.routeRegistry[name] = {
        component = routeComponent,
        path = path,
        pattern = pattern,
        title = options.title or name,
        defaultRoute = options.defaultRoute or false,
        meta = options.meta or {},
        requiresAuth = options.requiresAuth or false
    }

    if options.defaultRoute then
        RouteManager.defaultRoute = name
    end

    -- send route to client for immediate registration if ws_id provided
    if ws_id then
        local ops = HTML.client.batch(
            HTML.client.callModuleFn("window", "__registerRoute", {
                path,
                routeComponent.component_key or RouteManager.generateRouteId(name),
                {
                    title = options.title or name,
                    meta = options.meta or {},
                    requiresAuth = options.requiresAuth or false,
                    defaultRoute = options.defaultRoute or false
                }
            })
        )
        RouteManager:sendHTMLClientOperations(ws_id, ops)
    end

    return name
end

function RouteManager.setCurrentBrowserRouteUrl(url)
    RouteManager.currentBrowserRouteUrl = url
end


-- -----------------------
-- Server-Side Route Handling
-- -----------------------
function RouteManager.methods.registerClientRoutes(self, ws_id, args)
    -- Send all registered routes to client
    for name, routeInfo in pairs(RouteManager.routeRegistry) do
        local ops = HTML.client.batch(
            HTML.client.callModuleFn("window", "__registerRoute", {
                routeInfo.path,
                routeInfo.component.component_key or RouteManager.generateRouteId(name),
                {
                    title = routeInfo.title,
                    meta = routeInfo.meta,
                    requiresAuth = routeInfo.requiresAuth,
                    defaultRoute = routeInfo.defaultRoute
                }
            })
        )
        self:sendHTMLClientOperations(ws_id, ops)
    end
    
    -- Set default route if exists
    if RouteManager.defaultRoute then
        local defaultInfo = RouteManager.routeRegistry[RouteManager.defaultRoute]
        if defaultInfo then
            local ops = HTML.client.batch(
                HTML.client.callModuleFn("window", "__DEFAULT_ROUTE__", "set", { defaultInfo.path })
            )
            self:sendHTMLClientOperations(ws_id, ops)
        end
    end
end

function RouteManager.methods.loadRoute(self, ws_id, args)
    print("[RouteManager][loadRoute] START")
    print("[RouteManager][loadRoute] ws_id:", ws_id)
    print("[RouteManager][loadRoute] args:", args)

    local componentKey = args.componentKey
    local props = args.props or {}

    print("[RouteManager][loadRoute] componentKey:", componentKey)
    print("[RouteManager][loadRoute] initial props:", props)

    -- ========================
    -- Find the route component
    -- ========================
    print("[RouteManager][loadRoute] Searching routeRegistry for component...")

    local routeComponent = nil
    local routeName = nil

    for name, routeInfo in pairs(RouteManager.routeRegistry) do
        local rid = routeInfo.component.component_key
            or RouteManager.generateRouteId(name)

        print("[RouteManager][loadRoute] Checking route:", name, "-> rid:", rid)

        if rid == componentKey then
            routeComponent = routeInfo.component
            routeName = name
            print("[RouteManager][loadRoute] MATCH FOUND:", routeName)
            break
        end
    end

    -- ========================
    -- Component not found
    -- ========================
    if not routeComponent then
        print("[RouteManager][loadRoute][ERROR] Component not found for key:", componentKey)

        local ops = HTML.client.batch(
            HTML.client.callModuleFn("window", "__SPA_ROUTER__.emit", {
                "route-error",
                {
                    componentKey = componentKey,
                    error = "Component not found"
                }
            })
        )

        print("[RouteManager][loadRoute] Sending route-error to client")
        self:sendHTMLClientOperations(ws_id, ops)

        print("[RouteManager][loadRoute] END (component not found)")
        return
    end

    -- ========================
    -- Update component props
    -- ========================
    props.routeId = RouteManager.generateRouteId(routeName)
    props.routeConfig = RouteManager.routeRegistry[routeName].meta or {}

    print("[RouteManager][loadRoute] Updated props:")
    print("  routeId:", props.routeId)
    print("  routeConfig:", props.routeConfig)

    routeComponent:updateProps(props)
    print("[RouteManager][loadRoute] routeComponent:updateProps() called")

    -- ========================
    -- Load component if needed
    -- ========================
        print("[RouteManager][loadRoute] Component not loaded → loading")
        routeComponent:load()
        print("[RouteManager][loadRoute] Component loaded")


    -- ========================
    -- Mount component
    -- ========================
    print("[RouteManager][loadRoute] Mounting component...")

    local routeHtmlOutput = HTML.render(routeComponent:build())


    print("[RouteManager][loadRoute] Mount result:", routeHtmlOutput ~= nil)


    -- ========================
    -- Notify client router
    -- ========================
    print("[RouteManager][loadRoute] Notifying client router to render component")

    local ops = HTML.client.batch(
        HTML.client.callModuleFn("window", "__SPA_ROUTER__.renderComponent", {
            componentKey,
            props,
            routeHtmlOutput
        })
    )

    self:sendHTMLClientOperations(ws_id, ops)

       -- Load client state from Redis
        local clientState = self:getRedisClientState(routeComponent.client_token or ws_id, componentKey)
        print("Route:", routeName, "Client State:", cjson.encode(clientState))
        print("calling setClientState for route:", routeName, "from WEBAPP onclientready  with key:", componentKey)
        -- Set client state using the new function syntax
            for k, v in pairs(clientState) do
                    local result = self:setClientState(ws_id, {
                        _operation = HTML.CRUD_OPERATIONS.SET,  -- Use APPEND operation
                        _target = "cs."..k,                         -- Target path (no "cs." prefix needed)
                        _data = v,                           -- The task to append
                    })
            end
        
    --     -- Load component state from Redis
        local compState = self:getRedisComponentState(componentKey)
        print("Route:", routeName, "Component State:", cjson.encode(compState))
        for k, v in pairs(compState) do

        self:setState({
            _operation = HTML.CRUD_OPERATIONS.SET,
            _target = k,
            _data = v
        })
        end

    print("[RouteManager][loadRoute] END (success)")
end
-- -----------------------

function RouteManager.methods.handleClientNavigation(self, ws_id, args)
    -- This handles navigation requests from the client
    local path = args.path
    local options = args.options or {}
    
    if not path then
        return
    end
    
    -- Let the client router handle it completely
    local ops = HTML.client.batch(
        HTML.client.callModuleFn("window", "__SPA_ROUTER__.navigate", { path, options })
    )
    self:sendHTMLClientOperations(ws_id, ops)
end

-- -----------------------
-- Browser Navigation Initialization
-- -----------------------
function RouteManager.methods.initializeBrowserNavigation(self, ws_id, args)
    -- Register routes with client
    self:registerClientRoutes(ws_id, args)
    
    -- Setup popstate handler
    local ops = HTML.client.batch(
        HTML.client.callModuleFn("window", "addEventListener", {
            "popstate", 
            HTML.handler("handleClientNavigation", ws_id, {
                path = "__LOCATION_PATHNAME__ + __LOCATION_SEARCH__",
                options = { trigger = true }
            })
        })
    )
    
    -- Get current URL and trigger initial navigation
    local getUrlOps = HTML.client.batch(
        HTML.client.callModuleFn("window", "location", {"href"}, "get", 
            HTML.handler("handleClientNavigation", ws_id, {
                path = "__VALUE__.replace(__ORIGIN__, '')",
                options = { trigger = true, replace = true }
            })
        )
    )
    
    self:sendHTMLClientOperations(ws_id, ops)
    self:sendHTMLClientOperations(ws_id, getUrlOps)
end

-- -----------------------
-- Render and Initialization
-- -----------------------
function RouteManager:renderLayout(state, props, children, H)
    -- Render an empty container - client router will populate it
    return HTML.e("div", {
        id = "route-manager-container",
        class = "route-manager",
        style = "position: relative; width: 100%; height: 100%; min-height: 100vh;"
    }, {
        -- Loading indicator (will be replaced by route content)
        HTML.e("div", {
            id = "route-loading",
            style = "display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
        }, "Loading...")
    })
end

function RouteManager:startInit()
    self:init(function(server, children, props, style, H)
        return function(state, props, children, H)
            return self:renderLayout(state, props, children, H)
        end
    end)
end

function RouteManager:load()
    -- Setup WebSocket event handlers
    -- self:registerEventHandler("client_navigate", "handleClientNavigation")
    -- self:registerEventHandler("load_route", "loadRoute")
    
    -- Initialize route components (but don't mount them yet)
    for name, routeInfo in pairs(RouteManager.routeRegistry) do
        local rid = routeInfo.component.component_key or RouteManager.generateRouteId(name)
        routeInfo.routeId = rid
        
        -- Pre-initialize component with basic props
        local component = routeInfo.component
        if component then
            component:updateProps({
                routeId = rid,
                routeConfig = routeInfo.meta or {}
            })
            
            -- Load but don't mount
            component:load()

            print("[RouteManager] Pre-initialized route component:", name, "->", rid)
            
            -- Register as child component
            self:addChildComponent(rid, component)
            self:setComponentKey(rid)
        end
    end
    
    self:startInit()
end

-- -----------------------
-- WebSocket Connection Handler
-- -----------------------
function RouteManager.methods.initializeWebSocket(self, ws_id, args)
    -- Setup complete client-side routing system
    self:initializeBrowserNavigation(ws_id, args)
end

return RouteManager
