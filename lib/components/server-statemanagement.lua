local FuncComponent = require("layout.renderer.FuncComponent")

local serverstatemanagement = FuncComponent:extends()

serverstatemanagement:setView("components/server-statemanagement")
serverstatemanagement:setTheme("light") -- or "dark"

serverstatemanagement:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return serverstatemanagement