#!/bin/bash

# Dawn Web Framework Build Script for Debian-based systems

# --- Configuration ---
# Define colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Define icons
CHECK_MARK="${GREEN}✓${NC}"
CROSS_MARK="${RED}✗${NC}"
INFO_ICON="${BLUE}ℹ${NC}"
ARROW_ICON="${CYAN}➜${NC}"
STAR_ICON="${YELLOW}★${NC}"
WARNING_ICON="${YELLOW}⚠${NC}"

# Global flag for "yes to all"
YES_TO_ALL=false

# Arrays to track installation results
INSTALLED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0
FAILED_PACKAGES=()
START_TIME=$(date +%s)

# --- Functions ---

# Function to display a section header
log_header() {
    echo -e "\n${BLUE}${STAR_ICON} $1 ${STAR_ICON}${NC}"
    echo -e "${BLUE}----------------------------------------------------${NC}"
}

# Function to confirm an action with the user
confirm_action() {
    local prompt_message=$1
    if [ "$YES_TO_ALL" = true ]; then
        echo -e "${INFO_ICON} ${CYAN}${prompt_message} (Auto-approved with -Y)${NC}"
        return 0 # Auto-approve
    fi

    echo -e "${INFO_ICON} ${YELLOW}${prompt_message} (Y/n)? ${NC}\c"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to check if an apt package is installed
is_apt_package_installed() {
    dpkg -s "$1" &> /dev/null
}

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check if systemd is the running init system
# Returns 0 if systemd is detected, 1 otherwise.
is_systemd_active() {
    if [ -d /run/systemd/system ]; then
        return 0
    else
        # Try to execute a simple systemctl command and check for specific error patterns
        # This helps in cases where /run/systemd/system might not exist but systemctl is installed
        systemctl is-active --quiet &>/dev/null
        if [ $? -eq 0 ]; then
            return 0
        fi
        return 1
    fi
}


# Function to check and install a system dependency
check_and_install_apt_dep() {
    local package_name=$1
    local display_name=$2
    local install_cmd=$3

    echo -e "${ARROW_ICON} Checking for ${display_name} (${package_name})..."
    if is_apt_package_installed "$package_name"; then
        echo -e "  ${CHECK_MARK} ${display_name} is already installed. Skipping."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    elif command_exists "$package_name"; then
        # This covers cases where the command exists, but it's not a debian package (e.g., manually installed)
        echo -e "  ${CHECK_MARK} ${display_name} command found. Assuming installed. Skipping."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    else
        if confirm_action "Install ${display_name} (${package_name})?"; then
            echo -e "  ${ARROW_ICON} Installing ${display_name}..."
            if eval "$install_cmd"; then
                echo -e "  ${CHECK_MARK} ${display_name} installed successfully."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to install ${display_name}."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("$package_name")
            fi
        else
            echo -e "  ${INFO_ICON} Skipping installation of ${display_name}."
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    fi
}

# Function to check and install a LuaRocks dependency
check_and_install_luarocks_dep() {
    local package_name=$1
    local display_name=$2
    local install_cmd="luarocks install ${package_name}"

    echo -e "${ARROW_ICON} Checking for LuaRocks package: ${display_name} (${package_name})..."
    if luarocks list --porcelain "$package_name" 2>/dev/null | grep -q "^$package_name "; then
        echo -e "  ${CHECK_MARK} LuaRocks package '${display_name}' is already installed. Skipping."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    else
        if confirm_action "Install LuaRocks package '${display_name}'?"; then
            echo -e "  ${ARROW_ICON} Installing LuaRocks package '${display_name}'..."
            if eval "$install_cmd"; then
                echo -e "  ${CHECK_MARK} LuaRocks package '${display_name}' installed successfully."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to install LuaRocks package '${display_name}'."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("luarocks-${package_name}")
            fi
        else
            echo -e "  ${INFO_ICON} Skipping installation of LuaRocks package '${display_name}'."
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    fi
}

# Function to generate the dawn.lua script
generate_dawn_lua() {
    log_header "Generating dawn.lua CLI Script"
    echo -e "${ARROW_ICON} Creating 'dawn.lua' in the current directory..."

    cat << 'EOF' > dawn.lua
#!/usr/bin/env luajit

-- Dawn Web Framework CLI
-- This script provides a command-line interface for managing Dawn projects.
local json = require("dkjson")
local lustache = require("lustache")

local lfs = require("lfs")

--- Converts a PascalCase string to snake_case and pluralizes it.
-- @param str string The PascalCase string (e.g., "User", "ProductCategory").
-- @return string The snake_case pluralized string (e.g., "users", "product_categories").
local function pascal_to_snake_plural(str)
    -- Insert underscore before uppercase letters (unless it's the first character)
    local snake = str:gsub("([A-Z])", function(c)
        return "_" .. c:lower()
    end)
    -- Remove leading underscore if present
    snake = snake:gsub("^_", "")

    -- Basic pluralization (can be more sophisticated if needed)
    if snake:sub(-1) == "y" then
        if snake:sub(-2, -2) == "a" or snake:sub(-2, -2) == "e" or snake:sub(-2, -2) == "i" or snake:sub(-2, -2) == "o" or snake:sub(-2, -2) == "u" then
            -- Vowel before 'y', just add 's'
            snake = snake .. "s"
        else
            -- Consonant before 'y', change 'y' to 'ies'
            snake = snake:sub(1, -2) .. "ies"
        end
    elseif snake:sub(-1) == "s" or snake:sub(-1) == "x" or snake:sub(-2) == "ch" or snake:sub(-2) == "sh" then
        -- Ends with s, x, ch, sh, add 'es'
        snake = snake .. "es"
    else
        -- Default: just add 's'
        snake = snake .. "s"
    end
    return snake
end


local function exec(cmd)
    local result = os.execute(cmd)
    if result ~= 0 then
        io.stderr:write("Error: Command failed with exit code " .. result .. ": " .. cmd .. "\n")
        os.exit(1)
    end
end

local function download_project_structure(name)
    local cmd = string.format("git clone https://github.com/winslygeorge/Basic-Template-Structure.git %s", name)
    exec(cmd)
    exec(string.format("cd %s", name)) -- cd to the project directory
    exec(string.format("rm -rf %s/.git", name)) -- Remove .git directory to avoid confusion
end

local function print_help()
Dawn Web Framework CLI

Usage:
    dawn new <project_name>             Create a new project
    dawn install                        Install LuaRocks dependencies from config
    dawn serve                          Run the dev server
    dawn generate <type> <name>         Generate controller/model/middleware/fcomp/route/migration/ui-reactors
    dawn db migrate [<migration_file>]  Run database migrations (optional: specify file)
    dawn db create_table <model_name>   Create a specific table based on model
    dawn db drop_table <model_name>     Drop a specific table based on model
    dawn test                           Run unit tests
    dawn version                        Show version
    dawn help                           Show this help
]])
end

