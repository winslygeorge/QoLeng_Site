-- ModalManager.lua - Enhanced with advanced features and styling
local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")
local cjson = require("dkjson")
local try = require("utils.try")
local ModalManager = FunctionalComponent:extends()
ModalManager:setReactiveView()

function ModalManager:setOnClientReady()    
ModalManager:onClientReady(function (comp, parent_ws_id, parent_client_toke)
    local clientState = comp:getClientState(self._ws_id)
    print ("ModalManager client ready for WS ID: " .. tostring(parent_ws_id), cjson.encode(clientState))
end)
end

-- Modal registry to store all available modal types
ModalManager.modalRegistry = {}

-- Default modal styles and configuration
ModalManager.defaultConfig = {
    backdrop = true,
    backdropClose = true,
    escapeClose = true,
    animation = "fadeIn", -- fadeIn, slideUp, zoomIn, none
    animationDuration = 300, -- ms
    maxWidth = "600px",
    overlayClass = "modal-overlay",
    containerClass = "modal-container",
    contentClass = "modal-content",
    closeButton = true,
    closeButtonClass = "modal-close-btn",
    position = "center", -- center, top, bottom
    draggable = true, -- New: Enable dragging by default
    cascadeOffset = 20, -- New: Offset for cascading modals
    minZIndex = 1000, -- New: Starting z-index
    zIndexIncrement = 10 -- New: Increment for each new modal
}

-- Animation CSS classes
ModalManager.animations = {
    fadeIn = {
        enter = "modal-fade-in",
        leave = "modal-fade-out"
    },
    slideUp = {
        enter = "modal-slide-up",
        leave = "modal-slide-down"
    },
    zoomIn = {
        enter = "modal-zoom-in",
        leave = "modal-zoom-out"
    }
}

-- New: Dragging state tracking
ModalManager.draggingStates = {}

local function closeButton(parentKey, childKey, modalId, modalClass) 
    return HTML.render(HTML.Button(
        "×", 
        HTML.merge({
            class = modalClass
        },
         HTML.onClick(
            HTML.patch(
               parentKey, childKey, "hideModal", {modalId = modalId})
         )
        )
    ))
end

-- Register a modal type
function ModalManager.registerModalType(name, modalComponent)
    ModalManager.modalRegistry[name] = modalComponent
end

-- Generate unique modal ID
function ModalManager.generateModalId()
    return "modal_" .. tostring(math.random(100000, 999999)) .. "_" .. os.time()
end

