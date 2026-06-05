<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## AI Model Usage

**Always use AI Gateway** (`@ai-sdk/gateway`) for all AI calls — never import individual provider SDKs (e.g. `@ai-sdk/anthropic`, `@ai-sdk/openai`) directly. Use `createGatewayProvider` with `AI_GATEWAY_API_KEY` and model IDs in `provider/model-name` format (e.g. `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`). See `apps/web/AGENTS.md` for full details.
