local FuncComponent = require("layout.renderer.FuncComponent")

local framework_rendering = FuncComponent:extends()

framework_rendering:setView("components/framework_rendering")
framework_rendering:setTheme("light") -- or "dark"

framework_rendering:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return framework_rendering