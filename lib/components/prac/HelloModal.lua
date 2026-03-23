-- components/PromptDialog.lua
local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")
local cjson = require("dkjson")

local PromptDialog = FunctionalComponent:extends()
PromptDialog:setReactiveView()

function PromptDialog:renderLayout(state, props, children, H)
    return H.e("div", {
        id = props.modalId,
        class = "bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-auto modal-content"
    }, {
        H.e("h2", { class = "text-xl font-bold mb-4 text-gray-700" }, props.title or "Prompt"),
        H.e("p", { class = "mb-4 text-sm text-gray-700" }, props.message or "Your message here"),
        H.e("div", { class = "flex justify-end gap-2" }, {
            H.Button(
                "Close",
                H.merge(
                    { class = "px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400" },
                    H.onClick(H.patch("modalManager", nil, "hideModal", { modalId = props.modalId }))
                )
            )
        })
    })
end

function PromptDialog:startInit()
    PromptDialog.methods.handleCancel = function(self, ws_id, args)
        local parentKey = self:getParentKey()
        self:callParentMethod("hideModal", ws_id, {
            modalId = self.component_key
        })
    end
    self:init(function(server, children, props, style, H)
        return function(state, props, children, H)
            return self:renderLayout(state, props, children, H)
        end
    end)
end

function PromptDialog:load()
    self:startInit()
    for compKey, component in pairs(self.children) do
        if component and type(component.compKey) == "string" then
            self:addChildComponent(tostring(component.compKey), component.component)
            component.component:load()
        end
    end
end

return PromptDialog