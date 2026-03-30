local FuncComponent = require("layout.renderer.FuncComponent")

local headerpage = FuncComponent:extends()

headerpage:setView("components/headerpage")
headerpage:setTheme("light") -- or "dark"

headerpage:init(function(children, props, style)

end)

return headerpage