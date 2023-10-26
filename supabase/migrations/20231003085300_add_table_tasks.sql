-- Define enumeration types
CREATE TYPE task_type_enum AS ENUM ('fetch', 'extract', 'edit', 'export', 'transmute', 'enrich');
CREATE TYPE task_category_enum AS ENUM ('mining', 'enrich', 'activate');
CREATE TYPE task_status_enum AS ENUM ('running', 'canceled', 'done');

-- Create the 'tasks' table
CREATE TABLE tasks (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID,
    status task_status_enum DEFAULT NULL,
    category task_category_enum NOT NULL,
    type task_type_enum NOT NULL,
    details JSONB DEFAULT NULL,
    duration INTEGER DEFAULT NULL,
    stopped_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- Enable row level security for the 'tasks' table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
