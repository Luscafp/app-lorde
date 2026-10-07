import type { EventoResumoDto, ListaEventos } from '@atletica/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { Pressable, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { CartaoTreino } from './cartao-treino'

export const MENSAGEM_SEM_TREINOS = 'Sem treinos agendados'
export const MENSAGEM_ERRO_TREINOS = 'Não foi possível carregar os treinos'

type Props = {
  consulta: UseQueryResult<ListaEventos>
  aoAbrirTreino: (treino: EventoResumoDto) => void
  aoVerAgenda: () => void
}

/** Seção com estado próprio: a falha dos treinos não esconde o elenco. */
export function ProximosTreinos({ consulta, aoAbrirTreino, aoVerAgenda }: Props) {
  const { corPrimaria } = useAtletica()

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Texto variante="subtitulo">Próximos treinos</Texto>
        <Pressable
          accessibilityRole="link"
          onPress={aoVerAgenda}
          className="min-h-[44px] justify-center"
        >
          <Texto className="font-semibold" style={{ color: corPrimaria }}>
            Ver na agenda
          </Texto>
        </Pressable>
      </View>
      <TelaDados
        consulta={consulta}
        esqueleto="lista"
        faixaOffline={false}
        vazio={({ items }) => items.length === 0}
        mensagemVazio={MENSAGEM_SEM_TREINOS}
        mensagemErro={MENSAGEM_ERRO_TREINOS}
      >
        {({ items }) => (
          <View className="gap-2">
            {items.map((treino) => (
              <CartaoTreino key={treino.id} treino={treino} aoAbrir={aoAbrirTreino} />
            ))}
          </View>
        )}
      </TelaDados>
    </View>
  )
}
