import type { Papel, RespostaSessao } from '@atletica/shared'
import type { SessaoCriada } from './sessao.service'
import type { TokenAcessoEmitido } from './token-acesso.service'

export interface UsuarioDaSessao {
  id: string
  nome: string
  email: string
  fotoKey: string | null
  papel: Papel
  atleticaId: string
}

/** Contrato único de cadastro, login e refresh (convenções §11.2), também usado pela #58. */
export function montarRespostaSessao(
  usuario: UsuarioDaSessao,
  { refreshToken }: SessaoCriada,
  { accessToken, accessTokenExpiraEm }: TokenAcessoEmitido,
): RespostaSessao {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiraEm,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      // `fotoKey` → URL pública depende de `urlPublica` (#54); até lá não há foto de perfil.
      fotoUrl: null,
      papel: usuario.papel,
      atleticaId: usuario.atleticaId,
    },
  }
}
