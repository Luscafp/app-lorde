import type { FinalidadeUpload } from '@atletica/shared'
import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { Botao, MenuInferior, Texto, type OpcaoMenu } from '@/components/ui'
import { useUploadImagem, type OrigemImagem } from '@/features/uploads'
import { useOnline } from '@/infra/rede/online'
import { Imagem } from './imagem'

export const MENSAGEM_PREPARANDO = 'Preparando imagem…'
export const MENSAGEM_APENAS_ONLINE = 'Disponível apenas online'
export const ROTULO_ALTERAR_IMAGEM = 'Alterar imagem'
export const OPCAO_GALERIA = 'Escolher da galeria'
export const OPCAO_CAMERA = 'Tirar foto'
export const OPCAO_REMOVER = 'Remover foto'

type Props = {
  finalidade: FinalidadeUpload
  valorAtualUrl?: string | null
  /** Recebe a `key` do upload concluído, ou `null` ao remover. */
  onChange: (key: string | null) => void
  formato: 'circulo' | 'retangulo'
  desabilitado?: boolean
  podeRemover?: boolean
  rotulo?: string
  /** Fallback de iniciais quando não há imagem (perfil). */
  nome?: string
  /** O formulário mantém o salvar desabilitado enquanto for `true`. */
  onMudarEnviando?: (enviando: boolean) => void
}

const ESTILO_MOLDURA = {
  circulo: 'h-28 w-28 rounded-full',
  retangulo: 'aspect-video w-full rounded-xl',
} as const

export function SeletorImagem({
  finalidade,
  valorAtualUrl,
  onChange,
  formato,
  desabilitado = false,
  podeRemover = true,
  rotulo,
  nome,
  onMudarEnviando,
}: Props) {
  const upload = useUploadImagem(finalidade)
  const online = useOnline()
  const [urlRemovida, setUrlRemovida] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const aoMudar = useRef({ onChange, onMudarEnviando })
  aoMudar.current = { onChange, onMudarEnviando }

  const enviando = upload.estado === 'comprimindo' || upload.estado === 'enviando'
  const ocupado = enviando || upload.estado === 'selecionando'
  const bloqueado = desabilitado || !online || ocupado
  const urlAtual = valorAtualUrl && valorAtualUrl !== urlRemovida ? valorAtualUrl : null
  const uriExibida = upload.uriLocal ?? urlAtual
  const percentual = Math.round(upload.progresso * 100)

  useEffect(() => {
    if (upload.key) aoMudar.current.onChange(upload.key)
  }, [upload.key])

  useEffect(() => {
    aoMudar.current.onMudarEnviando?.(enviando)
  }, [enviando])

  const escolher = (origem: OrigemImagem) => void upload.selecionar(origem)

  const remover = () => {
    upload.limpar()
    setUrlRemovida(valorAtualUrl ?? null)
    onChange(null)
  }

  const confirmarRemocao = () =>
    Alert.alert(OPCAO_REMOVER, 'A imagem atual será removida ao salvar.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: remover },
    ])

  const opcoes: OpcaoMenu[] = [
    { titulo: OPCAO_GALERIA, aoTocar: () => escolher('galeria') },
    { titulo: OPCAO_CAMERA, aoTocar: () => escolher('camera') },
    ...(podeRemover && uriExibida
      ? [{ titulo: OPCAO_REMOVER, aoTocar: confirmarRemocao, perigo: true }]
      : []),
  ]

  return (
    <View className="gap-2">
      {rotulo && <Texto variante="rotulo">{rotulo}</Texto>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ROTULO_ALTERAR_IMAGEM}
        accessibilityState={{ disabled: bloqueado }}
        disabled={bloqueado}
        onPress={() => setMenuAberto(true)}
        className={`overflow-hidden bg-cartao ${ESTILO_MOLDURA[formato]}`}
      >
        <Imagem uri={uriExibida} nome={nome} rotulo={rotulo} className="h-full w-full" />
        {upload.estado === 'comprimindo' && (
          <View className="absolute inset-0 items-center justify-center bg-fundo/60">
            <Texto variante="legenda" accessibilityLiveRegion="polite">
              {MENSAGEM_PREPARANDO}
            </Texto>
          </View>
        )}
        {upload.estado === 'enviando' && (
          <View
            testID="seletor-imagem-progresso"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Enviando imagem"
            accessibilityValue={{ min: 0, max: 100, now: percentual }}
            className="absolute bottom-0 left-0 right-0 h-2 bg-fundo/60"
          >
            <View className="h-full bg-primaria" style={{ width: `${percentual}%` }} />
          </View>
        )}
      </Pressable>

      {upload.estado === 'erro' && upload.erro && (
        <View className="gap-2">
          <Texto variante="erro" accessibilityLiveRegion="polite">
            {upload.erro}
          </Texto>
          {upload.podeTentarNovamente && (
            <Botao
              titulo="Tentar novamente"
              variante="secundaria"
              disabled={desabilitado || !online}
              onPress={() => void upload.tentarNovamente()}
            />
          )}
        </View>
      )}

      {!online && <Texto variante="legenda">{MENSAGEM_APENAS_ONLINE}</Texto>}

      <MenuInferior visivel={menuAberto} opcoes={opcoes} aoFechar={() => setMenuAberto(false)} />
    </View>
  )
}
