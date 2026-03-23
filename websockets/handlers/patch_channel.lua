-- Patch Channel WebSocket Handler
-- This module handles WebSocket connections for patch subscriptions,
local cjson = require("dkjson")
local uuid = require("utils.uuid")
local log_level = require("utils.logger").LogLevel
local base64 = require("utils.base64")
local lfs = require("lfs")

local logger = {
    info = function(...) print("INFO:", ...) end,
    warn = function(...) print("WARN:", ...) end,
    error = function(...) print("ERROR:", ...) end,
    debug = function(...) print("DEBUG:", ...) end,
}

-- Utility functions
local function split_comma_list(val)
    if type(val) == "string" and #val > 0 then
        local t = {}
        for item in val:gmatch("[^,]+") do
            table.insert(t, item)
        end
        return t
    elseif type(val) == "table" then
        return val
    end
    return nil
end

local function safe_redis_decode(json_str)
    if not json_str then return nil end
    local success, decoded = pcall(cjson.decode, json_str)
    if not success then
        logger.error("Failed to decode JSON from Redis: ", decoded)
        return nil
    end
    return decoded
end

local function safe_redis_encode(data)
    local success, encoded = pcall(cjson.encode, data)
    if not success then
        logger.error("Failed to encode JSON for Redis: ", encoded)
        return nil
    end
    return encoded
end

-- PatchWSHandler Class
local PatchWSHandler = {}
PatchWSHandler.__index = PatchWSHandler

function PatchWSHandler:new()
    return setmetatable({}, PatchWSHandler)
end

