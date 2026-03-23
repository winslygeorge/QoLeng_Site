local FuncComponent = require("layout.renderer.FuncComponent")

local setupage = FuncComponent:extends()

setupage:setView("components/setupage")
setupage:setTheme("light") -- or "dark"

setupage:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return setupage