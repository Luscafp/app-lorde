import { View } from 'react-native'
import { Pilulas, type Opcao } from '@/components/ui'
import { useModalidades } from '@/features/modalidades'
import type { FiltrosSelecionados } from '../agenda'
import { OPCOES_TIPO } from '../rotulos'

type PropsModalidade = {
  valor: string | undefined
  aoMudar: (modalidadeId: string | undefined) => void
}

/** Sem modalidades (carregando ou erro) fica só "Todas": a lista não depende delas. */
export function FiltroModalidade({ valor, aoMudar }: PropsModalidade) {
  const { data: modalidades = [] } = useModalidades({ incluirInativas: false })
  const opcoes: Opcao<string>[] = [
    { valor: undefined, rotulo: 'Todas' },
    ...modalidades.map(({ id, nome }) => ({ valor: id, rotulo: nome })),
  ]

  return <Pilulas rotulo="Modalidade" opcoes={opcoes} valor={valor} aoMudar={aoMudar} />
}

type Props = { filtros: FiltrosSelecionados; aoMudar: (filtros: FiltrosSelecionados) => void }

export function FiltrosAgenda({ filtros, aoMudar }: Props) {
  return (
    <View className="gap-2 px-4">
      <Pilulas
        rotulo="Tipo de evento"
        opcoes={OPCOES_TIPO}
        valor={filtros.tipo}
        aoMudar={(tipo) => aoMudar({ ...filtros, tipo })}
      />
      <FiltroModalidade
        valor={filtros.modalidadeId}
        aoMudar={(modalidadeId) => aoMudar({ ...filtros, modalidadeId })}
      />
    </View>
  )
}
