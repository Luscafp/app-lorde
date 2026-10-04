import { Link } from 'expo-router'
import { Pressable, Text } from 'react-native'
import { TelaProvisoria } from '@/components/ui/tela-provisoria'
import { corTextoSobre, useAtletica } from '@/features/atletica'

export default function PaginaNaoEncontrada() {
  const { corPrimaria } = useAtletica()

  return (
    <TelaProvisoria titulo="Página não encontrada">
      <Link href="/" replace asChild>
        <Pressable className="min-h-11 justify-center rounded-lg bg-primaria px-6 active:opacity-80">
          <Text className="font-semibold" style={{ color: corTextoSobre(corPrimaria) }}>
            Voltar ao Início
          </Text>
        </Pressable>
      </Link>
    </TelaProvisoria>
  )
}
