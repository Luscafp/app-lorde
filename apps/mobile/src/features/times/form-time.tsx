import { zodResolver } from '@hookform/resolvers/zod'
import { timeCreateSchema, type TimeCriacao, type TimeDto, type TimeForm } from '@atletica/shared'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { Botao, Campo, toast } from '@/components/ui'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useAtualizarTime, useCriarTime } from './hooks'
import { SeletorAtletica, type AtleticaEscolhida } from './seletor-atletica'
import { SeletorModalidade } from './seletor-modalidade'

type Props = {
  /** Sem ele, cadastra um novo. */
  time?: TimeDto
  aoSalvar: () => void
}

export function FormTime({ time, aoSalvar }: Props) {
  const criar = useCriarTime()
  const atualizar = useAtualizarTime()
  const salvar = time ? atualizar : criar
  const [adversaria, setAdversaria] = useState(time ? !time.atletica.propria : false)
  const [atletica, setAtletica] = useState<AtleticaEscolhida | null>(
    time && !time.atletica.propria ? time.atletica : null,
  )
  const form = useForm<TimeForm, unknown, TimeCriacao>({
    resolver: zodResolver(timeCreateSchema),
    mode: 'onBlur',
    defaultValues: { nome: time?.nome ?? '', modalidadeId: time?.modalidade.id },
  })

  function escolherAtletica(escolhida: AtleticaEscolhida) {
    setAtletica(escolhida)
    form.clearErrors('atleticaAdversariaId')
  }

  const retorno = {
    onSuccess: () => {
      toast.sucesso('Time salvo')
      aoSalvar()
    },
    onError: (erro: ApiErro) => {
      if (!aplicarErrosDaApi(form, erro)) mostrarErroDaMutacao(erro)
    },
  }

  function enviar({ nome, modalidadeId }: TimeCriacao) {
    if (time) return atualizar.mutate({ id: time.id, dados: { nome, modalidadeId } }, retorno)
    if (adversaria && !atletica) {
      form.setError('atleticaAdversariaId', { message: 'Escolha a atlética adversária.' })
      return
    }
    criar.mutate(
      { nome, modalidadeId, atleticaAdversariaId: adversaria ? atletica?.id : null },
      retorno,
    )
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
        <SeletorAtletica
          adversaria={adversaria}
          aoMudarTipo={setAdversaria}
          selecionada={atletica}
          aoSelecionar={escolherAtletica}
          desabilitado={!!time}
          erro={form.formState.errors.atleticaAdversariaId?.message}
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
