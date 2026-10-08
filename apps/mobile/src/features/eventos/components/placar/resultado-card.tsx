import { formatarData, type EventoResumoDto } from '@atletica/shared'
import { Pressable, Text, View } from 'react-native'
import { Cartao, Selo, Texto } from '@/components/ui'
import { nomeAdversario } from '../../formatacao'
import { useResultadoLabel } from './use-resultado-label'

type Props = { evento: EventoResumoDto; aoAbrir: (evento: EventoResumoDto) => void }

/** A cor nunca é a única pista: o chip sempre traz o texto do resultado. */
export function ResultadoCard({ evento, aoAbrir }: Props) {
  const { resultado, placarTime, placarAdversario, timeAdversario } = evento
  const label = useResultadoLabel(resultado)
  const adversaria = nomeAdversario(evento)
  const data = formatarData(evento.inicio)
  const descricao = `${label.descrever(`${placarTime} a ${placarAdversario}`)} contra ${adversaria}`

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[descricao, evento.modalidade.nome, data].join(', ')}
      onPress={() => aoAbrir(evento)}
    >
      <Cartao className="gap-3">
        <View className="flex-row items-center gap-1.5">
          <Selo texto={evento.modalidade.nome} />
          <Selo texto={label.chip} cor={label.cor} />
          <Texto variante="legenda" className="ml-auto">
            {data}
          </Texto>
        </View>
        <View className="flex-row items-center gap-3">
          <Texto variante="rotulo" className="flex-1" numberOfLines={2}>
            {evento.time.nome}
          </Texto>
          <Texto variante="subtitulo">
            {resultado ? (
              <>
                <Text style={{ color: label.cor }}>{placarTime}</Text>
                {` : ${placarAdversario}`}
              </>
            ) : (
              '– : –'
            )}
          </Texto>
          <View className="flex-1 items-end">
            <Texto variante="rotulo" className="text-right" numberOfLines={2}>
              {adversaria}
            </Texto>
            {timeAdversario && (
              <Texto variante="legenda" className="text-right" numberOfLines={1}>
                {timeAdversario.nome}
              </Texto>
            )}
          </View>
        </View>
      </Cartao>
    </Pressable>
  )
}