local function get_version()
end

local function run_server()
    exec("luajit main.lua")
end

local function run_tests()
    exec("luajit tests/run_tests.lua")
end

local function run_migrations(migration_file)
    local cmd
    if migration_file then
        cmd = string.format("luajit db/migrations/%s", migration_file)
    else
        cmd = "luajit db/migrations/run.lua"
    end
    exec(cmd)
end

-- Recursive directory creation function
local function create_dir_recursive(path)
    local current_path = ""
    for segment in path:gmatch("[^/]+") do
        if current_path == "" then
            current_path = segment
        else
            current_path = current_path .. "/" .. segment
        end

        local attr = lfs.attributes(current_path, "mode")
        if not attr then -- Directory does not exist
            local success, err = lfs.mkdir(current_path)
            if not success then
                return false, err
            end
        elseif attr ~= "directory" then -- Path exists but is not a directory
            return false, "Path exists but is not a directory: " .. current_path
        end
    end
    return true
end

-- NEW FUNCTION: Create table based on model name input (simplified)
local function create_table_for_model(model_name_input)
    local SchemaManager = require("orm.schema_manager")
    local models = require("models.init_models")

    -- Ensure model_name_input is PascalCase for lookup
    -- Assuming models.init_models exposes models with their PascalCase names
    local model_instance = models[model_name_input]

    if not model_instance then
        os.exit(1)
    end

    -- Derive the actual table name (snake_case, plural) from the model's PascalCase name
    local actual_table_name = pascal_to_snake_plural(model_name_input)

    SchemaManager.create_table(model_instance)
    os.exit(1)
end

-- Update: Drop table based on model name input (simplified)
local function drop_table_for_model(model_name_input)
    local SchemaManager = require("orm.schema_manager")
    local models = require("models.init_models")

    -- Ensure model_name_input is PascalCase for lookup
    local model_instance = models[model_name_input]

    if not model_instance then
        os.exit(1)
    end

    -- Derive the actual table name (snake_case, plural) from the model's PascalCase name
    local actual_table_name = pascal_to_snake_plural(model_name_input)

    SchemaManager.drop_table(model_name_input)

    os.exit(1)
end


