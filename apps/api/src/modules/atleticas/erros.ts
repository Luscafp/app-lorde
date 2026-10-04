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
