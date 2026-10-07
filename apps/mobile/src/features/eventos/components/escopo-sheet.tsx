import { EscopoOcorrencia } from '@atletica/shared'
import { Modal, View } from 'react-native'
import { Botao, Texto } from '@/components/ui'

type Props = {
  titulo: string
  /** Treinos agendados a partir deste, inclusive; sem o número, a linha é omitida. */
  agendados?: number
  aoEscolher: (escopo: EscopoOcorrencia) => void
  aoFechar: () => void
}

/** UC16 A1/A2: em ocorrência de série, editar e cancelar perguntam o alcance antes. */
export function EscopoSheet({ titulo, agendados, aoEscolher, aoFechar }: Props) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="gap-3 rounded-t-3xl bg-superficie p-4 pb-8">
          <Texto variante="subtitulo">{titulo}</Texto>
          {agendados !== undefined && (
            <Texto variante="legenda">
              {agendados === 1
                ? '1 treino agendado a partir deste.'
                : `${agendados} treinos agendados a partir deste.`}
            </Texto>
          )}
          <Botao
            titulo="Somente este treino"
            variante="secundaria"
            onPress={() => aoEscolher(EscopoOcorrencia.ESTA)}
          />
          <Botao
            titulo="Este e os seguintes"
            variante="secundaria"
            onPress={() => aoEscolher(EscopoOcorrencia.ESTA_E_SEGUINTES)}
          />
          <Botao titulo="Voltar" onPress={aoFechar} />
        </View>
      </View>
    </Modal>
  )
}