-- Define the snippets
local snippets = {
    ["Lua Functional Component Usage"] = {
        prefix = "!dawn_fcomp",
        body = {
            "local FuncComponent = require(\"layout.renderer.FuncComponent\")",
            "",
            "local {{name}} = FuncComponent:extends()",
            "",
            "{{name}}:setView(\"components/{{view_template_name}}\")",
            "{{name}}:setTheme(\"light\") -- or \"dark\"",
            "",
            "{{name}}:init(function(children, props, style)",
            "\t-- Configure your component's children, props, and styles here",
            "\t-- children.header = \"<h1>Welcome!</h1>\"",
            "\t-- props.data = { title = \"Page Title\", message = \"Hello, World!\" }",
            "end)",
            "",
            "return {{name}}"
        },
        description = "Scaffolds a basic usage example for FunctionalComponent"
    },
    ["Lua Controller Class Usage"] = {
        prefix = "!dawn_controller",
        body = {
            "local Controller = require(\"layout.renderer.Controller\")",
            "local MainLayout = require(\"lib.main_layout\")",
            "local {{name}} = Controller:extends()",
            "",
            "function {{name}}:initialize_data()",
            "\t-- Optional: Initialize controller-specific properties or services here, like fetching data",
            "end",
            "",
            "function {{name}}:beforeAction(action, ...)",
            "\t-- Optional: Code to run before any action in this controller",
            "\t-- For example, logging or authentication checks specific to this controller",
            "end",
            "",
            "function {{name}}:index()",
            "\t-- Handle GET /{{route_name}}",
            "\t-- Example: Handle Controller data layout rendering",
            "\t-- Pass the content or component layout of the controller as children.body on the MainLayout renderer",
            "\tMainLayout:init(function (children, props, style)",
            "end)",
            "",
            "MainLayout:render_layout(self)",
            "end",
            "",
            "return {{name}}"
        },
        description = "Scaffolds a basic usage example for the Controller base class"
    },
    ["Lua ORM Model Definition and Usage"] = {
        prefix = "!dawn_ormmodel",
        body = {
            "local Model = require(\"orm.model\")",
            "local env = require(\"config.get_env\")",
            "",
            "local db_conf = env.DB_CONFIG or {",
            "\t\thost = \"localhost\",",
            "\t\tport = 5432,",
            "\t\tuser = \"game_player\",",
            "\t\tpassword = \"1234\",",
            "\t\tdbname = \"game\",",
            "}",
            "",
            "---",
            "--- Profile Model Definition",
            "--- Represents the 'profiles' table in your database. This is a one-to-one relation with User.",
            "---",
            "local {{model_name_profile}} = Model:extend(",
            "\t\"{{table_name_profile}}\", -- Table name",
            "\t{",
            "\t\tid = { type = \"integer\", primary_key = true },",
            "\t\tbio = \"text\",",
            "\t\tphone = \"string\",",
            "\t\tcreated_at = { type = \"timestamp\", not_null = true, default = \"CURRENT_TIMESTAMP\" },",
            "\t\tupdated_at = { type = \"timestamp\", not_null = true, default = \"CURRENT_TIMESTAMP\" },",
            "\t},",
            "\t{",
            "\t\t_connection_info = string.format(\"host=%s port=%d user=%s password=%s dbname=%s\",",
            "\t\t\tdb_conf.host, db_conf.port, db_conf.user, db_conf.password, db_conf.dbname),",
            "\t\t_primary_key = \"id\",",
            "\t\t_timestamps = true,",
            "\t\t_include_relations = true,",
            "\t\t_connection_mode = \"sync\",",
            "\t\t_indexes = {},",
            "\t\t_unique_keys = { { } },",
            "\t}",
            ")",
            "",
            "---",
            "",
            "--- {{name}} Model Definition",
            "--- Represents the '{{table_name_user}}' table with a foreign key to 'profiles'.",
            "--- This model demonstrates a 'has-one' / 'belongs-to' relationship with Profile.",
            "---",
            "local {{name}} = Model:extend(",
            "\t\"{{table_name_user}}\", -- Table name",
            "\t{",
            "\t\tid = { type = \"integer\", primary_key = true },",
            "\t\tname = \"string\",",
            "\t\temail = { type = \"string\", unique = true },",
            "\t\tprofile_id = { type = \"integer\", references = \"profiles(id)\", on_delete = \"SET NULL\" },",
            "\t\tcreated_at = { type = \"timestamp\", not_null = true, default = \"CURRENT_TIMESTAMP\" },",
            "\t\tupdated_at = { type = \"timestamp\", not_null = true, default = \"CURRENT_TIMESTAMP\" },",
            "\t},",
            "\t{",
            "\t\t_connection_info = string.format(\"host=%s port=%d user=%s password=%s dbname=%s\",",
            "\t\t\tdb_conf.host, db_conf.port, db_conf.user, db_conf.password, db_conf.dbname),",
            "\t\t_primary_key = \"id\",",
            "\t\t_timestamps = true,",
            "\t\t_connection_mode = \"sync\",",
            "\t\t_include_relations = true,",
            "\t\t_foreign_keys = {",
            "\t\t\tprofile_id = { table = \"profiles\", column = \"id\", on_delete = \"SET NULL\" }",
            "\t\t},",
            "\t\t_relations = {",
            "\t\t\tprofile = { ",
            "\t\t\t\tmodel_name = \"Profile\",",
            "\t\t\t\tlocal_key = \"profile_id\",",
            "\t\t\t\tforeign_key = \"id\",",
            "\t\t\t\tjoin_type = \"LEFT\"",
            "\t\t\t}",
            "\t\t},",
            "\t\t_indexes = {},",
            "\t\t_unique_keys = { { } },",
            "\t}",
            ")",
            "",
            "--- For eager loading, ensure 'db.init_models' exists and returns a table like:",
            "local M = {}",
            "M.User = {{name}}",
            "M.Profile = {{model_name_profile}}",
            "return M",
            "",
            "",
            "-- Create a new Profile record first, as User depends on it",
            "local newProfile, err_profile = {{model_name_profile}}:create({ bio = \"Software Engineer\", phone = \"+1234567890\" })",
            "if newProfile then",
            "else",
            "end",
            "",
            "-- Create a new User record and attach them to the Profile",
            "if newProfile then",
            "\tlocal newUser, err_user = {{name}}:create({",
            "\t\tname = \"John Doe\",",
            "\t\temail = \"john.doe@example.com\",",
            "\t\tprofile_id = newProfile.id",
            "\t})",
            "\tif newUser then",
            "\telse",
            "\tend",
            "",
            "\t-- Find a User by ID and eager load their related Profile",
            "\t{{name}}._include_relations = true",
            "\tlocal foundUserWithProfile, err_find = {{name}}:find(newUser.id)",
            "\t{{name}}._include_relations = false",
            "\tif foundUserWithProfile then",
            "\t\tif foundUserWithProfile.profile then",
            "\t\telse",
            "\t\tend",
            "\telse",
            "\tend",
            "",
            "\t-- Update the user's email and save the changes",
            "\tif newUser then",
            "\t\tnewUser.email = \"john.updated@example.com\"",
            "\t\tlocal success_update, err_update = newUser:save()",
            "\t\tif success_update then",
            "\t\telse",
            "\t\tend",
            "\tend",
            "",
            "\t-- Find all users (using query builder)",
            "\t{{name}}._include_relations = true",
            "\tlocal allUsers, err_query = {{name}}:query():order_by(\"name\", \"ASC\"):get()",
            "\t{{name}}._include_relations = false",
            "\tif allUsers then",
            "\t\tfor i, user in ipairs(allUsers) do",
            "\t\tend",
            "\telse",
            "\tend",
            "",
            "\t-- Delete the newly created user record",
            "\tif newUser then",
            "\t\tlocal success_delete, err_delete = newUser:delete()",
            "\t\tif success_delete then",
            "\t\telse",
            "\t\tend",
            "\tend",
            "",
            "\t-- Delete the newly created profile record (if you want to clean up completely)",
            "\tif newProfile then",
            "\t\tlocal success_delete_profile, err_delete_profile = newProfile:delete()",
            "\t\tif success_delete_profile then",
            "\t\telse",
            "\t\tend",
            "\tend",
            "else",
            "end",
            "",
            "--- Remember to ensure all required ORM modules and 'db.init_models' are set up.",
            "--- This example assumes synchronous operations. Adapt for callbacks if using 'async' mode.",
            "---"
        },
        description = "Comprehensive example for defining and using Lua ORM Models (User & Profile)."
    },
    ["Lua Generic Middleware Skeleton"] = {
        prefix = "!dawn_middleware",
        body = {
            "return function(options)",
            " options = options or {} -- Optional: Process configuration options for the middleware",
            "",
            " return function(req, res, next)",
            "  -- Middleware logic goes here: {{name}}",
            "  -- skip middleware for WS, comment if you want the middleware to run WebSocket requests",
            "  --if req.method == \"WS\" then next() return end",
            "  -- You can access request (req) and response (res) objects.",
            "  -- For example, to read a header:",
            "  -- local auth_header = req:getHeader(\"authorization\")",
            "",
            "  -- Or to set a response header:",
            "  -- res:writeHeader(\"X-Custom-Header\", \"Value\")",
            "",
            "  -- To stop the request chain and send a response:",
            "  -- if some_condition then",
            "  -- return res:writeStatus(400):send(\"Bad Request\")",
            "  -- end",
            "",
            "  -- IMPORTANT: Call next() to pass control to the next middleware or route handler",
            "  next()",
            " end",
            "end"
        },
        description = "Generates a generic Lua middleware skeleton for uWebSockets applications."
    },
    ["Lua uWebSockets Routes Module"] = {
        prefix = "!dawn_route",
        body = {
            "local json = require('dkjson')",
            "",
            "local M = {}",
            "M.__index = M",
            "",
            "function M:new(server)",
            " local self = setmetatable({}, M)",
            " self.server = server",
            " return self",
            "end",
            "",
            "function M:routes()",
            "",
            " -- Your routes go here, e.g.:",
            " -- self.server:get(\"/api/{{route_base_name}}\", function(req, res)",
            " -- -- Your data handling logic",
            " -- res:writeStatus(200):send(\"Data\");",
            " -- end)",
            "",
            " -- self.server:post(\"/api/{{route_base_name}}\", function(req, res)",
            " -- -- Your item creation logic",
            " -- res:writeStatus(201):send(\"Item Created\");",
            " -- end)",
            "",
            "end",
            "",
            "return M"
        },
        description = "Lua uWebSockets module for defining server routes with common middleware setup."
    },
    ["Lua Create Table Migration"] = {
        prefix = "!dawn_migration",
        body = {
            "-- Auto-generated migration to create table for model '{{model_name_pascal_case}}'",
            "",
            "local SchemaManager = require(\"orm.schema_manager\")",
            "local models = require(\"models.init_models\")",
            "",
            "local model_to_migrate = models['{{model_name_pascal_case}}']", -- Changed lookup to PascalCase
            "",
            "if not model_to_migrate then",
            "\tos.exit(1)",
            "end",
            "",
            "",
            "-- Apply migrations (will create table if it doesn't exist, or alter if schema changed)",
            "SchemaManager.apply_migrations(model_to_migrate)",
            "",
        },
        description = "Generates a migration file to create a table based on a given model."
    },
    ["JavaScript Client Store with Reducers"] = {
        prefix = "!js_client_store",
        body = {
            "// {{name}}.js",
            "import { ",
            "  initializeStore, ",
            "  registerReducer, ",
            "  dispatch, ",
            "  getState,",
            "  subscribe ",
            "} from '/static/assets/js/clientStore.js';",
            "",
            "import { bindStateToDOM, initializeBindings } from '/static/assets/js/domBindings.js';",
            "",
            "// Initial state for generic data handling and pagination demo",
            "const initialState = {",
            "  pageTitle: \"Generic Reactive Store\",",
            "  inputModel: \"\",",
            "  data: [",
            "    { id: 1, name: \"Item A\" },",
            "    { id: 2, name: \"Item B\" },",
            "    { id: 3, name: \"Item C\" },",
            "    { id: 4, name: \"Item D\" }",
            "  ],",
            "  __page: {",
            "    data: 1",
            "  },",
            "  __perPage: {",
            "    data: 2",
            "  }",
            "};",
            "",
            "// Initialize the store with the initial state",
            "initializeStore(initialState);",
            "",
            "// --- Core Reducers ---",
            "",
            "// Reducer for two-way data binding on input elements",
            "registerReducer(\"__SET_MODEL\", (state, action) => {",
            "  const { key, value } = action;",
            "  // console.log(\"Setting model:\", key, value);",
            "  return {",
            "    ...state,",
            "    [key]: value",
            "  };",
            "});",
            "",
            "// Pagination: Move to the next page for a collection key",
            "registerReducer(\"__PAGE_NEXT\", (state, action) => {",
            "  const { key } = action;",
            "  const currentPage = state.__page?.[key] || 1;",
            "  const items = state[key];",
            "  ",
            "  if (!Array.isArray(items)) return state;",
            "  ",
            "  const perPage = state.__perPage?.[key] || items.length;",
            "  const totalPages = Math.ceil(items.length / perPage);",
            "  const nextPage = currentPage < totalPages ? currentPage + 1 : currentPage;",
            "  ",
            "  return {",
            "    ...state,",
            "    __page: {",
            "      ...state.__page,",
            "      [key]: nextPage",
            "    }",
            "  };",
            "});",
            "",
            "// Pagination: Move to the previous page for a collection key",
            "registerReducer(\"__PAGE_PREV\", (state, action) => {",
            "  const { key } = action;",
            "  const currentPage = state.__page?.[key] || 1;",
            "  const prevPage = currentPage > 1 ? currentPage - 1 : 1;",
            "  ",
            "  return {",
            "    ...state,",
            "    __page: {",
            "      ...state.__page,",
            "      [key]: prevPage",
            "    }",
            "  };",
            "});",
            "",
            "// Subscribe to store changes and update DOM",
            "subscribe((state) => {",
            "  bindStateToDOM(state, dispatch);",
            "});",
            "",
            "// Export for potential use elsewhere",
            "export { getState, dispatch };",
            "",
            "console.log(\"✅ Generic client store initialized\");"
        },
        description = "Minimal JavaScript client-side store template with core data binding and pagination reducers."
    }
}

