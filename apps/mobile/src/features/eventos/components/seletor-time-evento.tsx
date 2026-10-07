import type { EventoDto } from '@atletica/shared'
import { ActivityIndicator, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { OpcaoRadio, useTimesProprios } from '@/features/times'

export type TimeEscolhido = Pick<EventoDto, 'time' | 'modalidade'>

type Props = {
  valor: string
  aoMudar: (escolha: TimeEscolhido) => void
  /** Time do evento em edição: aparece mesmo se tiver sido desativado. */
  atual?: TimeEscolhido
  desabilitado?: boolean
  erro?: string
}

function agruparPorModalidade(times: TimeEscolhido[]) {
  const grupos = new Map<
    string,
    { modalidade: TimeEscolhido['modalidade']; times: TimeEscolhido[] }
  >()
  for (const escolha of times) {
    const grupo = grupos.get(escolha.modalidade.id) ?? { modalidade: escolha.modalidade, times: [] }
    grupo.times.push(escolha)
    grupos.set(escolha.modalidade.id, grupo)
  }
  return [...grupos.values()].sort((a, b) =>
    a.modalidade.nome.localeCompare(b.modalidade.nome, 'pt-BR'),
  )
}

/** Times ativos da atlética agrupados por modalidade; a modalidade do evento é a do time (RN10). */
export function SeletorTimeEvento({ valor, aoMudar, atual, desabilitado, erro }: Props) {
  const { data: ativos, isError } = useTimesProprios()
  const opcoes: TimeEscolhido[] = (ativos ?? []).map(({ id, nome, modalidade }) => ({
    time: { id, nome },
    modalidade,
  }))
  if (atual && !opcoes.some(({ time }) => time.id === atual.time.id)) opcoes.unshift(atual)
  const selecionado = opcoes.find(({ time }) => time.id === valor)

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Time da atlética</Texto>
      {!ativos && !isError && <ActivityIndicator color={paleta['texto-suave']} />}
      {isError && <Texto variante="legenda">Não foi possível carregar os times.</Texto>}
      {ativos?.length === 0 && !atual && (
        <Texto variante="legenda">Cadastre um time antes de criar o evento.</Texto>
      )}
      {agruparPorModalidade(desabilitado && selecionado ? [selecionado] : opcoes).map(
        ({ modalidade, times }) => (
          <View key={modalidade.id} className="gap-2">
            <Texto variante="legenda">{modalidade.nome}</Texto>
            <View accessibilityRole="radiogroup" className="gap-2">
              {times.map((escolha) => (
                <OpcaoRadio
                  key={escolha.time.id}
                  rotulo={escolha.time.nome}
                  marcada={escolha.time.id === valor}
                  desabilitada={desabilitado}
                  aoEscolher={() => aoMudar(escolha)}
                />
              ))}
            </View>
          </View>
        ),
      )}
      {selecionado && (
        <Texto variante="legenda">{`Modalidade: ${selecionado.modalidade.nome}`}</Texto>
      )}
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
    </View>
  )
}
