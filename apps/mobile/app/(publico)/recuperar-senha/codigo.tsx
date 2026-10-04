import { MENSAGEM_RECUPERACAO_ENVIADA, VALIDADE_CODIGO_MS } from '@atletica/shared'
import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { Botao, CampoCodigo, DIGITOS_CODIGO, Texto, toast } from '@/components/ui'
import {
  ESPERA_REENVIO_MS,
  formatarMinutosSegundos,
  TelaRecuperacao,
  useEnviarCodigo,
  useRecuperacaoStore,
  useSegundosAte,
  useVerificarCodigo,
} from '@/features/recuperacao-senha'
import { CodigoApi } from '@/infra/api/api-erro'

const depoisDe = (inicio: number | null, ms: number) => (inicio === null ? null : inicio + ms)

export default function InformarCodigo() {
  const router = useRouter()
  const email = useRecuperacaoStore((estado) => estado.email)
  const codigo = useRecuperacaoStore((estado) => estado.codigo)
  const enviadoEm = useRecuperacaoStore((estado) => estado.enviadoEm)
  const definirCodigo = useRecuperacaoStore((estado) => estado.definirCodigo)
  const codigoEnviado = useRecuperacaoStore((estado) => estado.codigoEnviado)
  const [invalido, setInvalido] = useState(false)
  const verificar = useVerificarCodigo()
  const reenviar = useEnviarCodigo()
  const expiraEm = useSegundosAte(depoisDe(enviadoEm, VALIDADE_CODIGO_MS))
  const esperaReenvio = useSegundosAte(depoisDe(enviadoEm, ESPERA_REENVIO_MS))

  if (!email) return <Redirect href="/recuperar-senha" />

  function aoMudar(novo: string) {
    setInvalido(false)
    definirCodigo(novo)
  }

  function aoVerificar() {
    verificar.mutate(
      { email, codigo },
      {
        onSuccess: () => router.push('/recuperar-senha/nova-senha'),
        onError: (erro) => {
          if (erro.code !== CodigoApi.CODIGO_INVALIDO) return
          definirCodigo('')
          setInvalido(true)
        },
      },
    )
  }

  function aoReenviar() {
    reenviar.mutate(
      { email },
      {
        onSuccess: () => {
          codigoEnviado(email)
          setInvalido(false)
          toast.sucesso('Enviamos um novo código.')
        },
      },
    )
  }

  return (
    <TelaRecuperacao titulo="Digite o código">
      <Texto variante="legenda">{MENSAGEM_RECUPERACAO_ENVIADA}</Texto>
      <CampoCodigo valor={codigo} aoMudar={aoMudar} erro={invalido} autoFocus />
      {invalido && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          Código inválido ou expirado.
        </Texto>
      )}
      <Texto variante="legenda" accessibilityLiveRegion="polite">
        {expiraEm > 0
          ? `O código expira em ${formatarMinutosSegundos(expiraEm)}`
          : 'O código expirou. Peça um novo código.'}
      </Texto>
      <Botao
        titulo="Verificar"
        carregando={verificar.isPending}
        disabled={!verificar.online || codigo.length !== DIGITOS_CODIGO}
        onPress={aoVerificar}
      />
      <Botao
        titulo={esperaReenvio > 0 ? `Reenviar código em ${esperaReenvio} s` : 'Reenviar código'}
        variante="secundaria"
        carregando={reenviar.isPending}
        disabled={!reenviar.online || esperaReenvio > 0}
        onPress={aoReenviar}
      />
    </TelaRecuperacao>
  )
}