local function generate_code(tp, name)
    local base = {
        controller = "controllers",
        model = "models",
        middleware = "routes/middlewares",
        fcomp = "lib/components",
        route = "routes",
        migration = "db/migrations",
        ["ui-reactors"] = "ui-reactors"
    }

    local dir = base[tp]
    if not dir then
        os.exit(1)
    end

    -- Use the new recursive directory creation function
    if not lfs.attributes(dir, "mode") then
        local success, err = create_dir_recursive(dir)
        if not success then
            os.exit(1)
        end
    end

    local template_data = {
        name = name,
        route_name = name,
        route_base_name = name,
        view_template_name = name
    }

    -- Specific template data for ORM model
    if tp == "model" then
        template_data.table_name_user = pascal_to_snake_plural(name) -- Derive snake_case plural
        template_data.table_name_profile = "profiles" -- This is a fixed related table
        template_data.model_name_profile = "Profile"
    end
    -- Specific template data for migration
    if tp == "migration" then
        template_data.model_name_pascal_case = name
        template_data.model_name_snake_case_plural = pascal_to_snake_plural(name) -- Derive snake_case plural
    end

    local snippet_key
    if tp == "controller" then
        snippet_key = "Lua Controller Class Usage"
    elseif tp == "model" then
        snippet_key = "Lua ORM Model Definition and Usage"
    elseif tp == "middleware" then
        snippet_key = "Lua Generic Middleware Skeleton"
    elseif tp == "fcomp" then
        snippet_key = "Lua Functional Component Usage"
    elseif tp == "route" then
        snippet_key = "Lua uWebSockets Routes Module"
    elseif tp == "migration" then
        snippet_key = "Lua Create Table Migration"
    elseif tp == "ui-reactors" then
        snippet_key = "JavaScript Client Store with Reducers"
    else
        os.exit(1)
    end

    local snippet = snippets[snippet_key]
    if not snippet then
        os.exit(1)
    end

    -- Determine the Lua filename based on type
    local lua_filename
    if tp == "migration" then
        -- For migrations, name it based on the action and derived model name
        lua_filename = string.format("%s/create_%s_table.lua", dir, template_data.model_name_snake_case_plural)
    elseif tp == "ui-reactors" then
        -- For UI Reactors, create a .js file
        lua_filename = string.format("%s/%s.js", dir, name)
    else
        lua_filename = string.format("%s/%s.lua", dir, name)
    end

    -- Render and write the file
    local content = lustache:render(table.concat(snippet.body, "\n"), template_data)
    local file = io.open(lua_filename, "w")
    if not file then
        os.exit(1)
    end
    file:write(content)
    file:close()

    -- Generate corresponding .mustache file for fcomp type
    if tp == "fcomp" then
        local view_dir = "views/components"
        -- Use the new recursive directory creation function here too
        if not lfs.attributes(view_dir, "mode") then
            local success, err = create_dir_recursive(view_dir)
            if not success then
                os.exit(1)
            end
        end

        local mustache_content = string.format("<div class=\"%s\">\n\n</div>", template_data.view_template_name)
        local mustache_filename = string.format("%s/%s.mustache", view_dir, template_data.view_template_name)
        local mustache_file = io.open(mustache_filename, "w")
        if not mustache_file then
            os.exit(1)
        end
        mustache_file:write(mustache_content)
        mustache_file:close()
    end
