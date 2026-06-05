"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth, RedirectToSignIn } from "@clerk/nextjs"
import { useConvexAuth, useQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"

export function FullScreenLoader() {
  return (
    <div className="flex h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/**
 * Centered message screen for empty / not-found / error states.
 */
export function StatusScreen({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
        {action && (
          <Button asChild className="mt-5">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Shown when Clerk reports a signed-in user but Convex hasn't accepted the
 * session token. Normally this is a sub-second handshake, so we show a loader.
 * If it persists, the Clerk JWT template is almost certainly missing — surface
 * an actionable message instead of spinning forever (which would otherwise look
 * like a hang or, with a naive gate, a redirect loop).
 */
function ConnectingToBackend() {
  const [stalled, setStalled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setStalled(true), 6000)
    return () => clearTimeout(t)
  }, [])

  if (!stalled) return <FullScreenLoader />

  return (
    <StatusScreen
      title="Can't reach the backend"
      description="You're signed in, but the app couldn't authenticate with Convex. Make sure a Clerk JWT template named “convex” exists and matches convex/auth.config.ts, then reload."
    />
  )
}

/**
 * Waits until the Convex user row exists before rendering children. The row is
 * created by `UserSync` in the Convex provider the moment auth resolves; until
 * then, ownership-checked queries would throw "User not found", so we hold.
 */
function EnsureUserSynced({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.getCurrentUser)
  if (me === undefined || me === null) return <FullScreenLoader />
  return <>{children}</>
}

/**
 * Gate for authenticated areas. Decisions are split between the two auth
 * systems so the flow can never loop:
 *
 *  - Clerk not loaded / Convex still loading  → loader
 *  - Clerk signed OUT                         → redirect to sign-in
 *  - Clerk signed IN, Convex not ready        → loader (NEVER redirect)
 *  - Both authenticated                       → render (after user sync)
 *
 * The previous version redirected whenever Convex was unauthenticated, which
 * bounced signed-in users between "/" and "/sign-in" indefinitely.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (!isLoaded) return <FullScreenLoader />
  if (!isSignedIn) return <RedirectToSignIn />
  if (isLoading || !isAuthenticated) return <ConnectingToBackend />

  return <EnsureUserSynced>{children}</EnsureUserSynced>
}
