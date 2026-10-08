import { aceitaPresenca, type StatusEvento } from '@atletica/shared'
import { View } from 'react-native'
import { Botao, Texto } from '@/components/ui'
import { usePresencas } from '../hooks'
import { MENSAGEM_PRESENCA_BLOQUEADA } from './tela-presenca'

const contarPresentes = (total: number) => (total === 1 ? '1 presente' : `${total} presentes`)

type Props = {
  evento: { id: string; status: StatusEvento }
  aoRegistrar: () => void
}

/** Botão e resumo no detalhe do evento do Painel (épico #35 §3.1 itens 1 e 8). */
export function SecaoPresenca({ evento, aoRegistrar }: Props) {
  const permitida = aceitaPresenca(evento.status)
  const { data: lista } = usePresencas(evento.id, permitida)
  const registrada = permitida && lista?.registrada === true
  const presentes = lista?.itens.filter(({ presente }) => presente).length ?? 0

  return (
    <View className="gap-2">
      {registrada && (
        <Texto variante="legenda">{`Presença registrada · ${contarPresentes(presentes)}`}</Texto>
      )}
      <Botao
        titulo={registrada ? 'Corrigir presença' : 'Registrar presença'}
        variante="secundaria"
        disabled={!permitida}
        onPress={aoRegistrar}
      />
      {!permitida && <Texto variante="legenda">{MENSAGEM_PRESENCA_BLOQUEADA}</Texto>}
    </View>
  )
}
