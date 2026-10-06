import { zodResolver } from '@hookform/resolvers/zod'
import {
  CONTEUDO_NOTICIA_MAX,
  FinalidadeUpload,
  noticiaPublicacaoSchema,
  noticiaRascunhoSchema,
  Papel,
  StatusNoticia,
  TITULO_NOTICIA_MAX,
  type NoticiaAtualizacao,
  type NoticiaCriacao,
  type NoticiaForm,
  type NoticiaPainelDetalheDto,
} from '@atletica/shared'
import { useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Alert, ScrollView, View } from 'react-native'
import type { z } from 'zod'
import { FaixaOffline } from '@/components/estado'
import { SeletorImagem } from '@/components/imagem'
import { Botao, Campo, Texto, toast } from '@/components/ui'
import { ApiErro } from '@/infra/api/api-erro'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useOnline } from '@/infra/rede/online'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'
import { BarraMarkdown } from './barra-markdown'
import {
  ERROS_DE_UPLOAD,
  ERROS_DO_FORMULARIO,
  useAtualizarNoticia,
  useCriarNoticia,
  useDespublicarNoticia,
  useExcluirNoticia,
  usePublicarNoticia,
} from './hooks'
import { aplicarMarcacao, type Marcacao, type Selecao } from './marcacao'
import { useAvisoAlteracoes } from './use-aviso-alteracoes'

type DadosNoticia = z.output<typeof noticiaRascunhoSchema>
type NomeCampo = keyof DadosNoticia
type Acao = 'rascunho' | 'salvar' | 'publicar' | 'despublicar' | 'excluir'

const SUCESSO: Record<Acao, string> = {
  rascunho: 'Rascunho salvo',
  salvar: 'Notícia salva',
  publicar: 'Notícia publicada',
  despublicar: 'Notícia despublicada',
  excluir: 'Notícia excluída',
}

/** A API não expõe a chave da capa atual; para validar a publicação basta saber que ela existe. */
const CAPA_ATUAL = 'capa-atual'

const formatarTotal = (total: number) => String(total).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function Contador({ atual, maximo }: { atual: number; maximo: number }) {
  return (
    <Texto variante="legenda" className="text-right">
      {`${formatarTotal(atual)}/${formatarTotal(maximo)}`}
    </Texto>
  )
}

type Props = {
  /** Sem ela, cadastra uma nova. */
  noticia?: NoticiaPainelDetalheDto
  aoConcluir: () => void
  aoAbrirPrevia?: () => void
}

