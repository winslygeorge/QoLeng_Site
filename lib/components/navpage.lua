local FuncComponent = require("layout.renderer.FuncComponent")

local navpage = FuncComponent:extends()

navpage:setView("components/navpage")
navpage:setTheme("light") -- or "dark"

navpage:init(function(children, props, style)

end)

return navpage