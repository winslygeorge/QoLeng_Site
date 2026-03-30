local json = require('dkjson')

local M = {}
M.__index = M

function M:new(server)
 local self = setmetatable({}, M)
 self.server = server
 return self
end

function M:routes()

self.server:use(function(req, res, next)
    -- Authentication middleware
    if not req.headers or not req.headers.authorization then
        return res:writeStatus(401):send("Unauthorized")
    end
    next()
end, "/api")

 -- Your routes go here, e.g.:
 self.server:get("/hello", function(req, res)
 -- Your data handling logic
        res:writeStatus(200):send("Hello World, this is a practice route!");
 end)

 self.server:scope("/api/v1", function(s)
    s:get("/data", function(req, res)
        local response = {
            message = "This is some practice data from /api/prac/data",
            items = {1, 2, 3, 4, 5}
        }
        res:writeHeader("Content-Type", "application/json")
        res:writeStatus(200):send(json.encode(response))
    end)
 end)

 self.server:get("/sse/updates", function(req, res, query)
    -- Each SSE client connection receives a unique ID
    local sse_id = req.sse_id

    print("these are sse query params:", json.encode(query))

    -- Example: send an initial welcome message
    self.server:sse_send(sse_id, "Connected to SSE stream.")

    -- -- Example: periodically push updates
    local timer = self.server:setInterval(function(ctx)
        print("Sending SSE update to client:", sse_id)
        self.server:sse_send(sse_id, "Server time: " .. os.date("%H:%M:%S"))
    end, 2000)

    -- Clean up when the client disconnects
    res:onClose(function()
        self.server:clearInterval(timer)
        self.server:sse_send(sse_id, "Connection closed.")
    end)
end)

self.server:get("/file/write", function(req, res, query)
    local file_path = "practice_log.txt"
    local log_message = "Hello World"

    --this is the write file line example 
    self.server:write_file(file_path, log_message)

    res:writeStatus(200):send("Log entry added.")

end)

self.server:get("/file/read", function(req, res, query)
    local file_path = "practice_log.txt"

    --this is the read file line example 
    local content, err = self.server:read_file(file_path)

    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end

    res:writeHeader("Content-Type", "text/plain")
    res:writeStatus(200):send(content)
end)
-- Endpoint to get all students from a JSON file
self.server:get("students/all", function (req, res)

    local file_path = "routes/students.json"
    --this is the read students.json file , that contains an array of student objects 
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end
    --- decode the JSON content
    local students, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end
    -- send the student data as JSON response
    res:writeHeader("Content-Type", "application/json")
    res:writeStatus(200):send(json.encode(students))
end)

-- Endpoint to get a student by ID using query parameters I.E ?id=1
self.server:get("students/get", function (req, res, query)
    -- extract the student ID from the query parameters
    local q = query or {}
    local student_id = tonumber(q.id)
    if not student_id then
        return res:writeStatus(400):send("Invalid student ID")
    end
    -- read the students.json file
    local file_path = "routes/students.json"
    --this is the read students.json file , that contains an array of student objects 
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end
    --- decode the JSON content
    local data, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end
    -- find the student with the matching ID
    for _, student in ipairs(data.students) do
        if student["id"] == student_id then
            res:writeHeader("Content-Type", "application/json")
            return res:writeStatus(200):send(json.encode(student))
        end
    end
    return res:writeStatus(404):send("Student not found")
end)

-- Endpoint to get a student by ID using URL parameter I.E / students/1
self.server:get("students/:id", function (req, res)
    -- extract the student ID from the URL parameters
    local params = req.params
    local student_id = tonumber(params.id)
    if not student_id then
        return res:writeStatus(400):send("Invalid student ID")
    end
    -- read the students.json file
    local file_path = "routes/students.json"
    --this is the read students.json file , that contains an array of student objects 
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end
    --- decode the JSON content
    local data, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end

    -- find the student with the matching ID
    for _, student in ipairs(data.students) do
        if student["id"] == student_id then
            res:writeHeader("Content-Type", "application/json")
            return res:writeStatus(200):send(json.encode(student))
        end
    end
    return res:writeStatus(404):send("Student not found")
end)

-- api for post request to add a new student (json body & x-www-form-urlencoded & plain text  supported)
self.server:post("students/add", function (req, res, body)
    --- extract student data from the request body
     body = body or  {} 
    if type(body) == "table" then
    local name = body.name
    local age = body.age
    local mean_score = body.mean_score
    if not name or not age or not mean_score then
        return res:writeStatus(400):send("Missing student data")
    end
    -- read the existing students.json file
    local file_path = "routes/students.json"
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err) 
    end
    --- decode the JSON content
    local data, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end
    -- create a new student object
    local new_student = {
        id = #data.students + 1,
        name = name,
        age = age,
        mean_score = mean_score
    }
    table.insert(data.students, new_student)
    -- encode the updated data back to JSON
    local updated_content = json.encode(data, { indent = true })
    -- write the updated content back to the students.json file
    local write_ok, write_err = self.server:write_file(file_path, updated_content)
    if not write_ok then
        return res:writeStatus(500):send("Error writing file: " .. write_err)
    end
    res:writeHeader("Content-Type", "application/json")
    res:writeStatus(201):send(json.encode(new_student))
