local MainLayout = require("lib.Web")
local json = require("dkjson")

local M = {}
M.__index = M

function M:new(server)
  local self = setmetatable({}, M)
  self.server = server
  return self
end

function M:routes()
    -- Your routes go here, e.g.:

    self.server:get("/web", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.welcome")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/setup", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.setupage")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

      self.server:get("/web/core-server", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.core_server_page")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/core-routing", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.qol_core_routing")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/core-advanced", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.core_advanced_features")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/redis-state-management", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.redis_state_management")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/core-sockets", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.core_sockets")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/core-channel-handler", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.core_channel_handler")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/db-orm-model", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.db_models")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/db-orm-schema-conn", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.db_schema_conn")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/db-orm-modelroutes", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.db_model_route")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/db-query-builder", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.db_query_builder")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/db-setup", function(req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.db_setup")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

    self.server:get("/web/framework-rendering", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_rendering")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

        self.server:get("/web/framework-luareactive", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_LuaHTMLReactive")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

    self.server:get("/web/framework-luareactive-clientops", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_LuaHTMLReactive_clientops")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

    self.server:get("/web/framework-luareactive-mainappentry", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_LuaHTMLReactive_mainappentry")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

        self.server:get("/web/framework-luareactive-customEl", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_LuaHTMLReactive_customEL")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

    self.server:get("/web/framework-luareactive-sparouting", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_LuaHTMLReactive_SPARouting")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
    end)

        self.server:get("/web/framework-luareactive-sparouting-integration", function (req, res, query)

       MainLayout:init(function(children, props, style)
        local body = require("lib.components.framework_LuaHTMLReactive_SPARoutingIntegration")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()

      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

    self.server:get("/web/server-state-management", function (req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.server-statemanagement")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()
      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

        self.server:get("/web/ui-reactor-state", function (req, res, query)

      MainLayout:init(function(children, props, style)
        local body = require("lib.components.ui_reactor_state")
        children.body = body:build()
      end)
      local layout = MainLayout:render_layout()
      res:writeHeader("Content-Type", "text/html")
      res:send(layout)
      
    end)

end

return M