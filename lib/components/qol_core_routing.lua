local FuncComponent = require("layout.renderer.FuncComponent")

local qol_core_routing = FuncComponent:extends()

qol_core_routing:setView("components/qol_core_routing")
qol_core_routing:setTheme("light") -- or "dark"

qol_core_routing:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return qol_core_routing