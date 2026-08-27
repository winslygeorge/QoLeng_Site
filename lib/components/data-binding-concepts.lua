local FuncComponent = require("layout.renderer.FuncComponent")

local databindingconcepts = FuncComponent:extends()

databindingconcepts:setView("components/data-binding-concepts")
databindingconcepts:setTheme("light") -- or "dark"

databindingconcepts:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return databindingconcepts