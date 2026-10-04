import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

/** `null` (ainda não verificado) conta como online. */
export function estaOnline(estado: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  return estado.isConnected !== false && estado.isInternetReachable !== false
}

/** Liga NetInfo → `onlineManager` e `AppState` → `focusManager`. */
export function configurarRede(): void {
  onlineManager.setEventListener((definirOnline) =>
    NetInfo.addEventListener((estado) => definirOnline(estaOnline(estado))),
  )
  focusManager.setEventListener((definirFoco) => {
    const assinatura = AppState.addEventListener('change', (status) =>
      definirFoco(status === 'active'),
    )
    return () => assinatura.remove()
  })
}

const assinar = (aoMudar: () => void) => onlineManager.subscribe(aoMudar)
const lerOnline = () => onlineManager.isOnline()

export function useOnline(): boolean {
  return useSyncExternalStore(assinar, lerOnline)
}
