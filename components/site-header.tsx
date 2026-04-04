import Link from "next/link"

import { SignOutButton } from "@/components/sign-out-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getServerSession } from "@/lib/auth-session"

export async function SiteHeader() {
  const session = await getServerSession()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            AutoReceipt
          </Link>
          {session?.user ? <Badge variant="secondary">Signed in</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href="/receipts">Receipts</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/insights">Insights</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/billing">Billing</Link>
          </Button>
          {session?.user ? (
            <SignOutButton />
          ) : (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Create account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
