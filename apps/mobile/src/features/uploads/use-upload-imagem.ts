import type { FinalidadeUpload } from '@atletica/shared'
import { createUploadTask, FileSystemUploadType, type UploadTask } from 'expo-file-system/legacy'
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  type ImagePickerOptions,
} from 'expo-image-picker'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { toast } from '@/components/ui/toast'
import { ApiErro } from '@/infra/api/api-erro'
import { pedirPresign } from './api'
import { comprimir, ErroImagem, type ImagemComprimida } from './comprimir'

export type EstadoUpload =
  'ocioso' | 'selecionando' | 'comprimindo' | 'enviando' | 'concluido' | 'erro'

export type OrigemImagem = 'galeria' | 'camera'

export const MENSAGEM_PERMISSAO_NEGADA = 'Permita o acesso às fotos nas configurações do Android.'
export const ACAO_ABRIR_CONFIGURACOES = 'Abrir configurações'
export const MENSAGEM_FALHA_ENVIO = 'Não foi possível enviar a imagem. Tente novamente.'
export const MENSAGEM_FALHA_SELECAO = 'Não foi possível abrir a imagem. Tente novamente.'

/** Convenções §11.5. */
export const PROPORCAO_RECORTE: Record<FinalidadeUpload, [number, number]> = {
  PERFIL: [1, 1],
  NOTICIA: [16, 9],
  BANNER: [16, 9],
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

async function temPermissao(origem: OrigemImagem): Promise<boolean> {
  const resposta =
    origem === 'camera'
      ? await requestCameraPermissionsAsync()
      : await requestMediaLibraryPermissionsAsync()
  return resposta.granted
}

async function escolherImagem(origem: OrigemImagem, finalidade: FinalidadeUpload) {
  const opcoes: ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: PROPORCAO_RECORTE[finalidade],
    quality: 1,
  }
  const resultado =
    origem === 'camera' ? await launchCameraAsync(opcoes) : await launchImageLibraryAsync(opcoes)
  return resultado.canceled ? null : (resultado.assets[0] ?? null)
}

function avisarPermissaoNegada() {
  toast.erro(MENSAGEM_PERMISSAO_NEGADA, {
    acao: ACAO_ABRIR_CONFIGURACOES,
    aoTocar: () => void Linking.openSettings(),
  })
}

function mensagemDoErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroImagem || erro instanceof ApiErro ? erro.message : padrao
}

/** Escolhe, recorta, comprime e envia a imagem direto ao R2 (épico #9, itens 8–9). */
export function useUploadImagem(finalidade: FinalidadeUpload) {
  const [situacao, setSituacao] = useState<Situacao>(INICIAL)
  const atual = useRef(situacao)
  const comprimida = useRef<ImagemComprimida | null>(null)
  const tarefa = useRef<UploadTask | null>(null)
  const geracao = useRef(0)

  useEffect(() => {
    atual.current = situacao
  })

  const atualizar = useCallback((id: number, parcial: Partial<Situacao>) => {
    if (id === geracao.current) setSituacao((anterior) => ({ ...anterior, ...parcial }))
  }, [])

  const descartarEnvio = useCallback(() => {
    geracao.current += 1
    void tarefa.current?.cancelAsync()
    tarefa.current = null
    return geracao.current
  }, [])

  useEffect(() => () => void descartarEnvio(), [descartarEnvio])

  const enviar = useCallback(
    async (id: number, imagem: ImagemComprimida) => {
      atualizar(id, { estado: 'enviando', progresso: 0, erro: null, podeTentarNovamente: false })
      try {
        const { uploadUrl, key } = await pedirPresign({
          finalidade,
          contentType: TIPO_ENVIADO,
          tamanhoBytes: imagem.tamanhoBytes,
        })
        if (id !== geracao.current) return
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
              atualizar(id, { progresso: Math.min(totalBytesSent / totalBytesExpectedToSend, 1) })
            }
          },
        )
        tarefa.current = envio
        const resposta = await envio.uploadAsync()
        if (id !== geracao.current) return
        tarefa.current = null
        if (!resposta || resposta.status < 200 || resposta.status >= 300) {
          throw new Error(`PUT respondeu ${resposta?.status ?? 'sem resposta'}`)
        }
        atualizar(id, { estado: 'concluido', progresso: 1, key })
      } catch (erro) {
        atualizar(id, {
          estado: 'erro',
          erro: mensagemDoErro(erro, MENSAGEM_FALHA_ENVIO),
          podeTentarNovamente: true,
        })
      }
    },
    [atualizar, finalidade],
  )

  const selecionar = useCallback(
    async (origem: OrigemImagem) => {
      const anterior = atual.current
      let id = geracao.current
      atualizar(id, { estado: 'selecionando' })
      try {
        if (!(await temPermissao(origem))) {
          atualizar(id, anterior)
          avisarPermissaoNegada()
          return
        }
        const escolhida = await escolherImagem(origem, finalidade)
        if (!escolhida) return atualizar(id, anterior)
        if (id !== geracao.current) return

        id = descartarEnvio()
        comprimida.current = null
        setSituacao({ ...INICIAL, estado: 'comprimindo', uriLocal: escolhida.uri })
        const imagem = await comprimir(escolhida.uri)
        if (id !== geracao.current) return
        comprimida.current = imagem
        await enviar(id, imagem)
      } catch (erro) {
        atualizar(id, { estado: 'erro', erro: mensagemDoErro(erro, MENSAGEM_FALHA_SELECAO) })
      }
    },
    [atualizar, descartarEnvio, enviar, finalidade],
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

export type UploadImagem = ReturnType<typeof useUploadImagem>
