import { ANTECEDENCIAS, type AntecedenciaLembrete } from '@atletica/shared'
import { View } from 'react-native'
import { Segmentos, Texto } from '@/components/ui'

const OPCOES = ANTECEDENCIAS.map((horas) => ({ valor: String(horas), rotulo: `${horas} h` }))

type Props = {
  valor: AntecedenciaLembrete
  desabilitado?: boolean
  aoMudar: (valor: AntecedenciaLembrete) => void
}

export function SeletorAntecedencia({ valor, desabilitado, aoMudar }: Props) {
  return (
    <View className="gap-2 px-4 py-3">
      <Texto className={desabilitado ? 'opacity-50' : ''}>Antecedência do lembrete</Texto>
      <Segmentos
        opcoes={OPCOES}
        valor={String(valor)}
        desabilitado={desabilitado}
        aoMudar={(horas) => {
          const nova = Number(horas) as AntecedenciaLembrete
          if (nova !== valor) aoMudar(nova)
        }}
      />
    </View>
  )
}
