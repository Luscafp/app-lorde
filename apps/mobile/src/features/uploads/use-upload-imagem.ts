import type { FinalidadeUpload } from '@atletica/shared'
import { createUploadTask, FileSystemUploadType, type UploadTask } from 'expo-file-system/legacy'
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  type ImagePickerOptions,
  type ImagePickerResult,
  type PermissionResponse,
} from 'expo-image-picker'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { toast } from '@/components/ui/toast'
import { ApiErro } from '@/infra/api/api-erro'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { pedirPresign } from './api'
import { comprimir, ErroImagem, type ImagemComprimida } from './comprimir'

export type EstadoUpload =
  'ocioso' | 'selecionando' | 'comprimindo' | 'enviando' | 'concluido' | 'erro'

export type OrigemImagem = 'galeria' | 'camera'

export const MENSAGEM_PERMISSAO_NEGADA = 'Permita o acesso às fotos nas configurações do Android.'
export const MENSAGEM_PERMISSAO_CAMERA_NEGADA =
  'Permita o acesso à câmera nas configurações do Android.'
export const ACAO_ABRIR_CONFIGURACOES = 'Abrir configurações'
export const MENSAGEM_FALHA_ENVIO = 'Não foi possível enviar a imagem. Tente novamente.'
export const MENSAGEM_FALHA_SELECAO = 'Não foi possível abrir a imagem. Tente novamente.'
/** UC21 A4: a capa de notícia tem mensagem única para formato e tamanho. */
export const MENSAGEM_CAPA_INVALIDA = 'Imagem inválida ou maior que 5 MB'

const MENSAGEM_IMAGEM_INVALIDA: Partial<Record<FinalidadeUpload, string>> = {
  NOTICIA: MENSAGEM_CAPA_INVALIDA,
}

/** Convenções §11.5. */
export const PROPORCAO_RECORTE: Record<FinalidadeUpload, [number, number]> = {
  PERFIL: [1, 1],
  NOTICIA: [16, 9],
  BANNER: [16, 9],
}

const ORIGENS: Record<
  OrigemImagem,
  {
    pedirPermissao: () => Promise<PermissionResponse>
    abrir: (opcoes: ImagePickerOptions) => Promise<ImagePickerResult>
    mensagemPermissaoNegada: string
  }
> = {
  galeria: {
    pedirPermissao: requestMediaLibraryPermissionsAsync,
    abrir: launchImageLibraryAsync,
    mensagemPermissaoNegada: MENSAGEM_PERMISSAO_NEGADA,
  },
  camera: {
    pedirPermissao: requestCameraPermissionsAsync,
    abrir: launchCameraAsync,
    mensagemPermissaoNegada: MENSAGEM_PERMISSAO_CAMERA_NEGADA,
  },
}

const TIPO_ENVIADO = 'image/jpeg'

type Situacao = {
  estado: EstadoUpload
  progresso: number
  key: string | null
  uriLocal: string | null
  erro: string | null
  podeTentarNovamente: boolean
}

const INICIAL: Situacao = {
  estado: 'ocioso',
  progresso: 0,
  key: null,
  uriLocal: null,
  erro: null,
  podeTentarNovamente: false,
}

async function escolherImagem(origem: OrigemImagem, finalidade: FinalidadeUpload) {
  const resultado = await ORIGENS[origem].abrir({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: PROPORCAO_RECORTE[finalidade],
    quality: 1,
  })
  return resultado.canceled ? null : (resultado.assets[0] ?? null)
}

function avisarPermissaoNegada(origem: OrigemImagem) {
  toast.erro(ORIGENS[origem].mensagemPermissaoNegada, {
    rotulo: ACAO_ABRIR_CONFIGURACOES,
    aoTocar: () => void Linking.openSettings(),
  })
}

function mensagemDoErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroImagem || erro instanceof ApiErro ? erro.message : padrao
}

