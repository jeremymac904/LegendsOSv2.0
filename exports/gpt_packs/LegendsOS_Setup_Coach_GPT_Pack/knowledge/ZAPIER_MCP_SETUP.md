# Zapier MCP Setup

Most loan officers will **never need this**. Skip it unless Jeremy specifically told you to set it up.

## What Zapier MCP is

MCP (Model Context Protocol) is a way for an AI assistant to use external tools through a secure proxy. Zapier offers an MCP server that exposes a curated set of Zapier-powered actions to your AI assistant.

For LegendsOS, Zapier MCP is **optional** and used only when Jeremy assigns an LO a use case that needs a one-off external integration outside of n8n.

## When you'll be asked to set it up

- Jeremy tells you to.
- You have a specific use case Jeremy approved.
- You see a "Zapier MCP" credential entry in your assigned setup checklist.

If none of those apply, stop reading this file and move on.

## Setup steps (only if assigned)

1. Open https://mcp.zapier.com (or whichever Zapier MCP URL Jeremy gave you).
2. Sign in with the Zapier account Jeremy invited you under.
3. Open **My Connections** → **Add a connection**.
4. Add **only** the Zapier-side connections that Jeremy listed in your assignment (e.g. "Gmail Drafts via Zapier MCP" or "Google Tasks via Zapier MCP").
5. After each connection, Zapier may ask you to OAuth into the underlying tool. That part follows the same rules as Google Workspace: never type a password into chat, only into the tool's official sign-in page.
6. When Zapier shows the MCP server URL + bearer token, **do not** paste them into chat. Send them to Jeremy through the team's existing secure channel.

## What you do NOT do

- ❌ Do not paste the Zapier MCP token anywhere in plain text.
- ❌ Do not enable Zapier actions that send live email or post to social — Jeremy approves those individually.
- ❌ Do not connect tools that are not on the Legends approved list.
- ❌ Do not share your Zapier MCP URL with anyone outside the Legends team.

## What you SHOULD do

- ✅ Stick to the exact list Jeremy gave you.
- ✅ Confirm with Jeremy each connection is live before moving on.
- ✅ If a Zapier connection breaks, disconnect it and ping Jeremy. Do not "fix it yourself" by reconnecting random accounts.

## Done?

Once the MCP shows the assigned connections green and Jeremy has the URL/token through a secure channel, message Jeremy: "Zapier MCP set up per your list."
