local FuncComponent = require("layout.renderer.FuncComponent")

local db_schema_conn = FuncComponent:extends()

db_schema_conn:setView("components/db_schema_conn")
db_schema_conn:setTheme("light") -- or "dark"

db_schema_conn:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return db_schema_conn