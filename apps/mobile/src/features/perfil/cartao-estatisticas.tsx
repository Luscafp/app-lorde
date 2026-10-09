import type { EstatisticasAtleta } from '@atletica/shared'
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Cartao, Texto } from '@/components/ui'

export const MENSAGEM_SEM_PRESENCAS = 'Ainda não há presenças registradas'

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${valor}`}
      className="flex-1 items-center gap-1"
    >
      <Texto variante="subtitulo">{valor}</Texto>
      <Texto variante="legenda" className="text-center">
        {rotulo}
      </Texto>
    </View>
  )
}

/** Épico #35 §3.2 item 10: usado no Perfil e no detalhe do usuário do Painel. */
export function CartaoEstatisticas({ estatisticas }: { estatisticas: EstatisticasAtleta }) {
  const { jogosParticipados, treinosPresentes, taxaPresenca } = estatisticas
  return (
    <Cartao testID="cartao-estatisticas" className="gap-3">
      <View className="flex-row">
        <Numero valor={String(jogosParticipados)} rotulo="Jogos participados" />
        <Numero valor={String(treinosPresentes)} rotulo="Treinos presentes" />
        <Numero
          valor={taxaPresenca === null ? '—' : `${taxaPresenca}%`}
          rotulo="Taxa de presença"
        />
      </View>
      {taxaPresenca === null && (
        <Texto variante="legenda" className="text-center">
          {MENSAGEM_SEM_PRESENCAS}
        </Texto>
      )}
    </Cartao>
  )
}

export function BlocoEstatisticas({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="gap-2">
      <Texto variante="subtitulo">Estatísticas</Texto>
      {children}
    </View>
  )
}