-- Method to show a modal with enhanced options
ModalManager.methods.showModal = function(self, ws_id, args)
    local modalId = args.modalId or ModalManager.generateModalId()
    local modalType = args.modalType
    local modalProps = args.props or {}
    local modalChildren = args.children or {}
    local modalConfig = ModalManager.mergeConfig(args.config or {})
    local parentKey = self:getParentKey()
    local modalKey = self:getComponentKey()
    
    if not ModalManager.modalRegistry[modalType] then
        self.server.logger:log(3, "[ModalManager] Modal type not found: " .. modalType, "ModalManager", self.component_key)
        return
    end
    
    -- Get client-specific state
    local clientState = self:getClientState(ws_id)
    clientState.activeModals = clientState.activeModals or {}
    clientState.modalConfigs = clientState.modalConfigs or {}
    clientState.modalPositions = clientState.modalPositions or {}
    clientState.modalZIndices = clientState.modalZIndices or {}

    local modalComponent = self.modalRegistry[modalType]

    modalComponent:setProps(modalProps)

    -- Create modal instance if it doesn't exist
    if not clientState.activeModals[modalId] then
        for _, comp in pairs(modalChildren) do
            try.tryCatchFinally(
                function()
                    local pathstr = "lib." .. comp.path
                    local component = require(pathstr)
                    if component then
                        component:updateProps(comp.props)
                        modalComponent:addChild({
                            compKey = comp.compKey,
                            component = component
                        })
                    else
                        try.throw(try.error("ComponentError", "Component not found", { path = pathstr }))
                    end
                end,
                function(err)
                    if type(err) == "table" and err.__TRY_ERROR__ then
                        print("Caught structured error:")
                        print("  Type:", err.type)
                        print("  Message:", err.message)
                        if err.data and next(err.data) then
                            for k, v in pairs(err.data) do
                                print("   " .. k .. ":", v)
                            end
                        end
                    else
                        print("Caught raw error:", err)
                    end
                end,
                function()
                    print("Finished attempting to load component (finally)")
                end
            )
        end
        modalComponent:load()
    end

    -- Store modal configuration
    clientState.modalConfigs[modalId] = modalConfig

    -- Calculate z-index and position for the new modal
    local maxZIndex = modalConfig.minZIndex
    local modalCount = 0
    
    -- Find the highest z-index and count active modals
    for id, modal in pairs(clientState.activeModals) do
        if modal.visible then
            modalCount = modalCount + 1
            if modal.zIndex and modal.zIndex > maxZIndex then
                maxZIndex = modal.zIndex
            end
        end
    end
    
    -- Assign z-index (higher than the current maximum)
    local newZIndex = maxZIndex + modalConfig.zIndexIncrement
    
    -- Calculate cascade position
    local positionOffset = modalCount * modalConfig.cascadeOffset
    local positionStyle = string.format("top: %dpx; left: %dpx;", positionOffset, positionOffset)
    
    -- Update client state to show modal
    clientState.activeModals[modalId] = {
        id = modalId,
        type = modalType,
        props = modalProps,
        visible = true,
        zIndex = newZIndex
    }
    
    -- Store position and z-index
    clientState.modalPositions[modalId] = { top = positionOffset, left = positionOffset }
    clientState.modalZIndices[modalId] = newZIndex
    
    -- Persist client state
    self:setClientState(ws_id, { 
        activeModals = clientState.activeModals,
        modalConfigs = clientState.modalConfigs,
        modalPositions = clientState.modalPositions,
        modalZIndices = clientState.modalZIndices
    })
    
    -- Generate modal HTML with enhanced styling
    local modalHtmlOutput = HTML.render(modalComponent:build())
    
    -- Send client operations to show modal with animations
    local ops = HTML.client.batch(
        -- Append modal content
        HTML.client.append("#modal-manager-container", modalHtmlOutput),
        

        HTML.client.wrap("[id="..modalId.."]", "div", { 
            id = "modal-container-"..modalId, 
            class = "modal-wrapper " .. modalConfig.overlayClass,
            style = "position: absolute; z-index: " .. newZIndex .. ";" .. positionStyle
        }),

        
        -- Add backdrop if enabled
        HTML.client.if_(
            modalConfig.backdrop == true,
            HTML.client.prepend("#modal-container-"..modalId,                
                '<div class="modal-backdrop" data-modal-id="'..modalId..'"></div>'
            )
        ),
        
        HTML.client.prepend("#modal-container-"..modalId, 
            closeButton(parentKey, modalKey, modalId, modalConfig.closeButtonClass)
        ),
        
        -- Apply animation classes
        HTML.client.addClass("#modal-container-"..modalId, modalConfig.animationClass),
        HTML.client.addClass("#modal-container-"..modalId.." > [id="..modalId.."]", modalConfig.contentAnimationClass),
        
        -- Set up event handlers
        HTML.client.callModuleFn("window", "_onBackdropClick", {modalId, modalConfig}),
        HTML.client.callModuleFn("window", "_onEscapeKey", {modalId, modalConfig}),
        
        -- Set up dragging if enabled
        HTML.client.if_(
            modalConfig.draggable == true,
            HTML.client.batch(
                HTML.client.addClass("#modal-container-"..modalId.." > [id="..modalId.."]", "modal-draggable"),
                HTML.client.setAttrs("#modal-container-"..modalId.." > [id="..modalId.."]", {
                    ["data-modal-id"] = modalId,
                    style = "cursor: move;"
                }),
                HTML.client.callModuleFn("window", "_setupModalDragging", {modalId})
            )
        ),
        
        -- Focus management
        HTML.client.callModuleFn("window", "_focusFirstInput", {"#modal-container-"..modalId}),
        -- Body scroll lock
        HTML.client.addClass("body", "modal-open"),
        HTML.client.removeClass("[id=modal-manager-container]", "hidden")
    )
    
    self:sendHTMLClientOperations(ws_id, ops)
end

