local FuncComponent = require("layout.renderer.FuncComponent")

local core_advanced_features = FuncComponent:extends()

core_advanced_features:setView("components/core_advanced_features")
core_advanced_features:setTheme("light") --or "dark"

core_advanced_features:init(function(children, props, style)
	-- __ Configure your component's children, props, and styles here
	-- __ children.header = "<h1>Welcome!</h1>"
	-- __ props.data = { title = "Page Title", message = "Hello, World!" }
end)

return core_advanced_features