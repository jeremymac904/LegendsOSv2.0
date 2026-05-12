# Supabase Data Model

## profiles

Purpose: User identity and role.

Columns:

- id uuid primary key references auth.users
- email text unique not null
- full_name text
- role text check in owner, admin, loan_officer
- team_id uuid
- avatar_url text
- is_active boolean default true
- created_at timestamptz
- updated_at timestamptz

## teams

- id uuid primary key
- name text
- owner_id uuid
- created_at timestamptz

## atlas_agents

- id uuid primary key
- team_id uuid
- owner_user_id uuid nullable
- name text
- description text
- visibility text check in owner_only, assigned_user, team_shared
- system_prompt text
- is_active boolean
- created_at timestamptz

## chat_sessions

- id uuid primary key
- user_id uuid
- agent_id uuid
- title text
- created_at timestamptz
- updated_at timestamptz

## chat_messages

- id uuid primary key
- session_id uuid
- user_id uuid
- role text check in user, assistant, system
- content text
- metadata jsonb
- created_at timestamptz

## uploaded_files

- id uuid primary key
- user_id uuid
- bucket text
- path text
- file_name text
- mime_type text
- size_bytes int
- source_module text
- created_at timestamptz

## generated_images

- id uuid primary key
- user_id uuid
- prompt text
- revised_prompt text
- provider text
- model text
- storage_path text
- status text
- cost_estimate numeric
- metadata jsonb
- created_at timestamptz

## social_posts

- id uuid primary key
- user_id uuid
- title text
- body text
- channels text[]
- image_id uuid nullable
- status text check in draft, scheduled, publishing, published, failed
- scheduled_at timestamptz nullable
- n8n_execution_id text nullable
- error_message text nullable
- created_at timestamptz
- updated_at timestamptz

## email_drafts

- id uuid primary key
- user_id uuid
- subject text
- body text
- template_id uuid nullable
- status text check in draft, approved, sending, sent, failed
- created_at timestamptz
- updated_at timestamptz

## calendar_items

- id uuid primary key
- user_id uuid
- title text
- description text
- item_type text
- starts_at timestamptz
- ends_at timestamptz nullable
- metadata jsonb
- created_at timestamptz

## provider_configs

- id uuid primary key
- team_id uuid
- provider text
- status text check in missing, configured, disabled, error
- encrypted_key_ref text nullable
- public_metadata jsonb
- created_at timestamptz
- updated_at timestamptz

## usage_events

- id uuid primary key
- user_id uuid nullable
- team_id uuid nullable
- event_type text
- module text
- metadata jsonb
- created_at timestamptz

## audit_logs

- id uuid primary key
- actor_user_id uuid nullable
- action text
- target_type text
- target_id text
- metadata jsonb
- created_at timestamptz

## RLS rules

- Users can read their own profile.
- Owner can read all team profiles.
- Users can read their own chat sessions and messages.
- Users can read team shared agents and their assigned agent.
- Owner can read all usage events.
- Users can read their own generated images and files.
- Owner can manage provider configs.
- No user can read secrets directly.
