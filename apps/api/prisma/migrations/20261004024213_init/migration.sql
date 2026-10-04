-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ATLETA', 'DIRETOR', 'PRESIDENTE', 'VICE_PRESIDENTE', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('JOGO', 'TREINO');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('AGENDADO', 'EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Resultado" AS ENUM ('VITORIA', 'EMPATE', 'DERROTA');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusNoticia" AS ENUM ('RASCUNHO', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "TipoCodigoVerificacao" AS ENUM ('RECUPERAR_SENHA', 'VERIFICAR_EMAIL');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senhaHash" VARCHAR(255) NOT NULL,
    "fotoKey" VARCHAR(300),
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "excluidoEm" TIMESTAMPTZ(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atletica" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40),
    "nome" VARCHAR(80) NOT NULL,
    "sigla" VARCHAR(12),
    "curso" VARCHAR(120),
    "logoUrl" VARCHAR(500),
    "corPrimaria" CHAR(7),
    "corSecundaria" CHAR(7),
    "usaAplicativo" BOOLEAN NOT NULL DEFAULT false,
    "contatoEmail" VARCHAR(254),
    "contatoInstagram" VARCHAR(60),
    "contatoWhatsapp" VARCHAR(20),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Atletica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoAtletica" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'ATLETA',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VinculoAtletica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenciaNotificacao" (
    "usuarioId" UUID NOT NULL,
    "pushAtivo" BOOLEAN NOT NULL DEFAULT true,
    "novosEventos" BOOLEAN NOT NULL DEFAULT true,
    "alteracoesEventos" BOOLEAN NOT NULL DEFAULT true,
    "lembretes" BOOLEAN NOT NULL DEFAULT true,
    "antecedenciaLembreteHoras" SMALLINT NOT NULL DEFAULT 2,
    "resultados" BOOLEAN NOT NULL DEFAULT true,
    "noticias" BOOLEAN NOT NULL DEFAULT true,
    "solicitacoes" BOOLEAN NOT NULL DEFAULT true,
    "avisos" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PreferenciaNotificacao_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "DispositivoPush" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "sessaoId" UUID,
    "tokenPush" VARCHAR(255) NOT NULL,
    "plataforma" VARCHAR(10) NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispositivoPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modalidade" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(40) NOT NULL,
    "icone" VARCHAR(40) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Time" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "modalidadeId" UUID NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "capitaoId" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Time_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroTime" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "timeId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "solicitacaoId" UUID,
    "entradaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saidaEm" TIMESTAMPTZ(3),

    CONSTRAINT "MembroTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoEntrada" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "timeId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avaliadaEm" TIMESTAMPTZ(3),
    "avaliadoPorId" UUID,
    "canceladaEm" TIMESTAMPTZ(3),

    CONSTRAINT "SolicitacaoEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "timeId" UUID NOT NULL,
    "timeAdversarioId" UUID,
    "serieId" UUID,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "local" VARCHAR(150) NOT NULL,
    "status" "StatusEvento" NOT NULL DEFAULT 'AGENDADO',
    "placarTime" SMALLINT,
    "placarAdversario" SMALLINT,
    "resultado" "Resultado",
    "observacoes" VARCHAR(1000),
    "criadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "excluidoEm" TIMESTAMPTZ(3),

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerieRecorrencia" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "timeId" UUID NOT NULL,
    "diasSemana" INTEGER[],
    "horario" CHAR(5) NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "local" VARCHAR(150) NOT NULL,
    "observacoes" VARCHAR(1000),
    "criadoPorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "canceladaEm" TIMESTAMPTZ(3),

    CONSTRAINT "SerieRecorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participacao" (
    "atleticaId" UUID NOT NULL,
    "eventoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "confirmado" BOOLEAN,
    "respondidoEm" TIMESTAMPTZ(3),
    "presente" BOOLEAN,
    "presencaRegistradaEm" TIMESTAMPTZ(3),
    "presencaRegistradaPorId" UUID,

    CONSTRAINT "Participacao_pkey" PRIMARY KEY ("eventoId","usuarioId")
);

-- CreateTable
CREATE TABLE "Noticia" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "imagemCapaKey" VARCHAR(300),
    "status" "StatusNoticia" NOT NULL DEFAULT 'RASCUNHO',
    "publicadaEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,
    "excluidoEm" TIMESTAMPTZ(3),

    CONSTRAINT "Noticia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "nome" VARCHAR(30) NOT NULL,
    "nomeNormalizado" VARCHAR(30) NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticiaTag" (
    "noticiaId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "NoticiaTag_pkey" PRIMARY KEY ("noticiaId","tagId")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "titulo" VARCHAR(80) NOT NULL,
    "imagemKey" VARCHAR(300) NOT NULL,
    "link" VARCHAR(500),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "usuarioId" UUID,
    "acao" VARCHAR(40) NOT NULL,
    "entidade" VARCHAR(40) NOT NULL,
    "entidadeId" UUID NOT NULL,
    "dados" JSONB NOT NULL,
    "requestId" VARCHAR(64),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "atleticaId" UUID NOT NULL,
    "refreshTokenHash" CHAR(64) NOT NULL,
    "refreshTokenAnteriorHash" CHAR(64),
    "rotacionadaEm" TIMESTAMPTZ(3),
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "revogadaEm" TIMESTAMPTZ(3),
    "motivoRevogacao" VARCHAR(30),
    "userAgent" VARCHAR(255),
    "ip" VARCHAR(45),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaAcesso" (
    "id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "chave" VARCHAR(300) NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoVerificacao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoCodigoVerificacao" NOT NULL,
    "codigoHash" VARCHAR(255) NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),
    "tentativas" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "CodigoVerificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AceiteTermos" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "versao" VARCHAR(20) NOT NULL,
    "aceitoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45),

    CONSTRAINT "AceiteTermos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Atletica_slug_key" ON "Atletica"("slug");

-- CreateIndex
CREATE INDEX "Atletica_usaAplicativo_idx" ON "Atletica"("usaAplicativo");

-- CreateIndex
CREATE INDEX "VinculoAtletica_atleticaId_papel_idx" ON "VinculoAtletica"("atleticaId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoAtletica_usuarioId_atleticaId_key" ON "VinculoAtletica"("usuarioId", "atleticaId");

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoPush_tokenPush_key" ON "DispositivoPush"("tokenPush");

-- CreateIndex
CREATE INDEX "DispositivoPush_usuarioId_idx" ON "DispositivoPush"("usuarioId");

-- CreateIndex
CREATE INDEX "Modalidade_ativa_idx" ON "Modalidade"("ativa");

-- CreateIndex
CREATE INDEX "Time_atleticaId_modalidadeId_ativo_idx" ON "Time"("atleticaId", "modalidadeId", "ativo");

-- CreateIndex
CREATE INDEX "Time_modalidadeId_idx" ON "Time"("modalidadeId");

-- CreateIndex
CREATE INDEX "Time_capitaoId_idx" ON "Time"("capitaoId");

-- CreateIndex
CREATE UNIQUE INDEX "MembroTime_solicitacaoId_key" ON "MembroTime"("solicitacaoId");

-- CreateIndex
CREATE INDEX "MembroTime_timeId_saidaEm_idx" ON "MembroTime"("timeId", "saidaEm");

-- CreateIndex
CREATE INDEX "MembroTime_usuarioId_saidaEm_idx" ON "MembroTime"("usuarioId", "saidaEm");

-- CreateIndex
CREATE INDEX "SolicitacaoEntrada_atleticaId_status_criadaEm_idx" ON "SolicitacaoEntrada"("atleticaId", "status", "criadaEm");

-- CreateIndex
CREATE INDEX "SolicitacaoEntrada_usuarioId_status_idx" ON "SolicitacaoEntrada"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoEntrada_timeId_status_idx" ON "SolicitacaoEntrada"("timeId", "status");

-- CreateIndex
CREATE INDEX "Evento_atleticaId_inicio_idx" ON "Evento"("atleticaId", "inicio");

-- CreateIndex
CREATE INDEX "Evento_atleticaId_status_inicio_idx" ON "Evento"("atleticaId", "status", "inicio");

-- CreateIndex
CREATE INDEX "Evento_atleticaId_tipo_inicio_idx" ON "Evento"("atleticaId", "tipo", "inicio");

-- CreateIndex
CREATE INDEX "Evento_timeId_inicio_idx" ON "Evento"("timeId", "inicio");

-- CreateIndex
CREATE INDEX "Evento_timeAdversarioId_idx" ON "Evento"("timeAdversarioId");

-- CreateIndex
CREATE INDEX "Evento_serieId_inicio_idx" ON "Evento"("serieId", "inicio");

-- CreateIndex
CREATE INDEX "SerieRecorrencia_atleticaId_timeId_idx" ON "SerieRecorrencia"("atleticaId", "timeId");

-- CreateIndex
CREATE INDEX "Participacao_usuarioId_presente_idx" ON "Participacao"("usuarioId", "presente");

-- CreateIndex
CREATE INDEX "Noticia_atleticaId_status_publicadaEm_idx" ON "Noticia"("atleticaId", "status", "publicadaEm" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_atleticaId_nomeNormalizado_key" ON "Tag"("atleticaId", "nomeNormalizado");

-- CreateIndex
CREATE INDEX "NoticiaTag_tagId_idx" ON "NoticiaTag"("tagId");

-- CreateIndex
CREATE INDEX "Banner_atleticaId_ativo_ordem_idx" ON "Banner"("atleticaId", "ativo", "ordem");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_atleticaId_criadoEm_idx" ON "RegistroAuditoria"("atleticaId", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "RegistroAuditoria_atleticaId_entidade_entidadeId_idx" ON "RegistroAuditoria"("atleticaId", "entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_atleticaId_usuarioId_criadoEm_idx" ON "RegistroAuditoria"("atleticaId", "usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_refreshTokenHash_key" ON "Sessao"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_revogadaEm_idx" ON "Sessao"("usuarioId", "revogadaEm");

-- CreateIndex
CREATE INDEX "Sessao_refreshTokenAnteriorHash_idx" ON "Sessao"("refreshTokenAnteriorHash");

-- CreateIndex
CREATE INDEX "TentativaAcesso_tipo_chave_criadoEm_idx" ON "TentativaAcesso"("tipo", "chave", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "TentativaAcesso_criadoEm_idx" ON "TentativaAcesso"("criadoEm");

-- CreateIndex
CREATE INDEX "CodigoVerificacao_usuarioId_tipo_criadoEm_idx" ON "CodigoVerificacao"("usuarioId", "tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "AceiteTermos_usuarioId_aceitoEm_idx" ON "AceiteTermos"("usuarioId", "aceitoEm");

-- AddForeignKey
ALTER TABLE "VinculoAtletica" ADD CONSTRAINT "VinculoAtletica_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoAtletica" ADD CONSTRAINT "VinculoAtletica_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenciaNotificacao" ADD CONSTRAINT "PreferenciaNotificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoPush" ADD CONSTRAINT "DispositivoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoPush" ADD CONSTRAINT "DispositivoPush_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Time" ADD CONSTRAINT "Time_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Time" ADD CONSTRAINT "Time_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Time" ADD CONSTRAINT "Time_capitaoId_fkey" FOREIGN KEY ("capitaoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroTime" ADD CONSTRAINT "MembroTime_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroTime" ADD CONSTRAINT "MembroTime_timeId_fkey" FOREIGN KEY ("timeId") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroTime" ADD CONSTRAINT "MembroTime_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroTime" ADD CONSTRAINT "MembroTime_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoEntrada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoEntrada" ADD CONSTRAINT "SolicitacaoEntrada_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoEntrada" ADD CONSTRAINT "SolicitacaoEntrada_timeId_fkey" FOREIGN KEY ("timeId") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoEntrada" ADD CONSTRAINT "SolicitacaoEntrada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoEntrada" ADD CONSTRAINT "SolicitacaoEntrada_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_timeId_fkey" FOREIGN KEY ("timeId") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_timeAdversarioId_fkey" FOREIGN KEY ("timeAdversarioId") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "SerieRecorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT "SerieRecorrencia_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT "SerieRecorrencia_timeId_fkey" FOREIGN KEY ("timeId") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT "SerieRecorrencia_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participacao" ADD CONSTRAINT "Participacao_presencaRegistradaPorId_fkey" FOREIGN KEY ("presencaRegistradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noticia" ADD CONSTRAINT "Noticia_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noticia" ADD CONSTRAINT "Noticia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticiaTag" ADD CONSTRAINT "NoticiaTag_noticiaId_fkey" FOREIGN KEY ("noticiaId") REFERENCES "Noticia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticiaTag" ADD CONSTRAINT "NoticiaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_atleticaId_fkey" FOREIGN KEY ("atleticaId") REFERENCES "Atletica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoVerificacao" ADD CONSTRAINT "CodigoVerificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceiteTermos" ADD CONSTRAINT "AceiteTermos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- SQL acrescentado manualmente (épico #3 §8.3): o Prisma não expressa índices parciais,
-- índices por expressão nem CHECK. Os nomes estão listados no topo do schema.prisma.
-- ============================================================================

-- Extensão para busca de nomes sem acento (#27): WHERE unaccent(lower(nome)) LIKE unaccent(lower($1))
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Usuário
ALTER TABLE "Usuario" ADD CONSTRAINT usuario_email_minusculo CHECK (email = lower(email));

-- Atlética: atlética que usa o app precisa de slug, sigla e cores
ALTER TABLE "Atletica" ADD CONSTRAINT atletica_dados_app CHECK (
  "usaAplicativo" = false OR (slug IS NOT NULL AND sigla IS NOT NULL
    AND "corPrimaria" IS NOT NULL AND "corSecundaria" IS NOT NULL));
ALTER TABLE "Atletica" ADD CONSTRAINT atletica_cores_hex CHECK (
  ("corPrimaria" IS NULL OR "corPrimaria" ~ '^#[0-9A-Fa-f]{6}$') AND
  ("corSecundaria" IS NULL OR "corSecundaria" ~ '^#[0-9A-Fa-f]{6}$'));

-- RN07: no máximo um Presidente e um Vice-presidente por atlética, independentemente de `ativo` (convenções §11.4)
CREATE UNIQUE INDEX vinculo_presidente_unico ON "VinculoAtletica" ("atleticaId")
  WHERE papel = 'PRESIDENTE';
CREATE UNIQUE INDEX vinculo_vice_unico ON "VinculoAtletica" ("atleticaId")
  WHERE papel = 'VICE_PRESIDENTE';

-- 3.4: antecedência do lembrete
ALTER TABLE "PreferenciaNotificacao" ADD CONSTRAINT preferencia_antecedencia
  CHECK ("antecedenciaLembreteHoras" IN (1, 2, 6, 24));

-- Modalidade: nome único (sem diferenciar maiúsculas); exclusão física, índice não parcial (convenções §11.4)
CREATE UNIQUE INDEX modalidade_nome_unico ON "Modalidade" (lower(nome));

-- Time: nome único por atlética e modalidade; exclusão física, índice não parcial (convenções §11.4)
CREATE UNIQUE INDEX time_nome_unico ON "Time" ("atleticaId", "modalidadeId", lower(nome));

-- RN28: um vínculo ativo por usuário e time
CREATE UNIQUE INDEX membro_time_ativo_unico ON "MembroTime" ("timeId", "usuarioId")
  WHERE "saidaEm" IS NULL;
ALTER TABLE "MembroTime" ADD CONSTRAINT membro_saida_apos_entrada
  CHECK ("saidaEm" IS NULL OR "saidaEm" >= "entradaEm");

-- RN27: uma solicitação pendente por usuário e time
CREATE UNIQUE INDEX solicitacao_pendente_unica ON "SolicitacaoEntrada" ("timeId", "usuarioId")
  WHERE status = 'PENDENTE';
ALTER TABLE "SolicitacaoEntrada" ADD CONSTRAINT solicitacao_avaliacao_coerente
  CHECK (status NOT IN ('APROVADA', 'REJEITADA') OR "avaliadaEm" IS NOT NULL);

-- RN11/RN12/RN15/RN16: coerência do evento
ALTER TABLE "Evento" ADD CONSTRAINT evento_tipo_coerente CHECK (
  (tipo = 'TREINO' AND "timeAdversarioId" IS NULL AND "placarTime" IS NULL
     AND "placarAdversario" IS NULL AND resultado IS NULL)
  OR (tipo = 'JOGO' AND "timeAdversarioId" IS NOT NULL AND "serieId" IS NULL));
ALTER TABLE "Evento" ADD CONSTRAINT evento_times_distintos
  CHECK ("timeAdversarioId" IS NULL OR "timeAdversarioId" <> "timeId");
ALTER TABLE "Evento" ADD CONSTRAINT evento_placar_completo CHECK (
  ("placarTime" IS NULL) = ("placarAdversario" IS NULL)
  AND ("placarTime" IS NULL) = (resultado IS NULL));
ALTER TABLE "Evento" ADD CONSTRAINT evento_placar_nao_negativo
  CHECK (("placarTime" IS NULL OR "placarTime" >= 0) AND ("placarAdversario" IS NULL OR "placarAdversario" >= 0));
ALTER TABLE "Evento" ADD CONSTRAINT evento_resultado_finalizado
  CHECK (resultado IS NULL OR status = 'FINALIZADO');

-- RN13: série
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT serie_dias_validos CHECK (
  cardinality("diasSemana") BETWEEN 1 AND 7 AND "diasSemana" <@ ARRAY[0,1,2,3,4,5,6]);
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT serie_horario_formato
  CHECK (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT serie_periodo_valido
  CHECK ("dataFim" >= "dataInicio");
ALTER TABLE "SerieRecorrencia" ADD CONSTRAINT serie_limite_6_meses
  CHECK ("dataFim" <= ("dataInicio" + INTERVAL '6 months')::date);

-- Participação: resposta e presença com data
ALTER TABLE "Participacao" ADD CONSTRAINT participacao_resposta_coerente
  CHECK (("confirmado" IS NULL) = ("respondidoEm" IS NULL));
ALTER TABLE "Participacao" ADD CONSTRAINT participacao_presenca_coerente
  CHECK (("presente" IS NULL) = ("presencaRegistradaEm" IS NULL));

-- Notícia publicada tem data de publicação
ALTER TABLE "Noticia" ADD CONSTRAINT noticia_publicada_com_data
  CHECK (status <> 'PUBLICADA' OR "publicadaEm" IS NOT NULL);

-- Tag: unicidade por (atleticaId, nomeNormalizado) já é @@unique no schema

-- RN34: link HTTPS
ALTER TABLE "Banner" ADD CONSTRAINT banner_link_https CHECK (link IS NULL OR link LIKE 'https://%');
ALTER TABLE "Banner" ADD CONSTRAINT banner_ordem_nao_negativa CHECK (ordem >= 0);
