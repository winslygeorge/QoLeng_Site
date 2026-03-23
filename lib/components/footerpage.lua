local FuncComponent = require("layout.renderer.FuncComponent")

local footerpage = FuncComponent:extends()

footerpage:setView("components/footerpage")
footerpage:setTheme("light") -- or "dark"

footerpage:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return footerpage