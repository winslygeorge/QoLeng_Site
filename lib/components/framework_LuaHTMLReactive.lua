local FuncComponent = require("layout.renderer.FuncComponent")

local framework_LuaHTMLReactive = FuncComponent:extends()

framework_LuaHTMLReactive:setView("components/framework_LuaHTMLReactive")
framework_LuaHTMLReactive:setTheme("light") -- or "dark"

framework_LuaHTMLReactive:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return framework_LuaHTMLReactive