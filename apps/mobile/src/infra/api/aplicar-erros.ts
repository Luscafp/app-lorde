import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiErro } from './api-erro'

/**
 * Leva `details[].field` (notação de ponto, ex.: `tags.0`) para os campos do formulário.
 * Devolve `true` se algum erro foi aplicado.
 */
export function aplicarErrosDaApi<T extends FieldValues>(
  form: { setError: UseFormSetError<T> },
  erro: unknown,
): boolean {
  if (!(erro instanceof ApiErro) || erro.details.length === 0) return false
  erro.details.forEach(({ field, message }, indice) => {
    form.setError(field as Path<T>, { type: 'api', message }, { shouldFocus: indice === 0 })
  })
  return true
}
