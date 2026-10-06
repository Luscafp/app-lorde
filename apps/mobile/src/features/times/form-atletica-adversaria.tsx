import { zodResolver } from '@hookform/resolvers/zod'
import {
  atleticaAdversariaSchema,
  type AtleticaAdversaria,
  type AtleticaAdversariaCriacao,
  type AtleticaAdversariaForm,
} from '@atletica/shared'
import { useForm } from 'react-hook-form'
import { Modal, ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import { Botao, Campo, Texto, toast } from '@/components/ui'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useAtualizarAtleticaAdversaria, useCriarAtleticaAdversaria } from './hooks'

type Props = {
  /** Sem ela, cadastra uma nova. */
  atletica?: AtleticaAdversaria
  aoSalvar: (atletica: AtleticaAdversaria) => void
  aoCancelar: () => void
}

export function FormAtleticaAdversaria({ atletica, aoSalvar, aoCancelar }: Props) {
  const criar = useCriarAtleticaAdversaria()
  const atualizar = useAtualizarAtleticaAdversaria()
  const salvar = atletica ? atualizar : criar
  const form = useForm<AtleticaAdversariaForm, unknown, AtleticaAdversariaCriacao>({
    resolver: zodResolver(atleticaAdversariaSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: atletica?.nome ?? '',
      sigla: atletica?.sigla ?? '',
      curso: atletica?.curso ?? '',
    },
  })

  const retorno = {
    onSuccess: (salva: AtleticaAdversaria) => {
      toast.sucesso('Atlética salva')
      aoSalvar(salva)
    },
    onError: (erro: ApiErro) => {
      if (!aplicarErrosDaApi(form, erro)) mostrarErroDaMutacao(erro)
    },
  }

  const enviar = (dados: AtleticaAdversariaCriacao) =>
    atletica ? atualizar.mutate({ id: atletica.id, dados }, retorno) : criar.mutate(dados, retorno)

  return (
    <View className="gap-4">
      {!salvar.online && <FaixaOffline />}
      <Campo controle={form.control} nome="nome" rotulo="Nome" autoCapitalize="words" />
      <Campo
        controle={form.control}
        nome="sigla"
        rotulo="Sigla (opcional)"
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Campo controle={form.control} nome="curso" rotulo="Curso (opcional)" />
      <View className="flex-row gap-3">
        <Botao titulo="Cancelar" variante="secundaria" className="flex-1" onPress={aoCancelar} />
        <Botao
          titulo="Salvar atlética"
          className="flex-1"
          carregando={salvar.isPending}
          disabled={!salvar.online}
          onPress={() => void form.handleSubmit(enviar)()}
        />
      </View>
    </View>
  )
}

export function SheetAtleticaAdversaria({
  atletica,
  aoSalvar,
  aoFechar,
}: {
  atletica?: AtleticaAdversaria
  aoSalvar: (atletica: AtleticaAdversaria) => void
  aoFechar: () => void
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 justify-end bg-black/60">
        <ScrollView
          className="max-h-[90%] grow-0 rounded-t-3xl bg-superficie"
          contentContainerClassName="gap-4 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Texto variante="subtitulo">
            {atletica ? 'Editar atlética adversária' : 'Nova atlética adversária'}
          </Texto>
          <FormAtleticaAdversaria atletica={atletica} aoSalvar={aoSalvar} aoCancelar={aoFechar} />
        </ScrollView>
      </View>
    </Modal>
  )
}
