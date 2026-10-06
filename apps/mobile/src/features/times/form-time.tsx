import { zodResolver } from '@hookform/resolvers/zod'
import { timeCreateSchema, type TimeCriacao, type TimeDto } from '@atletica/shared'
import { Controller, useForm } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { z } from 'zod'
import { FaixaOffline } from '@/components/estado'
import { Botao, Campo, toast } from '@/components/ui'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useAtualizarTime, useCriarTime } from './hooks'
import { SeletorAtletica } from './seletor-atletica'
import { SeletorModalidade } from './seletor-modalidade'

/** `atleticaAdversariaId` vazio: "Adversária" marcada sem atlética escolhida. */
const formTimeSchema = timeCreateSchema.extend({
  atleticaAdversariaId: z.uuid({ error: 'Escolha a atlética adversária.' }).nullable(),
})

type Props = {
  /** Sem ele, cadastra um novo. */
  time?: TimeDto
  aoSalvar: () => void
}

export function FormTime({ time, aoSalvar }: Props) {
  const criar = useCriarTime()
  const atualizar = useAtualizarTime()
  const salvar = time ? atualizar : criar
  const adversariaDoTime = time && !time.atletica.propria ? time.atletica : undefined
  const form = useForm<z.input<typeof formTimeSchema>, unknown, z.output<typeof formTimeSchema>>({
    resolver: zodResolver(formTimeSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: time?.nome ?? '',
      modalidadeId: time?.modalidade.id,
      atleticaAdversariaId: adversariaDoTime?.id ?? null,
    },
  })

  const retorno = {
    onSuccess: () => {
      toast.sucesso('Time salvo')
      aoSalvar()
    },
    onError: (erro: ApiErro) => {
      if (!aplicarErrosDaApi(form, erro)) mostrarErroDaMutacao(erro)
    },
  }

  function enviar(dados: TimeCriacao) {
    if (!time) return criar.mutate(dados, retorno)
    const { nome, modalidadeId } = dados
    atualizar.mutate({ id: time.id, dados: { nome, modalidadeId } }, retorno)
  }

  return (
    <View className="flex-1">
      {/* Na edição, a faixa vem do `TelaDados` da rota. */}
      {!time && !salvar.online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Campo controle={form.control} nome="nome" rotulo="Nome" autoCapitalize="words" />
        <Controller
          control={form.control}
          name="modalidadeId"
          render={({ field, fieldState }) => (
            <SeletorModalidade
              valor={field.value}
              aoMudar={field.onChange}
              atual={time?.modalidade}
              erro={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="atleticaAdversariaId"
          render={({ field, fieldState }) => (
            <SeletorAtletica
              valor={field.value}
              aoMudar={field.onChange}
              inicial={adversariaDoTime}
              desabilitado={!!time}
              erro={fieldState.error?.message}
            />
          )}
        />
        <Botao
          titulo="Salvar"
          carregando={salvar.isPending}
          disabled={!salvar.online}
          onPress={() => void form.handleSubmit(enviar)()}
        />
      </ScrollView>
    </View>
  )
}
