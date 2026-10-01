import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  Role, Screen, ToastItem, ConfirmState, Evento, Time, Modalidade, AtleticaRef,
  Solicitacao, Noticia, Banner, Usuario, AuditLog, AuditEntity, DemoState,
} from './types'

export type AppCtx = {
  role: Role
  setScreen: (s: Screen) => void
  showToast: (message: string, type: 'success' | 'error') => void
  showConfirm: (title: string, message: string, onConfirm: () => void) => void
  eventos: Evento[]
  setEventos: Dispatch<SetStateAction<Evento[]>>
  times: Time[]
  setTimes: Dispatch<SetStateAction<Time[]>>
  modalidades: Modalidade[]
  setModalidades: Dispatch<SetStateAction<Modalidade[]>>
  atleticas: AtleticaRef[]
  setAtleticas: Dispatch<SetStateAction<AtleticaRef[]>>
  solicitacoes: Solicitacao[]
  setSolicitacoes: Dispatch<SetStateAction<Solicitacao[]>>
  noticias: Noticia[]
  setNoticias: Dispatch<SetStateAction<Noticia[]>>
  banners: Banner[]
  setBanners: Dispatch<SetStateAction<Banner[]>>
  usuarios: Usuario[]
  setUsuarios: Dispatch<SetStateAction<Usuario[]>>
  auditoria: AuditLog[]
  audit: (entidade: AuditEntity, acao: string, alvo: string) => void
  demoState: DemoState
}

export const AppContext = createContext<AppCtx>({
  role: 'atleta',
  setScreen: () => {},
  showToast: () => {},
  showConfirm: () => {},
  eventos: [], setEventos: () => {},
  times: [], setTimes: () => {},
  modalidades: [], setModalidades: () => {},
  atleticas: [], setAtleticas: () => {},
  solicitacoes: [], setSolicitacoes: () => {},
  noticias: [], setNoticias: () => {},
  banners: [], setBanners: () => {},
  usuarios: [], setUsuarios: () => {},
  auditoria: [], audit: () => {},
  demoState: 'ready',
})

export const useApp = () => useContext(AppContext)

export type { ToastItem, ConfirmState }
