import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getServerSession } from "@/lib/auth-session"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await getServerSession()
  const { callbackUrl } = await searchParams

  if (session?.user) {
    redirect(callbackUrl || "/")
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <AuthForm mode="sign-in" callbackUrl={callbackUrl || "/"} />
    </main>
  )
}
