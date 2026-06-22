import { SignIn } from '@clerk/nextjs'
import { redirect } from 'next/navigation'

import { isClerkEnabled } from '@/lib/auth'

export default function SignInPage() {
  if (!isClerkEnabled()) redirect('/')

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-10">
      <SignIn signUpUrl="" />
    </main>
  )
}
