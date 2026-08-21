'use client'

import { useFormStatus } from 'react-dom'

import Button from '@/components/ui/Button'

export default function CopySetupSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="secondary" size="sm" isPending={pending} pendingText="Creating draft...">
      Copy setup
    </Button>
  )
}
