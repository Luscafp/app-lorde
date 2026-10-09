import type { EstatisticasAtleta } from '@atletica/shared'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Cartao, Texto } from '@/components/ui'
import { useEstatisticas } from './consultas'

export const MENSAGEM_SEM_PRESENCAS = 'Ainda não há presenças registradas'
export const MENSAGEM_ERRO_ESTATISTICAS = 'Não foi possível carregar suas estatísticas'

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

/** Perfil (UC10 passo 3): estado próprio, sem afetar o restante da tela. */
export function SecaoEstatisticas() {
  const consulta = useEstatisticas()
  return (
    <View testID="secao-estatisticas" className="gap-2">
      <Texto variante="subtitulo">Estatísticas</Texto>
      <TelaDados
        consulta={consulta}
        esqueleto="cartao"
        faixaOffline={false}
        mensagemErro={MENSAGEM_ERRO_ESTATISTICAS}
      >
        {(estatisticas) => <CartaoEstatisticas estatisticas={estatisticas} />}
      </TelaDados>
    </View>
  )
}
