local FuncComponent = require("layout.renderer.FuncComponent")

local db_models = FuncComponent:extends()

db_models:setView("components/db_models")
db_models:setTheme("light") -- or "dark"

db_models:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return db_models