/** Escolhe, recorta, comprime e envia a imagem direto ao R2. */
export function useUploadImagem(finalidade: FinalidadeUpload) {
  const [situacao, setSituacao] = useState<Situacao>(INICIAL)
  const situacaoAtual = useRef(situacao)
  const comprimida = useRef<ImagemComprimida | null>(null)
  const tarefa = useRef<UploadTask | null>(null)
  const geracaoAtual = useRef(0)
  const { mutateAsync: presignar } = useAcaoOnline({ mutationFn: pedirPresign })

  useEffect(() => {
    situacaoAtual.current = situacao
  })

  const obsoleta = useCallback((geracao: number) => geracao !== geracaoAtual.current, [])

  const atualizar = useCallback(
    (geracao: number, parcial: Partial<Situacao>) => {
      if (!obsoleta(geracao)) setSituacao((anterior) => ({ ...anterior, ...parcial }))
    },
    [obsoleta],
  )

  const descartarEnvio = useCallback(() => {
    geracaoAtual.current += 1
    void tarefa.current?.cancelAsync()
    tarefa.current = null
    return geracaoAtual.current
  }, [])

  useEffect(() => () => void descartarEnvio(), [descartarEnvio])

  const enviar = useCallback(
    async (geracao: number, imagem: ImagemComprimida) => {
      atualizar(geracao, {
        estado: 'enviando',
        progresso: 0,
        erro: null,
        podeTentarNovamente: false,
      })
      try {
        const { uploadUrl, key } = await presignar({
          finalidade,
          contentType: TIPO_ENVIADO,
          tamanhoBytes: imagem.tamanhoBytes,
        })
        if (obsoleta(geracao)) return
        const envio = createUploadTask(
          uploadUrl,
          imagem.uri,
          {
            httpMethod: 'PUT',
            uploadType: FileSystemUploadType.BINARY_CONTENT,
            headers: {
              'Content-Type': TIPO_ENVIADO,
              'Content-Length': String(imagem.tamanhoBytes),
            },
          },
          ({ totalBytesSent, totalBytesExpectedToSend }) => {
            if (totalBytesExpectedToSend > 0) {
              atualizar(geracao, {
                progresso: Math.min(totalBytesSent / totalBytesExpectedToSend, 1),
              })
            }
          },
        )
        tarefa.current = envio
        const resposta = await envio.uploadAsync()
        if (obsoleta(geracao)) return
        tarefa.current = null
        if (!resposta || resposta.status < 200 || resposta.status >= 300) {
          throw new Error(`PUT respondeu ${resposta?.status ?? 'sem resposta'}`)
        }
        atualizar(geracao, { estado: 'concluido', progresso: 1, key })
      } catch (erro) {
        atualizar(geracao, {
          estado: 'erro',
          erro: mensagemDoErro(erro, MENSAGEM_FALHA_ENVIO),
          podeTentarNovamente: true,
        })
      }
    },
    [atualizar, finalidade, obsoleta, presignar],
  )

  const selecionar = useCallback(
    async (origem: OrigemImagem) => {
      const anterior = situacaoAtual.current
      let geracao = geracaoAtual.current
      atualizar(geracao, { estado: 'selecionando' })
      try {
        if (!(await ORIGENS[origem].pedirPermissao()).granted) {
          atualizar(geracao, anterior)
          avisarPermissaoNegada(origem)
          return
        }
        const escolhida = await escolherImagem(origem, finalidade)
        if (!escolhida) return atualizar(geracao, anterior)
        if (obsoleta(geracao)) return

        geracao = descartarEnvio()
        comprimida.current = null
        setSituacao({ ...INICIAL, estado: 'comprimindo', uriLocal: escolhida.uri })
        const imagem = await comprimir(escolhida.uri)
        if (obsoleta(geracao)) return
        comprimida.current = imagem
        await enviar(geracao, imagem)
      } catch (erro) {
        const especifica = erro instanceof ErroImagem ? MENSAGEM_IMAGEM_INVALIDA[finalidade] : null
        atualizar(geracao, {
          estado: 'erro',
          erro: especifica ?? mensagemDoErro(erro, MENSAGEM_FALHA_SELECAO),
        })
      }
    },
    [atualizar, descartarEnvio, enviar, finalidade, obsoleta],
  )

  /** Reenvia a mesma imagem comprimida com um presign **novo**. */
  const tentarNovamente = useCallback(async () => {
    const imagem = comprimida.current
    if (!imagem) return
    await enviar(descartarEnvio(), imagem)
  }, [descartarEnvio, enviar])

  const limpar = useCallback(() => {
    descartarEnvio()
    comprimida.current = null
    setSituacao(INICIAL)
  }, [descartarEnvio])

  return { ...situacao, selecionar, tentarNovamente, limpar }
}
