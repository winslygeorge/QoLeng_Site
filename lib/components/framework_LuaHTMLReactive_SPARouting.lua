local FuncComponent = require("layout.renderer.FuncComponent")

local framework_LuaHTMLReactive_SPARouting = FuncComponent:extends()

framework_LuaHTMLReactive_SPARouting:setView("components/framework_LuaHTMLReactive_SPARouting")
framework_LuaHTMLReactive_SPARouting:setTheme("light") -- or "dark"

framework_LuaHTMLReactive_SPARouting:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return framework_LuaHTMLReactive_SPARouting