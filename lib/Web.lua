local FuncComponent = require('layout.renderer.FuncComponent')
local navComponent = require('lib.components.navpage')
local footer = require('lib.components.footerpage')
local header = require('lib.components.headerpage')

local  MainComponent = FuncComponent:extends()

MainComponent:setView('layouts/default')

function MainComponent:startInit()

    self:init(function (children, props, style)
      props.layout_data = {
        title = "Home - Dawnserver",
        head_extra = '<meta name="keywords" content="luajit, webserver, uwebsockets">',
        -- body_extra = '<script src="/static/js/home-page-specific.js" defer></script>',
        current_year = os.date("%Y")
    }
    -- you can add children layouts to the main layout by using below illustration
    children.header = header:build()
    children.nav = navComponent:build()
    children.body = children.body or ""
    -- children.footer = footer:build()
    end)

end

function MainComponent:render_layout()
    self:startInit()
    local output = self:build()
    return output
end

return MainComponent

