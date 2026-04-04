import Link from "next/link"

import { SiteHeaderNav } from "@/components/site-header-nav"
import { Badge } from "@/components/ui/badge"
import { getServerSession } from "@/lib/auth-session"

export async function SiteHeader() {
  const session = await getServerSession()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            AutoReceipt
          </Link>
          {session?.user ? <Badge variant="secondary">Signed in</Badge> : null}
        </div>
        <SiteHeaderNav signedIn={Boolean(session?.user)} />
      </div>
    </header>
  )
}
