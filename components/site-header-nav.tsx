"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"

import { SignOutButton } from "@/components/sign-out-button"
import { Button } from "@/components/ui/button"

export function SiteHeaderNav({ signedIn }: { signedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false)

  function closeMenu() {
    setIsOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 md:flex">
        <Button size="sm" variant="ghost" asChild>
          <Link href="/receipts">Receipts</Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/insights">Insights</Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/pricing">Pricing</Link>
        </Button>
        {signedIn ? (
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/billing">Billing</Link>
            </Button>
            <SignOutButton />
          </>
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

      <Button
        size="icon"
        variant="outline"
        className="md:hidden"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {isOpen ? (
        <div className="absolute inset-x-0 top-full z-50 border-b bg-background px-4 py-3 md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/receipts" onClick={closeMenu}>
                Receipts
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/insights" onClick={closeMenu}>
                Insights
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/pricing" onClick={closeMenu}>
                Pricing
              </Link>
            </Button>
            {signedIn ? (
              <>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/billing" onClick={closeMenu}>
                    Billing
                  </Link>
                </Button>
                <div className="pt-1">
                  <SignOutButton />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="outline" className="justify-start" asChild>
                  <Link href="/sign-in" onClick={closeMenu}>
                    Sign in
                  </Link>
                </Button>
                <Button className="justify-start" asChild>
                  <Link href="/sign-up" onClick={closeMenu}>
                    Create account
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
