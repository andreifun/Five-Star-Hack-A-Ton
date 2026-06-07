# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```

## Demo mode

The authenticated `/demo` route clones a preloaded real business into an
isolated workspace for the signed-in presenter. Configure the source business
in the Convex environment:

```bash
npx convex env set DEMO_TEMPLATE_BUSINESS_ID <business-id>
```

The source business must exist and be active. Starting the demo again resets
the presenter's previous demo workspace.
