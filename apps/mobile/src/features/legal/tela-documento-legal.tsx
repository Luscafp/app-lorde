import Ionicons from '@expo/vector-icons/Ionicons'
import type { DocumentoLegal } from '@atletica/shared'
import { useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { TelaRolavel } from '@/components/tela-rolavel'
import { Alerta, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { useOnline } from '@/infra/rede/online'
import { BlocoVersaoAceita } from './bloco-versao-aceita'

export function TelaDocumentoLegal({ documento }: { documento: DocumentoLegal }) {
  const router = useRouter()
  const online = useOnline()

  return (
    <TelaRolavel>
      {!online && <FaixaOffline />}
      {router.canGoBack() && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] justify-center"
        >
          <Ionicons name="arrow-back" size={24} color={paleta.texto} />
        </Pressable>
      )}
      <Texto variante="titulo">{documento.titulo}</Texto>
      <BlocoVersaoAceita />
      {documento.provisorio && (
        <Alerta variante="alerta" titulo="Texto provisório">
          Este texto ainda não é a versão definitiva e pode mudar antes do lançamento.
        </Alerta>
      )}
      {documento.secoes.map((secao) => (
        <View key={secao.titulo} className="gap-2">
          <Texto variante="subtitulo">{secao.titulo}</Texto>
          {secao.paragrafos.map((paragrafo) => (
            <Texto key={paragrafo}>{paragrafo}</Texto>
          ))}
        </View>
      ))}
    </TelaRolavel>
  )
}
