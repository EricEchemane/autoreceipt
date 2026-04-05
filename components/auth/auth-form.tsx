"use client"

import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { authClient } from "@/lib/auth-client"

type AuthMode = "sign-in" | "sign-up"

type AuthFormProps = {
  mode: AuthMode
  callbackUrl?: string
}

export function AuthForm({ mode, callbackUrl = "/" }: AuthFormProps) {
  const isSignIn = mode === "sign-in"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [isGooglePending, setIsGooglePending] = useState(false)

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsPending(true)

    try {
      if (isSignIn) {
        await authClient.signIn.email({
          email,
          password,
          callbackURL: callbackUrl,
        })
      } else {
        await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: callbackUrl,
        })
      }

      window.location.href = callbackUrl
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We couldn't complete that. Please try again."
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleGoogleAuth() {
    setError("")
    setIsGooglePending(true)

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Google sign-in failed. Please try again."
      )
      setIsGooglePending(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          {isSignIn ? "Welcome back" : "Get started"}
        </Badge>
        <CardTitle>{isSignIn ? "Sign in" : "Create your account"}</CardTitle>
        <CardDescription>
          {isSignIn
            ? "Continue managing your receipts."
            : "Start uploading and reviewing receipts in one place."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleAuth}
          disabled={isGooglePending}
        >
          {isGooglePending ? "Redirecting to Google..." : "Continue with Google"}
        </Button>
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          {!isSignIn ? (
            <Input
              required
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : null}
          <Input
            required
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isSignIn
                ? "Signing in..."
                : "Creating account..."
              : isSignIn
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {error ? (
          <p className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {isSignIn ? "No account yet?" : "Already have an account?"}{" "}
          <Link
            href={isSignIn ? "/sign-up" : "/sign-in"}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isSignIn ? "Create one" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
