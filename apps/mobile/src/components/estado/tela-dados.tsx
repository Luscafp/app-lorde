import { onlineManager, type UseQueryResult } from '@tanstack/react-query'
import { useSyncExternalStore, type ReactNode } from 'react'
import { View } from 'react-native'
import { Esqueleto, type VarianteEsqueleto } from './esqueleto'
import { EstadoErro } from './estado-erro'
import { EstadoVazio } from './estado-vazio'
import { FaixaOffline } from './faixa-offline'

export const MENSAGEM_SEM_CONEXAO = 'Sem conexão. Conecte-se à internet para carregar os dados.'

type Consulta<T> = Pick<UseQueryResult<T>, 'data' | 'isError' | 'refetch' | 'dataUpdatedAt'>

type Props<T> = {
  consulta: Consulta<T>
  vazio?: (dados: T) => boolean
  mensagemVazio?: string
  esqueleto?: VarianteEsqueleto
  children: (dados: T) => ReactNode
}

function useConectado() {
  return useSyncExternalStore(
    (aoMudar) => onlineManager.subscribe(aoMudar),
    () => onlineManager.isOnline(),
  )
}

export function TelaDados<T>({
  consulta,
  vazio,
  mensagemVazio = 'Nada por aqui ainda.',
  esqueleto,
  children,
}: Props<T>) {
  const conectado = useConectado()
  const tentarNovamente = () => void consulta.refetch()
  const { data } = consulta

  if (data === undefined) {
    if (!conectado) {
      return (
        <EstadoErro
          mensagem={MENSAGEM_SEM_CONEXAO}
          icone="cloud-offline-outline"
          onTentarNovamente={tentarNovamente}
        />
      )
    }
    if (consulta.isError) return <EstadoErro onTentarNovamente={tentarNovamente} />
    return <Esqueleto variante={esqueleto} />
  }

  return (
    <View className="flex-1">
      {!conectado && <FaixaOffline atualizadoEm={consulta.dataUpdatedAt} />}
      {vazio?.(data) ? <EstadoVazio mensagem={mensagemVazio} /> : children(data)}
    </View>
  )
}
