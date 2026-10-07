import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiErro } from './api-erro'

/**
 * Leva `details[].field` (notação de ponto) ao formulário; `true` se aplicou algum.
 * `campos` renomeia os campos da API que têm outro nome na tela.
 */
export function aplicarErrosDaApi<T extends FieldValues>(
  form: { setError: UseFormSetError<T> },
  erro: unknown,
  campos: Record<string, string> = {},
): boolean {
  if (!(erro instanceof ApiErro) || erro.details.length === 0) return false
  erro.details.forEach(({ field, message }, indice) => {
    form.setError(
      (campos[field] ?? field) as Path<T>,
      { type: 'api', message },
      { shouldFocus: indice === 0 },
    )
  })
  return true
}
