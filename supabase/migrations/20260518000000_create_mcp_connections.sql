-- Migration: 20260518000000_create_mcp_connections.sql
-- Adds per-user MCP server connections for tool integration.
-- Each user can connect their own MCP servers (Zapier, Composio, custom).

-- Create the mcp_connections table
CREATE TABLE IF NOT EXISTS mcp_connections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    label       TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 128),
    url         TEXT NOT NULL CHECK (char_length(url) BETWEEN 1 AND 1024),
    auth_token  TEXT CHECK (auth_token IS NULL OR char_length(auth_token) < 4096),
    provider    TEXT NOT NULL DEFAULT 'zapier' CHECK (provider IN ('zapier', 'composio', 'custom')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Enforce unique labels per user
    UNIQUE (user_id, label)
);

-- Index for fast user-level lookups
CREATE INDEX IF NOT EXISTS idx_mcp_connections_user_id ON mcp_connections(user_id);

-- Row-Level Security: users can only see/delete their own connections
ALTER TABLE mcp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own MCP connections"
    ON mcp_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MCP connections"
    ON mcp_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own MCP connections"
    ON mcp_connections FOR DELETE
    USING (auth.uid() = user_id);

-- Audit trigger: auto-update saved_at on upsert
CREATE OR REPLACE FUNCTION update_mcp_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.saved_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mcp_connections_upsert
    BEFORE INSERT OR UPDATE ON mcp_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_mcp_connection_timestamp();

-- Grant access
GRANT ALL ON mcp_connections TO authenticated;
GRANT ALL ON mcp_connections TO service_role;
