import { zodResolver } from '@hookform/resolvers/zod'
import {
  ehIconeModalidade,
  modalidadeCreateSchema,
  type Modalidade,
  type ModalidadeCriacao,
  type ModalidadeForm,
} from '@atletica/shared'
import { Controller, useForm } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { Botao, Campo, toast } from '@/components/ui'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useAtualizarModalidade, useCriarModalidade } from './hooks'
import { SeletorIcone } from './seletor-icone'

type Props = {
  /** Sem ela, cadastra uma nova. */
  modalidade?: Modalidade
  aoSalvar: () => void
}

export function FormModalidade({ modalidade, aoSalvar }: Props) {
  const criar = useCriarModalidade()
  const atualizar = useAtualizarModalidade()
  const salvar = modalidade ? atualizar : criar
  const form = useForm<ModalidadeForm, unknown, ModalidadeCriacao>({
    resolver: zodResolver(modalidadeCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: modalidade?.nome ?? '',
      icone: modalidade && ehIconeModalidade(modalidade.icone) ? modalidade.icone : undefined,
    },
  })

  const retorno = {
    onSuccess: () => {
      toast.sucesso('Modalidade salva')
      aoSalvar()
    },
    onError: (erro: ApiErro) => {
      if (!aplicarErrosDaApi(form, erro)) mostrarErroDaMutacao(erro)
    },
  }

  const enviar = (dados: ModalidadeCriacao) =>
    modalidade
      ? atualizar.mutate({ id: modalidade.id, dados }, retorno)
      : criar.mutate(dados, retorno)

  return (
    <View className="flex-1">
      {/* Na edição, a faixa vem do `TelaDados` da rota. */}
      {!modalidade && !salvar.online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Campo controle={form.control} nome="nome" rotulo="Nome" autoCapitalize="words" />
        <Controller
          control={form.control}
          name="icone"
          render={({ field, fieldState }) => (
            <SeletorIcone
              valor={field.value}
              aoMudar={field.onChange}
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
