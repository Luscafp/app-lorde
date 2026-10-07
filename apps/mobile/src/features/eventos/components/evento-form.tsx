import { zodResolver } from '@hookform/resolvers/zod'
import {
  EscopoOcorrencia,
  gerarDatasSerie,
  OBSERVACOES_EVENTO_MAX,
  recorrenciaSchema,
  StatusEvento,
  TipoEvento,
  type CriarSerie,
  type EventoDto,
} from '@atletica/shared'
import { useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import {
  Alerta,
  Botao,
  Campo,
  confirmar,
  mascararData,
  mascararHora,
  Texto,
  toast,
} from '@/components/ui'
import { OpcaoRadio } from '@/features/times'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useAtualizarEvento, useCriarEvento, useCriarSerie, useEditarSeguintes } from '../hooks'
import {
  CAMPO_DO_FORM,
  eventoFormSchema,
  observacoesFormSchema,
  paraEdicao,
  paraEdicaoSeguintes,
  recorrenciaDoForm,
  valoresIniciais,
  type EventoFormEntrada,
  type EventoFormSaida,
} from '../schemas'
import { RecorrenciaCampos, type PreviaSerie } from './recorrencia-campos'
import { SeletorAdversario } from './seletor-adversario'
import { SeletorTimeEvento, type TimeEscolhido } from './seletor-time-evento'

const TIPOS: Record<TipoEvento, string> = { JOGO: 'Jogo', TREINO: 'Treino' }

const AVISO_SEGUINTES =
  'Treinos deste em diante que você alterou individualmente também receberão estas mudanças.'

type Props = {
  /** Sem ele, cadastra um novo. */
  evento?: EventoDto
  /** Na criação de série, recebe a 1ª ocorrência. */
  aoSalvar: (eventoId: string) => void
  /** `ESTA_E_SEGUINTES` trava data e time (#20 §6). */
  escopo?: EscopoOcorrencia
  /** Abaixo de Data/Horário. */
  aposDataHora?: ReactNode
}

