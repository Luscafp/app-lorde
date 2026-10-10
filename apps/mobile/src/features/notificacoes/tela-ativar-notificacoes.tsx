import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { View } from 'react-native'
import { TelaRolavel } from '@/components/tela-rolavel'
import { Botao, Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { marcarPermissaoPerguntada, solicitarPermissaoERegistrar } from './registro-push'

/** Pré-permissão (épico #36 §3.1 itens 1–3): respondida, não pergunta de novo sozinha. */
export function TelaAtivarNotificacoes({ aoConcluir }: { aoConcluir: () => void }) {
  const { corPrimaria } = useAtletica()
  const [permitindo, setPermitindo] = useState(false)

  async function permitir() {
    setPermitindo(true)
    await solicitarPermissaoERegistrar().catch(() => undefined)
    aoConcluir()
  }

  async function agoraNao() {
    await marcarPermissaoPerguntada().catch(() => undefined)
    aoConcluir()
  }

  return (
    <TelaRolavel centralizada>
      <View className="items-center gap-3">
        <Ionicons name="notifications-outline" size={56} color={corPrimaria} />
        <Texto variante="titulo" className="text-center">
          Ativar notificações
        </Texto>
        <Texto className="text-center">
          Receba avisos de novos jogos e treinos, mudanças de horário, lembretes dos eventos,
          resultados e notícias da atlética.
        </Texto>
        <Texto variante="legenda" className="text-center">
          Você pode mudar isso depois em Perfil › Configurações › Notificações.
        </Texto>
      </View>
      <Botao titulo="Permitir" carregando={permitindo} onPress={() => void permitir()} />
      <Botao
        titulo="Agora não"
        variante="secundaria"
        disabled={permitindo}
        onPress={() => void agoraNao()}
      />
    </TelaRolavel>
  )
}
