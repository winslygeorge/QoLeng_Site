local Model = require("orm.model")
local env = require('config.get_env')

local connectionString = env.DB_CONNECTION_STRING  or "" 


-- Loan Model Definition
local Loan = Model:extend("loans", {
    -- Field definitions matching the Go struct
    id = "string",
    customer_id = "string",
    customer_name = "string", 
    phone_number = "string",
    email = "string",
    loan_amount = "float",
    outstanding_amount = "float",
    due_date = "timestamp",
    status = "string",
    last_payment_date = "timestamp",
    created_at = "timestamp",
    updated_at = "timestamp"
}, {
    -- Model configuration
    _primary_key = "id",
    _connection_mode = "sync", -- or "async" based on your needs
    _connection_string = connectionString,
    _timestamps = true,
    
    -- Unique constraints
    _unique_keys = {
        {"id"},
        {"customer_id", "status"} -- One active loan per customer
    },
    
    -- Indexes for performance
    _indexes = {
        "customer_id",
        "status", 
        "due_date",
        "last_payment_date",
        {"status", "due_date"}, -- For finding overdue loans
        {"customer_id", "status", "due_date"} -- Customer loan status queries
    },
    
    
    -- Filter presets for common loan queries
    _filter_presets = {
        active = function(qb)
            return qb:where("status", "=", "active")
        end,
        overdue = function(qb)
            return qb:where("status", "=", "active")
                    :where("due_date", "<", os.date("!%Y-%m-%d"))
        end,
        paid = function(qb)
            return qb:where("status", "=", "paid")
        end,
        defaulted = function(qb)
            return qb:where("status", "=", "defaulted")
        end,
        by_customer = function(qb, customer_id)
            return qb:where("customer_id", "=", customer_id)
        end
    },
    
    -- Loan status validation values
    _status_values = {
        "pending", "approved", "active", "paid", "defaulted", "cancelled"
    },
    
    -- Required for relations if you have related models
    _model_classes = {}
})

-- Custom methods for Loan model
function Loan:calculate_remaining_amount()
    return self.loan_amount - self.outstanding_amount
end

function Loan:is_overdue()
    if self.status ~= "active" then
        return false
    end
    local current_time = os.time()
    local due_time = os.time({year = os.date("%Y", self.due_date), 
                              month = os.date("%m", self.due_date), 
                              day = os.date("%d", self.due_date)})
    return current_time > due_time
end

function Loan:days_until_due()
    if self.status ~= "active" then
        return nil
    end
    local current_time = os.time()
    local due_time = os.time({year = os.date("%Y", self.due_date), 
                              month = os.date("%m", self.due_date), 
                              day = os.date("%d", self.due_date)})
    local diff_seconds = due_time - current_time
    return math.floor(diff_seconds / (24 * 60 * 60))
end

-- Static methods for batch operations
function Loan:get_overdue_loans()
    return self:query()
        :where("status", "=", "active")
        :where("due_date", "<", os.date("!%Y-%m-%d"))
        :order_by("due_date", "asc")
        :execute()
end

function Loan:get_customer_loans(customer_id)
    return self:query()
        :where("customer_id", "=", customer_id)
        :order_by("created_at", "desc")
        :execute()
end

function Loan:get_loans_by_status(status)
    return self:query()
        :where("status", "=", status)
        :order_by("created_at", "desc")
        :execute()
end

-- Export the Loan model
return Loan