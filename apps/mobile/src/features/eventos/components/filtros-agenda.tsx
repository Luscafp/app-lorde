import { View } from 'react-native'
import { Pilulas, type Opcao } from '@/components/ui'
import { useModalidades } from '@/features/modalidades'
import type { FiltrosSelecionados } from '../agenda'
import { OPCOES_TIPO } from '../rotulos'

type Props = { filtros: FiltrosSelecionados; aoMudar: (filtros: FiltrosSelecionados) => void }

/** Sem modalidades (carregando ou erro) fica só "Todas": a lista não depende delas. */
export function FiltrosAgenda({ filtros, aoMudar }: Props) {
  const { data: modalidades = [] } = useModalidades({ incluirInativas: false })
  const opcoesModalidade: Opcao<string>[] = [
    { valor: undefined, rotulo: 'Todas' },
    ...modalidades.map(({ id, nome }) => ({ valor: id, rotulo: nome })),
  ]

  return (
    <View className="gap-2 px-4">
      <Pilulas
        rotulo="Tipo de evento"
        opcoes={OPCOES_TIPO}
        valor={filtros.tipo}
        aoMudar={(tipo) => aoMudar({ ...filtros, tipo })}
      />
      <Pilulas
        rotulo="Modalidade"
        opcoes={opcoesModalidade}
        valor={filtros.modalidadeId}
        aoMudar={(modalidadeId) => aoMudar({ ...filtros, modalidadeId })}
      />
    </View>
  )
}