end

local function is_package_installed(pkg)
    local f = io.popen("luarocks list --porcelain " .. pkg)
    local output = f:read("*a")
    f:close()
    return output and output:match("^" .. pkg .. "%s+%d")
end

local function install_dependencies(project_name, force)

    local dep_file = "config/dependencies.json"
    if not lfs.attributes(dep_file) then
        os.exit(1)
    end

    local file = io.open(dep_file, "r")
    local data = file:read("*a")
    file:close()

    local deps, _, err = json.decode(data)
    if not deps then
        os.exit(1)
    end

    local installed, skipped, failed = {}, {}, {}

    for _, dep in ipairs(deps) do
        local pkg = dep.name
        local version = dep.version or ""
        local already_installed = is_package_installed(pkg)

        if not force and already_installed then
            table.insert(skipped, pkg)
        else
            local cmd = "luarocks install " .. pkg
            if version ~= "" then
                cmd = cmd .. " " .. version
            end
            -- Uncomment the line below if you want to force local installation by default
            -- cmd = cmd .. " --local"

            local result = os.execute(cmd)
            if result == 0 then
                table.insert(installed, pkg)
            else
                table.insert(failed, pkg)
            end
        end
    end


    if #failed > 0 then
        os.exit(1)
    end
end


-- Main CLI dispatcher
local cmd = arg[1]

