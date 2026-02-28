'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold text-foreground">문제가 발생했습니다</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        일시적인 오류일 수 있습니다. 다시 시도해 주세요.
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
      >
        다시 시도
      </button>
    </div>
  )
}
