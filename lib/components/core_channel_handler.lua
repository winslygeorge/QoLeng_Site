local FuncComponent = require("layout.renderer.FuncComponent")

local core_channel_handler = FuncComponent:extends()

core_channel_handler:setView("components/core_channel_handler")
core_channel_handler:setTheme("light") -- or "dark"

core_channel_handler:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return core_channel_handler