import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import { ErroConfiguracao } from '../../config/env.schema'

/** Zero ou mais de uma atlética com `usaAplicativo = true`: a API não sobe (convenções §6). */
export class ErroAtleticaPadrao extends ErroConfiguracao {
  override readonly name = 'ErroAtleticaPadrao'

  constructor(readonly nomes: string[]) {
    super(
      nomes.length === 0
        ? 'Nenhuma atlética com usaAplicativo = true. Rode o seed (pnpm prisma:seed) ou ajuste o banco.'
        : `Esperada uma única atlética com usaAplicativo = true; encontradas ${nomes.length}: ` +
            `${nomes.join(', ')}. Deixe só uma com usaAplicativo = true.`,
    )
  }
}

const ATLETICA_DUPLICADA = 'Já existe uma atlética adversária com este nome.'

export function erroAdversariaDuplicada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'ATLETICA_DUPLICADA', ATLETICA_DUPLICADA, [
    { field: 'nome', message: ATLETICA_DUPLICADA },
  ])
}

export function erroAdversariaNaoEncontrada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Atlética adversária não encontrada.')
}
