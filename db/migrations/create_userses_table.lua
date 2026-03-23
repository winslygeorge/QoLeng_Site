-- Auto-generated migration to create table for model 'users'

local SchemaManager = require("orm.schema_manager")
local models = require("models.init_models")

local model_to_migrate = models['users']

if not model_to_migrate then
	print("Error: Model 'users' not found in models.init_models. Make sure your model is defined and exposed.")
	os.exit(1)
end

print("--- Running migration for: users (Table: userses) ---")

-- Apply migrations (will create table if it doesn't exist, or alter if schema changed)
SchemaManager.apply_migrations(model_to_migrate)

print("--- Migration for users completed. ---")