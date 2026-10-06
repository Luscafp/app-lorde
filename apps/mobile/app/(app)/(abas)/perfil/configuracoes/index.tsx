import { router } from 'expo-router'
import { TelaConfiguracoes } from '@/features/configuracoes'

export default function Configuracoes() {
  return <TelaConfiguracoes aoAbrir={(rota) => router.push(rota)} />
}
