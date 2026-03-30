local FuncComponent = require("layout.renderer.FuncComponent")

local welcome = FuncComponent:extends()

welcome:setView("components/welcome")
welcome:setTheme("light") -- or "dark"

welcome:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return welcome