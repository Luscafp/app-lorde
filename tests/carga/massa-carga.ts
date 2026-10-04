export type EnvCarga = Record<string, string | undefined>

export const MENSAGEM_AMBIENTE_RECUSADO = 'Massa de carga só pode ser criada em homologação.'

/** Falha dos scripts de carga com mensagem para quem os executa; nunca inclui valores das variáveis. */
export class ErroCarga extends Error {
  override readonly name = 'ErroCarga'
}

export const MASSA = { usuarios: 200, times: 10, eventosPorTime: 30, noticias: 100 } as const

/** Prefixo dos nomes de times, títulos de notícias e local dos eventos da massa. */
export const PREFIXO_CARGA = '[Carga]'
export const SLUG_ADVERSARIA_CARGA = 'carga-adversaria'
export const FILTRO_EMAIL_CARGA = { startsWith: 'carga+', endsWith: '@teste.local' }

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const tresDigitos = (n: number) => String(n).padStart(3, '0')

export const emailCarga = (n: number) => `carga+${tresDigitos(n)}@teste.local`
export const nomeUsuarioCarga = (n: number) => `Atleta Carga ${tresDigitos(n)}`
export const nomeTimeCarga = (n: number) => `${PREFIXO_CARGA} Time ${doisDigitos(n)}`
export const tituloNoticiaCarga = (n: number) => `${PREFIXO_CARGA} Notícia ${tresDigitos(n)}`

function nomeDoBanco(url: string): string | undefined {
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1))
  } catch {
    return undefined
  }
}

/** Mesmo servidor e banco, ignorando usuário, senha e parâmetros da URL. */
export function mesmoBanco(a: string, b: string): boolean {
  try {
    const [ua, ub] = [new URL(a), new URL(b)]
    return (
      ua.hostname.toLowerCase() === ub.hostname.toLowerCase() &&
      (ua.port || '5432') === (ub.port || '5432') &&
      nomeDoBanco(a) === nomeDoBanco(b)
    )
  } catch {
    return a.trim() === b.trim()
  }
}

/**
 * Trava de ambiente (#83): só `AMBIENTE=homologacao`, ou `AMBIENTE=teste` em banco `*_test`;
 * recusa `APP_ENV=producao` e a URL de `DATABASE_URL_PRODUCAO`. Roda antes de abrir conexão.
 */
export function validarAmbienteDeCarga(env: EnvCarga): string {
  const url = env.DATABASE_URL?.trim()
  const ambientePermitido =
    env.AMBIENTE === 'homologacao' ||
    (env.AMBIENTE === 'teste' && url !== undefined && !!nomeDoBanco(url)?.endsWith('_test'))
  const producao = env.DATABASE_URL_PRODUCAO?.trim()
  if (
    !ambientePermitido ||
    env.APP_ENV === 'producao' ||
    (url && producao && mesmoBanco(url, producao))
  ) {
    throw new ErroCarga(MENSAGEM_AMBIENTE_RECUSADO)
  }
  if (!url) throw new ErroCarga('DATABASE_URL obrigatória, no formato postgresql://')
  return url
}

/** Execução pela linha de comando: resumo no stdout; falha com código 1 e só a mensagem. */
export function executarComoScript<T>(tarefa: () => Promise<T>, resumir: (r: T) => string): void {
  tarefa()
    .then((resultado) => process.stdout.write(`${resumir(resultado)}\n`))
    .catch((erro: unknown) => {
      process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`)
      process.exitCode = 1
    })
}