export function FormNoticia({ noticia, aoConcluir, aoAbrirPrevia }: Props) {
  const online = useOnline()
  const podeExcluir = useTemNivelMinimo(Papel.PRESIDENTE)
  const criar = useCriarNoticia()
  const atualizar = useAtualizarNoticia()
  const publicar = usePublicarNoticia()
  const despublicar = useDespublicarNoticia()
  const excluir = useExcluirNoticia()
  const [emCurso, setEmCurso] = useState<Acao>()
  const [enviandoCapa, setEnviandoCapa] = useState(false)
  const selecao = useRef<Selecao>({ start: 0, end: 0 })
  const form = useForm<NoticiaForm, unknown, DadosNoticia>({
    resolver: zodResolver(noticiaRascunhoSchema),
    defaultValues: {
      titulo: noticia?.titulo ?? '',
      conteudo: noticia?.conteudo ?? '',
      imagemCapaKey: undefined,
    },
  })
  const [titulo = '', conteudo = ''] = useWatch({
    control: form.control,
    name: ['titulo', 'conteudo'],
  })
  const { isDirty } = form.formState
  const liberarSaida = useAvisoAlteracoes(isDirty)

  const publicada = noticia?.status === StatusNoticia.PUBLICADA
  const bloqueado = !online || !!emCurso || enviandoCapa
  const semAlteracoes = !!noticia && !isDirty

  function tratarErro(erro: unknown) {
    if (!(erro instanceof ApiErro)) return
    if (ERROS_DE_UPLOAD.includes(erro.code)) {
      form.setError('imagemCapaKey', { type: 'api', message: erro.message })
    } else if (!aplicarErrosDaApi(form, erro) && ERROS_DO_FORMULARIO.includes(erro.code)) {
      toast.erro(erro.message)
    }
  }

  async function executar(acao: Acao, enviar: () => Promise<unknown>) {
    setEmCurso(acao)
    try {
      await enviar()
      toast.sucesso(SUCESSO[acao])
      liberarSaida()
      aoConcluir()
    } catch (erro) {
      tratarErro(erro)
    } finally {
      setEmCurso(undefined)
    }
  }

  const alterado = (campo: NomeCampo) => form.getFieldState(campo).isDirty

  function alteracoes({ titulo, conteudo = '', imagemCapaKey }: DadosNoticia): NoticiaAtualizacao {
    return {
      ...(alterado('titulo') ? { titulo } : {}),
      ...(alterado('conteudo') ? { conteudo } : {}),
      ...(alterado('imagemCapaKey') ? { imagemCapaKey: imagemCapaKey ?? null } : {}),
    }
  }

  function paraCriacao(dados: DadosNoticia, publicarAgora: boolean): NoticiaCriacao {
    const { titulo, conteudo = '', imagemCapaKey } = dados
    return {
      titulo,
      conteudo,
      ...(imagemCapaKey ? { imagemCapaKey } : {}),
      publicar: publicarAgora,
    }
  }

  function atendePublicacao({ titulo, conteudo = '', imagemCapaKey }: DadosNoticia): boolean {
    const capa = imagemCapaKey === undefined && noticia?.imagemCapaUrl ? CAPA_ATUAL : imagemCapaKey
    const resultado = noticiaPublicacaoSchema.safeParse({ titulo, conteudo, imagemCapaKey: capa })
    resultado.error?.issues.forEach(({ path: [campo], message }) =>
      form.setError(campo as NomeCampo, { type: 'publicacao', message }),
    )
    return resultado.success
  }

  async function enviarPublicacao(dados: DadosNoticia) {
    if (!noticia) return criar.mutateAsync(paraCriacao(dados, true))
    const mudancas = alteracoes(dados)
    if (Object.keys(mudancas).length > 0) {
      await atualizar.mutateAsync({ id: noticia.id, dados: mudancas })
    }
    return publicar.mutateAsync(noticia.id)
  }

  const salvarRascunho = form.handleSubmit((dados) =>
    executar('rascunho', () =>
      noticia
        ? atualizar.mutateAsync({ id: noticia.id, dados: alteracoes(dados) })
        : criar.mutateAsync(paraCriacao(dados, false)),
    ),
  )

  const salvarPublicada = form.handleSubmit(async (dados) => {
    if (!noticia || !atendePublicacao(dados)) return
    await executar('salvar', () =>
      atualizar.mutateAsync({ id: noticia.id, dados: alteracoes(dados) }),
    )
  })

  const pedirPublicacao = form.handleSubmit((dados) => {
    if (!atendePublicacao(dados)) return
    Alert.alert('Publicar agora?', 'A notícia aparecerá na Home para todos os usuários.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Publicar', onPress: () => void executar('publicar', () => enviarPublicacao(dados)) },
    ])
  })

  function pedirDespublicacao(id: string) {
    Alert.alert('Despublicar notícia?', 'A notícia deixará de ser exibida.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Despublicar',
        style: 'destructive',
        onPress: () => void executar('despublicar', () => despublicar.mutateAsync(id)),
      },
    ])
  }

  function pedirExclusao({ id, titulo: tituloSalvo }: NoticiaPainelDetalheDto) {
    Alert.alert(`Excluir ${tituloSalvo}?`, 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => void executar('excluir', () => excluir.mutateAsync(id)),
      },
    ])
  }

  function marcar(marcacao: Marcacao) {
    const resultado = aplicarMarcacao(form.getValues('conteudo') ?? '', selecao.current, marcacao)
    form.setValue('conteudo', resultado.texto, { shouldDirty: true })
    selecao.current = { start: resultado.cursor, end: resultado.cursor }
  }

  return (
    <View className="flex-1">
      {/* Na edição, a faixa vem do `TelaDados` da rota. */}
      {!noticia && !online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        {aoAbrirPrevia && (
          <View className="gap-1">
            <Botao
              titulo="Prévia"
              variante="secundaria"
              disabled={isDirty}
              onPress={aoAbrirPrevia}
            />
            {isDirty && (
              <Texto variante="legenda">Salve as alterações para vê-las na prévia.</Texto>
            )}
          </View>
        )}
        <Controller
          control={form.control}
          name="imagemCapaKey"
          render={({ field, fieldState }) => (
            <View className="gap-1">
              <SeletorImagem
                finalidade={FinalidadeUpload.NOTICIA}
                formato="retangulo"
                rotulo="Imagem de capa"
                valorAtualUrl={noticia?.imagemCapaUrl}
                desabilitado={!!emCurso}
                onChange={field.onChange}
                onMudarEnviando={setEnviandoCapa}
              />
              {fieldState.error?.message && (
                <Texto variante="erro" accessibilityLiveRegion="polite">
                  {fieldState.error.message}
                </Texto>
              )}
            </View>
          )}
        />
        <View className="gap-1">
          <Campo controle={form.control} nome="titulo" rotulo="Título" />
          <Contador atual={titulo.length} maximo={TITULO_NOTICIA_MAX} />
        </View>
        <View className="gap-2">
          <BarraMarkdown aoAplicar={marcar} />
          <Campo
            controle={form.control}
            nome="conteudo"
            rotulo="Conteúdo"
            multiline
            textAlignVertical="top"
            style={{ minHeight: 160 }}
            onSelectionChange={({ nativeEvent }) => {
              selecao.current = nativeEvent.selection
            }}
          />
          <Contador atual={conteudo.length} maximo={CONTEUDO_NOTICIA_MAX} />
        </View>
        {publicada ? (
          <>
            <Botao
              titulo="Salvar"
              carregando={emCurso === 'salvar'}
              disabled={bloqueado || semAlteracoes}
              onPress={() => void salvarPublicada()}
            />
            <Botao
              titulo="Despublicar"
              variante="secundaria"
              carregando={emCurso === 'despublicar'}
              disabled={bloqueado}
              onPress={() => pedirDespublicacao(noticia.id)}
            />
          </>
        ) : (
          <>
            <Botao
              titulo="Publicar"
              carregando={emCurso === 'publicar'}
              disabled={bloqueado}
              onPress={() => void pedirPublicacao()}
            />
            <Botao
              titulo="Salvar rascunho"
              variante="secundaria"
              carregando={emCurso === 'rascunho'}
              disabled={bloqueado || semAlteracoes}
              onPress={() => void salvarRascunho()}
            />
          </>
        )}
        {noticia && podeExcluir && (
          <Botao
            titulo="Excluir"
            variante="perigo"
            carregando={emCurso === 'excluir'}
            disabled={bloqueado}
            onPress={() => pedirExclusao(noticia)}
          />
        )}
      </ScrollView>
    </View>
  )
}
