-- MainAppPage.lua with Enhanced Route Management
local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")
local cjson = require("dkjson")

-- Import pages
local HomePage = require("lib.components.home")
local StatePage = require("lib.components.state_doc")
local AboutPage = require("lib.components.about_page")

-- Import RouteManager
local RouteManager = require("system.RouteManager")

local MainAppPage = FunctionalComponent:extends()
MainAppPage:setReactiveView()

MainAppPage.routeUrl = ""

function MainAppPage:defineRoutes (parent_ws_id)
    RouteManager.registerRoute("home", HomePage, {
        path = "/app",
        title = "Home",
        defaultRoute = false
    }, parent_ws_id)

    RouteManager.registerRoute("state", StatePage, {
        path = "/app/state",
        title = "State",
        defaultRoute = true,
    }, parent_ws_id)

    RouteManager.registerRoute("about", AboutPage, {
        path = "/app/about",
        title = "About",
        defaultRoute = false,
    }, parent_ws_id)
end

MainAppPage:defineRoutes(nil)

function MainAppPage:setRouteToNavigateTo(url)
    MainAppPage.routeUrl = url
    RouteManager.setCurrentBrowserRouteUrl(url)
end

function MainAppPage:renderLayout(state, props, children, H, client_state)
    local parentKey = self:getParentKey()
    local componentKey = self:getComponentKey()

    return HTML.e("div", { class = "app-container" }, {
        HTML.Component("routeManager", {}),
        HTML.Component('modalManager', {})
    })
end

local function startInit()
    MainAppPage:init(function(server, children, props, style, HTMLReactive, collected_js_scripts, client_state)
        --====== METHODS ======
        MainAppPage.methods.navigateTo = function(self, ws_id, args)
            local routeManager = self:getChildComponent("routeManager")
            if routeManager then
                routeManager.methods.navigateTo(routeManager, ws_id, args)
            end
        end

        MainAppPage.methods.navigateBack = function(self, ws_id, args)
            local routeManager = self:getChildComponent("routeManager")
            if routeManager then
                routeManager.methods.navigateBack(routeManager, ws_id, args)
            end
        end

        MainAppPage.methods.navigateToCurrent = function(self, ws_id, args)
            local routeManager = self:getChildComponent("routeManager")
            if routeManager then
                routeManager.methods.navigateToCurrent(routeManager, ws_id, args)
            end
        end

        -- Method to show a prompt modal
        MainAppPage.methods.showPrompt = function(self, ws_id, args)
            self:callChildMethod("modalManager", "showModal", ws_id, args)
        end

        -- Method to show a prompt modal
        MainAppPage.methods.hidePrompt = function(self, ws_id, args)
            local modalId = args.modalId or nil
            self:callChildMethod("modalManager", "hideModal", ws_id, {modalId = modalId})
        end

        return function(state, props, children, H, client_state)
            return MainAppPage:renderLayout(state, props, children, H, client_state)
        end
    end)
end

MainAppPage:onClientReady(function (self, parent_ws_id, parent_client_token)
    MainAppPage:defineRoutes(parent_ws_id)
end)

function MainAppPage:render_layout()
    self:setComponentKey('mainAppPage')
    startInit()

    -- Add RouteManager as a child component
    self:addChildComponent("routeManager", RouteManager)
    RouteManager:load()

    local modalManager = require("system.ModalManager")
    self:addChildComponent('modalManager', modalManager)
    modalManager:load()

    -- -- Create the initial state for the app
    -- local initialState = {}
    
    -- -- You can add initial state here if needed
    -- -- initialState.someKey = "someValue"
    
    -- -- Update self.state with initialState if using setState function
    -- if next(initialState) ~= nil then
    --     self:setState(function(currentState)
    --         local merged = {}
    --         for k, v in pairs(currentState) do
    --             merged[k] = v
    --         end
    --         for k, v in pairs(initialState) do
    --             merged[k] = v
    --         end
    --         return merged
    --     end)
    -- end

    local final_html_vdom = self:renderAppPage({
        title = "Qoleng - Build Bold. Run Fast. Scale Wild.",
        state = self.state,
        head_extra = HTML.fragment({
            HTML.e("style", {}, [[
                .gradient-text {
                    background: linear-gradient(135deg, #0066FF, #00CC88, #8A2BE2);
                    background-size: 200% 200%;
                    animation: gradient 8s ease infinite;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                /* Smooth theme transitions */
                body, .theme-transition {
                    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
                }

                ]]),
            HTML.e("script", {}, string.format(
                "window.__DEFAULT_COMPONENT_KEY__ = %q;", 
                self.component_key or ""
            ))
        }),
        body_attrs = { class = "antialiased bg-[#FFFFFF]" }
    })
    
    return self.HTMLReactive.render(final_html_vdom)
end

return MainAppPage