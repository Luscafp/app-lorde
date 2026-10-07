import { TipoEvento } from '@atletica/shared'
import { View } from 'react-native'
import { Pilulas, type Opcao } from '@/components/ui'
import { useModalidades } from '@/features/modalidades'
import type { FiltrosSelecionados } from '../agenda'

const OPCOES_TIPO: readonly Opcao<TipoEvento>[] = [
  { valor: undefined, rotulo: 'Todos' },
  { valor: TipoEvento.JOGO, rotulo: 'Jogos' },
  { valor: TipoEvento.TREINO, rotulo: 'Treinos' },
]

type Props = {
  filtros: FiltrosSelecionados
  aoMudar: (filtros: FiltrosSelecionados) => void
  /** O Placar só filtra por modalidade. */
  comTipo?: boolean
}

/** Sem modalidades (carregando ou erro) fica só "Todas": a lista não depende delas. */
export function FiltrosAgenda({ filtros, aoMudar, comTipo = true }: Props) {
  const { data: modalidades = [] } = useModalidades({ incluirInativas: false })
  const opcoesModalidade: Opcao<string>[] = [
    { valor: undefined, rotulo: 'Todas' },
    ...modalidades.map(({ id, nome }) => ({ valor: id, rotulo: nome })),
  ]

  return (
    <View className="gap-2 px-4">
      {comTipo && (
        <Pilulas
          rotulo="Tipo de evento"
          opcoes={OPCOES_TIPO}
          valor={filtros.tipo}
          aoMudar={(tipo) => aoMudar({ ...filtros, tipo })}
        />
      )}
      <Pilulas
        rotulo="Modalidade"
        opcoes={opcoesModalidade}
        valor={filtros.modalidadeId}
        aoMudar={(modalidadeId) => aoMudar({ ...filtros, modalidadeId })}
      />
    </View>
  )
}
