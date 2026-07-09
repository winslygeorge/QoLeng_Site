
local corsMiddleware = require('routes.middlewares.cors_middleware')

local rate_limiting_middleware = require('routes.middlewares.rate_limiting_middleware')

local json = require('dkjson')

local parseFilters = require("utils.query_filter_parser")
local PatchStreamer = require("utils.patchStreamer")

local env = require('config.get_env')

local M = {}
M.__index = M

function M:new(server)
  local self = setmetatable({}, M)
  self.server = server
  return self
end

function M:routes()


    local patch_streamer = PatchStreamer:new(self.server)

  -- Your routes go here, e.g.:
    self.server:use(rate_limiting_middleware())

      self.server:use(corsMiddleware({
      allow_origin = "*",
      allow_methods = "GET, POST, PUT, DELETE, OPTIONS",
      allow_headers = "Content-Type, Authorization"
    }), '/api')



    self.server:get("/sse/patches", function(req, res)
      local filters = parseFilters(req.query)
      local sse_id = req.sse_id
      patch_streamer:addSubscriber(sse_id, filters)
    end)

  self.server:get("/sse/logs", function(req, res, query)    
    local sse_id = req.sse_id

    local opts = {}

    for k, v in pairs(query) do
        if k == "level" then
            opts.level = v:upper() or "INFO"
        elseif k == "component" then
            opts.component = v
        end
    end

    self.server.logger:log(1, "New SSE log stream connection opened with ID: " .. sse_id, "SSE_Log_Stream")

    self.server.logger:addSubscriber(sse_id, opts)

    res:send("text/event-stream")

    res:onClose(function()
        self.server.logger:removeSubscriber(sse_id)
    end)
end)

  self.server:get("system/health", function(req, res)
    -- Simple health check
    res:send("OK")
  end)


  self.server:get("system/clear_logs", function(req, res)
    local f = io.open("app.log", "w")
    if f then
      f:close()
      res:send("Logs cleared successfully")
    else
      res:writeStatus(500):send("Failed to clear logs")
    end
  end)



  -- write a broadcast to logs sse route 
  self.server:get("system/broadcast", function(req, res, query)
    local message = query.message or "No message provided"
    local sse_id = req.sse_id

    -- Broadcast the message to all connected SSE clients
    for id, _ in pairs(self.server.logger.subscribers) do
      if id ~= sse_id then -- Avoid sending back to the sender
        self.server:sse_send(id, message, "broadcast")
      end
    end

    res:send("Broadcast sent: " .. message)
  end)

  if env and env.SINGLE_APP_MODE == true then
    
          self.server:get("/", function(req, res, query)    
          self.server:redirect(res, "/app", 302)
        end)

        self.server:get("/*", function(req, res, query)
            local category

          local url = req._raw:getUrl() or ""

            if url:match("^/app") or url == "/" or url ==  "" then
                category = "page"
            else
                category = "others"
            end
            if category == "page" then
                -- Extract path for client-side routing
                local path = req._raw:getUrl() == "/" and "/" or req._raw:getUrl()      
                print("Serving SPA shell for path: " .. path)
                -- Serve SPA shell
                local modalPracPage = require("lib.WebApp")
                modalPracPage:setServer(self.server)
                modalPracPage:setRouteToNavigateTo(path)
                local htmlOutput = modalPracPage:render_layout()
                res:writeHeader("Content-Type", "text/html; charset=utf-8")
                res:send(htmlOutput)
            else
                -- Let other handlers catch API/auth/sse/static routes
                res:writeStatus("404 Not Found")
                res:send("Not found")
            end
        end)
  end


end

return M