-- Method to hide a modal with animations
ModalManager.methods.hideModal = function(self, ws_id, args)
    local modalId = args.modalId
    -- Get client-specific state
    local clientState = self:getClientState(ws_id)
    clientState.activeModals = clientState.activeModals or {}
    
    if not clientState.activeModals[modalId] then
        return
    end
    
    local modalConfig = clientState.modalConfigs[modalId] or ModalManager.defaultConfig
    
    -- Update client state to hide modal
    clientState.activeModals[modalId].visible = false
    
    -- Send client operations to hide modal with animations
    local ops = HTML.client.batch(
        -- Add leave animation class
        HTML.client.addClass("#modal-container-"..modalId, modalConfig.animationLeaveClass),
        HTML.client.addClass("#modal-container-"..modalId.." > [id="..modalId.."]", modalConfig.contentLeaveClass),
        
        -- Wait for animation to complete before removing
        HTML.client.setTimeout(modalConfig.animationDuration, 
            HTML.client.batch(
                HTML.client.remove("#modal-container-"..modalId),
                
                -- Remove body scroll lock if no other modals are open
                HTML.client.if_(
                    HTML.client.query(".modal-wrapper:visible").length == 0,
                    HTML.client.removeClass("body", "modal-open")
                )
            )
        )
    )
    
    self:sendHTMLClientOperations(ws_id, ops)
    
    -- Update state after animation completes
    self.server:setTimeout(function()
        local updatedState = self:getClientState(ws_id)
        if updatedState.activeModals then
            updatedState.activeModals[modalId] = nil
            updatedState.modalPositions[modalId] = nil
            updatedState.modalZIndices[modalId] = nil
            self:setClientState(ws_id, { 
                activeModals = updatedState.activeModals,
                modalPositions = updatedState.modalPositions,
                modalZIndices = updatedState.modalZIndices
            })
        end
    end, modalConfig.animationDuration)
end

-- Method to update modal position (for dragging)
ModalManager.methods.updateModalPosition = function(self, ws_id, args)
    local modalId = args.modalId
    local top = args.top
    local left = args.left
    
    -- Get client-specific state
    local clientState = self:getClientState(ws_id)
    clientState.modalPositions = clientState.modalPositions or {}
    
    -- Update position in state
    clientState.modalPositions[modalId] = { top = top, left = left }
    
    -- Persist updated client state
    self:setClientState(ws_id, { 
        modalPositions = clientState.modalPositions
    })
    
    -- Send client operation to update position
    local ops = HTML.client.batch(
        HTML.client.setAttrs("#modal-container-"..modalId, {
            style = "top: " .. top .. "px; left: " .. left .. "px;"
        })
    )
    
    self:sendHTMLClientOperations(ws_id, ops)
end

-- Method to bring modal to front
ModalManager.methods.bringToFront = function(self, ws_id, args)
    local modalId = args.modalId
    
    -- Get client-specific state
    local clientState = self:getClientState(ws_id)
    clientState.activeModals = clientState.activeModals or {}
    clientState.modalZIndices = clientState.modalZIndices or {}
    
    if not clientState.activeModals[modalId] then
        return
    end
    
    local modalConfig = clientState.modalConfigs[modalId] or ModalManager.defaultConfig
    
    -- Find the highest current z-index
    local maxZIndex = modalConfig.minZIndex
    for id, zIndex in pairs(clientState.modalZIndices) do
        if id ~= modalId and zIndex > maxZIndex then
            maxZIndex = zIndex
        end
    end
    
    -- Assign new z-index (higher than the current maximum)
    local newZIndex = maxZIndex + modalConfig.zIndexIncrement
    
    -- Update state
    clientState.modalZIndices[modalId] = newZIndex
    clientState.activeModals[modalId].zIndex = newZIndex
    
    -- Persist updated client state
    self:setClientState(ws_id, { 
        activeModals = clientState.activeModals,
        modalZIndices = clientState.modalZIndices
    })
    
    -- Send client operation to update z-index
    local ops = HTML.client.batch(
        HTML.client.setAttrs("#modal-container-"..modalId, {
            style = "z-index: " .. newZIndex .. ";"
        })
    )
    
    self:sendHTMLClientOperations(ws_id, ops)
