const ROTAS_PUBLICAS = ['/', '/login', '/cadastro', '/termos', '/privacidade']
const PREFIXOS_IGNORADOS = ['/recuperar-senha', '/expo-development-client']

let destinoAposLogin: string | null = null

/** `atletica://eventos/1?x=1` ou `atletica:///eventos/1` → `/eventos/1?x=1`. */
export function caminhoInterno(url: string): string {
  return '/' + url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '')
}

export function exigeSessao(caminho: string): boolean {
  const semConsulta = caminho.split(/[?#]/)[0] ?? caminho
  if (ROTAS_PUBLICAS.includes(semConsulta)) return false
  return !PREFIXOS_IGNORADOS.some((prefixo) => semConsulta.startsWith(prefixo))
}

export function guardarDestinoAposLogin(url: string): void {
  const caminho = caminhoInterno(url)
  if (exigeSessao(caminho)) destinoAposLogin = caminho
}

export function consumirDestinoAposLogin(): string | null {
  const destino = destinoAposLogin
  destinoAposLogin = null
  return destino
}
