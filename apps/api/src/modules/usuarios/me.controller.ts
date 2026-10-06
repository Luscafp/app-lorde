import {
  alterarSenhaSchema,
  atualizarFotoSchema,
  atualizarPerfilSchema,
  excluirContaSchema,
  fotoAtualizadaSchema,
  perfilSchema,
  type FotoAtualizada,
  type Perfil,
} from '@atletica/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { RESPOSTA_LIMITE_EXCEDIDO } from '../../common/swagger/respostas'
import { emMinutos } from '../../common/tempo'
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator'
import type { UsuarioAutenticado } from '../auth/tipos'
import { ContaService } from './conta.service'
import { MENSAGEM_ULTIMO_ADMINISTRADOR_EXCLUSAO } from './erros'
import { LIMITE_SENHA_ATUAL, PerfilService } from './perfil.service'

class AtualizarPerfilDto extends createZodDto(atualizarPerfilSchema) {}
class AtualizarFotoDto extends createZodDto(atualizarFotoSchema) {}
class AlterarSenhaDto extends createZodDto(alterarSenhaSchema) {}
class ExcluirContaDto extends createZodDto(excluirContaSchema) {}
class PerfilDto extends createZodDto(perfilSchema) {}
class FotoAtualizadaDto extends createZodDto(fotoAtualizadaSchema) {}

const ID_EXEMPLO = '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const FOTO_KEY_EXEMPLO = `usuarios/${ID_EXEMPLO}/perfil/2b7f5c1e-0d4a-4f8e-9b3c-7a6d5e4f3a21.jpg`
const FOTO_URL_EXEMPLO = `https://imagens.exemplo/${FOTO_KEY_EXEMPLO}`

const EXEMPLO_PERFIL: Perfil = {
  id: ID_EXEMPLO,
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  fotoUrl: FOTO_URL_EXEMPLO,
  emailVerificado: false,
  papel: 'DIRETOR',
  atletica: { id: '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b', nome: 'Atlética Lorde', sigla: 'LORDE' },
  times: [
    {
      id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f',
      nome: 'Futsal Masculino',
      modalidade: { id: '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11', nome: 'Futsal', icone: 'futsal' },
      capitao: true,
      entradaEm: '2026-08-02T13:00:00.000Z',
    },
  ],
  termosAceitos: { versao: '2026-10-01', aceitoEm: '2026-10-02T12:00:00.000Z' },
  criadoEm: '2026-10-02T12:00:00.000Z',
}

const DESCRICAO_FOTO =
  '| HTTP | code | Quando |\n|---|---|---|\n' +
  '| 400 | `VALIDATION_ERROR` | corpo diferente de `{ fotoKey }` |\n' +
  '| 422 | `UPLOAD_INVALIDO` | chave fora de `usuarios/{usuarioId}/perfil/{uuid}.{ext}` do próprio ' +
  'usuário, tipo não suportado ou objeto > 5 MB |\n' +
  '| 422 | `UPLOAD_NAO_ENCONTRADO` | objeto inexistente no R2 |'

