local FuncComponent = require("layout.renderer.FuncComponent")

local db_model_route = FuncComponent:extends()

db_model_route:setView("components/db_model_route")
db_model_route:setTheme("light") -- or "dark"

db_model_route:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return db_model_route