if cmd == "new" and arg[2] then
    download_project_structure(arg[2])

elseif cmd == "install" then
    local project_name = arg[2] -- Could be a project name or "--force"
    local force = false

    if project_name == "--force" then
        force = true
        project_name = nil -- No specific project name, just force install in current dir
    elseif arg[3] == "--force" then
        force = true
    end

    install_dependencies(project_name, force)


elseif cmd == "serve" then
    run_server()

elseif cmd == "generate" and arg[2] and arg[3] then
    generate_code(arg[2], arg[3])

elseif cmd == "db" and arg[2] == "migrate" then
    run_migrations(arg[3]) -- arg[3] will be nil if no file is specified

elseif cmd == "db" and arg[2] == "create_table" and arg[3] then
    create_table_for_model(arg[3])

elseif cmd == "db" and arg[2] == "drop_table" and arg[3] then
    drop_table_for_model(arg[3])

elseif cmd == "test" then
    run_tests()

elseif cmd == "version" then
    get_version()

elseif cmd == "help" or cmd == nil then
    print_help()

else
    print_help()
    os.exit(1)
end
EOF

    if [ -f "dawn.lua" ]; then
        echo -e "  ${CHECK_MARK} 'dawn.lua' created successfully."
        INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    else
        echo -e "  ${CROSS_MARK} Failed to create 'dawn.lua'."
        FAILED_COUNT=$((FAILED_COUNT + 1))
        FAILED_PACKAGES+=("dawn.lua creation")
        exit 1 # Exit if the core CLI script cannot be created
    fi
}

