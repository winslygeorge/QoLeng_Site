local FuncComponent = require("layout.renderer.FuncComponent")

local homepage = FuncComponent:extends()

homepage:setView("components/homepage")
homepage:setTheme("light") -- or "dark"

homepage:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return homepage