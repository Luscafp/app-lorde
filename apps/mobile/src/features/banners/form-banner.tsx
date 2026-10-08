import { zodResolver } from '@hookform/resolvers/zod'
import {
  bannerFormSchema,
  FinalidadeUpload,
  MENSAGEM_IMAGEM_BANNER,
  type BannerAtualizacao,
  type BannerForm,
  type BannerPainelDto,
  type DadosBannerForm,
} from '@atletica/shared'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ScrollView, Switch, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { SeletorImagem } from '@/components/imagem'
import { Botao, Campo, Texto, toast } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ApiErro } from '@/infra/api/api-erro'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useOnline } from '@/infra/rede/online'
import { useAtualizarBanner, useCriarBanner } from './hooks'

const MENSAGEM_IMAGEM_INVALIDA = 'Imagem inválida ou maior que 5 MB'

const CAMPO_DO_ERRO: Record<string, keyof DadosBannerForm> = {
  UPLOAD_INVALIDO: 'imagemKey',
  UPLOAD_NAO_ENCONTRADO: 'imagemKey',
}

type Props = {
  /** Sem ele, cadastra um novo. */
  banner?: BannerPainelDto
  aoConcluir: () => void
}

/** Só os campos alterados; link vazio vira `null` (remove). */
function alteracoes(
  dados: DadosBannerForm,
  alterado: (campo: keyof DadosBannerForm) => boolean,
): BannerAtualizacao {
  return {
    ...(alterado('titulo') ? { titulo: dados.titulo } : {}),
    ...(alterado('link') ? { link: dados.link } : {}),
    ...(alterado('ativo') ? { ativo: dados.ativo } : {}),
    ...(alterado('imagemKey') && dados.imagemKey ? { imagemKey: dados.imagemKey } : {}),
  }
}

export function FormBanner({ banner, aoConcluir }: Props) {
  const online = useOnline()
  const { corPrimaria } = useAtletica()
  const criar = useCriarBanner()
  const atualizar = useAtualizarBanner()
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const form = useForm<BannerForm, unknown, DadosBannerForm>({
    resolver: zodResolver(bannerFormSchema),
    mode: 'onBlur',
    defaultValues: {
      titulo: banner?.titulo ?? '',
      link: banner?.link ?? '',
      ativo: banner?.ativo ?? true,
      imagemKey: undefined,
    },
  })
  const salvando = criar.isPending || atualizar.isPending

  function tratarErro(erro: unknown) {
    if (!(erro instanceof ApiErro) || aplicarErrosDaApi(form, erro)) return
    const campo = CAMPO_DO_ERRO[erro.code]
    if (campo) form.setError(campo, { type: 'api', message: erro.message })
    else if (erro.code === 'VALIDATION_ERROR') toast.erro(erro.message)
  }

  const salvar = form.handleSubmit(async (dados) => {
    try {
      if (banner) {
        const alterado = (campo: keyof DadosBannerForm) => form.getFieldState(campo).isDirty
        const mudancas = alteracoes(dados, alterado)
        if (Object.keys(mudancas).length > 0) {
          await atualizar.mutateAsync({ id: banner.id, dados: mudancas })
        }
      } else {
        if (!dados.imagemKey) {
          form.setError('imagemKey', { type: 'manual', message: MENSAGEM_IMAGEM_BANNER })
          return
        }
        await criar.mutateAsync({ ...dados, imagemKey: dados.imagemKey })
      }
      toast.sucesso('Banner salvo')
      aoConcluir()
    } catch (erro) {
      tratarErro(erro)
    }
  })

  return (
    <View className="flex-1">
      {/* Na edição, a faixa vem do `TelaDados` da rota. */}
      {!banner && !online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Controller
          control={form.control}
          name="imagemKey"
          render={({ field, fieldState }) => (
            <View className="gap-1">
              <SeletorImagem
                finalidade={FinalidadeUpload.BANNER}
                formato="retangulo"
                rotulo="Imagem do banner"
                valorAtualUrl={banner?.imagemUrl}
                podeRemover={false}
                desabilitado={salvando}
                mensagemImagemInvalida={MENSAGEM_IMAGEM_INVALIDA}
                onChange={(key) => field.onChange(key ?? undefined)}
                onMudarEnviando={setEnviandoImagem}
              />
              {fieldState.error?.message && (
                <Texto variante="erro" accessibilityLiveRegion="polite">
                  {fieldState.error.message}
                </Texto>
              )}
            </View>
          )}
        />
        <Campo controle={form.control} nome="titulo" rotulo="Título" />
        <Campo
          controle={form.control}
          nome="link"
          rotulo="Link (opcional)"
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Controller
          control={form.control}
          name="ativo"
          render={({ field, fieldState }) => (
            <View className="gap-1">
              <View className="min-h-[44px] flex-row items-center justify-between">
                <Texto>Exibir na Home</Texto>
                <Switch
                  accessibilityLabel="Exibir na Home"
                  value={field.value}
                  onValueChange={field.onChange}
                  trackColor={{ true: corPrimaria, false: paleta.borda }}
                />
              </View>
              {fieldState.error?.message && (
                <Texto variante="erro" accessibilityLiveRegion="polite">
                  {fieldState.error.message}
                </Texto>
              )}
            </View>
          )}
        />
        <Botao
          titulo="Salvar"
          carregando={salvando}
          disabled={!online || salvando || enviandoImagem}
          onPress={() => void salvar()}
        />
      </ScrollView>
    </View>
  )
}
