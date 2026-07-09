local env = require('config.get_env')

local connectionString = env.DB_CONNECTION_STRING  or "" 
print("User model connection string: " .. connectionString)
local Model = require("orm.model")
local User -- Forward declaration


-- User model with relation back to Post
 User = Model:extend("users", {
    -- Basic type definitions only (strings)
    id = "integer",
    username = "string", 
    email = "string",
    password_hash = "string",
    first_name = "string",
    last_name = "string",
    age = "integer",
    salary = "float", 
    is_active = "boolean",
    bio = "text",
    created_at = "timestamp",
    updated_at = "timestamp",
    deleted_at = "timestamp",
    last_login = "timestamp",
    login_count = "integer"
}, {
    _primary_key = "id",
    _connection_mode = "sync",
    _connection_string = connectionString,
    _timestamps = true,
    
    -- These work:
    _unique_keys = {
        {"email"},
        {"username"}
    },
    
    _indexes = {
        "email",
        {"first_name", "last_name"},
        { columns = "email", unique = true }
    },
    
    _filter_presets = {
        active = function(qb)
            return qb:where("is_active", "=", true)
        end
    },
    
    _model_classes = { Post = Post } -- Required for relations to work
})

return  User