else
    return res:writeStatus(400):send("Invalid request body")
end
end)

-- Endpoint to handle file uploads using multipart/form-data
self.server:post("/upload", function(req, res, form_data)
    -- Access uploaded files and fields
    if type(form_data) ~= "table" then
        return res:writeStatus(400):send("No form data received")
    end
    for name, field in pairs(form_data or {}) do
        for k, v in pairs(field) do
            print("Field:", name, "Key:", k, "Value:", v)
        end
        if type(field) == "table" and field.path then
            print("Uploaded file:", field.filename, "stored at:", field.path)
        else
            print("Form field:", field.name, "=", field.body)
        end
    end
    -- loops results demostrating the form data format:
--     Field:  1       Key:    size_raw        Value:  5461
-- Field:  1       Key:    base64  Value:  false
-- Field:  1       Key:    name    Value:  file
-- Field:  1       Key:    on_end  Value:  function: 0x7f9e4ff58e60
-- Field:  1       Key:    on_data Value:  function: 0x7f9e4ffcb138
-- Field:  1       Key:    size    Value:  5461
-- Field:  1       Key:    temp_writer     Value:  table: 0x7f9e4fffa468
-- Field:  1       Key:    gzip    Value:  false
-- Field:  1       Key:    path    Value:  ./uploads/logo-choice.png
-- Field:  1       Key:    is_file Value:  true
-- Field:  1       Key:    mimetype        Value:  image/png
-- Field:  1       Key:    filename        Value:  logo-choice.png
-- Field:  1       Key:    headers Value:  table: 0x7f9e4fe8a350
-- Uploaded file:  logo-choice.png stored at:      ./uploads/logo-choice.png
-- Field:  2       Key:    size_raw        Value:  4
-- Field:  2       Key:    base64  Value:  false
-- Field:  2       Key:    name    Value:  name
-- Field:  2       Key:    on_end  Value:  function: 0x7f9e4ffcecf8
-- Field:  2       Key:    size    Value:  4
-- Field:  2       Key:    on_data Value:  function: 0x7f9e51829418
-- Field:  2       Key:    gzip    Value:  false
-- Field:  2       Key:    is_file Value:  false
-- Field:  2       Key:    body    Value:  logo
-- Field:  2       Key:    headers Value:  table: 0x7f9e50028e78
-- Form field:     name    =       logo
-- Field:  3       Key:    size_raw        Value:  5
-- Field:  3       Key:    base64  Value:  false
-- Field:  3       Key:    name    Value:  filename
-- Field:  3       Key:    on_end  Value:  function: 0x7f9e4fffd258
-- Field:  3       Key:    size    Value:  5
-- Field:  3       Key:    on_data Value:  function: 0x7f9e500597a8
-- Field:  3       Key:    gzip    Value:  false
-- Field:  3       Key:    is_file Value:  false
-- Field:  3       Key:    body    Value:  clogo
-- Form field:     filename        =       clogo
    res:writeHeader("Content-Type", "application/json")
       :writeStatus(200)
       :send('{"ok":true}')
end)

