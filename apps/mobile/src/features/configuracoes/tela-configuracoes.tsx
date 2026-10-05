import type { Href } from 'expo-router'
import { Pressable, ScrollView, View } from 'react-native'
import { Texto } from '@/components/ui'
import { BotaoSair } from '@/features/auth'
import { SecaoConfiguracoes } from './secao-configuracoes'

export const ROTAS_CONFIGURACOES = {
  editarPerfil: '/perfil/configuracoes/editar-perfil',
  alterarSenha: '/perfil/configuracoes/alterar-senha',
  termos: '/termos',
  privacidade: '/privacidade',
  sobre: '/perfil/configuracoes/sobre',
  excluirConta: '/perfil/configuracoes/excluir-conta',
} as const satisfies Record<string, Href>

type Rota = (typeof ROTAS_CONFIGURACOES)[keyof typeof ROTAS_CONFIGURACOES]

/** Só itens do MVP (seção 3.4); o item Notificações é acrescentado pela #37. */
export function TelaConfiguracoes({ aoAbrir }: { aoAbrir: (rota: Rota) => void }) {
  const rotas = ROTAS_CONFIGURACOES

  return (
    <ScrollView contentContainerClassName="gap-6 p-4">
      <SecaoConfiguracoes
        titulo="Conta"
        itens={[
          {
            icone: 'person-outline',
            rotulo: 'Editar perfil',
            onPress: () => aoAbrir(rotas.editarPerfil),
          },
          {
            icone: 'lock-closed-outline',
            rotulo: 'Alterar senha',
            onPress: () => aoAbrir(rotas.alterarSenha),
          },
        ]}
      />
      <SecaoConfiguracoes
        titulo="Sobre"
        itens={[
          {
            icone: 'document-text-outline',
            rotulo: 'Termos de Uso',
            onPress: () => aoAbrir(rotas.termos),
          },
          {
            icone: 'shield-checkmark-outline',
            rotulo: 'Política de Privacidade',
            onPress: () => aoAbrir(rotas.privacidade),
          },
          {
            icone: 'information-circle-outline',
            rotulo: 'Sobre o aplicativo',
            onPress: () => aoAbrir(rotas.sobre),
          },
        ]}
      />
      <View className="gap-4">
        <BotaoSair />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Excluir conta"
          onPress={() => aoAbrir(rotas.excluirConta)}
          className="min-h-[44px] items-center justify-center"
        >
          <Texto variante="erro" className="font-semibold">
            Excluir conta
          </Texto>
        </Pressable>
      </View>
    </ScrollView>
  )
}
