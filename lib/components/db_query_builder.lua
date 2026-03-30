local FuncComponent = require("layout.renderer.FuncComponent")

local db_query_builder = FuncComponent:extends()

db_query_builder:setView("components/db_query_builder")
db_query_builder:setTheme("light") -- or "dark"

db_query_builder:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return db_query_builder