-- shouldSend logic
local function shouldSend(patch, filters)
    if not filters then return true end

    if filters.component and patch.component then
        local ok = false
        for _, allowed in ipairs(filters.component) do
            if patch.component == allowed or patch.component:sub(1, #allowed) == allowed then
                ok = true; break
            end
        end
        if not ok then return false end
    end

    if filters.not_component and patch.component then
        for _, blocked in ipairs(filters.not_component) do
            if patch.component == blocked or patch.component:sub(1, #blocked) == blocked then
                return false
            end
        end
    end

    if filters.path and patch.path then
        if not (patch.path:sub(1, #filters.path) == filters.path) then return false end
    end

    if filters.not_path and patch.path then
        if (patch.path:sub(1, #filters.not_path) == filters.not_path) then return false end
    end

    return true
end

-- function PatchWSHandler:start_broadcast_loop(_, _, _, shared, _, presence)
--     local handler_self = self

--     self.server.patch_queue:on_push(function(patch)
--         local active_ws_ids, err = presence.redis:smembers("active_subscribers_set")
--         -- print cjson patch
--         print("Broadcasting patch:", cjson.encode(patch))
--         if not active_ws_ids then
--             self.server.logger:log(log_level.ERROR, string.format("Redis SMEMBERS failed: %s", err), "PatchWSHandler", "start_broadcast_loop")
--             return
--         end

--         print("Active subscribers count:", #active_ws_ids)

--         if #active_ws_ids == 0 then return end

--         local keys = {}
--         for _, id in ipairs(active_ws_ids) do
--             table.insert(keys, "subscriber:" .. id)
--         end

--         local sub_jsons, err = presence.redis:mget(unpack(keys))
--         print("Retrieved subscriber data for active subscribers : ",  cjson.encode(sub_jsons))
--         if not sub_jsons then
--             self.server.logger:log(log_level.ERROR, string.format("Redis MGET failed: %s", err), "PatchWSHandler", "start_broadcast_loop")
--             return
--         end


--         local timestamp_updates = {}
--         local current_time = os.time()
--         for i, json in ipairs(sub_jsons) do
--             local ws_id = active_ws_ids[i]
--             if not json then
--                 presence.redis:srem("active_subscribers_set", ws_id)
--             else
--                 local sub = safe_redis_decode(json)
--                 -- if sub and shouldSend(patch, sub.filters) then
                
--                     shared.sockets:send_to_user(ws_id, {
--                         id = uuid.v4(),
--                         type = "patches",
--                         data = patch
--                     })

--                     table.insert(timestamp_updates, ws_id)
--                     table.insert(timestamp_updates, current_time)
--                 -- end
--             end
--         end

--         if #timestamp_updates > 0 then
--             local ok, err = presence.redis:hmset("global_last_patch_time", unpack(timestamp_updates))
--             if not ok then
--                 self.server.logger:log(log_level.ERROR, string.format("Failed to update timestamps: %s", err), "PatchWSHandler", "start_broadcast_loop")
--             else
--                 presence.redis:expire("global_last_patch_time", 86400)
--             end
--         end
--     end)

--     self.server.logger:log(log_level.INFO, "Patch dispatcher registered (event-driven, no loop)", "PatchWSHandler", "start_broadcast_loop")
-- end

function PatchWSHandler:start_broadcast_loop(_, _, _, shared, _, presence)

    local server = self.server
    local redis = presence.redis
    local sockets = shared.sockets
    local logger = server.logger

    server.patch_queue:on_push(function(patch)

        local active_ws_ids, err = redis:smembers("active_subscribers_set")
        if not active_ws_ids then
            logger:log(
                log_level.ERROR,
                string.format("Redis SMEMBERS failed: %s", err),
                "PatchWSHandler",
                "start_broadcast_loop"
            )
            return
        end

        local count = #active_ws_ids
        if count == 0 then return end

        -- Build subscriber keys
        local keys = {}
        for i = 1, count do
            keys[i] = "subscriber:" .. active_ws_ids[i]
        end

        local sub_jsons, err = redis:mget(unpack(keys))
        if not sub_jsons then
            logger:log(
                log_level.ERROR,
                string.format("Redis MGET failed: %s", err),
                "PatchWSHandler",
                "start_broadcast_loop"
            )
            return
        end

        local now = os.time()
        local timestamp_updates = {}
        local ts_index = 1

        for i = 1, count do
            local ws_id = active_ws_ids[i]
            local json = sub_jsons[i]

            if not json then
                redis:srem("active_subscribers_set", ws_id)

            else
                local sub = safe_redis_decode(json)

                if sub and shouldSend(patch, sub.filters) then

                    sockets:send_to_user(ws_id, {
                        id = uuid.v4(),
                        type = "patches",
                        data = { patch }
                    })

                    timestamp_updates[ts_index] = ws_id
                    timestamp_updates[ts_index + 1] = now
                    ts_index = ts_index + 2
                end
            end
        end

        if ts_index > 1 then
            local ok, err = redis:hmset(
                "global_last_patch_time",
                unpack(timestamp_updates, 1, ts_index - 1)
            )

            if not ok then
                logger:log(
                    log_level.ERROR,
                    string.format("Failed to update timestamps: %s", err),
                    "PatchWSHandler",
                    "start_broadcast_loop"
                )
            else
                redis:expire("global_last_patch_time", 86400)
            end
        end

    end)

    logger:log(
        log_level.INFO,
        "Patch dispatcher registered",
        "PatchWSHandler",
        "start_broadcast_loop"
    )
end

function PatchWSHandler:subscribe(ws, payload, state, shared, topic, presence)
    local ws_id = shared.sockets:safe_get_ws_id(ws)
    local comp_key = payload.component_key or "app_component_instance"
    local client_token  = payload.client_token or nil
    local filters = {
        component_key = comp_key,
        filters = {
            component = split_comma_list(payload.component),
            not_component = split_comma_list(payload.not_component),
            path = payload.path,
            not_path = payload.not_path
        }
    }

    local sub_key = "subscriber:" .. ws_id
    local encoded_filters = safe_redis_encode(filters)
    if encoded_filters then
        local ok, err = presence.redis:set(sub_key, encoded_filters)
        if ok then presence.redis:expire(sub_key, 86400) end
    end
    presence.redis:sadd("active_subscribers_set", ws_id)
    presence.redis:sadd("component_subscribers:" .. comp_key, ws_id)

    local redis_state = presence:retrieve_state("component_state:" .. comp_key)

    local client_state_key = string.format("client_state:%s:%s", comp_key, client_token or ws_id)
    local redis_client_state = presence:retrieve_state(client_state_key)

    local comp = self.server:get_component(comp_key) or {}
    
    comp.state = redis_state or {}
    comp.client_token  = client_token or ws_id
    comp.client_states = comp.client_states or {}
    comp.client_states[client_token or ws_id] = redis_client_state or {}

    local patch_key = "component_patch_log:" .. comp_key
    local patch_log_json, err_lrange = presence.redis:lrange(patch_key, 0, 50)
    if not patch_log_json then
        self.server.logger:log(log_level.ERROR, string.format("Redis LRANGE failed for patch log %s: %s", patch_key, err_lrange), "PatchWSHandler", "start_broadcast_loop")
        patch_log_json = {}
    end

    local last_seen_id = payload.last_patch_id
    local replaying = (last_seen_id == nil)
    print("Replaying patches for", ws_id, "from", last_seen_id or "beginning")
    for _, patch_json_str in ipairs(patch_log_json) do
        local patch_entry = safe_redis_decode(patch_json_str)
        if patch_entry and patch_entry.patch then
            local patch_id = patch_entry.patch.id

            if not replaying and patch_id == last_seen_id then
                replaying = true
            elseif replaying then
                print("Replaying patch to", ws_id, "patch id:", patch_id, "data:", cjson.encode(patch_entry.patch))
                shared.sockets:send_to_user(ws_id, {
                    id = uuid.v4(),
                    type = "patches",
                    data = { patch_entry.patch }
                })
            end
        else
            self.server.logger:log(log_level.WARN, string.format("Skipping malformed patch entry in log for %s: %s", patch_key, patch_json_str), "PatchWSHandler", "start_broadcast_loop")
        end
    end

    shared.sockets:push_notification(ws, {
        id = uuid.v4(),
        event = "subscribed_to_patches",
        data = { onSuscribe = true, component_key = comp_key, filters = filters.filters }
    })

    -- if comp.onJoin then
    --     comp:onJoin(ws_id, client_token)
    -- end

    self.server.logger:log(log_level.INFO, string.format("Client %s subscribed to '%s'", ws_id, comp_key), "PatchWSHandler", "start_broadcast_loop")
end

function PatchWSHandler:unsubscribe(ws, payload, state, shared, topic, presence)
    local ws_id = shared.sockets:safe_get_ws_id(ws) or shared.WebSocket_tocleanup
    local sub_key = "subscriber:" .. ws_id

    -- Remove Redis subscription entry
    local ok_del, err_del = presence.redis:del(sub_key)
    if not ok_del then
        self.server.logger:log(log_level.ERROR, string.format(
            "Redis DEL failed for subscriber key %s: %s", sub_key, err_del
        ), "PatchWSHandler", "unsubscribe")
    end

    -- Remove from active subscribers set
    local ok_srem, err_srem = presence.redis:srem("active_subscribers_set", ws_id)
    if not ok_srem then
        self.server.logger:log(log_level.ERROR, string.format(
            "Redis SREM failed for active_subscribers_set: %s", err_srem
        ), "PatchWSHandler", "unsubscribe")
    end

    -- Remove all client-related state from FunctionalComponent instances
    if self.server and self.server.reactive_components then
        for _, comp in pairs(self.server.reactive_components) do
            if type(comp.client_states) == "table" and comp.client_states[ws_id] then
                comp.client_states[ws_id] = nil
            end
            if type(comp.clients) == "table" then
                comp.clients[ws_id] = nil
            end
            -- Remove Redis-stored client state for this component
            if self.server.dawn_sockets_handler.state_management.redis and comp.component_key then
                self.server.logger:log(log_level.INFO,
                    string.format("Clearing Redis client state for %s:%s", comp.component_key, ws_id),
                    "PatchWSHandler", "unsubscribe"
                )
                local redis_key = string.format("client_state:%s:%s", comp.component_key, ws_id)
                local ok, err = pcall(function()
                    self.server.dawn_sockets_handler.state_management.redis:del(redis_key)
                end)
                if not ok then
                    self.server.logger:log(log_level.WARN,
                        string.format("Redis DEL failed for %s: %s", redis_key, tostring(err)),
                        "PatchWSHandler", "unsubscribe"
                    )
                end
            end
        end
    end

    self.server.logger:log(log_level.INFO,
        string.format("Client %s unsubscribed and state cleared.", ws_id),
        "PatchWSHandler", "unsubscribe"
    )
end

-- Ping function (no major changes, already efficient)
function PatchWSHandler:ping(ws, payload, state, shared, topic, presence)
    local ws_id = shared.sockets:safe_get_ws_id(ws)
    shared.sockets:push_notification(ws, {
        id = uuid.v4(),
        event = "pong",
        data = { time = os.time() }
    })
    self.server.logger:log(log_level.DEBUG, string.format("Client %s ping -> pong", ws_id), "PatchWSHandler", "ping")
end

-- Process client action function - UPDATED for new function syntax
function PatchWSHandler:process_client_action(ws, payload, state, shared, topic, presence)
   
    local methodName = payload.method
    local args = payload.args or {}
    local comp_key = payload.component_key or "app_component_instance"
    
    local component = self.server:get_component(comp_key)
    
    local ws_id = shared.sockets:safe_get_ws_id(ws)
    local client_token = payload.client_token
    print("[DEBUG] Client details - WS ID:", ws_id, "| Client token:", client_token)
    
    if not component then
        print("[ERROR] Component not found:", comp_key)
        print("[DEBUG] Sending error notification to client")
        shared.sockets:push_notification(ws, {
            id = uuid.v4(),
            type = "error",
            event = "action_failed",
            data = { message = "Component not found: " .. comp_key }
        })
        self.server.logger:log(log_level.WARN, string.format("Action failed: Component not found for client %s, key: %s", ws_id, comp_key), "PatchWSHandler", "process_client_action")
        print("[DEBUG] ================== END process_client_action (Component not found) ==================")
        return
    end
    
    -- Ensure component is initialized for this client
    print("[DEBUG] Checking if component is initialized for client:", ws_id)
    if not component.ws_id then 
        print("[INFO] Initializing component for client:", ws_id, "with client token:", client_token)
        print("[DEBUG] Calling component:onJoin() method")
        component:onJoin(ws_id, client_token)
        print("[DEBUG] Component initialization complete")
    else
        print("[DEBUG] Component already initialized for client")
    end
    
    local patches = {}
    print("[DEBUG] Starting method execution lookup")

    component.client_token = client_token
    
    -- Try to call the component method first
    if type(component.methods) == "table" and type(component.methods[methodName]) == "function" then
        print("[DEBUG] Found method in component.methods[" .. methodName .. "]")
        print("[DEBUG] Calling direct method with args:", cjson.encode(args))
        -- Direct method call (for methods that return patches directly)
        patches = component.methods[methodName](component, ws_id, args) or {}
        print("[DEBUG] Direct method returned patches count:", #patches)
    elseif type(component.patch) == "function" then
        print("[DEBUG] Method not found in component.methods, using component:patch() as fallback")
        patches = component:patch(ws_id, methodName, args) or {}
        print("[DEBUG] Patch method returned patches count:", #patches)
    else
        print("[ERROR] Method not found:", methodName, "for component:", comp_key)
        print("[DEBUG] Sending method not found error notification")
        shared.sockets:push_notification(ws, {
            id = uuid.v4(),
            type = "error",
            event = "action_failed",
            data = { message = "Component method '" .. methodName .. "' not found for: " .. comp_key }
        })
        self.server.logger:log(log_level.WARN, string.format("Action failed: Component method '%s' not found for client %s, key: %s", methodName, ws_id, comp_key), "PatchWSHandler", "process_client_action")
        print("[DEBUG] ================== END process_client_action (Method not found) ==================")
        return
    end
    
    -- print("[DEBUG] Raw patches before processing:", patches and type(patches) == "table" and "Table with " .. #patches .. " items" or tostring(patches))
    
    -- -- Ensure patches is a table (might be nil or single patch)
    -- if patches and not (type(patches) == "table" and #patches > 0) then
    --     print("[DEBUG] Patches need normalization - checking if single patch object")
    --     -- Check if patches is a single patch object
    --     if patches.type then
    --         print("[DEBUG] Converting single patch to table")
    --         patches = { patches }
    --     else
    --         print("[DEBUG] Setting patches to empty table")
    --         patches = {}
    --     end
    -- end
    
    print("[DEBUG] Final patches count:", #patches)
    
    -- local patch_key = "component_patch_log:" .. comp_key
    -- local patch_redis_commands = {}
    -- print("[DEBUG] Patch Redis key:", patch_key)

    -- if #patches > 0 then
    --     print("[DEBUG] Processing", #patches, "patches for Redis logging")
    --     for i, patch in ipairs(patches) do
    --         print("[DEBUG] Processing patch", i, "- ID:", patch.id, "- Type:", patch.type)
            
    --         -- Ensure patch has required fields
    --         patch.id = patch.id or uuid.v4()
    --         patch.component = patch.component or self.server:get_patch_namespace(comp_key, patch.varName or patch.path or "")
    --         print("[DEBUG] Patch after enhancement - ID:", patch.id, "- Component:", patch.component)
            
    --         -- Add patch to queue for broadcasting
    --         print("[DEBUG] Adding patch to server patch_queue")
    --         self.server.patch_queue:push(patch)
    --         print("[DEBUG] Patch added to queue successfully")
            
    --         -- Prepare patch for Redis log
    --         local patch_entry = {
    --             timestamp = os.time(),
    --             patch = patch
    --         }
    --         print("[DEBUG] Created patch entry with timestamp:", patch_entry.timestamp)
            
    --         local json_patch = safe_redis_encode(patch_entry)
    --         if json_patch then
    --             print("[DEBUG] Patch encoded successfully, adding to Redis commands")
    --             table.insert(patch_redis_commands, {"LPUSH", patch_key, json_patch})
    --         else
    --             print("[ERROR] Failed to encode patch entry for component", comp_key)
    --             self.server.logger:log(log_level.ERROR, string.format("Failed to encode patch entry for component %s", comp_key), "PatchWSHandler", "process_client_action")
    --         end
    --     end

    --     -- Add LTRIM command to keep only last 100 patches
    --     print("[DEBUG] Adding LTRIM command to keep only last 100 patches")
    --     table.insert(patch_redis_commands, {"LTRIM", patch_key, 0, 99})
    --     print("[DEBUG] Total Redis commands prepared:", #patch_redis_commands)

    --     -- Execute Redis commands for patches in a pipeline
    --     if #patch_redis_commands > 0 then
    --         print("[DEBUG] Executing Redis pipeline for patch logging")
    --         local ok, err = presence:call_pipeline(patch_redis_commands)
    --         if not ok then
    --             print("[ERROR] Redis pipeline failed for", patch_key, "Error:", err)
    --             self.server.logger:log(log_level.ERROR, string.format("Redis pipeline for patch log failed for %s: %s", patch_key, err), "PatchWSHandler", "process_client_action")
    --         else
    --             print("[DEBUG] Redis pipeline executed successfully")
    --         end
    --     end
    -- else
    --     print("[DEBUG] No patches to process for Redis logging")
    -- end
    
    -- State persistence logic - UPDATED for new state management
    -- print("[DEBUG] =========== Starting state persistence logic ===========")
    -- print("[DEBUG] Checking if component has state:", component.state and "Yes" or "No")
    
    -- if component.state then
    --     local state_key = "component_state:" .. comp_key
    --     print("[DEBUG] State Redis key:", state_key)
        
    --     print("[DEBUG] Encoding component state to JSON")
    --     local new_json = safe_redis_encode(component.state)
    --     if not new_json then
    --         print("[ERROR] Failed to encode component state for", comp_key)
    --         self.server.logger:log(log_level.ERROR, string.format("Failed to encode component state for %s", comp_key), "PatchWSHandler", "process_client_action")
    --         print("[DEBUG] ================== END process_client_action (State encoding failed) ==================")
    --         return
    --     end
    --     print("[DEBUG] State encoded successfully")

    --     -- Check if state has changed
    --     print("[DEBUG] Checking if state has changed")
    --     print("[DEBUG] Previous serialized state:", component._last_serialized and "Exists" or "None")
    --     print("[DEBUG] New serialized state length:", #new_json)
        
    --     if component._last_serialized ~= new_json then
    --         print("[INFO] State has changed, persisting new state")
    --         component._last_serialized = new_json
    --         component._version = 0
    --         print("[DEBUG] Calling presence:persist_state() with TTL 3600")
    --         presence:persist_state(state_key, component.state, 3600)
    --         print("[INFO] Component state updated and persisted for", comp_key)
    --         self.server.logger:log(log_level.INFO, string.format("Component state updated and persisted for %s", comp_key), "PatchWSHandler", "process_client_action")
    --     else
    --         print("[DEBUG] State unchanged, incrementing version")
    --         component._version = (component._version or 0) + 1
    --         print("[DEBUG] Current version:", component._version)
            
    --         if component._version % 10 == 0 then
    --             print("[INFO] Version", component._version, "triggering periodic state persistence")
    --             print("[DEBUG] Calling presence:persist_state() with TTL 3600")
    --             presence:persist_state(state_key, component.state, 3600)
    --             print("[INFO] Component state persisted (version", component._version, ") for", comp_key)
    --             self.server.logger:log(log_level.INFO, string.format("Component state persisted (version %d) for %s", component._version, comp_key), "PatchWSHandler", "process_client_action")
    --         else
    --             print("[DEBUG] Version", component._version, "skipping persistence (not multiple of 10)")
    --         end
    --     end
    -- else
    --     print("[DEBUG] Component has no state, skipping state persistence")
    -- end

    -- Also persist client state if it exists for this user
    -- print("[DEBUG] =========== Starting client state persistence logic ===========")
    -- print("[DEBUG] Checking if component has client_states:", component.client_states and "Yes" or "No")
    
    -- if component.client_states and component.client_states[client_token or ws_id] then
    --     local client_state_key = string.format("client_state:%s:%s", comp_key, client_token or ws_id)
    --     local client_state = component.client_states[client_token or ws_id]
    --     print("[DEBUG] Client state key:", client_state_key)
    --     print("[DEBUG] Client state found:", client_state and "Yes" or "No")
        
    --     if type(client_state) == "table" and next(client_state) then
    --         print("[DEBUG] Client state is non-empty table, persisting with TTL 86400")
    --         presence:persist_state(client_state_key, client_state, 86400)
    --         print("[INFO] Client state persisted for", comp_key, ":", client_token or ws_id)
    --         self.server.logger:log(log_level.DEBUG, string.format("Client state persisted for %s:%s", comp_key, client_token or ws_id), "PatchWSHandler", "process_client_action")
    --     else
    --         print("[DEBUG] Client state is empty or not a table, skipping persistence")
    --     end
    -- else
    --     print("[DEBUG] No client state found for this user")
    -- end
    
    print("[DEBUG] ================== END process_client_action (Success) ==================")
end

local in_progress_uploads = {}

function PatchWSHandler:process_upload_file_chunk(ws, payload, state, shared, topic, presence)
    local ws_id = shared.sockets:safe_get_ws_id(ws)
    local file_id = payload.args.fileId
    local chunk_id = payload.args.chunkId
    local is_last_chunk = payload.args.isLastChunk
    local file_object = payload.args.fileObject
    local mime_type = file_object.details.mimeType

    -- Use original filename or fallback
    local original_filename = file_object.name or ("upload_" .. os.time())
    -- Sanitize dangerous characters
    local safe_filename = string.gsub(original_filename, "[/\\?%%*|\"<>:]", "_")

    -- Ensure uploads directory exists
    local upload_dir = "./uploads"
    local attr = lfs.attributes(upload_dir)
    if not attr then
        lfs.mkdir(upload_dir)
    end

    -- Split filename into base + extension
    local base, ext = safe_filename:match("^(.*)%.(.-)$")
    if not base then
        base = safe_filename
        ext = ""
    end

    local final_filename = safe_filename
    local file_path = upload_dir .. "/" .. final_filename

    -- Prevent overwrite → append UUID if file exists
    local counter = 0
    while lfs.attributes(file_path) do
        local unique = uuid.v4()
        if ext ~= "" then
            final_filename = string.format("%s_%s.%s", base, unique, ext)
        else
            final_filename = string.format("%s_%s", base, unique)
        end
        file_path = upload_dir .. "/" .. final_filename
        counter = counter + 1
        if counter > 5 then
            -- safety fallback
            final_filename = base .. "_" .. os.time() .. (ext ~= "" and ("." .. ext) or "")
            file_path = upload_dir .. "/" .. final_filename
            break
        end
    end

    local base64_content = string.sub(file_object.content, string.find(file_object.content, ",") + 1)
    local decoded_content = base64.decode(base64_content)

    -- Initialize upload session
    if not in_progress_uploads[file_id] then
        in_progress_uploads[file_id] = {
            file_name = final_filename,
            path = file_path,
            chunks_received = 0,
            -- No file handle needed with stream_write_file
        }
        local success, err = self.server:stream_write_file(file_path, "")
        if not success then
            self.server.logger:log(log_level.ERROR, "Failed to create file: " .. tostring(err))
            shared.sockets:push_notification(ws, {
                topic = "patch",
                type = "file_upload_error",
                data = { fileId = file_id, message = "Server failed to create file: " .. tostring(err) }
            })
            return
        end
        self.server.logger:log(log_level.DEBUG, "Started new file upload session for file_id: " .. file_id)
    end

    local upload_session = in_progress_uploads[file_id]

    -- Write chunk using stream_write_file (appends data)
    local success, err = self.server:stream_write_file(upload_session.path, decoded_content)
    if not success then
        self.server.logger:log(log_level.ERROR, "Failed to write chunk " .. chunk_id .. " for file_id: " .. file_id .. " - " .. tostring(err))
        shared.sockets:push_notification(ws, {
            topic = "patch",
            type = "file_upload_error",
            data = { fileId = file_id, chunkId = chunk_id, message = "Failed to write chunk: " .. tostring(err) }
        })
        return
    end

    upload_session.chunks_received = upload_session.chunks_received + 1

    local response = {
        type = "chunk_received",
        payload = {
            fileId = file_id,
            chunkId = chunk_id
        }
    }
    shared.sockets:send_to_user(ws_id, response)

    if is_last_chunk then
        self.server.logger:log(log_level.DEBUG, "File upload complete for file_id: " .. file_id)

        shared.sockets:send_to_user(ws_id, {
            type = "file_upload_finished",
            payload = {
                fileId = file_id,
                filePath = upload_session.path,
                fileName = upload_session.file_name
            }
        })

        if payload.args.isFinalFile then
            shared.sockets:send_to_user(ws_id, {
                type = "batch_upload_complete",
                payload = {
                    batchId = payload.args.batchId or file_id, -- optional grouping
                    lastFileId = file_id,
                    fileName = upload_session.file_name
                }
            })
        end

        in_progress_uploads[file_id] = nil
    end
end

return PatchWSHandler