import { useState } from 'react'
import { TelaDados } from '@/components/estado'
import { TelaRolavel } from '@/components/tela-rolavel'
import { AvisoOffline, Botao, CampoCodigo, DIGITOS_CODIGO, Texto, toast } from '@/components/ui'
import { useMe } from '@/features/perfil/consultas'
import { formatarMinutosSegundos, useSegundosAte } from '@/features/recuperacao-senha'
import { CodigoApi } from '@/infra/api/api-erro'
import { useReenviarCodigo, useVerificarEmail } from './api'
import { useVerificacaoEmailStore } from './store'

export const MENSAGEM_EMAIL_VERIFICADO = 'E-mail verificado'

const MENSAGENS_ERRO: Record<string, string> = {
  [CodigoApi.CODIGO_INVALIDO]: 'Código inválido.',
  [CodigoApi.CODIGO_EXPIRADO]: 'Código expirado. Reenvie um novo código.',
}

function rotuloReenvio(segundos: number): string {
  if (segundos === 0) return 'Reenviar código'
  return segundos <= 60
    ? `Reenviar código em ${segundos} s`
    : `Reenviar código em ${formatarMinutosSegundos(segundos)}`
}

function Formulario({ email, aoConcluir }: { email: string; aoConcluir: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const verificar = useVerificarEmail()
  const reenviar = useReenviarCodigo()
  const proximoEnvioEm = useVerificacaoEmailStore((estado) => estado.proximoEnvioEm)
  const espera = useSegundosAte(proximoEnvioEm)

  function aoMudar(novo: string) {
    setErro(null)
    setCodigo(novo)
  }

  function aoVerificar() {
    verificar.mutate(
      { codigo },
      {
        onSuccess: () => {
          toast.sucesso(MENSAGEM_EMAIL_VERIFICADO)
          aoConcluir()
        },
        onError: ({ code }) => setErro(MENSAGENS_ERRO[code] ?? null),
      },
    )
  }

  function aoReenviar() {
    reenviar.mutate(undefined, {
      onSuccess: () => {
        setCodigo('')
        setErro(null)
        toast.sucesso('Enviamos um novo código.')
      },
      onError: ({ code, message }) => {
        if (code === CodigoApi.RATE_LIMITED) setErro(message)
      },
    })
  }

  return (
    <>
      <Texto>{`Digite o código de ${DIGITOS_CODIGO} dígitos enviado para ${email}.`}</Texto>
      <CampoCodigo valor={codigo} aoMudar={aoMudar} erro={erro !== null} autoFocus />
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
      <AvisoOffline online={verificar.online} />
      <Botao
        titulo="Verificar"
        carregando={verificar.isPending}
        disabled={!verificar.online || codigo.length !== DIGITOS_CODIGO}
        onPress={aoVerificar}
      />
      <Texto variante="legenda">Não recebeu? Confira o spam ou peça um novo código.</Texto>
      <Botao
        titulo={rotuloReenvio(espera)}
        variante="secundaria"
        carregando={reenviar.isPending}
        disabled={!reenviar.online || espera > 0}
        onPress={aoReenviar}
      />
    </>
  )
}

export function TelaVerificarEmail({ aoConcluir }: { aoConcluir: () => void }) {
  const consulta = useMe()

  return (
    <TelaRolavel>
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(perfil) =>
          perfil.emailVerificado ? (
            <Texto>Seu e-mail já está verificado.</Texto>
          ) : (
            <Formulario email={perfil.email} aoConcluir={aoConcluir} />
          )
        }
      </TelaDados>
    </TelaRolavel>
  )
}
