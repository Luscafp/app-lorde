import { zodResolver } from '@hookform/resolvers/zod'
import {
  atleticaAdversariaSchema,
  nomeTimeSchema,
  type EventoDto,
  type TimeDto,
} from '@atletica/shared'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Modal, ScrollView, View } from 'react-native'
import { z } from 'zod'
import { FaixaOffline } from '@/components/estado'
import { Botao, Campo, ErroCampo, Texto } from '@/components/ui'
import {
  BuscaAdversaria,
  useCriarAtleticaAdversaria,
  useCriarTime,
  type AtleticaEscolhida,
} from '@/features/times'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'

const CAMPOS_DA_ATLETICA = { nome: 'atletica.nome', sigla: 'atletica.sigla' }

const adversarioRapidoSchema = z
  .object({
    novaAtletica: z.boolean(),
    atleticaAdversariaId: z.string(),
    atletica: z.object({ nome: z.string(), sigla: z.string() }),
    nome: nomeTimeSchema,
  })
  .transform((form, ctx) => {
    const falhar = (path: PropertyKey[], message: string) =>
      ctx.issues.push({ code: 'custom', path, message, input: form })

    if (!form.novaAtletica) {
      if (!z.uuid().safeParse(form.atleticaAdversariaId).success) {
        falhar(['atleticaAdversariaId'], 'Escolha a atlética adversária.')
      }
      return { nome: form.nome, atleticaAdversariaId: form.atleticaAdversariaId, nova: null }
    }
    const nova = atleticaAdversariaSchema.safeParse(form.atletica)
    for (const { path, message } of nova.error?.issues ?? []) falhar(['atletica', ...path], message)
    return nova.success ? { nome: form.nome, atleticaAdversariaId: '', nova: nova.data } : z.NEVER
  })

type Entrada = z.input<typeof adversarioRapidoSchema>
type Saida = z.output<typeof adversarioRapidoSchema>

type Props = {
  /** Fixa: a do time da atlética (RN11). */
  modalidade: EventoDto['modalidade']
  aoCriar: (time: TimeDto) => void
  aoFechar: () => void
}

/** UC16 A4: grava a atlética nova (se houver) e depois o time. */
export function AdversarioRapidoSheet({ modalidade, aoCriar, aoFechar }: Props) {
  const criarAtletica = useCriarAtleticaAdversaria()
  const criarTime = useCriarTime()
  const [atletica, setAtletica] = useState<AtleticaEscolhida | null>(null)
  const form = useForm<Entrada, unknown, Saida>({
    resolver: zodResolver(adversarioRapidoSchema),
    mode: 'onBlur',
    defaultValues: {
      novaAtletica: false,
      atleticaAdversariaId: '',
      atletica: { nome: '', sigla: '' },
      nome: '',
    },
  })
  const novaAtletica = useWatch({ control: form.control, name: 'novaAtletica' })
  const online = criarAtletica.online && criarTime.online

  function tratarErro(erro: ApiErro, campos?: Record<string, string>) {
    if (!aplicarErrosDaApi(form, erro, campos)) mostrarErroDaMutacao(erro)
  }

  function escolherAtletica(escolhida: AtleticaEscolhida) {
    setAtletica(escolhida)
    form.setValue('atleticaAdversariaId', escolhida.id)
    form.setValue('novaAtletica', false)
  }

  function gravarTime(nome: string, atleticaAdversariaId: string) {
    criarTime.mutate(
      { nome, modalidadeId: modalidade.id, atleticaAdversariaId },
      { onSuccess: aoCriar, onError: (erro: ApiErro) => tratarErro(erro) },
    )
  }

  /** Gravada a atlética, ela fica escolhida: repetir após erro do time não a duplica. */
  function gravar({ nome, atleticaAdversariaId, nova }: Saida) {
    if (!nova) return gravarTime(nome, atleticaAdversariaId)
    criarAtletica.mutate(nova, {
      onSuccess: (salva) => {
        escolherAtletica(salva)
        gravarTime(nome, salva.id)
      },
      onError: (erro: ApiErro) => tratarErro(erro, CAMPOS_DA_ATLETICA),
    })
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 justify-end bg-black/60">
        <ScrollView
          className="max-h-[90%] grow-0 rounded-t-3xl bg-superficie"
          contentContainerClassName="gap-4 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Texto variante="subtitulo">Cadastrar adversário</Texto>
          {!online && <FaixaOffline />}
          <Texto variante="legenda">{`Modalidade: ${modalidade.nome}`}</Texto>
          {novaAtletica ? (
            <View className="gap-4">
              <Texto variante="rotulo">Nova atlética adversária</Texto>
              <Campo
                controle={form.control}
                nome="atletica.nome"
                rotulo="Nome da atlética"
                autoCapitalize="words"
              />
              <Campo
                controle={form.control}
                nome="atletica.sigla"
                rotulo="Sigla (opcional)"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Botao
                titulo="Escolher atlética existente"
                variante="secundaria"
                onPress={() => form.setValue('novaAtletica', false)}
              />
            </View>
          ) : (
            <Controller
              control={form.control}
              name="atleticaAdversariaId"
              render={({ fieldState }) => (
                <View className="gap-1">
                  <Texto variante="rotulo">Atlética adversária</Texto>
                  <BuscaAdversaria
                    selecionada={atletica}
                    aoSelecionar={escolherAtletica}
                    aoCadastrarNova={() => form.setValue('novaAtletica', true)}
                  />
                  <ErroCampo mensagem={fieldState.error?.message} />
                </View>
              )}
            />
          )}
          <Campo controle={form.control} nome="nome" rotulo="Nome do time" autoCapitalize="words" />
          <View className="flex-row gap-3">
            <Botao titulo="Cancelar" variante="secundaria" className="flex-1" onPress={aoFechar} />
            <Botao
              titulo="Salvar adversário"
              className="flex-1"
              carregando={criarAtletica.isPending || criarTime.isPending}
              disabled={!online}
              onPress={() => void form.handleSubmit(gravar)()}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
