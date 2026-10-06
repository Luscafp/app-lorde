import type { ComponentType } from 'react'

export const init = jest.fn()
export const captureException = jest.fn()
export const captureMessage = jest.fn()
export const addBreadcrumb = jest.fn()
export const setUser = jest.fn()
export const startInactiveSpan = jest.fn(() => ({ end: jest.fn() }))
export const wrap = jest.fn(<P extends object>(componente: ComponentType<P>) => componente)
export const reactNavigationIntegration = jest.fn(() => ({
  name: 'ReactNavigation',
  registerNavigationContainer: jest.fn(),
}))