# --- Main Script Execution ---

# Check for -Y argument
if [[ " $* " =~ " -Y " ]] || [[ " $* " =~ " --yes-to-all " ]]; then
    YES_TO_ALL=true
    echo -e "${INFO_ICON} ${CYAN}Running in non-interactive mode (auto-yes to all prompts).${NC}"
fi

# Ensure running as root for apt commands
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}${CROSS_MARK} This script must be run as root.${NC}"
   echo -e "${INFO_ICON} Please run with: ${YELLOW}sudo ./build_dawn.sh${NC}"
   exit 1
fi

log_header "Starting Dawn Web Framework Installation"

# 1. Generate dawn.lua
generate_dawn_lua

# 2. Set Dawn CLI (make executable and move to /usr/local/bin)
log_header "Setting up Dawn CLI"
if [ -f "dawn.lua" ]; then
    if confirm_action "Make dawn.lua executable and move it to /usr/local/bin?"; then
        echo -e "${ARROW_ICON} Making dawn.lua executable..."
        if chmod +x dawn.lua; then
            echo -e "  ${CHECK_MARK} dawn.lua is now executable."
            echo -e "${ARROW_ICON} Moving dawn.lua to /usr/local/bin/dawn..."
            if mv dawn.lua /usr/local/bin/dawn; then
                echo -e "  ${CHECK_MARK} Dawn CLI installed at /usr/local/bin/dawn."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to move dawn.lua to /usr/local/bin. Manual intervention may be required."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("Move dawn.lua")
            fi
        else
            echo -e "  ${CROSS_MARK} Failed to make dawn.lua executable."
            FAILED_COUNT=$((FAILED_COUNT + 1))
            FAILED_PACKAGES+=("Chmod dawn.lua")
        fi
    else
        echo -e "  ${INFO_ICON} Skipping Dawn CLI setup. You will need to manage 'dawn.lua' manually."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
else
    echo -e "${WARNING_ICON} dawn.lua not found. Cannot set up CLI."
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_PACKAGES+=("dawn.lua not found for CLI setup")
fi


# 3. Install system dependencies
log_header "Installing System Dependencies"
check_and_install_apt_dep "git" "Git" "sudo apt install -y git"
check_and_install_apt_dep "cmake" "CMake" "sudo apt install -y cmake"
check_and_install_apt_dep "python3" "Python 3" "sudo apt install -y python3"
check_and_install_apt_dep "g++" "G++ Compiler" "sudo apt install -y g++"
check_and_install_apt_dep "libssl-dev" "OpenSSL Development Libraries" "sudo apt install -y libssl-dev"
check_and_install_apt_dep "zlib1g-dev" "Zlib Development Libraries" "sudo apt install -y zlib1g-dev"
check_and_install_apt_dep "libpq-dev" "PostgreSQL Development Libraries" "sudo apt install -y libpq-dev"
check_and_install_apt_dep "lua5.1" "Lua 5.1" "sudo apt install -y lua5.1" # Though luajit is preferred, lua5.1 is a dependency for some luarocks
check_and_install_apt_dep "luajit" "LuaJIT" "sudo apt install -y luajit"
check_and_install_apt_dep "libluajit-5.1-dev" "LuaJIT Development Libraries" "sudo apt install -y libluajit-5.1-dev"
check_and_install_apt_dep "luarocks" "LuaRocks" "sudo apt install -y luarocks"

# 4. Install LuaRocks dependencies
log_header "Installing LuaRocks Dependencies"
# Ensure LuaRocks is installed before trying to use it
if command_exists "luarocks"; then
    check_and_install_luarocks_dep "luafilesystem" "LuaFileSystem"
    check_and_install_luarocks_dep "dkjson" "dkjson"
    check_and_install_luarocks_dep "lustache" "Lustache"
else
    echo -e "${RED}${CROSS_MARK} LuaRocks is not installed. Skipping LuaRocks package installations.${NC}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_PACKAGES+=("LuaRocks itself")
fi

# 5. Install and configure PostgreSQL
log_header "Installing and Configuring PostgreSQL"
check_and_install_apt_dep "postgresql" "PostgreSQL Server" "sudo apt install -y postgresql postgresql-contrib postgresql-server-dev-all postgresql-client"

