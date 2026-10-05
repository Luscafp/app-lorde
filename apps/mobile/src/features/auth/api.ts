import {
  respostaSessaoSchema,
  type CadastroEntrada,
  type LoginEntrada,
  type RespostaSessao,
} from '@atletica/shared'
import { api } from '@/infra/api/cliente'

export async function entrar(dados: LoginEntrada): Promise<RespostaSessao> {
  return respostaSessaoSchema.parse(await api.post('/auth/login', dados))
}

export async function cadastrar(dados: CadastroEntrada): Promise<RespostaSessao> {
  return respostaSessaoSchema.parse(await api.post('/auth/cadastro', dados))
}
