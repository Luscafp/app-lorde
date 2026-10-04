import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'

/** Consultas desligadas; `useAtletica` e `useAcaoOnline` precisam do provider. */
export function comQuery() {
  const cliente = new QueryClient({ defaultOptions: { queries: { enabled: false } } })
  return function ComQuery({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  }
}

export function renderizar(elemento: ReactElement) {
  return render(elemento, { wrapper: comQuery() })
}
