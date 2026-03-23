local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")
local cjson = require("dkjson")

local TaskPage = FunctionalComponent:extends()
TaskPage:setReactiveView()

TaskPage:onClientReady(function ()
    for x = 1, 10 do
        print( "value of x is  = ", x)
    end
end)

--- Template for state.tasks (server-side state)
local StateTaskTemplate = function()
    return HTML.e("template", {["data-template-id"] = "tasks_template"}, {
        HTML.e("div", { class = "p-3 border-l-4 border-blue-500 bg-blue-50 rounded mb-2" }, {
            HTML.e("div", { class = "flex justify-between items-center" }, {
                HTML.e("span", {
                    ["data-bind"] = "title",
                    class = "font-medium text-blue-800"
                }),
                HTML.e("span", {
                    ["data-bind"] = "id",
                    class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                }),
                HTML.e("span", {
                    ["data-bind"] = "assignedTo.name",
                    class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                }),
                HTML.e("span", {
                    ["data-bind"] = "assignedTo.role.name",
                    class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                }),
                HTML.e("span", {
                    ["data-bind"] = "assignedTo.department.name",
                    class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                })
            })
        })
    })
end

--- Template for clientState.tasks (client-side state with full interactivity)
local ClientStateTaskTemplate = function(comp_key)
    return HTML.e("template", {["data-template-id"] = "cs.tasks_template"}, {
        HTML.e("div", {
            class = "p-3 border rounded-lg mb-3 bg-white shadow-sm hover:shadow transition-shadow"
        }, {
            HTML.fragment({
                -- Task content row
                HTML.e("div", { class = "flex justify-between items-center mb-2" }, {
                    -- Title display/input (toggles based on edit mode)
                    HTML.fragment({
                        -- Display mode (when not editing)
                        HTML.e("span", {
                            ["data-bind"] = "title",
                            class = "text-gray-800 font-medium flex-grow",
                            ["data-bind-class-hidden"] = "editing"  -- Hide when editing
                        }),

                        HTML.e("span", {
                            ["data-bind"] = "assignedTo.name",
                            class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                        }),

                        HTML.e("span", {
                            ["data-bind"] = "assignedTo.role.name",
                            class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                        }),

                        HTML.e("span", {
                            ["data-bind"] = "assignedTo.department.name",
                            class = "text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded"
                        }),

                        -- Edit mode (when editing)
                        HTML.e("input", {
                            type = "text",
                            ["data-bind"] = "editTitle",
                            class = "border border-blue-300 p-2 rounded flex-grow focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            ["data-bind-class-hidden"] = "not-editing",  -- Hide when not editing
                            oninput = HTML.patch(comp_key, nil, "updateEditTitle", {
                                id = HTML.client.getVar("id"),
                                title = HTML.client.getValue(":scope > input")
                            })
                        })
                    }),

                    -- ID badge
                    HTML.e("span", {
                        ["data-bind"] = "id",
                        class = "text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded ml-2"
                    })
                }),

                -- Action buttons row
                HTML.e("div", { class = "flex gap-2" }, {
                    -- Edit button (shown when NOT editing)
                    HTML.e("button", {
                        ["data-bind"] = "data-bind-action-edit",
                        class = "px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition",
                        onclick = HTML.patch(comp_key, nil, "startEditClientTask", {
                            id = HTML.client.getVar("id")
                        })
                    }, "Edit"),

                    -- Save button (shown when editing)
                    HTML.e("button", {
                        ["data-bind"] = "data-bind-action-save",
                        class = "px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition",
                        ["data-bind-class-hidden"] = "not-editing",
                        onclick = HTML.patch(comp_key, nil, "saveEditClientTask", {
                            id = HTML.client.getVar("id", {relative = true}),
                            title = HTML.client.getVar("editTitle", {relative = true})
                        })
                    }, "Save"),

                    -- Cancel button (shown when editing)
                    HTML.e("button", {
                        ["data-bind"] = "data-bind-action-cancel",
                        class = "px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition",
                        ["data-bind-class-hidden"] = "not-editing",
                        onclick = HTML.patch(comp_key, nil, "cancelEditClientTask", {
                            id = HTML.client.getVar("id", {relative = true})
                        })
                    }, "Cancel"),

                    -- Delete button
                    HTML.e("button", {
                        ["data-bind"] = "data-bind-action-delete",
                        class = "px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition",
                        onclick = HTML.patch(comp_key, nil, "deleteClientTask", {
                            id = HTML.client.getVar("id", {relative = true})
                        })
                    }, "Delete")
                })
            })
        })
    })
