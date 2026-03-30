local FuncComponent = require("layout.renderer.FuncComponent")

local core_server_page = FuncComponent:extends()

core_server_page:setView("components/core_server_page")
core_server_page:setTheme("light") -- or "dark"

core_server_page:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return core_server_page