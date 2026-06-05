import { UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { Button } from "@workspace/ui/components/button"

export default async function Page() {
  const { userId } = await auth()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold text-sm">five-star</span>
        <UserButton />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
          <div>
            <h1 className="font-medium">Welcome!</h1>
            <p className="text-muted-foreground">
              You&apos;re signed in as <code className="font-mono text-xs">{userId}</code>.
            </p>
            <Button className="mt-2">Get started</Button>
          </div>
          <div className="text-muted-foreground font-mono text-xs">
            (Press <kbd>d</kbd> to toggle dark mode)
          </div>
        </div>
      </main>
    </div>
  )
}