end

-----------------------------------------------------------
-- HELPER FUNCTIONS
-----------------------------------------------------------

local function pickRandomColor()
    local colors = {
        "red", "blue", "green", "yellow", "purple", "orange", "pink", "teal", "cyan", "magenta"
    }
    local randomIndex = math.random(1, #colors)
    return colors[randomIndex]
end

local function createTaskObject(comp, id, title, isClientTask)
    local baseTask = {
        id = id,
        title = title,
        color = pickRandomColor(),
        assignedTo = {
            name = "Timothy",
            userId = 42,
            role = {
                id = 3,
                name = "Developer",
                color = pickRandomColor()
            },
            department = {
                id = 2,
                name = "Engineering"
            }
        }
    }

    if isClientTask then
        return comp.utils.objectMerge(baseTask, {
            editing = false,
            editTitle = title,
            createdAt = os.time()
        })
    else
        return comp.utils.objectMerge(baseTask, {
            createdAt = os.time()
        })
    end
end

-----------------------------------------------------------
-- METHODS FOR STATE.TASKS (Server-side) USING self.utils
-----------------------------------------------------------

TaskPage.methods.addStateTask = function(self, ws_id, args)
    local title = args.title
    if not title or title == "" then return end

    print("[DEBUG][addStateTask] Adding task:", title)

    -- Get current state for next ID
    local currentState = self.reactive_component:getNormalState() or {}
    local nextId = (currentState.nextStateId or 0) + 1

    -- Create task object
    local newTask = {
        id = nextId,
        title = title,
        completed = false,
        createdAt = os.time()
    }

   if self.utils and self.utils.append then
        -- Append task and update counter separately
        print("[DEBUG][addStateTask] Using utils.append and separate setState")
        -- local patches = self.utils.append("tasks", newTask)

        ---use setState to update task list instead of relying on utils to do it in one step, to ensure nextStateId is updated correctly
        -----------------------
        self:setState({
            _operation = HTML.CRUD_OPERATIONS.APPEND,
            _target = "tasks",
            _data = newTask
        })

        -- Update counter
        self:setState({
            _operation = HTML.CRUD_OPERATIONS.SET,
            _target = "nextStateId",
            _data = nextId
        })

    else
        -- Traditional approach
        print("[DEBUG][addStateTask] Using traditional setState")
        return self:setState(function(state)
            local tasks = state.tasks or {}
            table.insert(tasks, newTask)
            return {
                tasks = tasks,
                nextStateId = nextId
            }
        end)
    end
end

-- Delete task from state (server-side) - Using self.utils
TaskPage.methods.deleteStateTask = function(self, ws_id, args)
    local id = tonumber(args.id)

    self:setState(function(state)
        return self.utils.objectMerge(state, {
            tasks = self.utils.arrayRemove(state.tasks or {}, function(task)
                return task.id == id
            end)
        })
    end)
end

-----------------------------------------------------------
-- METHODS FOR CLIENTSTATE.TASKS (Client-side) USING self.utils
-----------------------------------------------------------

-- Add a new task to clientState - Using self.utils
-----------------------------------------------------------
-- METHODS FOR STATE.TASKS (Server-side) USING self.utils
-----------------------------------------------------------

-- -- Add task to state (server-side) - Using self.utils
-- TaskPage.methods.addStateTask = function(self, ws_id, args)
--     local title = args.title
--     if not title or title == "" then return end

--     -- Get current state
--     local currentState = self.reactive_component:getNormalState() or {}
--     local nextId = (currentState.nextStateId or 0) + 1

--     -- Create new task using pickRandomColor directly
--     local newTask = {
--         id = nextId,
--         title = title,
--         color = pickRandomColor(),
--         createdAt = os.time(),
--         assignedTo = {
--             name = "Timothy",
--             userId = 42,
--             role = {
--                 id = 3,
--                 name = "Developer",
--                 color = pickRandomColor()
--             },
--             department = {
--                 id = 2,
--                 name = "Engineering"
--             }
--         }
--     }

--     -- Update state using self.utils (available when method is called)
--     self:setState(function(state)
--         return self.utils.objectMerge(state, {
--             tasks = self.utils.arrayPush(state.tasks or {}, newTask),
--             nextStateId = nextId
--         })
--     end)
-- end

-- -- Delete task from state (server-side) - Using self.utils
-- TaskPage.methods.deleteStateTask = function(self, ws_id, args)
--     local id = tonumber(args.id)

--     self:setState(function(state)
--         return self.utils.objectMerge(state, {
--             tasks = self.utils.arrayRemove(state.tasks or {}, function(task)
--                 return task.id == id
--             end)
--         })
--     end)
-- end

-----------------------------------------------------------
-- METHODS FOR CLIENTSTATE.TASKS (Client-side) USING self.utils
-----------------------------------------------------------
-- Add a new task to clientState - Using CRUD operations
TaskPage.methods.addClientTask = function(self, ws_id, args)
    local title = args.title
    if not title or title == "" then return end

    print("[DEBUG][addClientTask] Starting task addition to client state")
    print("[DEBUG][addClientTask] Title:", title, "WS ID:", ws_id)

    -- Calculate next ID first
    local currentClientState = self:getClientState(ws_id)
    local nextId = (currentClientState.nextClientId or 0) + 1
    print("[DEBUG][addClientTask] Current nextClientId:", currentClientState.nextClientId, "Next ID:", nextId)

    -- Create task object
    local newTask = {
        id = nextId,
        title = title,
        editing = false,
        editTitle = title,
        color = pickRandomColor(),
        createdAt = os.time(),
        assignedTo = {
            name = "Timothy",
            userId = 42,
            role = {
                id = 3,
                name = "Developer",
                color = pickRandomColor()
            },
            department = {
                id = 2,
                name = "Engineering"
            }
        }
    }

    print("[DEBUG][addClientTask] Created task object with ID:", newTask.id)

    -- OPTION 1: Direct CRUD operation on setClientState
    -- This is the cleanest approach if your setClientState supports it
    local result = self:setClientState(ws_id, {
        _operation = HTML.CRUD_OPERATIONS.APPEND,  -- Use APPEND operation
        _target = "cs.tasks",                         -- Target path (no "cs." prefix needed)
        _data = newTask,                           -- The task to append
    })

          -- Update counter
        self:setClientState(ws_id,{
            _operation = HTML.CRUD_OPERATIONS.SET,
            _target = "cs.nextClientId",
            _data = nextId
        })

end

-- Delete task from clientState - Using self.utils
TaskPage.methods.deleteClientTask = function(self, ws_id, args)
    local id = tonumber(args.id)

    print("Deleting task ID:", id)
     print("calling setClientState for route:", id, "from TaskPage method deleteClientTask")

    self:setClientState(ws_id, function(clientState)
        return self.utils.objectMerge(clientState, {
            tasks = self.utils.arrayRemove(clientState.tasks or {}, function(task)
                return task.id == id
            end)
        })
    end)
end

-- Start editing a task in clientState - Using self.utils
TaskPage.methods.startEditClientTask = function(self, ws_id, args)
    local id = tonumber(args.id)

    print("Starting edit for task ID:", id)
     print("calling setClientState for route:", id, "from TaskPage method startEditClientTask")

    self:setClientState(ws_id, function(clientState)
        local tasks = clientState.tasks or {}

        -- Update the specified task to editing mode, turn off others
        local updatedTasks = self.utils.arrayMap(tasks, function(task)
            if task.id == id then
                return self.utils.objectMerge(task, {
                    editing = true,
                    editTitle = task.title
                })
            else
                return self.utils.objectMerge(task, {
                    editing = false
                })
            end
        end)

        return self.utils.objectMerge(clientState, {
            tasks = updatedTasks
        })
    end)
end

-- Save edited task in clientState - Using self.utils
TaskPage.methods.saveEditClientTask = function(self, ws_id, args)
    local id = tonumber(args.id)
    local newTitle = args.title

    if not newTitle or newTitle == "" then return end

    print("Saving edit for task ID:", id, "with new title:", newTitle)
     print("calling setClientState for route:", id, "from TaskPage method saveEditClientTask")

    self:setClientState(ws_id, function(clientState)
        local updatedTasks = self.utils.arrayMap(clientState.tasks or {}, function(task)
            if task.id == id then
                return self.utils.objectMerge(task, {
                    title = newTitle,
                    editing = false,
                    editTitle = nil
                })
            else
                return task
            end
        end)

        return self.utils.objectMerge(clientState, {
            tasks = updatedTasks
        })
    end)
end

-- Cancel editing in clientState - Using self.utils
TaskPage.methods.cancelEditClientTask = function(self, ws_id, args)
    local id = tonumber(args.id)
    print("Cancelling edit for task ID:", id)
     print("calling setClientState for route:", id, "from TaskPage method cancelEditClientTask")
    self:setClientState(ws_id, function(clientState)
        local updatedTasks = self.utils.arrayMap(clientState.tasks or {}, function(task)
            if task.id == id then
                return self.utils.objectMerge(task, {
                    editing = false,
                    editTitle = nil
                })
            else
                return task
            end
        end)

        return self.utils.objectMerge(clientState, {
            tasks = updatedTasks
        })
    end)
end

-- Update edit title as user types - Using self.utils
TaskPage.methods.updateEditTitle = function(self, ws_id, args)
    local id = tonumber(args.id)
    local title = args.title or ""

    print("Updating edit title for task ID:", id, "to:", title)
     print("calling setClientState for route:", id, "from TaskPage method updateEditTitle")

    self:setClientState(ws_id, function(clientState)
        local updatedTasks = self.utils.arrayMap(clientState.tasks or {}, function(task)
            if task.id == id then
                return self.utils.objectMerge(task, {
                    editTitle = title
                })
            else
                return task
            end
        end)

        return self.utils.objectMerge(clientState, {
            tasks = updatedTasks
        })
    end)
end

-- Update new task title input - Using self.utils
TaskPage.methods.updateNewClientTitle = function(self, ws_id, args)
    local title = args.title or ""

    print("Updating new client task title to:", title)
     print("calling setClientState for route:", title, "from TaskPage method updateNewClientTitle")

    self:setClientState(ws_id, {
        newClientTitle = title
    })
end

-- Bulk add multiple tasks - Using self.utils
TaskPage.methods.bulkAddClientTasks = function(self, ws_id, args)
    local titles = args.titles or {}

    print("Bulk adding client tasks:", cjson.encode(titles))
     print("calling setClientState for route:", cjson.encode(titles), "from TaskPage method bulkAddClientTasks")

    self:setClientState(ws_id, function(clientState)
        local nextId = clientState.nextClientId or 0
        local tasks = clientState.tasks or {}

        for _, title in ipairs(titles) do
            if title and title ~= "" then
                nextId = nextId + 1
                local newTask = {
                    id = nextId,
                    title = title,
                    editing = false,
                    editTitle = title,
                    color = pickRandomColor(),
                    createdAt = os.time(),
                    assignedTo = {
                        name = "Timothy",
                        userId = 42,
                        role = {
                            id = 3,
                            name = "Developer",
                            color = pickRandomColor()
                        },
                        department = {
                            id = 2,
                            name = "Engineering"
                        }
                    }
                }
                tasks = self.utils.arrayPush(tasks, newTask)
            end
        end

        return self.utils.objectMerge(clientState, {
            tasks = tasks,
            nextClientId = nextId
        })
    end)
end

-- Clear all client tasks - Using self.utils
TaskPage.methods.clearAllClientTasks = function(self, ws_id, args)
    print("Clearing all client tasks")
     print("calling setClientState for route:", "clearAll", "from TaskPage method clearAllClientTasks")
    self:setClientState(ws_id, function(clientState)
        return self.utils.objectMerge(clientState, {
            tasks = {},
            newClientTitle = ""
        })
    end)
end

-- Duplicate a task - Using self.utils
TaskPage.methods.duplicateClientTask = function(self, ws_id, args)
    local id = tonumber(args.id)

    print("Duplicating task ID:", id)
     print("calling setClientState for route:", id, "from TaskPage method duplicateClientTask")

    self:setClientState(ws_id, function(clientState)
        local tasks = clientState.tasks or {}
        local nextId = clientState.nextClientId or 0

        for _, task in ipairs(tasks) do
            if task.id == id then
                nextId = nextId + 1
                local duplicate = self.utils.objectMerge(task, {
                    id = nextId,
                    editing = false,
                    editTitle = task.title,
                    createdAt = os.time()
                })

                return self.utils.objectMerge(clientState, {
                    tasks = self.utils.arrayPush(tasks, duplicate),
                    nextClientId = nextId
                })
            end
        end

        return clientState
    end)
end
-----------------------------------------------------------
-- UI / VIEW
-----------------------------------------------------------

function TaskPage:renderLayout(state, props, children, H, clientState)
    -- Ensure defaults for both state and clientState using utils
    state = state or {}
    state.tasks = state.tasks or {}
    state.nextStateId = state.nextStateId or 0


    -- Calculate statistics
    local totalServerTasks = #state.tasks
    local completedClientTasks = 0
    local editingClientTasks = 0

    clientState = clientState or {}
    clientState.tasks = clientState.tasks or {}
    clientState.nextClientId = clientState.nextClientId or 0
    clientState.newClientTitle = clientState.newClientTitle or ""
    local totalClientTasks = #clientState.tasks
    for _, task in ipairs(clientState.tasks) do
        if task.editing then
            editingClientTasks = editingClientTasks + 1
        end
    end
    return H.e("div", {id=props.routeId, class = "p-6 max-w-4xl mx-auto" }, {
        ------------------------------------------------------
        -- HEADER
        ------------------------------------------------------
        H.e("h1", { class = "text-3xl font-bold mb-6 text-gray-800" }, "Dual State Task Manager"),

        -- Quick action buttons using utils
        H.Row({ class = "mb-6 gap-3" }, {
            H.Button("Bulk Add Demo Tasks", H.onClick(
                H.patch(self.component_key, nil, "bulkAddClientTasks", {
                    titles = {"Task 1", "Task 2", "Task 3", "Task 4"}
                })
            )),

            H.Button("Clear All Client Tasks", H.merge(
                { class = "bg-red-100 text-red-700 hover:bg-red-200" },
                H.onClick(
                    H.patch(self.component_key, nil, "clearAllClientTasks")
                )
            ))
        }),

        ------------------------------------------------------
        -- CLIENT STATE TASKS SECTION (Interactive)
        ------------------------------------------------------
        H.e("div", { class = "mb-10 p-4 border-2 border-purple-300 rounded-xl bg-purple-50" }, {
            H.e("h2", { class = "text-xl font-semibold mb-4 text-purple-800" },
                "Client-Side Tasks (Interactive)" ..
                (editingClientTasks > 0 and " (" .. editingClientTasks .. " editing)" or "")
            ),

            -- New task input for clientState
            H.e("div", { class = "flex gap-2 mb-6" }, {
                H.e("input", {
                    id = 'clientTskInp',
                    type = "text",
                    class = "border border-purple-300 p-3 flex-grow rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500",
                    value = "",
                    placeholder = "Enter client-side task...",
                    ["data-bind-client"] = "newClientTitle",
                    oninput = H.patch(self.component_key, nil, "updateNewClientTitle", {
                        title = H.client.getValue("#clientTskInp")
                    })
                }),
                H.e("button",
                    H.merge(
                        { class = "px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium" },
                        H.onClick(
                            H.client.batch(
                                H.patch(self.component_key, nil, "addClientTask", {
                                    title = H.client.getValue('#clientTskInp')
                                })
                            )
                        )
                    ),
                    "Add Client Task"
                )
            }),

            -- ClientState tasks list with template
            H.fragment({
                ClientStateTaskTemplate(),

                H.e("div", {
                    ["data-bind"] = "cs.tasks",
                    ["data-template-id"] = "cs.tasks_template",
                    class = "space-y-3"
                })
            }),

            -- Client stats
            H.e("div", { class = "mt-4 text-sm text-purple-600 flex gap-4" }, {
                H.e("p", {}, "Total: " .. tostring(totalClientTasks)),
                H.e("p", {}, "Editing: " .. tostring(editingClientTasks)),
                H.e("p", {}, "Next ID: " .. tostring(0))
            })
        }),

        ------------------------------------------------------
        -- STATE TASKS SECTION (Server-side, Read-only)
        ------------------------------------------------------
        H.e("div", { class = "p-4 border-2 border-blue-300 rounded-xl bg-blue-50" }, {
            H.e("h2", { class = "text-xl font-semibold mb-4 text-blue-800" }, "Server-Side Tasks (Read-only)"),

            -- New task input for state
            H.e("div", { class = "flex gap-2 mb-6" }, {
                H.e("input", {
                    id = "stateTitleInp",
                    type = "text",
                    class = "border border-blue-300 p-3 flex-grow rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                    placeholder = "Enter server-side task..."
                }),
                H.e("button",
                    H.merge(
                        { class = "px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" },
                        H.onClick(
                            H.client.batch(
                                H.patch(self.component_key, nil, "addStateTask", {
                                    title = H.client.getValue("#stateTitleInp")
                                })
                            )
                        )
                    ),
                    "Add Server Task"
                )
            }),

            -- State tasks list with template
            H.fragment({
                StateTaskTemplate(),

                H.e("div", {
                    ["data-bind"] = "tasks",
                    ["data-template-id"] = "tasks_template",
                    class = "space-y-3"
                })
            }),

            -- Server stats
            H.e("div", { class = "mt-4 text-sm text-blue-600" }, {
                H.e("p", {}, {"Total server tasks: " , H.e("span", {class = "font-bold", ["data-bind"]="tasksLength"}, tostring(#state.tasks))}),
                H.e("p", {}, {"Next server ID: ", H.e("span", {class = "font-bold", ["data-bind"]="nextStateId"}, tostring(state.nextStateId))})
            })
        }),

        ------------------------------------------------------
        -- SUMMARY DASHBOARD
        ------------------------------------------------------
        H.e("div", { class = "mt-8 p-4 bg-gray-100 rounded-lg" }, {
            H.e("h3", { class = "font-medium text-gray-700 mb-4" }, "Dashboard Summary"),
            H.Grid(2, "1rem", {
                H.e("div", { class = "p-4 bg-white rounded-lg shadow" }, {
                    H.e("p", { class = "font-medium text-purple-600 mb-1" }, "Client Tasks"),
                    H.e("p", { class = "text-2xl font-bold text-purple-700" }, tostring(totalClientTasks)),
                    H.e("div", { class = "text-xs text-gray-500 mt-2" }, {
                        H.e("div", { class = "flex justify-between" }, {
                            H.e("span", {}, "Editing"),
                            H.e("span", { class = "font-medium" }, tostring(editingClientTasks))
                        })
                    })
                }),
                H.e("div", { class = "p-4 bg-white rounded-lg shadow" }, {
                    H.e("p", { class = "font-medium text-blue-600 mb-1" }, "Server Tasks"),
                    H.e("p", { class = "text-2xl font-bold text-blue-700" }, tostring(totalServerTasks)),
                    H.e("div", { class = "text-xs text-gray-500 mt-2" }, {
                        H.e("div", { class = "flex justify-between" }, {
                            H.e("span", {}, "Next ID"),
                            H.e("span", { class = "font-medium" }, tostring(state.nextStateId))
                        })
                    })
                })
            })
        })
    })
end

-----------------------------------------------------------
-- INIT
-----------------------------------------------------------

function TaskPage:startInit()
    self:init(function(server, children, props, style, H)
        return function(state, props, children, H, clientState)
            -- Use utils to merge with defaults
            return self:renderLayout(state, props, children, H, clientState)
        end
    end)
end

function TaskPage:load()
    self:setComponentKey('route_state')
    self:startInit()
end

return TaskPage