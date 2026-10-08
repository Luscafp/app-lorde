import { zodResolver } from '@hookform/resolvers/zod'
import {
  calcularResultado,
  PLACAR_MAX,
  registrarResultadoSchema,
  StatusEvento,
  type EventoDto,
  type RegistrarResultado,
  type RegistrarResultadoForm,
} from '@atletica/shared'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { ScrollView, TextInput, View } from 'react-native'
import {
  Alerta,
  AvisoOffline,
  Botao,
  BotaoIcone,
  Cartao,
  confirmar,
  ErroCampo,
  Texto,
  toast,
} from '@/components/ui'
import { comAlfa, paleta } from '@/features/atletica'
import { useRegistrarResultado } from '../hooks'
import { useResultadoLabel } from './placar/use-resultado-label'

export const MENSAGEM_FINALIZAR_E_REGISTRAR =
  'O jogo ainda não foi finalizado. Finalizar e registrar o placar?'

const AVISO_AUDITORIA = 'A alteração ficará registrada no histórico de auditoria.'

type Placar = 'placarTime' | 'placarAdversario'

type ControleResultado = Control<RegistrarResultadoForm, unknown, RegistrarResultado>

const paraPlacar = (texto: string) => {
  const digitos = texto.replace(/\D/g, '')
  return digitos === '' ? undefined : Number(digitos)
}

function CampoPlacar({
  controle,
  nome,
  rotulo,
}: {
  controle: ControleResultado
  nome: Placar
  rotulo: string
}) {
  return (
    <Controller
      control={controle}
      name={nome}
      render={({ field, fieldState: { error } }) => {
        const valor = field.value as number | undefined
        const base = valor ?? 0
        return (
          <View className="flex-1 items-center gap-2">
            <Texto variante="rotulo" className="text-center" numberOfLines={2}>
              {rotulo}
            </Texto>
            <View className="flex-row items-center">
              <BotaoIcone
                icone="remove"
                rotulo={`Diminuir ${rotulo}`}
                disabled={base <= 0}
                onPress={() => field.onChange(Math.max(0, base - 1))}
              />
              <TextInput
                ref={field.ref}
                value={valor === undefined ? '' : String(valor)}
                onChangeText={(texto) => field.onChange(paraPlacar(texto))}
                onBlur={field.onBlur}
                accessibilityLabel={rotulo}
                accessibilityHint={error?.message}
                keyboardType="number-pad"
                maxLength={4}
                className={`min-h-[44px] w-16 rounded-xl border bg-superficie text-center text-2xl font-semibold text-texto ${
                  error ? 'border-erro' : 'border-borda'
                }`}
              />
              <BotaoIcone
                icone="add"
                rotulo={`Aumentar ${rotulo}`}
                disabled={base >= PLACAR_MAX}
                onPress={() => field.onChange(Math.min(PLACAR_MAX, base + 1))}
              />
            </View>
            <ErroCampo mensagem={error?.message} />
          </View>
        )
      }}
    />
  )
}

function Previa({ controle }: { controle: ControleResultado }) {
  const [placarTime, placarAdversario] = useWatch({
    control: controle,
    name: ['placarTime', 'placarAdversario'],
  })
  const valido = registrarResultadoSchema.safeParse({ placarTime, placarAdversario }).success
  const resultado = valido ? calcularResultado(placarTime, placarAdversario) : null
  const { frase, cor } = useResultadoLabel(resultado)
  if (!resultado) return null
  return (
    <View
      accessibilityLabel={`Prévia: ${frase}`}
      className="items-center rounded-2xl border py-3"
      style={{ borderColor: cor, backgroundColor: comAlfa(cor) }}
    >
      <Texto variante="subtitulo" style={{ color: cor }}>
        {frase}
      </Texto>
    </View>
  )
}

type Props = {
  evento: EventoDto
  aoSalvar: () => void
}

export function ResultadoForm({ evento, aoSalvar }: Props) {
  const registrar = useRegistrarResultado()
  const corrigindo = evento.resultado !== null
  const form = useForm<RegistrarResultadoForm, unknown, RegistrarResultado>({
    resolver: zodResolver(registrarResultadoSchema),
    defaultValues: {
      placarTime: evento.placarTime ?? undefined,
      placarAdversario: evento.placarAdversario ?? undefined,
    },
  })
  const adversario = evento.timeAdversario?.atletica.nome ?? 'Adversário'

  const gravar = (dados: RegistrarResultado) =>
    registrar.mutate(
      { id: evento.id, dados },
      {
        onSuccess: () => {
          toast.sucesso(corrigindo ? 'Resultado corrigido' : 'Resultado registrado')
          aoSalvar()
        },
      },
    )

  const salvar = (dados: RegistrarResultado) => {
    if (evento.status === StatusEvento.FINALIZADO) return gravar(dados)
    confirmar({
      titulo: 'Finalizar jogo?',
      mensagem: MENSAGEM_FINALIZAR_E_REGISTRAR,
      acao: 'Finalizar e registrar',
      cancelar: 'Voltar',
      destrutiva: false,
      aoConfirmar: () => gravar({ ...dados, finalizar: true }),
    })
  }

  return (
    <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
      <Texto variante="titulo">{`${evento.time.nome} × ${adversario}`}</Texto>
      {corrigindo && <Alerta variante="alerta">{AVISO_AUDITORIA}</Alerta>}
      <Cartao className="flex-row items-start gap-2">
        <CampoPlacar controle={form.control} nome="placarTime" rotulo={evento.time.nome} />
        <Texto variante="subtitulo" className="pt-10" style={{ color: paleta['texto-suave'] }}>
          ×
        </Texto>
        <CampoPlacar controle={form.control} nome="placarAdversario" rotulo={adversario} />
      </Cartao>
      <Previa controle={form.control} />
      <AvisoOffline online={registrar.online} />
      <Botao
        titulo="Salvar"
        carregando={registrar.isPending}
        disabled={!registrar.online}
        onPress={() => void form.handleSubmit(salvar)()}
      />
    </ScrollView>
  )
}