-- post binary data example body is @file:/tmp/upload_1763024537.tmp string
self.server:post("/binary/upload", function(req, res, body)
    -- Access raw binary data in body
    if not body or type(body) ~= "string" then
        return res:writeStatus(400):send("No binary data received")
    end

    -- binary file processing logic here
    -- read file at path extracted from body string
    -- lets read the binary data from the file path
    -- body is in format @file:/tmp/upload_1763024537.tmp
    local file_path = body:match("^@file:(.+)$")
    if not file_path then
        return res:writeStatus(400):send("Invalid binary data format")
    end
    local file_content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading binary file: " .. err)
    end
    -- For demonstration, just print the size of the binary data
    print("Received binary data of size:", #file_content)   

    -- You could save the binary data to a file or process it as needed

    res:writeHeader("Content-Type", "application/json")
       :writeStatus(200)
       :send('{"ok":true, "size":' .. tostring(#file_content) .. '}')   
end)

-- route for put request example
self.server:put("/students/:id", function(req, res, body)
    -- extract the student ID from the URL parameters
    local params = req.params
    local student_id = tonumber(params.id)
    if not student_id then
        return res:writeStatus(400):send("Invalid student ID")
    end
    -- read the students.json file
    local file_path = "routes/students.json"
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end
    --- decode the JSON content
    local data, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end
    -- find the student with the matching ID and update details
    local updated = false
    for _, student in ipairs(data.students) do
        if student["id"] == student_id then
            -- update student details from body
            if type(body) == "table" then
                student.name = body.name or student.name
                student.age = body.age or student.age
                student.mean_score = body.mean_score or student.mean_score
                updated = true
                break
            else
                return res:writeStatus(400):send("Invalid request body")
            end
        end
    end
    if not updated then
        return res:writeStatus(404):send("Student not found")
    end
    -- encode the updated data back to JSON
    local updated_content = json.encode(data, { indent = true })
    -- write the updated content back to the students.json file
    local write_ok, write_err = self.server:write_file(file_path, updated_content)
    if not write_ok then
        return res:writeStatus(500):send("Error writing file: " .. write_err)
    end

    res:writeHeader("Content-Type", "application/json")
       :writeStatus(200)
       :send(json.encode({ updated = true, id = student_id }))
end)

--- route for patch request example
self.server:patch("/students/:id", function(req, res, body)
    -- extract the student ID from the URL parameters
    local params = req.params
    local student_id = tonumber(params.id)
    if not student_id then
        return res:writeStatus(400):send("Invalid student ID")
    end
    -- read the students.json file
    local file_path = "routes/students.json"
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end
    --- decode the JSON content
    local data, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end
    -- find the student with the matching ID and update details
    local updated = false
    for _, student in ipairs(data.students) do
        if student["id"] == student_id then
            -- update student details from body
            if type(body) == "table" then
                if body.name then student.name = body.name end
                if body.age then student.age = body.age end
                if body.mean_score then student.mean_score = body.mean_score end
                updated = true
                break
            else
                return res:writeStatus(400):send("Invalid request body")
            end
        end
    end
    if not updated then
        return res:writeStatus(404):send("Student not found")

    end
    -- encode the updated data back to JSON
    local updated_content = json.encode(data, { indent = true })
    -- write the updated content back to the students.json file 
    local write_ok, write_err = self.server:write_file(file_path, updated_content)
    if not write_ok then
        return res:writeStatus(500):send("Error writing file: " .. write_err)
    end
    res:writeHeader("Content-Type", "application/json")
       :writeStatus(200)
       :send(json.encode({ updated = true, id = student_id }))
end)
-- route for delete request example
self.server:delete("/students/:id", function(req, res)
    -- extract the student ID from the URL parameters
    local params = req.params
    local student_id = tonumber(params.id)
    if not student_id then
        return res:writeStatus(400):send("Invalid student ID")
    end
    -- read the students.json file
    local file_path = "routes/students.json"
    local content, err = self.server:read_file(file_path)
    if err then
        return res:writeStatus(500):send("Error reading file: " .. err)
    end
    --- decode the JSON content
    local data, pos, decode_err = json.decode(content, 1, nil)
    if decode_err then
        return res:writeStatus(500):send("Error decoding JSON: " .. decode_err)
    end
    -- find and remove the student with the matching ID
    local deleted = false
    for index, student in ipairs(data.students) do
        if student["id"] == student_id then
            table.remove(data.students, index)
            deleted = true
            break
        end
    end
    if not deleted then
        return res:writeStatus(404):send("Student not found")
    end
    -- encode the updated data back to JSON
    local updated_content = json.encode(data, { indent = true })
    -- write the updated content back to the students.json file
    local write_ok, write_err = self.server:write_file(file_path, updated_content)
    if not write_ok then
        return res:writeStatus(500):send("Error writing file: " .. write_err)
    end
    res:writeHeader("Content-Type", "application/json")
       :writeStatus(200)
       :send(json.encode({ deleted = true, id = student_id }))
end)

-- Mock data store
local USERS = {
    ["1"] = { id = 1, name = "Winslow Georgos", email = "winslow@example.com" },
    ["2"] = { id = 2, name = "Jane Doe", email = "jane@example.com" }
}

---------------------------------------------------
-- 🧭 HEAD: return metadata only (no body)
---------------------------------------------------
self.server:head("/users/:id", function(req, res)
    local id = req.params.id
    local user = USERS[id]

    print("HEAD request for /users/" .. id)
    if user then
        res:writeHeader("Content-Type", "application/json")
           :writeHeader("X-User-Found", "true")
           :writeHeader("X-User-ID", id)
           :writeStatus(200)
           :send("") -- HEAD: headers only
    else
        res:writeHeader("X-User-Found", "false")
           :writeStatus(404)
           :send("")
    end
end)

---------------------------------------------------
-- 🧩 OPTIONS: tell the client what’s allowed
---------------------------------------------------
self.server:options("/users/:id", function(req, res)
    print("OPTIONS request for /users/" .. req.params.id)
    res:writeHeader("Access-Control-Allow-Origin", "*")
       :writeHeader("Access-Control-Allow-Methods", "GET, HEAD, PATCH, PUT, DELETE, OPTIONS")
       :writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
       :writeHeader("Access-Control-Max-Age", "86400")
       :writeStatus(204)  -- No body
       :send("")
end)

---------------------------------------------------
-- 🔍 GET: normal retrieval for context
---------------------------------------------------
self.server:get("/users/:id", function(req, res)
    local id = req.params.id
    local user = USERS[id]

    if user then
        res:writeHeader("Content-Type", "application/json")
           :writeStatus(200)
           :send(json.encode(user))
    else
        res:writeStatus(404)
           :send(json.encode({ error = "User not found" }))
    end
end)

end

return M