local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")

local AboutPage = FunctionalComponent:extends()
AboutPage:setReactiveView()

AboutPage.methods.sayHello = function(self, ws_id, args)
  local ops = HTML.client.callModuleFn("window", "alert", {"Hello, World!"})
  self:sendHTMLClientOperations(ws_id, ops)
end

function AboutPage:renderLayout(state, props, children, H)
  return H.e("div", { class = "p-4 text-center" }, {
    H.e("h1", {}, "Hello, World!"),
    H.e("button",
      H.merge(
        { class = "mt-4 px-4 py-2 bg-green-500 text-white rounded" },
        H.onClick(H.patch(self.component_key, nil, "sayHello", {}))
      ),
      "Say Hello"
    )
  })
end

function AboutPage:startInit()
  self:init(function(server, children, props, style, H)
    return function(state, props, children, H)
      return self:renderLayout(state, props, children, H)
    end
  end)
end

function AboutPage:load()
  self:startInit()
end

return AboutPage