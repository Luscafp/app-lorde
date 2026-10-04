import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'

/** Componentes que usam `useAtletica` precisam do provider; consultas desligadas, tema neutro. */
export function renderizar(elemento: ReactElement) {
  const cliente = new QueryClient({ defaultOptions: { queries: { enabled: false } } })
  const comQuery = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  )
  return render(elemento, { wrapper: comQuery })
}
