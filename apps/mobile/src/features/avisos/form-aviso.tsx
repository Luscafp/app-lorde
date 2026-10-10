import { zodResolver } from '@hookform/resolvers/zod'
import {
  avisoDoFormulario,
  avisoFormSchema,
  DestinoAviso,
  MENSAGEM_AVISO_MAX,
  TITULO_AVISO_MAX,
  type AlcanceAvisoQuery,
  type AvisoForm,
  type DadosAvisoForm,
} from '@atletica/shared'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ScrollView, View } from 'react-native'
import { FaixaOffline } from '@/components/estado'
import {
  Botao,
  Campo,
  Cartao,
  confirmar,
  Contador,
  ErroCampo,
  Segmentos,
  Texto,
  toast,
  type Segmento,
} from '@/components/ui'
import { OpcaoRadio, useTimesProprios } from '@/features/times'
import { ApiErro } from '@/infra/api/api-erro'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useOnline } from '@/infra/rede/online'
import { useAlcanceAviso, useEnviarAviso } from './hooks'

export const MENSAGEM_SEM_DESTINATARIOS =
  'Nenhum usuário receberá este aviso (preferências ou dispositivos).'

const DESTINOS: readonly Segmento<DestinoAviso>[] = [
  { valor: DestinoAviso.TODOS, rotulo: 'Todos' },
  { valor: DestinoAviso.TIME, rotulo: 'Time' },
]

const VAZIO: AvisoForm = { destino: DestinoAviso.TODOS, timeId: '', titulo: '', mensagem: '' }

const pessoas = (total: number) => `${total} ${total === 1 ? 'pessoa' : 'pessoas'}`

function consultaDeAlcance(destino: DestinoAviso, timeId: string): AlcanceAvisoQuery | null {
  if (destino === DestinoAviso.TODOS) return { destino }
  return timeId ? { destino, timeId } : null
}

function Alcance({ consulta }: { consulta: AlcanceAvisoQuery | null }) {
  const { data, isError } = useAlcanceAviso(consulta)
  if (!consulta) return null
  const texto = isError
    ? 'Não foi possível calcular o alcance.'
    : data === undefined
      ? 'Calculando alcance…'
      : `Será enviado para ${pessoas(data)}`
  return (
    <Texto variante="legenda" accessibilityLiveRegion="polite">
      {texto}
    </Texto>
  )
}

function SeletorTime({
  valor,
  aoMudar,
  erro,
  desabilitado,
}: {
  valor: string
  aoMudar: (timeId: string) => void
  erro?: string
  desabilitado: boolean
}) {
  const { data: times, isError } = useTimesProprios()
  return (
    <View className="gap-2">
      <Texto variante="rotulo">Time</Texto>
      {!times && !isError && <Texto variante="legenda">Carregando times…</Texto>}
      {isError && <Texto variante="erro">Não foi possível carregar os times.</Texto>}
      {times?.length === 0 && <Texto variante="legenda">A atlética não tem times ativos.</Texto>}
      <View accessibilityRole="radiogroup" className="gap-2">
        {times?.map((time) => (
          <OpcaoRadio
            key={time.id}
            rotulo={`${time.nome} · ${time.modalidade.nome}`}
            marcada={time.id === valor}
            desabilitada={desabilitado}
            aoEscolher={() => aoMudar(time.id)}
          />
        ))}
      </View>
      <ErroCampo mensagem={erro} />
    </View>
  )
}

function PreviaNotificacao({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  if (!titulo.trim() && !mensagem.trim()) return null
  return (
    <View className="gap-1">
      <Texto variante="rotulo">Prévia da notificação</Texto>
      <Cartao>
        <Texto className="font-semibold" numberOfLines={1}>
          {titulo.trim()}
        </Texto>
        <Texto variante="legenda" numberOfLines={2}>
          {mensagem.trim()}
        </Texto>
      </Cartao>
    </View>
  )
}

/** Aviso manual da diretoria por push (RF39, UC25). */
export function FormAviso() {
  const online = useOnline()
  const enviar = useEnviarAviso()
  const { data: times } = useTimesProprios()
  const form = useForm<AvisoForm, unknown, DadosAvisoForm>({
    resolver: zodResolver(avisoFormSchema),
    mode: 'onBlur',
    defaultValues: VAZIO,
  })
  const [destino, timeId, titulo, mensagem] = useWatch({
    control: form.control,
    name: ['destino', 'timeId', 'titulo', 'mensagem'],
  })

  function tratarErro(erro: unknown) {
    if (!(erro instanceof ApiErro) || aplicarErrosDaApi(form, erro)) return
    if (erro.code === 'NOT_FOUND') form.setError('timeId', { type: 'api', message: erro.message })
    else if (erro.code === 'VALIDATION_ERROR') toast.erro(erro.message)
  }

  async function enviarAviso(dados: DadosAvisoForm) {
    try {
      const { destinatarios } = await enviar.mutateAsync(avisoDoFormulario(dados))
      if (destinatarios > 0) toast.sucesso(`Aviso enviado para ${pessoas(destinatarios)}.`)
      else toast.info(MENSAGEM_SEM_DESTINATARIOS)
      form.reset(VAZIO)
    } catch (erro) {
      tratarErro(erro)
    }
  }

  const confirmarEnvio = form.handleSubmit((dados) => {
    const nomeTime = times?.find(({ id }) => id === dados.timeId)?.nome
    const membros = nomeTime ? `membros de ${nomeTime}` : 'membros do time'
    const alvo = dados.destino === DestinoAviso.TIME ? membros : 'todos os usuários'
    confirmar({
      titulo: 'Enviar aviso',
      mensagem: `Enviar aviso para ${alvo}? Esta ação não pode ser desfeita.`,
      acao: 'Enviar',
      destrutiva: false,
      aoConfirmar: () => void enviarAviso(dados),
    })
  })

  return (
    <View className="flex-1">
      {!online && <FaixaOffline />}
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Campo controle={form.control} nome="titulo" rotulo="Título" />
          <Contador atual={titulo.length} maximo={TITULO_AVISO_MAX} />
        </View>
        <View className="gap-1">
          <Campo
            controle={form.control}
            nome="mensagem"
            rotulo="Mensagem"
            multiline
            textAlignVertical="top"
            style={{ minHeight: 120 }}
          />
          <Contador atual={mensagem.length} maximo={MENSAGEM_AVISO_MAX} />
        </View>
        <View className="gap-2">
          <Texto variante="rotulo">Destinatários</Texto>
          <Controller
            control={form.control}
            name="destino"
            render={({ field }) => (
              <Segmentos
                opcoes={DESTINOS}
                valor={field.value}
                aoMudar={field.onChange}
                desabilitado={enviar.isPending}
              />
            )}
          />
        </View>
        {destino === DestinoAviso.TIME && (
          <Controller
            control={form.control}
            name="timeId"
            render={({ field, fieldState }) => (
              <SeletorTime
                valor={field.value}
                aoMudar={field.onChange}
                erro={fieldState.error?.message}
                desabilitado={enviar.isPending}
              />
            )}
          />
        )}
        <Alcance consulta={consultaDeAlcance(destino, timeId)} />
        <PreviaNotificacao titulo={titulo} mensagem={mensagem} />
        <Botao
          titulo="Enviar aviso"
          carregando={enviar.isPending}
          disabled={!online || enviar.isPending}
          onPress={() => void confirmarEnvio()}
        />
      </ScrollView>
    </View>
  )
}
