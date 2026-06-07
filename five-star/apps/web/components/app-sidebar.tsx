import { BusinessNav } from "@/components/business-nav"

export function AppSidebar() {
  return (
    <>
      <aside className="hidden w-52 shrink-0 px-3 pb-3 md:block">
        <div className="h-full rounded-2xl bg-muted/60 p-2">
          <p className="px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground">
            Workspace
          </p>
          <BusinessNav />
        </div>
      </aside>
      <aside className="z-20 shrink-0 border-t bg-background/95 px-2 py-1 backdrop-blur md:hidden">
        <BusinessNav mobile />
      </aside>
    </>
  )
}
