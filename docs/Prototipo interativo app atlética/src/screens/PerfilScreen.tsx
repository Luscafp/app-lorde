import { useState } from 'react'
import { C, ATLETICA } from '../theme'
import { ROLE_LABEL, canAccessPanel, fmtCard, initials, nowLocal, SENHA_REGRA, senhaValida } from '../utils'
import { encerrarVinculo, estatisticas, isMembro, participacaoDe, podeResponder, timesDoUsuario } from '../domain'
import { Card, SH, Chip, Av, Toggle, IcoBell, IcoCode, IcoShield, IcoUser, IcoCheck, IcoX, IcoBack, IcoAlert, IcoChev } from '../components/atoms'
import { Field, PasswordField, ErrorBox, StrBar, TermsModal, Sheet, DemoButton } from '../components/shared'
import { EventoCard } from '../components/EventoDetalhe'
import { useApp } from '../AppContext'

type PView = 'main' | 'settings' | 'edit-profile' | 'change-password' | 'notif-settings' | 'about' | 'delete-account'

function ChevR() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'rgba(107,114,128,.5)' }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.bdr}` }}>
      <button onClick={onBack}
        className="flex items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
        <IcoBack />
      </button>
      <h2 className="f-sora font-black text-lg" style={{ color: C.text }}>{title}</h2>
    </div>
  )
}

// ─── Editar perfil (UC11) ─────────────────────────────────────────────────────
function EditProfile({ onBack }: { onBack: () => void }) {
  const { me, setUsuarios, showToast, online } = useApp()
  const [nome, setNome] = useState(me.nome)
  const [fotoSheet, setFotoSheet] = useState(false)
  const [err, setErr] = useState<string | undefined>()

  function salvar() {
    if (!nome.trim()) { setErr('Informe seu nome'); return }
    if (!online()) return
    setUsuarios(p => p.map(u => u.id === me.id ? { ...u, nome: nome.trim() } : u))
    showToast('Perfil atualizado', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col h-full a-up relative">
      <SubHeader title="Editar perfil" onBack={onBack} />
      <div className="flex flex-col gap-5 px-4 pt-5 flex-1">
        <div className="flex flex-col items-center gap-3">
          <button className="relative" onClick={() => setFotoSheet(true)}>
            <Av s={initials(nome || me.nome)} size={80} bg={`linear-gradient(135deg,${C.red},${C.redD})`} />
            <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: C.blue, border: `2px solid ${C.bg}` }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </span>
          </button>
          <p className="f-mono text-[10px] text-center" style={{ color: C.muted }}>
            Toque para alterar a foto<br />A imagem será redimensionada para até 1080 px (máx. 5 MB)
          </p>
        </div>
        <Field label="Nome" value={nome} onChange={v => { setNome(v); setErr(undefined) }} error={err} />
        <Field label="E-mail" value={me.email} onChange={() => {}} disabled hint="O e-mail não pode ser alterado" />
        <button onClick={salvar}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 20px rgba(225,29,72,.4)' }}>
          Salvar alterações
        </button>
      </div>
      {fotoSheet && (
        <Sheet onClose={() => setFotoSheet(false)}>
          <h3 className="f-sora font-black text-base mb-3" style={{ color: C.text }}>Foto de perfil</h3>
          {['Tirar foto', 'Escolher da galeria', 'Remover foto'].map(op => (
            <button key={op} onClick={() => { setFotoSheet(false); showToast(op === 'Remover foto' ? 'Foto removida' : 'Foto atualizada', 'success') }}
              className="w-full px-4 py-3 rounded-xl mb-2 text-left f-sora font-semibold text-sm"
              style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: op === 'Remover foto' ? '#f43f5e' : C.text }}>
              {op}
            </button>
          ))}
          <button onClick={() => setFotoSheet(false)} className="w-full py-3 f-mono text-sm" style={{ color: C.muted }}>Cancelar</button>
        </Sheet>
      )}
    </div>
  )
}

// ─── Alterar senha (UC11) ─────────────────────────────────────────────────────
function ChangePassword({ onBack }: { onBack: () => void }) {
  const { me, senhaCorreta, alterarSenha, showToast, online } = useApp()
  const [cur, setCur]   = useState('')
  const [nw, setNw]     = useState('')
  const [conf, setConf] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    if (!senhaCorreta(me.id, cur)) { setErr('Senha atual incorreta.'); return }
    if (!senhaValida(nw))           { setErr(SENHA_REGRA); return }
    if (nw !== conf)                { setErr('As senhas não coincidem.'); return }
    if (!online()) return
    setErr(null)
    alterarSenha(me.id, nw)
    showToast('Senha alterada', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col h-full a-up">
      <SubHeader title="Alterar senha" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-5">
        {err && <ErrorBox message={err} />}
        <PasswordField label="Senha atual" value={cur} onChange={setCur} />
        <div>
          <PasswordField label="Nova senha" value={nw} onChange={setNw} hint={SENHA_REGRA} />
          <StrBar pw={nw} />
        </div>
        <PasswordField label="Confirmar nova senha" value={conf} onChange={setConf}
          error={conf && nw !== conf ? 'As senhas não coincidem' : undefined} />
        <button onClick={submit} disabled={!cur || !nw || !conf}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: (cur && nw && conf) ? C.red : C.dim, color: '#fff' }}>
          Alterar senha
        </button>
      </div>
    </div>
  )
}

// ─── Notificações (seção 3.4 / UC12) ──────────────────────────────────────────
const NOTIF_CATS = [
  { key: 'eventos',    label: 'Novos eventos',              desc: 'Jogos e treinos criados para os meus times' },
  { key: 'alteracoes', label: 'Alterações e cancelamentos', desc: 'Data, horário, local ou status alterados' },
  { key: 'lembretes',  label: 'Lembretes',                  desc: 'Antes dos eventos confirmados e confirmação pendente' },
  { key: 'resultados', label: 'Resultados',                 desc: 'Resultado de jogo registrado' },
  { key: 'noticias',   label: 'Notícias',                   desc: 'Notícia publicada' },
  { key: 'solics',     label: 'Solicitações',               desc: 'Respostas às minhas solicitações de entrada' },
  { key: 'avisos',     label: 'Avisos da diretoria',        desc: 'Avisos manuais da diretoria' },
] as const

const ANTECEDENCIAS = ['1 h', '2 h', '6 h', '24 h'] as const

export type Prefs = { global: boolean; cats: Record<string, boolean>; antecedencia: string }
export const PREFS_PADRAO: Prefs = { global: true, cats: Object.fromEntries(NOTIF_CATS.map(c => [c.key, true])), antecedencia: '2 h' }

function NotifSettings({ prefs, setPrefs, onBack }: { prefs: Prefs; setPrefs: (f: (p: Prefs) => Prefs) => void; onBack: () => void }) {
  const { demo, showToast, online } = useApp()
  const off = !prefs.global

  function salvar(f: (p: Prefs) => Prefs, msg?: string) {
    if (!online()) return
    setPrefs(f)
    if (msg) showToast(msg, 'success')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto a-up">
      <SubHeader title="Notificações" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        {demo.notifNegada && (
          <div className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: '#1c1209', border: `1px solid ${C.yellow}33` }}>
            <IcoAlert size={18} color={C.yellow} />
            <div className="flex-1">
              <p className="f-sora font-bold text-sm mb-0.5" style={{ color: C.yellow }}>Permissão negada no Android</p>
              <p className="f-mono text-xs mb-2" style={{ color: C.muted }}>
                As notificações estão bloqueadas nas configurações do sistema.
              </p>
              <button onClick={() => showToast('Abrindo configurações do Android', 'success')}
                className="f-mono text-xs font-semibold" style={{ color: C.blueL }}>
                Abrir configurações →
              </button>
            </div>
          </div>
        )}

        <Card pad="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="f-sora font-semibold text-sm" style={{ color: C.text }}>Notificações push</p>
              <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>Ativar ou desativar todas</p>
            </div>
            <Toggle on={prefs.global} onChange={() => salvar(p => ({ ...p, global: !p.global }), prefs.global ? 'Notificações desativadas' : 'Notificações ativadas')} />
          </div>
        </Card>

        <Card pad="p-0">
          <p className="f-mono text-[9px] uppercase tracking-widest px-4 pt-4 pb-2" style={{ color: C.dim }}>Categorias</p>
          {NOTIF_CATS.map((cat, i) => (
            <div key={cat.key} className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? `1px solid ${C.bdr}` : 'none', opacity: off ? .45 : 1 }}>
              <div>
                <span className="f-sora font-medium text-sm" style={{ color: C.text }}>{cat.label}</span>
                <p className="f-mono text-[9px]" style={{ color: C.muted }}>{cat.desc}</p>
              </div>
              <Toggle on={prefs.cats[cat.key]} disabled={off}
                onChange={() => salvar(p => ({ ...p, cats: { ...p.cats, [cat.key]: !p.cats[cat.key] } }))} />
            </div>
          ))}
          <p className="f-mono text-[9px] px-4 pb-3" style={{ color: C.dim }}>
            Avisos de alteração de cargo são sempre enviados.
          </p>
        </Card>

        <div style={{ opacity: off || !prefs.cats.lembretes ? .45 : 1 }}>
          <p className="f-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: C.dim }}>Antecedência do lembrete</p>
          <div className="grid grid-cols-4 gap-2">
            {ANTECEDENCIAS.map(a => (
              <button key={a} disabled={off || !prefs.cats.lembretes} onClick={() => salvar(p => ({ ...p, antecedencia: a }))}
                className="py-2.5 rounded-xl f-mono text-xs font-semibold transition-all"
                style={{
                  background: prefs.antecedencia === a ? C.red : C.card,
                  color: prefs.antecedencia === a ? '#fff' : C.muted,
                  border: `1px solid ${prefs.antecedencia === a ? C.red : C.bdr}`,
                  cursor: off ? 'not-allowed' : 'pointer',
                }}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sobre ────────────────────────────────────────────────────────────────────
function About({ onBack }: { onBack: () => void }) {
  const [modal, setModal] = useState<'termos' | 'privacidade' | null>(null)
  const items: { label: string; onClick?: () => void; right?: string }[] = [
    { label: 'Termos de Uso', onClick: () => setModal('termos') },
    { label: 'Política de Privacidade', onClick: () => setModal('privacidade') },
    { label: 'Versão do app', right: 'v1.0.0 (build 1)' },
    { label: 'Contato da diretoria', right: 'diretoria@atleticalorde.com.br' },
  ]
  return (
    <div className="flex flex-col h-full a-up relative">
      <SubHeader title="Sobre" onBack={onBack} />
      <div className="px-4 pt-5">
        <Card pad="p-0">
          {items.map((item, i) => (
            <button key={item.label} onClick={item.onClick} disabled={!item.onClick}
              className="w-full flex items-center justify-between px-4 py-4"
              style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.bdr}` : 'none', textAlign: 'left' }}>
              <span className="f-sora font-medium text-sm" style={{ color: C.text }}>{item.label}</span>
              {item.right
                ? <span className="f-mono text-[10px]" style={{ color: C.muted }}>{item.right}</span>
                : <ChevR />}
            </button>
          ))}
        </Card>
        <div className="mt-8 text-center">
          <p className="f-sora font-black text-2xl" style={{ color: C.text }}>{ATLETICA.sigla}</p>
          <p className="f-mono text-[10px] mt-1" style={{ color: C.dim }}>{ATLETICA.nome} · {ATLETICA.curso}</p>
        </div>
      </div>
      {modal && <TermsModal type={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

// ─── Excluir conta (UC13 / RN33 / RN08) ───────────────────────────────────────
function DeleteAccount({ onBack }: { onBack: () => void }) {
  const {
    me, usuarios, setUsuarios, setMembros, setTimes, setSolicitacoes, senhaCorreta, online, logout,
  } = useApp()
  const [pw, setPw] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const ultimoAdmin = me.role === 'admin' && usuarios.filter(u => u.role === 'admin' && u.ativo && !u.excluido).length === 1

  function submit() {
    if (ultimoAdmin) return
    if (!senhaCorreta(me.id, pw)) { setErr('Senha incorreta.'); return }
    if (!online()) return
    const agora = nowLocal()
    // Anonimiza dados pessoais, sai dos elencos e cancela solicitações pendentes; participações ficam (anônimas)
    setUsuarios(p => p.map(u => u.id === me.id
      ? { ...u, nome: 'Usuário excluído', email: `excluido-${u.id}@anonimo`, ativo: false, excluido: true, role: 'atleta' }
      : u))
    setMembros(p => encerrarVinculo(p, me.id))
    setTimes(p => p.map(t => t.capitaoId === me.id ? { ...t, capitaoId: undefined } : t))
    setSolicitacoes(p => p.map(s => s.usuarioId === me.id && s.status === 'PENDENTE' ? { ...s, status: 'CANCELADA', avaliadaEm: agora } : s))
    logout('Conta excluída')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto a-up">
      <SubHeader title="Excluir conta" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <div className="p-4 rounded-2xl" style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <IcoAlert size={18} color="#f87171" />
            <p className="f-sora font-bold text-sm" style={{ color: '#f87171' }}>Ao excluir sua conta</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              'Seus dados pessoais serão anonimizados',
              'Você sairá de todos os times',
              'Suas solicitações pendentes serão canceladas',
              'Seu histórico de presenças e resultados será mantido de forma anônima',
            ].map(item => (
              <span key={item} className="flex items-start gap-2 f-mono text-xs leading-relaxed" style={{ color: C.muted }}>
                <span style={{ color: '#f87171' }}>•</span>{item}
              </span>
            ))}
          </div>
        </div>

        {ultimoAdmin ? (
          <ErrorBox message="Você é o único Administrador. Conceda o cargo a outra pessoa antes de excluir sua conta." />
        ) : (
          <>
            {err && <ErrorBox message={err} />}
            <PasswordField label="Confirme sua senha" value={pw} onChange={setPw} />
            <div className="flex items-start gap-3">
              <button onClick={() => setConfirmed(v => !v)}
                className="shrink-0 mt-0.5 rounded-lg flex items-center justify-center transition-all"
                style={{ width: 20, height: 20, background: confirmed ? '#f43f5e' : C.card2, border: `1.5px solid ${confirmed ? '#f43f5e' : C.dim}` }}>
                {confirmed && <IcoCheck size={12} color="#fff" />}
              </button>
              <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.muted }}>
                Entendo que esta ação não pode ser desfeita.
              </p>
            </div>
            <button onClick={submit} disabled={!pw || !confirmed}
              className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
              style={{ background: (pw && confirmed) ? '#f43f5e' : C.dim, color: '#fff' }}>
              Excluir minha conta
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Configurações ────────────────────────────────────────────────────────────
function SettingsMenu({ onBack, setView }: { onBack: () => void; setView: (v: PView) => void }) {
  const { showConfirm, logout } = useApp()

  const sections = [
    { title: 'Conta', items: [
      { Icon: IcoUser,   label: 'Editar perfil', onClick: () => setView('edit-profile') },
      { Icon: IcoShield, label: 'Alterar senha', onClick: () => setView('change-password') },
    ] },
    { title: 'Notificações', items: [
      { Icon: IcoBell, label: 'Preferências de notificação', onClick: () => setView('notif-settings') },
    ] },
    { title: 'Sobre', items: [
      { Icon: IcoCode, label: 'Termos, privacidade e versão', onClick: () => setView('about') },
    ] },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto a-up">
      <SubHeader title="Configurações" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        {sections.map(sec => (
          <div key={sec.title}>
            <p className="f-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: C.dim }}>{sec.title}</p>
            <Card pad="p-0">
              {sec.items.map((item, i) => (
                <button key={item.label} onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                  style={{ borderBottom: i < sec.items.length - 1 ? `1px solid ${C.bdr}` : 'none' }}>
                  <item.Icon size={16} color={C.muted} />
                  <span className="flex-1 f-sora font-medium text-sm" style={{ color: C.text }}>{item.label}</span>
                  <ChevR />
                </button>
              ))}
            </Card>
          </div>
        ))}

        {/* UC08: confirmação e volta ao login */}
        <button onClick={() => showConfirm('Sair da conta', 'Deseja encerrar a sessão neste dispositivo?', () => logout('Sessão encerrada'), 'Sair')}
          className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
          style={{ background: C.red + '15', color: C.red, border: `1px solid rgba(225,29,72,.22)` }}>
          <span className="flex items-center justify-center gap-2">
            <IcoX size={15} color={C.red} /> Sair da conta
          </span>
        </button>

        <button onClick={() => setView('delete-account')}
          className="f-mono text-xs text-center w-full py-2" style={{ color: '#f43f5e99' }}>
          Excluir conta
        </button>
      </div>
    </div>
  )
}

// ─── Perfil (UC10) ────────────────────────────────────────────────────────────
function ProfileMain({ setView, onDemo }: { setView: (v: PView) => void; onDemo: () => void }) {
  const {
    me, setScreen, abrirEvento, eventos, times, membros, participacoes, setParticipacoes, showToast, online,
  } = useApp()

  const meusTimes = timesDoUsuario(membros, me.id).map(id => times.find(t => t.id === id)).filter(t => !!t)
  const stats = estatisticas(participacoes, eventos, me.id)
  const agora = nowLocal()

  const futuros = eventos
    .filter(e => (e.status === 'Agendado' || e.status === 'Em andamento') && isMembro(membros, e.timeId, me.id))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  // UC10 passo 4: próximos eventos em que confirmei participação
  const confirmados = futuros.filter(e => participacaoDe(participacoes, e.id, me.id)?.confirmado === true)
  // Eventos agendados do meu elenco ainda sem resposta
  const pendentes = futuros.filter(e =>
    podeResponder(e, true).ok && (participacaoDe(participacoes, e.id, me.id)?.confirmado ?? null) === null)

  function responder(eventoId: string, confirmado: boolean) {
    if (!online()) return
    setParticipacoes(p => {
      const existe = p.some(x => x.eventoId === eventoId && x.usuarioId === me.id)
      return existe
        ? p.map(x => x.eventoId === eventoId && x.usuarioId === me.id ? { ...x, confirmado, respondidoEm: agora } : x)
        : [...p, { eventoId, usuarioId: me.id, confirmado, respondidoEm: agora, presente: null }]
    })
    showToast(confirmado ? 'Participação confirmada' : 'Você marcou que não vai', 'success')
  }

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 80% 0%,rgba(225,29,72,.16),transparent 55%), radial-gradient(ellipse at 15% 100%,rgba(37,99,235,.14),transparent 55%)' }} />
        <div className="absolute top-4 right-4 z-10"><DemoButton onClick={onDemo} /></div>
        <div className="relative flex flex-col items-center gap-3">
          <Av s={initials(me.nome)} size={76} bg={`linear-gradient(135deg,${C.red},${C.redD} 55%,#1e3a8a)`} />
          <div className="text-center px-4">
            <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>{me.nome}</h2>
            <p className="f-mono text-[11px] mt-px" style={{ color: C.muted }}>{me.email}</p>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <Chip label={ROLE_LABEL[me.role].toUpperCase()} color={C.red} />
              <Chip label={ATLETICA.sigla} color={C.muted} />
              {meusTimes.map(t => <Chip key={t.id} label={t.nome.toUpperCase()} color={C.blue} />)}
            </div>
          </div>
          {/* Estatísticas (RF26 / RN32) */}
          <div className="flex items-center gap-8 mt-1">
            {[
              { label: 'Jogos', v: stats.jogos },
              { label: 'Treinos', v: stats.treinos },
              { label: 'Presença', v: stats.taxa === null ? '—' : `${stats.taxa}%` },
            ].map(({ label, v }) => (
              <div key={label} className="text-center">
                <div className="f-sora font-black text-2xl" style={{ color: C.red }}>{v}</div>
                <div className="f-mono text-[10px]" style={{ color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <p className="f-mono text-[9px] text-center" style={{ color: C.dim }}>
            Contam apenas presenças registradas pela diretoria
          </p>
        </div>
      </div>

      {canAccessPanel(me.role) && (
        <div className="px-4">
          <button onClick={() => setScreen('painel')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-95 transition-all"
            style={{ background: C.red + '18', border: `1px solid rgba(225,29,72,.22)` }}>
            <div className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: C.red + '22' }}>
              <IcoCode size={18} color={C.red} />
            </div>
            <div className="flex-1 text-left">
              <div className="f-sora font-bold text-sm" style={{ color: C.text }}>Painel da Diretoria</div>
              <div className="f-mono text-[10px]" style={{ color: C.muted }}>Gerenciar eventos, times e mais</div>
            </div>
            <span className="f-mono text-xs" style={{ color: C.red }}>→</span>
          </button>
        </div>
      )}

      {/* UC10 A1: sem time */}
      {meusTimes.length === 0 && (
        <div className="px-4">
          <Card pad="p-4">
            <p className="f-sora font-semibold text-sm mb-1" style={{ color: C.text }}>Você ainda não faz parte de um time</p>
            <p className="f-mono text-[10px] mb-3" style={{ color: C.muted }}>Escolha um time e envie uma solicitação de entrada.</p>
            <button onClick={() => setScreen('modalidades')}
              className="px-4 py-2 rounded-xl f-sora font-semibold text-xs"
              style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
              Ver times
            </button>
          </Card>
        </div>
      )}

      {/* Meus próximos eventos confirmados */}
      {meusTimes.length > 0 && (
        <div className="px-4">
          <SH title="Meus próximos eventos confirmados" sub={confirmados.length ? `${confirmados.length} evento${confirmados.length !== 1 ? 's' : ''}` : undefined} />
          {confirmados.length === 0
            ? <p className="f-mono text-xs py-2 text-center" style={{ color: C.muted }}>Nenhuma participação confirmada</p>
            : (
              <div className="flex flex-col gap-2">
                {confirmados.map(ev => <EventoCard key={ev.id} ev={ev} onClick={() => abrirEvento(ev.id)} right={<IcoChev />} />)}
              </div>
            )}
        </div>
      )}

      {/* Responder participação */}
      {pendentes.length > 0 && (
        <div className="px-4">
          <SH title="Responder participação" sub="Você pode alterar a resposta até o início" />
          <div className="flex flex-col gap-2">
            {pendentes.map(ev => {
              const t = times.find(x => x.id === ev.timeId)
              return (
                <Card key={ev.id} pad="p-3">
                  <button className="w-full text-left mb-2" onClick={() => abrirEvento(ev.id)}>
                    <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>
                      {ev.tipo === 'JOGO' ? 'Jogo' : 'Treino'} — {t?.nome}
                    </span>
                    <div className="f-mono text-[10px]" style={{ color: C.muted }}>{fmtCard(ev.inicio)} · {ev.local}</div>
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => responder(ev.id, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl f-sora font-semibold text-xs active:scale-95"
                      style={{ background: C.green + '1a', color: C.green, border: `1px solid ${C.green}44` }}>
                      <IcoCheck size={12} /> Vou
                    </button>
                    <button onClick={() => responder(ev.id, false)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl f-sora font-semibold text-xs active:scale-95"
                      style={{ background: '#f43f5e1a', color: '#f43f5e', border: '1px solid rgba(244,63,94,.3)' }}>
                      <IcoX size={12} /> Não vou
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4">
        <button onClick={() => setView('settings')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          <IcoUser size={17} color={C.muted} />
          <span className="flex-1 f-sora font-medium text-sm text-left" style={{ color: C.text }}>Configurações</span>
          <ChevR />
        </button>
      </div>
    </div>
  )
}

export default function PerfilScreen({ onDemo, prefs, setPrefs }:
  { onDemo: () => void; prefs: Prefs; setPrefs: (f: (p: Prefs) => Prefs) => void }) {
  const [view, setView] = useState<PView>('main')
  const toSettings = () => setView('settings')

  if (view === 'settings')        return <SettingsMenu onBack={() => setView('main')} setView={setView} />
  if (view === 'edit-profile')    return <EditProfile onBack={toSettings} />
  if (view === 'change-password') return <ChangePassword onBack={toSettings} />
  if (view === 'notif-settings')  return <NotifSettings prefs={prefs} setPrefs={setPrefs} onBack={toSettings} />
  if (view === 'about')           return <About onBack={toSettings} />
  if (view === 'delete-account')  return <DeleteAccount onBack={toSettings} />
  return <ProfileMain setView={setView} onDemo={onDemo} />
}
