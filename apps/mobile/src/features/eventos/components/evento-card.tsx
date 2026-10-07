import { formatarDataHora, StatusEvento, TipoEvento, type EventoResumoDto } from '@atletica/shared'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Cartao, Selo, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ModalidadeIcone } from '@/features/modalidades'
import { tituloEvento } from '../formatacao'

export type EventoDoCard = Pick<
  EventoResumoDto,
  'id' | 'tipo' | 'status' | 'inicio' | 'local' | 'time' | 'modalidade' | 'timeAdversario'
>

const ROTULO_TIPO = { [TipoEvento.JOGO]: 'JOGO', [TipoEvento.TREINO]: 'TREINO' } as const

/** Chips do card no épico #22 §6: agendado é o estado normal e fica sem selo. */
const SELO_STATUS: Partial<Record<StatusEvento, { texto: string; cor: string }>> = {
  [StatusEvento.EM_ANDAMENTO]: { texto: 'EM ANDAMENTO', cor: paleta.sucesso },
  [StatusEvento.FINALIZADO]: { texto: 'FINALIZADO', cor: paleta['texto-suave'] },
  [StatusEvento.CANCELADO]: { texto: 'CANCELADO', cor: paleta.erro },
}

type Props<T extends EventoDoCard> = {
  evento: T
  aoAbrir: (evento: T) => void
  direita?: ReactNode
  /** Substitui a data e hora padrão (`dd/mm/aaaa HH:mm`); o local é acrescentado. */
  data?: string
  selos?: ReactNode
}

export function EventoCard<T extends EventoDoCard>({
  evento,
  aoAbrir,
  direita,
  data = formatarDataHora(evento.inicio),
  selos,
}: Props<T>) {
  const { corPrimaria, corSecundaria } = useAtletica()
  const titulo = tituloEvento(evento)
  const quando = `${data} · ${evento.local}`
  const cancelado = evento.status === StatusEvento.CANCELADO
  const status = SELO_STATUS[evento.status]
  const corTipo = evento.tipo === TipoEvento.JOGO ? corPrimaria : corSecundaria

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[titulo, status?.texto, quando].filter(Boolean).join(', ')}
      onPress={() => aoAbrir(evento)}
    >
      <Cartao className="min-h-[44px] flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-xl border"
          style={{ borderColor: corTipo, opacity: cancelado ? 0.5 : 1 }}
        >
          <ModalidadeIcone icone={evento.modalidade.icone} cor={corTipo} />
        </View>
        <View className="flex-1 gap-1" style={{ opacity: cancelado ? 0.6 : 1 }}>
          <View className="flex-row flex-wrap gap-1.5">
            <Selo texto={ROTULO_TIPO[evento.tipo]} cor={corTipo} />
            <Selo texto={evento.modalidade.nome} />
            {status && <Selo texto={status.texto} cor={status.cor} />}
            {selos}
          </View>
          <Texto
            className="font-semibold"
            numberOfLines={1}
            style={cancelado && { textDecorationLine: 'line-through' }}
          >
            {titulo}
          </Texto>
          <Texto variante="legenda" numberOfLines={1}>
            {quando}
          </Texto>
        </View>
        {direita}
      </Cartao>
    </Pressable>
  )
}
