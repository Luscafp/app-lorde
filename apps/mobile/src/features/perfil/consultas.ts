import type {
  AlterarSenha,
  AtualizarPerfil,
  ExcluirConta,
  FotoAtualizada,
  Perfil,
} from '@atletica/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { CodigoApi, type ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useAcaoOnline } from '@/infra/query/use-acao-online'
import { useSessao } from '@/infra/sessao/store'
import {
  alterarSenha,
  atualizarPerfil,
  buscarPerfil,
  definirFoto,
  excluirConta,
  removerFoto,
} from './api'

const MINUTO = 60_000

export const CodigoPerfil = {
  SENHA_INCORRETA: 'SENHA_INCORRETA',
  SENHA_IGUAL_ATUAL: 'SENHA_IGUAL_ATUAL',
} as const

/** `['me']` é a fonte do papel (convenções §10.1): a sessão segue o perfil, sem novo login. */
async function sincronizarSessao({ nome, email, fotoUrl, papel }: Perfil): Promise<void> {
  const { usuario, atualizarUsuario } = useSessao.getState()
  if (!usuario) return
  const igual =
    usuario.nome === nome &&
    usuario.email === email &&
    usuario.fotoUrl === fotoUrl &&
    usuario.papel === papel
  if (!igual) await atualizarUsuario({ nome, email, fotoUrl, papel })
}

export function useMe() {
  const consulta = useQuery({
    queryKey: chaves.me(),
    queryFn: ({ signal }) => buscarPerfil(signal),
    staleTime: MINUTO,
    refetchOnWindowFocus: true,
  })
  const { data } = consulta
  useEffect(() => {
    if (data) void sincronizarSessao(data)
  }, [data])
  return consulta
}

export function useAtualizarPerfil() {
  const cliente = useQueryClient()
  return useAcaoOnline<Perfil, ApiErro, AtualizarPerfil>({
    mutationFn: (dados) => atualizarPerfil(dados),
    onSuccess: async (perfil) => {
      cliente.setQueryData(chaves.me(), perfil)
      await sincronizarSessao(perfil)
    },
  })
}

export function useAtualizarFoto() {
  const cliente = useQueryClient()
  return useAcaoOnline<FotoAtualizada, ApiErro, string>({
    mutationFn: (fotoKey) => definirFoto(fotoKey),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.me(), exact: true }),
  })
}

export function useRemoverFoto() {
  const cliente = useQueryClient()
  return useAcaoOnline<void, ApiErro, void>({
    mutationFn: () => removerFoto(),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.me(), exact: true }),
  })
}

export function useAlterarSenha() {
  return useAcaoOnline<void, ApiErro, AlterarSenha>({
    mutationFn: (dados) => alterarSenha(dados),
    meta: { errosNaTela: [CodigoPerfil.SENHA_INCORRETA, CodigoPerfil.SENHA_IGUAL_ATUAL] },
  })
}

/** O servidor já revogou as sessões: encerra só a local, sem `logoutPendente`. */
export function useExcluirConta() {
  return useAcaoOnline<void, ApiErro, ExcluirConta>({
    mutationFn: (dados) => excluirConta(dados),
    onSuccess: () => useSessao.getState().encerrarSessao({ motivo: 'CONTA_EXCLUIDA' }),
    meta: {
      errosNaTela: [
        CodigoPerfil.SENHA_INCORRETA,
        CodigoApi.ULTIMO_ADMINISTRADOR,
        CodigoApi.RATE_LIMITED,
      ],
    },
  })
}
