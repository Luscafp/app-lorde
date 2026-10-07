import Ionicons from '@expo/vector-icons/Ionicons'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { EventoCard } from '@/features/eventos'
import { useMeusProximosEventos } from '../hooks'

export const MENSAGEM_SEM_PROXIMOS = 'Você não confirmou presença em nenhum evento próximo.'
export const MENSAGEM_ERRO_PROXIMOS = 'Não foi possível carregar seus próximos eventos'

/** Perfil (UC10 passo 4): estado próprio, sem afetar o restante da tela. */
export function SecaoMeusProximosEventos({
  aoAbrirEvento,
}: {
  aoAbrirEvento: (id: string) => void
}) {
  const consulta = useMeusProximosEventos()

  return (
    <View testID="meus-proximos-eventos" className="gap-2">
      <Texto variante="subtitulo">Meus próximos eventos</Texto>
      <TelaDados
        consulta={consulta}
        esqueleto="cartao"
        faixaOffline={false}
        vazio={(eventos) => eventos.length === 0}
        mensagemVazio={MENSAGEM_SEM_PROXIMOS}
        mensagemErro={MENSAGEM_ERRO_PROXIMOS}
      >
        {(eventos) => (
          <View className="gap-2">
            {eventos.map((evento) => (
              <EventoCard
                key={evento.id}
                evento={evento}
                aoAbrir={({ id }) => aoAbrirEvento(id)}
                direita={
                  <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
                }
              />
            ))}
          </View>
        )}
      </TelaDados>
    </View>
  )
}
