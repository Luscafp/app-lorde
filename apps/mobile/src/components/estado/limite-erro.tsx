import * as Sentry from '@sentry/react-native'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TelaErroFatal } from './tela-erro-fatal'

type Props = { children: ReactNode }
type Estado = { falhou: boolean }

/** ErrorBoundary do app: erro de renderização vai ao Sentry e mostra `TelaErroFatal`. */
export class LimiteErro extends Component<Props, Estado> {
  override state: Estado = { falhou: false }

  static getDerivedStateFromError(): Estado {
    return { falhou: true }
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    Sentry.captureException(erro, {
      contexts: { react: { componentStack: info.componentStack ?? null } },
    })
  }

  override render() {
    return this.state.falhou ? <TelaErroFatal /> : this.props.children
  }
}
