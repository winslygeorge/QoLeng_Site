require("bootstrap")("./") 
local DawnServer = require("dawn").dawn_server 
local server_config = require('config.server_config')
local routes = require('routes._index')

local DawnRoutes = require("orm.DawnModelRoute")
local Users = require('models.user_model')
local Loans = require('models.loan_model')

-- Create a new DawnServer instance
local server = DawnServer:new(server_config)

-- Register all routes
server.ROUTES_REGISTERED = routes

routes:load(server):registerAllRoutes()

DawnRoutes:new("users", Users, server):initialize()

DawnRoutes:new("loans", Loans, server):initialize()

-- Start the server
server:start()
