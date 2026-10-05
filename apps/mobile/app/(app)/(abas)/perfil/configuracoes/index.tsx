import { router } from 'expo-router'
import { TelaProvisoria } from '@/components/tela-provisoria'
import { Botao } from '@/components/ui'

// Menu completo na #14.
export default function Configuracoes() {
  return (
    <TelaProvisoria titulo="Configurações">
      <Botao
        titulo="Editar perfil"
        variante="secundaria"
        onPress={() => router.push('/perfil/configuracoes/editar-perfil')}
      />
      <Botao
        titulo="Alterar senha"
        variante="secundaria"
        onPress={() => router.push('/perfil/configuracoes/alterar-senha')}
      />
    </TelaProvisoria>
  )
}
