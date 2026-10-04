import Ionicons from '@expo/vector-icons/Ionicons'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { paleta, useAtletica } from '@/features/atletica'
import { useVePainel } from '@/infra/sessao/use-ve-painel'

type Aba = { nome: string; titulo: string; icone: ComponentProps<typeof Ionicons>['name'] }

const ABAS: readonly Aba[] = [
  { nome: 'index', titulo: 'Início', icone: 'home-outline' },
  { nome: 'agenda', titulo: 'Agenda', icone: 'calendar-outline' },
  { nome: 'times', titulo: 'Times', icone: 'people-outline' },
  { nome: 'perfil', titulo: 'Perfil', icone: 'person-outline' },
  { nome: 'painel', titulo: 'Painel', icone: 'shield-checkmark-outline' },
]

export default function LayoutAbas() {
  const { corPrimaria } = useAtletica()
  const vePainel = useVePainel()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: corPrimaria,
        tabBarInactiveTintColor: paleta['texto-suave'],
        tabBarStyle: { backgroundColor: paleta.superficie, borderTopColor: paleta.borda },
        tabBarItemStyle: { minHeight: 44 },
        sceneStyle: { backgroundColor: paleta.fundo },
      }}
    >
      {ABAS.map(({ nome, titulo, icone }) => (
        <Tabs.Screen
          key={nome}
          name={nome}
          options={{
            title: titulo,
            tabBarAccessibilityLabel: titulo,
            tabBarIcon: ({ color, size }) => <Ionicons name={icone} color={color} size={size} />,
            ...(nome === 'painel' && !vePainel && { href: null }),
          }}
        />
      ))}
    </Tabs>
  )
}