end

-- Enhanced method to remove a modal completely
ModalManager.methods.removeModal = function(self, ws_id, args)
    local modalId = args.modalId
    
    -- Get client-specific state
    local clientState = self:getClientState(ws_id)
    clientState.activeModals = clientState.activeModals or {}
    
    if not clientState.activeModals[modalId] then
        return
    end
    
    -- Remove from client state
    local newModals = {}
    for id, modal in pairs(clientState.activeModals) do
        if id ~= modalId then
            newModals[id] = modal
        end
    end
    
    -- Remove config
    local newConfigs = {}
    for id, config in pairs(clientState.modalConfigs or {}) do
        if id ~= modalId then
            newConfigs[id] = config
        end
    end
    
    -- Remove position and z-index
    local newPositions = {}
    for id, position in pairs(clientState.modalPositions or {}) do
        if id ~= modalId then
            newPositions[id] = position
        end
    end
    
    local newZIndices = {}
    for id, zIndex in pairs(clientState.modalZIndices or {}) do
        if id ~= modalId then
            newZIndices[id] = zIndex
        end
    end
    
    -- Persist updated client state
    self:setClientState(ws_id, { 
        activeModals = newModals,
        modalConfigs = newConfigs,
        modalPositions = newPositions,
        modalZIndices = newZIndices
    })
    
    -- Send client operation to remove modal immediately
    local ops = HTML.client.batch(
        HTML.client.remove("#modal-container-"..modalId),
        
        -- Remove body scroll lock if no other modals are open
        HTML.client.if_(
            HTML.client.query(".modal-wrapper:visible").length == 0,
            HTML.client.removeClass("body", "modal-open")
        )
    )
    
    self:sendHTMLClientOperations(ws_id, ops)
end

-- Method to update modal props
ModalManager.methods.updateModal = function(self, ws_id, args)
    local modalId = args.modalId
    local newProps = args.props or {}
    
    local clientState = self:getClientState(ws_id)
    if clientState.activeModals and clientState.activeModals[modalId] then
        -- Update props in state
        for k, v in pairs(newProps) do
            clientState.activeModals[modalId].props[k] = v
        end
        
        self:setClientState(ws_id, { activeModals = clientState.activeModals })
        
        -- Send patch to update modal content
        -- This would require the modal component to handle prop updates
        self.server.logger:log(1, "[ModalManager] Modal props updated: " .. modalId, "ModalManager", self.component_key)
    end
end

-- Get next z-index for modal stacking
function ModalManager:getNextZIndex(clientState)
    local maxZIndex = self.defaultConfig.minZIndex
    for _, modal in pairs(clientState.activeModals or {}) do
        if modal.zIndex and modal.zIndex > maxZIndex then
            maxZIndex = modal.zIndex
        end
    end
    return maxZIndex + self.defaultConfig.zIndexIncrement
end

-- Merge user config with default config
function ModalManager.mergeConfig(userConfig)
    local config = {}
    for k, v in pairs(ModalManager.defaultConfig) do
        config[k] = userConfig[k] or v
    end
    
    -- Set animation classes based on config
    local anim = ModalManager.animations[config.animation] or ModalManager.animations.fadeIn
    config.animationClass = anim.enter
    config.animationLeaveClass = anim.leave
    config.contentAnimationClass = config.animation .. "-content"
    config.contentLeaveClass = config.animation .. "-content-leave"
    
    return config
end

-- Render function for the modal manager
function ModalManager:renderLayout(state, props, children, H)
    return H.e("div", {
        id = "modal-manager-container",
        class = "modal-manager hidden", -- Initially hidden, shown by client ops
        style = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1000;"
    }, {

    })
end

-- Initialize the modal manager
function ModalManager:startInit()
    
    self:init(function(server, children, props, style, H)
        return function(state, props, children, H)
            return self:renderLayout(state, props, children, H)
        end
    end)
end

-- Load the modal manager
function ModalManager:load()
    self:startInit()
    for k, modal in pairs(self.modalRegistry) do
        self:addChildComponent(tostring(k), modal)
        modal:load()
    end
end

-- Register default modal types
 ModalManager.registerModalType("promptModal", require("components.prac.HelloModal"))

return ModalManager