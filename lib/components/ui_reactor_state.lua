local FuncComponent = require("layout.renderer.FuncComponent")

local ui_reactor_state = FuncComponent:extends()

ui_reactor_state:setView("components/ui_reactor_state")
ui_reactor_state:setTheme("light") -- or "dark"

ui_reactor_state:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return ui_reactor_state