if is_apt_package_installed "postgresql"; then
    if confirm_action "Enable and start PostgreSQL service?"; then
        echo -e "${ARROW_ICON} Attempting to enable PostgreSQL service..."
        if is_systemd_active; then
            if sudo systemctl enable postgresql; then
                echo -e "  ${CHECK_MARK} PostgreSQL service enabled via systemctl."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to enable PostgreSQL service via systemctl."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("PostgreSQL service enable (systemctl)")
            fi
        else
            echo -e "  ${INFO_ICON} Systemd not detected. Attempting to enable PostgreSQL service via 'service' command..."
            if sudo update-rc.d postgresql enable; then # For SysVinit enable
                echo -e "  ${CHECK_MARK} PostgreSQL service enabled via update-rc.d."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to enable PostgreSQL service via update-rc.d."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("PostgreSQL service enable (SysVinit)")
            fi
        fi

        echo -e "${ARROW_ICON} Attempting to start PostgreSQL service..."
        if is_systemd_active; then
            if sudo systemctl start postgresql; then
                echo -e "  ${CHECK_MARK} PostgreSQL service started via systemctl."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to start PostgreSQL service via systemctl."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("PostgreSQL service start (systemctl)")
            fi
        else
            echo -e "  ${INFO_ICON} Systemd not detected. Attempting to start PostgreSQL service via 'service' command..."
            if sudo service postgresql start; then
                echo -e "  ${CHECK_MARK} PostgreSQL service started via service command."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to start PostgreSQL service via service command."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("PostgreSQL service start (service)")
            fi
        fi
    else
        echo -e "  ${INFO_ICON} Skipping PostgreSQL service management."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
else
    echo -e "${WARNING_ICON} PostgreSQL is not installed. Skipping service configuration."
fi

# 6. Install and configure Redis
log_header "Installing and Configuring Redis"
check_and_install_apt_dep "redis-server" "Redis Server" "sudo apt install -y redis-server"

if is_apt_package_installed "redis-server"; then
    if confirm_action "Enable and start Redis service?"; then
        echo -e "${ARROW_ICON} Attempting to enable Redis service..."
        if is_systemd_active; then
            if sudo systemctl enable redis-server; then
                echo -e "  ${CHECK_MARK} Redis service enabled via systemctl."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to enable Redis service via systemctl."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("Redis service enable (systemctl)")
            fi
        else
            echo -e "  ${INFO_ICON} Systemd not detected. Attempting to enable Redis service via 'service' command..."
            if sudo update-rc.d redis-server enable; then # For SysVinit enable
                echo -e "  ${CHECK_MARK} Redis service enabled via update-rc.d."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to enable Redis service via update-rc.d."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("Redis service enable (SysVinit)")
            fi
        fi

        echo -e "${ARROW_ICON} Attempting to start Redis service..."
        if is_systemd_active; then
            if sudo systemctl start redis-server; then
                echo -e "  ${CHECK_MARK} Redis service started via systemctl."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to start Redis service via systemctl."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("Redis service start (systemctl)")
            fi
        else
            echo -e "  ${INFO_ICON} Systemd not detected. Attempting to start Redis service via 'service' command..."
            if sudo service redis-server start; then
                echo -e "  ${CHECK_MARK} Redis service started via service command."
                INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
            else
                echo -e "  ${CROSS_MARK} Failed to start Redis service via service command."
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_PACKAGES+=("Redis service start (service)")
            fi
        fi
        
        # Optional: Run Redis as a daemon if not already
        if ! pgrep -x "redis-server" > /dev/null; then
            if confirm_action "Run Redis as a daemon (recommended)?"; then
                echo -e "${ARROW_ICON} Running Redis as a daemon..."
                if redis-server --daemonize yes; then
                    echo -e "  ${CHECK_MARK} Redis is now running in daemon mode."
                    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
                else
                    echo -e "  ${CROSS_MARK} Failed to start Redis in daemon mode."
                    FAILED_COUNT=$((FAILED_COUNT + 1))
                    FAILED_PACKAGES+=("Redis daemonize")
                fi
            else
                echo -e "  ${INFO_ICON} Skipping Redis daemonization."
                SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            fi
        else
            echo -e "  ${CHECK_MARK} Redis is already running."
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    else
        echo -e "  ${INFO_ICON} Skipping Redis service management."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
else
    echo -e "${WARNING_ICON} Redis server is not installed. Skipping service configuration."
fi

# --- Final Metrics and Summary ---
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_header "Installation Summary"
echo -e "${GREEN}${CHECK_MARK} Total successful operations: ${INSTALLED_COUNT}${NC}"
echo -e "${CYAN}${INFO_ICON} Total skipped operations: ${SKIPPED_COUNT}${NC}"
echo -e "${RED}${CROSS_MARK} Total failed operations: ${FAILED_COUNT}${NC}"

if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
    echo -e "\n${RED}${WARNING_ICON} Details of failed operations:${NC}"
    for pkg in "${FAILED_PACKAGES[@]}"; do
        echo -e "  ${RED}- ${pkg}${NC}"
    done
fi

echo -e "\n${BLUE}${STAR_ICON} Script finished in ${DURATION} seconds.${NC}"

if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "${RED}Please review the failures and try to resolve them manually.${NC}"
    exit 1
else
    echo -e "${GREEN}All requested Dawn Web Framework components and dependencies installed/checked successfully!${NC}"
    echo -e "${YELLOW}You can now use 'dawn' command from anywhere in your terminal.${NC}"
fi

exit 0
