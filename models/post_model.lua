local env = require('config.get_env')

local connectionString = env.DB_CONNECTION_STRING  or "" 

local Model = require("orm.model")
-- Post model
local Post = Model:extend("posts", {
    id = "integer",
    title = "string",
    content = "text", 
    author_id = "integer",
    category_id = "integer",
    status = "string",
    published_at = "timestamp",
    view_count = "integer"
}, {
    _connection_string = connectionString,
    _primary_key = "id",
    _foreign_keys = {
        {
            columns = "author_id",
            references = "users(id)",
            on_delete = "CASCADE"
        }
    },
    
    _relations = {
        author = {
            model = "User",
            foreign_key = "author_id", 
            local_key = "id",
            join_type = "LEFT"
        }
    },
    
    _model_classes = { User = User }
})

return Post