/** Só `@UsuarioAtual()`: não há `:id`, então não existe 403/404 (convenções §9). */
@ApiTags('Perfil')
@Controller('me')
export class MeController {
  constructor(
    private readonly perfil: PerfilService,
    private readonly conta: ContaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Perfil do usuário autenticado (UC10)',
    description:
      '`papel` é o do vínculo com a atlética do token, lido a cada chamada. `times`: vínculos ' +
      'atuais com times ativos, por nome. `termosAceitos`: último aceite.',
  })
  @ApiOkResponse({ type: PerfilDto, example: EXEMPLO_PERFIL })
  obter(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<Perfil> {
    return this.perfil.obter(usuario)
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Altera o nome (UC11)', description: 'Responde o perfil atualizado.' })
  @ApiBody({ type: AtualizarPerfilDto, examples: { nome: { value: { nome: 'Ana Souza' } } } })
  @ApiOkResponse({ type: PerfilDto, example: EXEMPLO_PERFIL })
  @ApiBadRequestResponse({
    description:
      '`VALIDATION_ERROR`: nome fora de 2–80 caracteres ou campo extra (`email`, `papel`...).',
  })
  atualizar(
    @Body() dados: AtualizarPerfilDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Perfil> {
    return this.perfil.atualizar(usuario, dados)
  }

  @Put('foto')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Define a foto enviada ao R2 pelo presign `PERFIL` (UC11)',
    description: `A chave igual à atual responde 200 sem revalidar. A foto anterior é removida do R2 após o commit.\n\n${DESCRICAO_FOTO}`,
  })
  @ApiBody({ type: AtualizarFotoDto, examples: { foto: { value: { fotoKey: FOTO_KEY_EXEMPLO } } } })
  @ApiOkResponse({ type: FotoAtualizadaDto, example: { fotoUrl: FOTO_URL_EXEMPLO } })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR`.' })
  @ApiUnprocessableEntityResponse({ description: '`UPLOAD_INVALIDO` ou `UPLOAD_NAO_ENCONTRADO`.' })
  atualizarFoto(
    @Body() { fotoKey }: AtualizarFotoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<FotoAtualizada> {
    return this.perfil.atualizarFoto(usuario, fotoKey)
  }

  @Delete('foto')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a foto (UC11)' })
  @ApiNoContentResponse({ description: 'Também sem foto (idempotente); o objeto sai do R2.' })
  removerFoto(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<void> {
    return this.perfil.removerFoto(usuario)
  }

  @Put('senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Troca a senha informando a atual (UC11)',
    description:
      'Revoga as outras sessões (`TROCA_SENHA`); a sessão atual continua.\n\n' +
      '| HTTP | code | Quando |\n|---|---|---|\n' +
      '| 400 | `VALIDATION_ERROR` | nova senha fora da política (8–128, letra e número) |\n' +
      '| 400 | `SENHA_INCORRETA` | senha atual errada (conta para o limite) |\n' +
      '| 400 | `SENHA_IGUAL_ATUAL` | nova senha igual à atual |\n' +
      '| 429 | `RATE_LIMITED` | limite de senhas atuais erradas |',
  })
  @ApiBody({
    type: AlterarSenhaDto,
    examples: { senha: { value: { senhaAtual: 'lorde2026', novaSenha: 'novaSenha9' } } },
  })
  @ApiNoContentResponse({ description: 'Senha trocada e outras sessões revogadas.' })
  @ApiBadRequestResponse({
    description: '`VALIDATION_ERROR`, `SENHA_INCORRETA` ou `SENHA_IGUAL_ATUAL`.',
  })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description: `${LIMITE_SENHA_ATUAL.maximo} senhas atuais erradas em ${emMinutos(LIMITE_SENHA_ATUAL.janelaMs)} min.`,
  })
  alterarSenha(
    @Body() dados: AlterarSenhaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.perfil.alterarSenha(usuario, dados)
  }

  @Delete('conta')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui a própria conta, confirmando a senha (UC13, RN33)',
    description:
      'Anonimiza os dados pessoais, encerra os vínculos com times e atléticas, cancela as ' +
      'solicitações pendentes e revoga todas as sessões (`CONTA_EXCLUIDA`). O histórico de ' +
      'presenças e resultados fica com "Usuário excluído". Irreversível.\n\n' +
      '| HTTP | code | Quando |\n|---|---|---|\n' +
      '| 400 | `VALIDATION_ERROR` | corpo diferente de `{ senha }` |\n' +
      '| 400 | `SENHA_INCORRETA` | senha errada (conta para o limite) |\n' +
      '| 409 | `ULTIMO_ADMINISTRADOR` | único Administrador ativo de alguma atlética (RN08) |\n' +
      '| 429 | `RATE_LIMITED` | limite de senhas erradas |',
  })
  @ApiBody({ type: ExcluirContaDto, examples: { senha: { value: { senha: 'lorde2026' } } } })
  @ApiNoContentResponse({ description: 'Conta excluída e sessões revogadas.' })
  @ApiBadRequestResponse({ description: '`VALIDATION_ERROR` ou `SENHA_INCORRETA`.' })
  @ApiConflictResponse({
    description: `\`ULTIMO_ADMINISTRADOR\`: "${MENSAGEM_ULTIMO_ADMINISTRADOR_EXCLUSAO}"`,
  })
  @ApiTooManyRequestsResponse({
    ...RESPOSTA_LIMITE_EXCEDIDO,
    description: `${LIMITE_SENHA_ATUAL.maximo} senhas erradas em ${emMinutos(LIMITE_SENHA_ATUAL.janelaMs)} min (mesmo contador de \`PUT /me/senha\`).`,
  })
  excluirConta(
    @Body() { senha }: ExcluirContaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.conta.excluir(usuario.id, senha)
  }
}
