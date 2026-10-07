import { formatarDataHora, Resultado, type EventoResumoDto } from '@atletica/shared'
import { Pressable, View } from 'react-native'
import { Cartao, Selo, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { rotuloResultado } from '../formatacao'
import { RESULTADO, siglaOuNome } from '../rotulos'
import { MENSAGEM_RESULTADO_PENDENTE } from './evento-detalhe'

type Props = { evento: EventoResumoDto; aoAbrir: (evento: EventoResumoDto) => void }

function descricao(evento: EventoResumoDto, atletica: string): string {
  const { resultado, placarTime, placarAdversario, timeAdversario } = evento
  const contra = `contra ${timeAdversario?.atletica.nome ?? '—'}`
  if (!resultado) return `${MENSAGEM_RESULTADO_PENDENTE} ${contra}`
  const placar = `${placarTime} a ${placarAdversario}`
  if (resultado === Resultado.EMPATE) return `Empate em ${placar} ${contra}`
  return `${rotuloResultado(resultado, atletica)} por ${placar} ${contra}`
}

/** RN17: o resultado vem da API; aqui só vira rótulo e cor, sempre com texto. */
export function PlacarCard({ evento, aoAbrir }: Props) {
  const atletica = siglaOuNome(useAtletica())
  const { resultado, placarTime, placarAdversario } = evento
  const quando = formatarDataHora(evento.inicio)
  const selo = resultado
    ? { texto: RESULTADO[resultado].rotulo.toUpperCase(), cor: RESULTADO[resultado].cor }
    : { texto: MENSAGEM_RESULTADO_PENDENTE.toUpperCase(), cor: paleta.alerta }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[descricao(evento, atletica), evento.modalidade.nome, quando].join(', ')}
      onPress={() => aoAbrir(evento)}
    >
      <Cartao className="gap-2">
        <View className="flex-row flex-wrap gap-1.5">
          <Selo texto={evento.modalidade.nome} />
          <View style={{ opacity: resultado ? 1 : 0.7 }}>
            <Selo texto={selo.texto} cor={selo.cor} />
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Texto variante="rotulo" className="flex-1" numberOfLines={2}>
            {evento.time.nome}
          </Texto>
          <Texto variante="subtitulo">
            {resultado ? `${placarTime} : ${placarAdversario}` : '– : –'}
          </Texto>
          <Texto variante="rotulo" className="flex-1 text-right" numberOfLines={2}>
            {evento.timeAdversario?.atletica.nome ?? '—'}
          </Texto>
        </View>
        <Texto variante="legenda" numberOfLines={1}>
          {resultado ? `${rotuloResultado(resultado, atletica)} · ${quando}` : quando}
        </Texto>
      </Cartao>
    </Pressable>
  )
}
