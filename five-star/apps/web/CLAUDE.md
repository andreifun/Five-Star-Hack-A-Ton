<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## AI Model Usage

**Always use AI Gateway** (`@ai-sdk/gateway`) for all AI calls in this project — never import provider SDKs (e.g. `@ai-sdk/anthropic`, `@ai-sdk/openai`) directly in Convex actions.

The gateway provider is instantiated locally in each Convex action file:

```ts
import { createGatewayProvider } from "@ai-sdk/gateway";
const gateway = createGatewayProvider({ apiKey: process.env.AI_GATEWAY_API_KEY });
```

Model IDs follow the `provider/model-name` convention (e.g. `anthropic/claude-sonnet-4.6`, `openai/gpt-5.5`, `google/gemini-3.5-flash`). The default model for AI features that do not explicitly use MiniMax M3 is `anthropic/claude-sonnet-4.6`.

All AI action functions accept an optional `model` argument so callers can swap the model at runtime without code changes. The `generatedByModel` / `model` fields on `tips` and `chatMessages` documents record which model was used for each generation.
