import { ROTULO_PAPEL, SituacaoUsuario, type UsuarioResumo } from '@atletica/shared'
import { Image, Pressable, Text, View } from 'react-native'
import { Selo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return (
    (partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')
  ).toUpperCase()
}

export function Avatar({
  nome,
  fotoUrl,
  tamanho = 48,
}: {
  nome: string
  fotoUrl: string | null
  tamanho?: number
}) {
  const dimensoes = { width: tamanho, height: tamanho, borderRadius: tamanho / 2 }
  if (fotoUrl) {
    return <Image source={{ uri: fotoUrl }} style={dimensoes} accessibilityIgnoresInvertColors />
  }
  return (
    <View
      className="items-center justify-center border border-borda bg-cartao"
      style={dimensoes}
      importantForAccessibility="no-hide-descendants"
    >
      <Text className="font-semibold text-texto" style={{ fontSize: tamanho / 2.6 }}>
        {iniciais(nome)}
      </Text>
    </View>
  )
}

export function ItemUsuario({
  usuario,
  aoAbrir,
}: {
  usuario: UsuarioResumo
  aoAbrir: (id: string) => void
}) {
  const desativado = usuario.situacao === SituacaoUsuario.DESATIVADO
  const cargo = ROTULO_PAPEL[usuario.papel]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${usuario.nome}, ${cargo}${desativado ? ', desativado' : ''}`}
      onPress={() => aoAbrir(usuario.id)}
      className="min-h-[44px] flex-row items-center gap-3 border-b border-borda px-4 py-3"
    >
      <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} />
      <View className="flex-1 gap-1">
        <Texto className="font-semibold" numberOfLines={1}>
          {usuario.nome}
        </Texto>
        <Texto variante="legenda" numberOfLines={1}>
          {usuario.email}
        </Texto>
        <View className="flex-row flex-wrap gap-2">
          <Selo texto={cargo} />
          {desativado && <Selo texto="Desativado" cor={paleta.erro} />}
        </View>
      </View>
    </Pressable>
  )
}
