import {
  FinalidadeUpload,
  LIMITE_BANNERS_ATIVOS,
  type BannerAtualizacao,
  type BannerCriacao,
  type BannerDto,
  type BannerPainelDto,
  type BannersOrdenados,
  type BannersPainelQuery,
  type ListaBanners,
  type ListaBannersPainel,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { aposCommit, TransacaoService } from '../../infra/eventos/apos-commit'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type DadosAuditoria } from '../auditoria/auditoria.service'
import { diferenca, type DiferencaAuditoria } from '../auditoria/diferenca'
import type { UsuarioNaAtletica } from '../auth/tipos'
import { UploadsService } from '../uploads/uploads.service'
import { erroBannerNaoEncontrado, erroLimiteBannersAtivos, erroOrdemIncompleta } from './erros'

const CAMPOS = {
  id: true,
  titulo: true,
  imagemKey: true,
  link: true,
  ordem: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
} as const satisfies Prisma.BannerSelect

/** Empate de `ordem`: o mais antigo primeiro. */
const ORDENACAO = [
  { ordem: 'asc' },
  { criadoEm: 'asc' },
  { id: 'asc' },
] as const satisfies Prisma.BannerOrderByWithRelationInput[]

type LinhaBanner = Prisma.BannerGetPayload<{ select: typeof CAMPOS }>

interface Editaveis {
  titulo: string
  imagemKey: string
  link: string | null
  ativo: boolean
}

const EDITAVEIS = ['titulo', 'imagemKey', 'link', 'ativo'] as const

/** A chave da imagem não vai para a auditoria, só o indicador. */
function dadosDaAlteracao({ antes, depois }: DiferencaAuditoria): DadosAuditoria {
  const { imagemKey: _a, ...antesSemImagem } = antes
  const { imagemKey: _d, ...depoisSemImagem } = depois
  return {
    antes: antesSemImagem,
    depois: { ...depoisSemImagem, ...('imagemKey' in depois && { imagemAlterada: true }) },
  }
}

function auditaveis({ titulo, link, ordem, ativo }: LinhaBanner) {
  return { titulo, link, ordem, ativo }
}

