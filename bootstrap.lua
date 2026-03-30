local uv = require("luv")

local function normalize_path(path)
    return path:gsub("//", "/"):gsub("/$", "")
end

local function add_lua_paths_recursively(root)
    root = normalize_path(root)

    local function scan(path)
        local entries = uv.fs_scandir(path)
        while entries do
            local name, typ = uv.fs_scandir_next(entries)
            if not name then break end
            local full_path = path .. "/" .. name
            if typ == "directory" then
                package.path = package.path .. ";" .. full_path .. "/?.lua"
                scan(full_path)
            end
        end
    end

    package.path = package.path .. ";" .. root .. "/?.lua"
    print("Scanning Lua paths in: " .." : " .. root)
    scan(root)
end

return add_lua_paths_recursively
