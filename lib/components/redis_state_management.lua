local FuncComponent = require("layout.renderer.FuncComponent")

local redis_state_management = FuncComponent:extends()

redis_state_management:setView("components/redis_state_management")
redis_state_management:setTheme("light") -- or "dark"

redis_state_management:init(function(children, props, style)
	-- Configure your component's children, props, and styles here
	-- children.header = "<h1>Welcome!</h1>"
	-- props.data = { title = "Page Title", message = "Hello, World!" }
end)

return redis_state_management