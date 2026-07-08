import { SignIn } from '@clerk/nextjs'
import { redirect } from 'next/navigation'

import { isClerkEnabled } from '@/lib/auth'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  if (!isClerkEnabled()) redirect('/')
  const { redirect_url: redirectUrl } = await searchParams

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-10">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl={redirectUrl} forceRedirectUrl={redirectUrl} />
    </main>
  )
}
