import { StatusSolicitacao, type SolicitacaoPainelDto } from '@atletica/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { ListaInfinita, TelaDados } from '@/components/estado'
import { confirmar, Pilulas, Segmentos, type Opcao } from '@/components/ui'
import { useTimesProprios } from '@/features/times'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import {
  useAprovarSolicitacao,
  useRejeitarSolicitacao,
  useSolicitacoes,
  useTotalPendentes,
} from './hooks'
import { ItemSolicitacao, type AcoesSolicitacao } from './item-solicitacao'

type Aba = 'pendentes' | 'historico'

const ENCERRADAS = [
  StatusSolicitacao.APROVADA,
  StatusSolicitacao.REJEITADA,
  StatusSolicitacao.CANCELADA,
]

const OPCOES_STATUS: readonly Opcao<StatusSolicitacao>[] = [
  { valor: undefined, rotulo: 'Todas' },
  { valor: StatusSolicitacao.APROVADA, rotulo: 'Aceitas' },
  { valor: StatusSolicitacao.REJEITADA, rotulo: 'Rejeitadas' },
  { valor: StatusSolicitacao.CANCELADA, rotulo: 'Canceladas' },
]

function useAcoes(): AcoesSolicitacao {
  const aprovacao = useAprovarSolicitacao()
  const rejeicao = useRejeitarSolicitacao()
  return {
    online: aprovacao.online,
    aceitar: ({ id }) => aprovacao.mutate(id),
    rejeitar: ({ id, usuario, time }: SolicitacaoPainelDto) =>
      confirmar({
        titulo: 'Rejeitar solicitação',
        mensagem: `Rejeitar a solicitação de ${usuario.nome} para o ${time.nome}?`,
        acao: 'Rejeitar',
        aoConfirmar: () => rejeicao.mutate(id),
      }),
  }
}

/** Painel > Solicitações (UC20): pendentes para avaliar e histórico. */
export function PainelSolicitacoes() {
  const [aba, setAba] = useState<Aba>('pendentes')
  const [timeId, setTimeId] = useState<string>()
  const [status, setStatus] = useState<StatusSolicitacao>()
  const pendentes = aba === 'pendentes'
  const consulta = useSolicitacoes({
    status: pendentes ? [StatusSolicitacao.PENDENTE] : status ? [status] : ENCERRADAS,
    timeId,
  })
  const { data: totalPendentes } = useTotalPendentes(timeId)
  const { data: times = [] } = useTimesProprios()
  const acoes = useAcoes()

  const opcoesTime: Opcao<string>[] = [
    { valor: undefined, rotulo: 'Todos os times' },
    ...times.map((time) => ({ valor: time.id, rotulo: time.nome })),
  ]
  const abas = [
    {
      valor: 'pendentes',
      rotulo: totalPendentes === undefined ? 'Pendentes' : `Pendentes (${totalPendentes})`,
    },
    { valor: 'historico', rotulo: 'Histórico' },
  ] as const

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <Segmentos opcoes={abas} valor={aba} aoMudar={setAba} />
        <Pilulas rotulo="Filtrar por time" opcoes={opcoesTime} valor={timeId} aoMudar={setTimeId} />
        {!pendentes && (
          <Pilulas
            rotulo="Filtrar por status"
            opcoes={OPCOES_STATUS}
            valor={status}
            aoMudar={setStatus}
          />
        )}
      </View>
      <TelaDados
        consulta={consulta}
        esqueleto="lista"
        vazio={({ pages }) => juntarPaginas(pages).length === 0}
        mensagemVazio={
          pendentes ? 'Nenhuma solicitação pendente' : 'Nenhuma solicitação no histórico'
        }
      >
        {({ pages }) => (
          <ListaInfinita
            consulta={consulta}
            data={juntarPaginas(pages)}
            keyExtractor={({ id }) => id}
            contentContainerClassName="gap-2 px-4 pb-4"
            renderItem={({ item }) => (
              <ItemSolicitacao solicitacao={item} acoes={pendentes ? acoes : undefined} />
            )}
          />
        )}
      </TelaDados>
    </View>
  )
}