/** Carrossel da Home e gestão pelo Painel (RF11, RF38, UC22, issue #33). */
@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly uploads: UploadsService,
  ) {}

  async listarAtivos(): Promise<ListaBanners> {
    const banners = await this.prisma.db.banner.findMany({
      where: { ativo: true },
      orderBy: [...ORDENACAO],
      select: CAMPOS,
    })
    return { items: banners.map((banner) => this.paraItem(banner)) }
  }

  async listar({ page, limit }: BannersPainelQuery): Promise<ListaBannersPainel> {
    const [banners, total] = await Promise.all([
      this.prisma.db.banner.findMany({
        orderBy: [...ORDENACAO],
        skip: (page - 1) * limit,
        take: limit,
        select: CAMPOS,
      }),
      this.prisma.db.banner.count(),
    ])
    return { items: banners.map((banner) => this.paraDto(banner)), page, limit, total }
  }

  async detalhar(id: string): Promise<BannerPainelDto> {
    const banner = await this.prisma.db.banner.findFirst({ where: { id }, select: CAMPOS })
    if (!banner) throw erroBannerNaoEncontrado()
    return this.paraDto(banner)
  }

  async criar(solicitante: UsuarioNaAtletica, entrada: BannerCriacao): Promise<BannerPainelDto> {
    const { titulo, imagemKey, link = null, ativo = true } = entrada
    await this.validarImagem(imagemKey, solicitante)

    return this.transacao.executar(async (tx) => {
      await this.bloquearAtletica(tx, solicitante)
      if (ativo) await this.garantirVagaAtiva(tx)
      const ultimo = await tx.banner.findFirst({
        orderBy: { ordem: 'desc' },
        select: { ordem: true },
      })
      const criado = await tx.banner.create({
        data: {
          titulo,
          imagemKey,
          link,
          ativo,
          ordem: ultimo ? ultimo.ordem + 1 : 0,
          atleticaId: solicitante.atleticaId,
        },
        select: CAMPOS,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Banner',
        acao: 'BANNER_CRIADO',
        entidadeId: criado.id,
        dados: { antes: null, depois: auditaveis(criado) },
      })
      return this.paraDto(criado)
    })
  }

  /** Sem mudança: `200` sem gravar nem auditar (convenções §7). */
  async atualizar(
    id: string,
    solicitante: UsuarioNaAtletica,
    entrada: BannerAtualizacao,
  ): Promise<BannerPainelDto> {
    const imagemValidada = await this.validarImagemNova(id, entrada.imagemKey, solicitante)
    return this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante)
      const depois: Editaveis = {
        titulo: entrada.titulo ?? antes.titulo,
        imagemKey: entrada.imagemKey ?? antes.imagemKey,
        link: entrada.link === undefined ? antes.link : entrada.link,
        ativo: entrada.ativo ?? antes.ativo,
      }
      const diff = diferenca<Editaveis>(antes, depois, EDITAVEIS)
      if (!diff) return this.paraDto(antes)

      if (depois.ativo && !antes.ativo) await this.garantirVagaAtiva(tx)
      const imagemAnterior = antes.imagemKey
      const trocouImagem = depois.imagemKey !== imagemAnterior
      if (trocouImagem && depois.imagemKey !== imagemValidada) {
        await this.validarImagem(depois.imagemKey, solicitante)
      }

      const atualizado = await tx.banner.update({ where: { id }, data: depois, select: CAMPOS })
      await this.auditoria.registrar(tx, {
        entidade: 'Banner',
        acao: 'BANNER_ALTERADO',
        entidadeId: id,
        dados: dadosDaAlteracao(diff),
      })
      if (trocouImagem) aposCommit(() => this.uploads.remover(imagemAnterior))
      return this.paraDto(atualizado)
    })
  }

  /** Regrava `ordem` 0..n-1; a lista deve ter exatamente todos os banners da atlética. */
  async ordenar(solicitante: UsuarioNaAtletica, ids: string[]): Promise<BannersOrdenados> {
    return this.transacao.executar(async (tx) => {
      await this.bloquearAtletica(tx, solicitante)
      const atuais = await tx.banner.findMany({ orderBy: [...ORDENACAO], select: { id: true } })
      const antes = atuais.map(({ id }) => id)
      const recebidos = new Set(ids)
      const completa =
        recebidos.size === ids.length &&
        ids.length === antes.length &&
        antes.every((id) => recebidos.has(id))
      if (!completa) throw erroOrdemIncompleta()

      const mudou = ids.some((id, i) => id !== antes[i])
      if (mudou) {
        for (const [ordem, id] of ids.entries()) {
          await tx.banner.update({ where: { id }, data: { ordem } })
        }
        await this.auditoria.registrar(tx, {
          entidade: 'Banner',
          acao: 'BANNER_REORDENADO',
          entidadeId: ids[0] ?? '',
          dados: { antes: { ids: antes }, depois: { ids } },
        })
      }
      const banners = await tx.banner.findMany({ orderBy: [...ORDENACAO], select: CAMPOS })
      return { items: banners.map((banner) => this.paraDto(banner)) }
    })
  }

  /** Exclusão física (convenções §11.4); a imagem fica para a limpeza de órfãos (#56). */
  async excluir(id: string, solicitante: UsuarioNaAtletica): Promise<void> {
    await this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante)
      await tx.banner.delete({ where: { id } })
      await this.auditoria.registrar(tx, {
        entidade: 'Banner',
        acao: 'BANNER_EXCLUIDO',
        entidadeId: id,
        dados: { antes: auditaveis(antes), depois: null },
      })
    })
  }

  /** Serializa ordem e limite de ativos entre escritas concorrentes da mesma atlética. */
  private async bloquearAtletica(
    tx: TransacaoComEscopo,
    { atleticaId }: UsuarioNaAtletica,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`banners:${atleticaId}`}))`
  }

  private async bloquear(
    tx: TransacaoComEscopo,
    id: string,
    solicitante: UsuarioNaAtletica,
  ): Promise<LinhaBanner> {
    await this.bloquearAtletica(tx, solicitante)
    const banner = await tx.banner.findFirst({ where: { id }, select: CAMPOS })
    if (!banner) throw erroBannerNaoEncontrado()
    return banner
  }

  private async garantirVagaAtiva(tx: TransacaoComEscopo): Promise<void> {
    const ativos = await tx.banner.count({ where: { ativo: true } })
    if (ativos >= LIMITE_BANNERS_ATIVOS) throw erroLimiteBannersAtivos()
  }

  /** Fora da transação, para o `HeadObject` no R2 não segurar o lock. */
  private async validarImagemNova(
    id: string,
    key: string | undefined,
    solicitante: UsuarioNaAtletica,
  ): Promise<string | null> {
    if (!key) return null
    const atual = await this.prisma.db.banner.findFirst({
      where: { id },
      select: { imagemKey: true },
    })
    if (!atual || atual.imagemKey === key) return null
    await this.validarImagem(key, solicitante)
    return key
  }

  /** Só quando a chave muda (convenções §11.5). */
  private validarImagem(key: string, { id, atleticaId }: UsuarioNaAtletica): Promise<void> {
    return this.uploads.validarKey({
      key,
      finalidade: FinalidadeUpload.BANNER,
      usuarioId: id,
      atleticaId,
    })
  }

  private paraItem(banner: LinhaBanner): BannerDto {
    return {
      id: banner.id,
      titulo: banner.titulo,
      imagemUrl: this.uploads.urlPublica(banner.imagemKey),
      link: banner.link,
    }
  }

  private paraDto(banner: LinhaBanner): BannerPainelDto {
    return {
      ...this.paraItem(banner),
      ordem: banner.ordem,
      ativo: banner.ativo,
      criadoEm: banner.criadoEm.toISOString(),
      atualizadoEm: banner.atualizadoEm.toISOString(),
    }
  }
}
