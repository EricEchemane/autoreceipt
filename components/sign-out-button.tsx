"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function SignOutButton() {
  const [isPending, setIsPending] = useState(false)

  async function handleSignOut() {
    setIsPending(true)
    try {
      await authClient.signOut()
      window.location.href = "/"
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSignOut}
      disabled={isPending}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  )
}
