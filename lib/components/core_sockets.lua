local FuncComponent = require("layout.renderer.FuncComponent")

local core_sockets = FuncComponent:extends()

core_sockets:setView("components/core_sockets")
core_sockets:setTheme("light") -- or "dark"

core_sockets:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return core_sockets