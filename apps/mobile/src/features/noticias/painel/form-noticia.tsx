import { zodResolver } from '@hookform/resolvers/zod'
import {
  CONTEUDO_NOTICIA_MAX,
  FinalidadeUpload,
  noticiaRascunhoSchema,
  Papel,
  StatusNoticia,
  TITULO_NOTICIA_MAX,
  type NoticiaForm,
  type NoticiaPainelDetalheDto,
} from '@atletica/shared'
import { useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { SeletorImagem } from '@/components/imagem'
import { Botao, Campo, confirmar, Texto, toast } from '@/components/ui'
import { ApiErro } from '@/infra/api/api-erro'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useAvisoAlteracoes } from '@/infra/navegacao/use-aviso-alteracoes'
import { useOnline } from '@/infra/rede/online'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'
import { BarraMarkdown } from './barra-markdown'
import {
  alteracoes,
  paraCriacao,
  problemasDePublicacao,
  type DadosNoticia,
  type NomeCampo,
} from './dados-noticia'
import { CampoTags } from '../tags'
import { CAMPO_DO_ERRO, CAMPOS_DA_API, MENSAGEM_CAPA_INVALIDA } from './erros'
import {
  useAtualizarNoticia,
  useCriarNoticia,
  useDespublicarNoticia,
  useExcluirNoticia,
  usePublicarNoticia,
} from './hooks'
import { aplicarMarcacao, type Marcacao, type Selecao } from './marcacao'
import { PreviaNoticia } from './previa-noticia'

type Acao = 'rascunho' | 'salvar' | 'publicar' | 'despublicar' | 'excluir'

const SUCESSO: Record<Acao, string> = {
  rascunho: 'Rascunho salvo',
  salvar: 'Notícia salva',
  publicar: 'Notícia publicada',
  despublicar: 'Notícia despublicada',
  excluir: 'Notícia excluída',
}

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
}

export function FormNoticia({ noticia, aoConcluir }: Props) {
  const online = useOnline()
  const podeExcluir = useTemNivelMinimo(Papel.PRESIDENTE)
  const criar = useCriarNoticia()
  const atualizar = useAtualizarNoticia()
  const publicar = usePublicarNoticia()
  const despublicar = useDespublicarNoticia()
  const excluir = useExcluirNoticia()
  const [emCurso, setEmCurso] = useState<Acao>()
  const [enviandoCapa, setEnviandoCapa] = useState(false)
  const [capaExibida, setCapaExibida] = useState(noticia?.imagemCapaUrl ?? null)
  const [vendoPrevia, setVendoPrevia] = useState(false)
  const selecao = useRef<Selecao>({ start: 0, end: 0 })
  const form = useForm<NoticiaForm, unknown, DadosNoticia>({
    resolver: zodResolver(noticiaRascunhoSchema),
    defaultValues: {
      titulo: noticia?.titulo ?? '',
      conteudo: noticia?.conteudo ?? '',
      imagemCapaKey: undefined,
      tags: noticia?.tags.map(({ nome }) => nome) ?? [],
    },
  })
  const [titulo = '', conteudo = '', tags = []] = useWatch({
    control: form.control,
    name: ['titulo', 'conteudo', 'tags'],
  })
  const { isDirty } = form.formState
  const liberarSaida = useAvisoAlteracoes(isDirty)

  const publicada = noticia?.status === StatusNoticia.PUBLICADA
  const bloqueado = !online || !!emCurso || enviandoCapa
  const semAlteracoes = !!noticia && !isDirty

  function tratarErro(erro: unknown) {
    if (!(erro instanceof ApiErro) || aplicarErrosDaApi(form, erro, CAMPOS_DA_API)) return
    const campo = CAMPO_DO_ERRO[erro.code]
    if (campo) form.setError(campo, { type: 'api', message: erro.message })
    else if (erro.code === 'VALIDATION_ERROR') toast.erro(erro.message)
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

  function atendePublicacao(dados: DadosNoticia): boolean {
    const problemas = problemasDePublicacao(dados, !!noticia?.imagemCapaUrl)
    problemas.forEach(({ campo, mensagem }) =>
      form.setError(campo, { type: 'publicacao', message: mensagem }),
    )
    return problemas.length === 0
  }

  /** Se a publicação falhar, as alterações já salvas não ficam pendentes no formulário. */
  async function enviarPublicacao(dados: DadosNoticia) {
    if (!noticia) return criar.mutateAsync(paraCriacao(dados, true))
    const mudancas = alteracoes(dados, alterado)
    if (Object.keys(mudancas).length > 0) {
      await atualizar.mutateAsync({ id: noticia.id, dados: mudancas })
      form.reset(form.getValues())
    }
    return publicar.mutateAsync(noticia.id)
  }

  const salvarRascunho = form.handleSubmit((dados) =>
    executar('rascunho', () =>
      noticia
        ? atualizar.mutateAsync({ id: noticia.id, dados: alteracoes(dados, alterado) })
        : criar.mutateAsync(paraCriacao(dados, false)),
    ),
  )

  const salvarPublicada = form.handleSubmit(async (dados) => {
    if (!noticia || !atendePublicacao(dados)) return
    await executar('salvar', () =>
      atualizar.mutateAsync({ id: noticia.id, dados: alteracoes(dados, alterado) }),
    )
  })

  const pedirPublicacao = form.handleSubmit((dados) => {
    if (!atendePublicacao(dados)) return
    confirmar({
      titulo: 'Publicar agora?',
      mensagem: 'A notícia aparecerá na Home para todos os usuários.',
      acao: 'Publicar',
      destrutiva: false,
      aoConfirmar: () => void executar('publicar', () => enviarPublicacao(dados)),
    })
  })

  const pedirDespublicacao = (id: string) =>
    confirmar({
      titulo: 'Despublicar notícia?',
      mensagem: 'A notícia deixará de ser exibida.',
      acao: 'Despublicar',
      aoConfirmar: () => void executar('despublicar', () => despublicar.mutateAsync(id)),
    })

  const pedirExclusao = ({ id, titulo: tituloSalvo }: NoticiaPainelDetalheDto) =>
    confirmar({
      titulo: `Excluir ${tituloSalvo}?`,
      mensagem: 'Esta ação não pode ser desfeita.',
      acao: 'Excluir',
      aoConfirmar: () => void executar('excluir', () => excluir.mutateAsync(id)),
    })

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
        <Botao titulo="Prévia" variante="secundaria" onPress={() => setVendoPrevia(true)} />
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
                mensagemImagemInvalida={MENSAGEM_CAPA_INVALIDA}
                onChange={field.onChange}
                onMudarEnviando={setEnviandoCapa}
                onMudarImagem={setCapaExibida}
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
        <Controller
          control={form.control}
          name="tags"
          render={({ field, fieldState }) => (
            <CampoTags
              valor={field.value ?? []}
              aoMudar={field.onChange}
              erro={fieldState.error?.message}
              desabilitado={!!emCurso}
            />
          )}
        />
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
      {vendoPrevia && (
        <PreviaNoticia
          noticia={{
            titulo,
            conteudo,
            imagemCapaUrl: capaExibida,
            tags: tags.map((nome) => ({ id: nome, nome })),
            publicadaEm: noticia?.publicadaEm ?? null,
          }}
          aoFechar={() => setVendoPrevia(false)}
        />
      )}
    </View>
  )
}