export function EventoForm({ evento, aoSalvar, escopo, aposDataHora }: Props) {
  const criar = useCriarEvento()
  const criarSerie = useCriarSerie()
  const atualizar = useAtualizarEvento()
  const editarSeguintes = useEditarSeguintes()
  const seguintes = !!evento?.serieId && escopo === EscopoOcorrencia.ESTA_E_SEGUINTES
  const salvando = [criar, criarSerie, atualizar, editarSeguintes].some((m) => m.isPending)
  const somenteObservacoes = evento?.status === StatusEvento.FINALIZADO
  const [modalidade, setModalidade] = useState(evento?.modalidade)
  const form = useForm<EventoFormEntrada, unknown, EventoFormSaida>({
    resolver: zodResolver(somenteObservacoes ? observacoesFormSchema : eventoFormSchema),
    mode: 'onBlur',
    defaultValues: valoresIniciais(evento),
  })
  const [tipo, observacoes, recorrente, data, hora, diasSemana, dataFim] = useWatch({
    control: form.control,
    name: ['tipo', 'observacoes', 'recorrente', 'data', 'hora', 'diasSemana', 'dataFim'],
  })
  const serie = !evento && tipo === TipoEvento.TREINO && recorrente
  const recorrencia = serie ? recorrenciaDoForm({ data, hora, diasSemana, dataFim }) : undefined
  /** Só com a recorrência válida: um "Repetir até" em 2099 não trava a tela. */
  const previa = useMemo((): PreviaSerie | undefined => {
    if (!serie) return undefined
    const valida = recorrenciaSchema.safeParse(
      recorrenciaDoForm({ data, hora, diasSemana, dataFim }),
    )
    if (!valida.success) return undefined
    const datas = gerarDatasSerie(valida.data)
    return { total: datas.length, primeira: datas[0], ultima: datas.at(-1) }
  }, [serie, data, hora, diasSemana, dataFim])

  const aoFalhar = (erro: ApiErro) => {
    if (!aplicarErrosDaApi(form, erro, CAMPO_DO_FORM)) mostrarErroDaMutacao(erro)
  }

  const concluir = (mensagem: string, eventoId: string) => {
    toast.sucesso(mensagem)
    aoSalvar(eventoId)
  }

  function gravarSerie(dados: CriarSerie) {
    criarSerie.mutate(dados, {
      onSuccess: ({ totalOcorrencias, primeiraOcorrencia }) =>
        concluir(
          totalOcorrencias === 1 ? '1 treino criado' : `${totalOcorrencias} treinos criados`,
          primeiraOcorrencia.id,
        ),
      onError: aoFalhar,
    })
  }

  function gravarEdicao(dados: EventoFormSaida, atual: EventoDto) {
    if (seguintes) {
      const mudancas = paraEdicaoSeguintes(dados, atual)
      if (!mudancas) return aoSalvar(atual.id)
      return editarSeguintes.mutate(
        { id: atual.id, dados: mudancas },
        { onSuccess: () => concluir('Treinos atualizados', atual.id), onError: aoFalhar },
      )
    }
    const mudancas = paraEdicao(dados, atual)
    if (Object.keys(mudancas).length === 0) return aoSalvar(atual.id)
    atualizar.mutate(
      { id: atual.id, dados: mudancas },
      { onSuccess: ({ id }) => concluir('Evento atualizado', id), onError: aoFalhar },
    )
  }

  function gravar(dados: EventoFormSaida) {
    if (evento) return gravarEdicao(dados, evento)
    if (!('tipo' in dados)) return
    if ('recorrencia' in dados) return gravarSerie(dados)
    criar.mutate(dados, {
      onSuccess: ({ id }) => concluir('Evento cadastrado', id),
      onError: aoFalhar,
    })
  }

  function confirmarSeNoPassado(dados: EventoFormSaida) {
    const inicioMudou =
      'inicio' in dados && (!evento || Date.parse(dados.inicio) !== Date.parse(evento.inicio))
    if (!inicioMudou || Date.parse(dados.inicio) >= Date.now()) return gravar(dados)
    confirmar({
      titulo: 'Evento no passado',
      mensagem: 'Este evento está no passado. Deseja salvar mesmo assim?',
      acao: 'Salvar',
      destrutiva: false,
      aoConfirmar: () => gravar(dados),
    })
  }

  /** Adversário de outra modalidade deixa de valer (RN11). */
  function escolherTime(escolha: TimeEscolhido, aoMudar: (id: string) => void) {
    aoMudar(escolha.time.id)
    if (escolha.modalidade.id !== modalidade?.id) form.setValue('timeAdversarioId', null)
    setModalidade(escolha.modalidade)
  }

  return (
    <View className="flex-1">
      {/* Na edição, a faixa vem do `TelaDados` da rota. */}
      {!evento && !criar.online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        {somenteObservacoes && (
          <Alerta variante="alerta">
            Evento finalizado: só as observações podem ser alteradas.
          </Alerta>
        )}
        {seguintes && <Alerta variante="alerta">{AVISO_SEGUINTES}</Alerta>}
        <Controller
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <View className="gap-2">
              <Texto variante="rotulo">Tipo</Texto>
              <View accessibilityRole="radiogroup" className="flex-row gap-2">
                {Object.values(TipoEvento).map((opcao) => (
                  <View key={opcao} className="flex-1">
                    <OpcaoRadio
                      rotulo={TIPOS[opcao]}
                      marcada={field.value === opcao}
                      desabilitada={!!evento}
                      aoEscolher={() => {
                        field.onChange(opcao)
                        if (opcao === TipoEvento.TREINO) form.setValue('timeAdversarioId', null)
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        />
        <Controller
          control={form.control}
          name="timeId"
          render={({ field, fieldState }) => (
            <SeletorTimeEvento
              valor={field.value}
              aoMudar={(escolha) => escolherTime(escolha, field.onChange)}
              atual={evento}
              desabilitado={somenteObservacoes || seguintes}
              erro={fieldState.error?.message}
            />
          )}
        />
        {tipo === TipoEvento.JOGO && (
          <Controller
            control={form.control}
            name="timeAdversarioId"
            render={({ field, fieldState }) => (
              <SeletorAdversario
                valor={field.value}
                aoMudar={field.onChange}
                modalidade={modalidade}
                inicial={evento?.timeAdversario}
                desabilitado={somenteObservacoes}
                erro={fieldState.error?.message}
              />
            )}
          />
        )}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Campo
              controle={form.control}
              nome="data"
              rotulo={serie ? 'Data de início' : 'Data'}
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              maxLength={10}
              mascara={mascararData}
              editable={!somenteObservacoes && !seguintes}
            />
          </View>
          <View className="flex-1">
            <Campo
              controle={form.control}
              nome="hora"
              rotulo="Horário"
              placeholder="HH:mm"
              keyboardType="number-pad"
              maxLength={5}
              mascara={mascararHora}
              editable={!somenteObservacoes}
            />
          </View>
        </View>
        {!evento && tipo === TipoEvento.TREINO && (
          <RecorrenciaCampos
            controle={form.control}
            recorrente={recorrente}
            recorrencia={recorrencia}
            previa={previa}
          />
        )}
        {aposDataHora}
        <Campo controle={form.control} nome="local" rotulo="Local" editable={!somenteObservacoes} />
        <View className="gap-1">
          <Campo
            controle={form.control}
            nome="observacoes"
            rotulo="Observações"
            multiline
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />
          <Texto variante="legenda" className="text-right">
            {`${observacoes.length}/${OBSERVACOES_EVENTO_MAX}`}
          </Texto>
        </View>
        <Botao
          titulo="Salvar"
          carregando={salvando || form.formState.isSubmitting}
          disabled={!criar.online || (serie && previa?.total === 0)}
          onPress={() => void form.handleSubmit(confirmarSeNoPassado)()}
        />
      </ScrollView>
    </View>
  )
}
