/** A sigla é opcional na `Atletica`; sem ela, o nome ocupa o lugar. */
export function siglaOuNome({ sigla, nome }: { sigla: string | null; nome: string }): string {
  return sigla ?? nome
}
