import { Link } from 'expo-router'
import { Text } from 'react-native'
import { TelaProvisoria } from '@/components/tela-provisoria'
import { useAtletica } from '@/features/atletica'

// Tela real na #59.
export default function Login() {
  const { nome } = useAtletica()

  return (
    <TelaProvisoria titulo="Entrar">
      <Text className="text-lg font-semibold text-primaria">{nome}</Text>
      <Link href="/cadastro" className="min-h-11 py-3 text-secundaria">
        Criar conta
      </Link>
    </TelaProvisoria>
  )
}
