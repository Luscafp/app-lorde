const SEM_IP = 'sem-ip'

export function chaveCadastro(ip: string | undefined): string {
  return ip ?? SEM_IP
}

export function chaveIp(ip: string | undefined): string {
  return `ip:${ip ?? SEM_IP}`
}

/** Todas as chaves de falha de login de um e-mail começam com ele. */
export function prefixoChaveLogin(email: string): string {
  return `${email}|`
}

export function chaveLogin(email: string, ip: string | undefined): string {
  return `${prefixoChaveLogin(email)}${ip ?? SEM_IP}`
}
