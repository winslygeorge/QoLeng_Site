require("bootstrap")("./") 
local QolengServer = require("dawn").dawn_server 
local server_config = require('config.server_config')
local routes = require('routes._index')

local QolengRoutes = require("orm.QolengModelRoute")
local Users = require('models.user_model')
local Loans = require('models.loan_model')

-- Create a new QolengServer instance
local server = QolengServer:new(server_config)

-- Register all routes
server.ROUTES_REGISTERED = routes

routes:load(server):registerAllRoutes()

QolengRoutes:new("users", Users, server):initialize()

QolengRoutes:new("loans", Loans, server):initialize()

-- Start the server
server:start()
