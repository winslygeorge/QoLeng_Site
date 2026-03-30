local FuncComponent = require("layout.renderer.FuncComponent")

local db_setup = FuncComponent:extends()

db_setup:setView("components/db_setup")
db_setup:setTheme("light") -- or "dark"

db_setup:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return db_setup