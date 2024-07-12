DROP TABLE tasks;
DROP TABLE engagement;

DROP TYPE task_type_enum;
DROP TYPE task_category_enum;
DROP TYPE engagement_type_enum;

CREATE TYPE engagement_type_enum AS ENUM ('CSV', 'ENRICH');
CREATE TYPE task_category_enum AS ENUM ('mining', 'enriching', 'cleaning');
CREATE TYPE task_type_enum AS ENUM ('fetch', 'extract', 'edit', 'export', 'enrich');

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

-- Enable realtime for the 'tasks' table
alter publication supabase_realtime add table public.tasks;

-- Enable row level security for the 'tasks' table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

create policy "Enable select for users based on user_id"
on "public"."tasks"
as permissive
for select
to public
using ((select auth.uid()) = user_id);


CREATE TABLE engagement (
    user_id uuid not null,
    engagement_type public.engagement_type_enum null,
    engagement_created_at timestamp with time zone null default now(),
    email text not null,
    constraint engagement_pkey primary key (email, user_id, engagement_type),
    constraint engagement_user_id_fkey foreign key (user_id) references auth.users (id)
);