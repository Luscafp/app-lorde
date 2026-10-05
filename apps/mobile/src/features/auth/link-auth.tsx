import { Link } from 'expo-router'
import type { ComponentProps } from 'react'

export function LinkAuth(props: Omit<ComponentProps<typeof Link>, 'className'>) {
  return (
    <Link
      {...props}
      className="min-h-[44px] py-3 text-sm font-semibold text-secundaria underline"
    />
  )
}
