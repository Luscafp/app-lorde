import { useState, useRef } from 'react'
import { C } from '../../theme'
import { fmtFull, canDelete, nowLocal } from '../../utils'
import { Card, Chip, Pill, IcoBack, IcoPlus, IcoX, IcoBin, IcoEdit, IcoImage } from '../../components/atoms'
import { EmptyState, Field } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Noticia, Banner } from '../../types'

// Imagens simuladas (no app real: upload com redimensionamento para até 1080 px e 5 MB — RNF04)
const GRADIENTS = [
  { id: 'g1', bg: 'linear-gradient(135deg,#e11d48,#9f1239)' },
  { id: 'g2', bg: 'linear-gradient(135deg,#2563eb,#1e3a8a)' },
  { id: 'g3', bg: 'linear-gradient(135deg,#7c3aed,#4c1d95)' },
  { id: 'g4', bg: 'linear-gradient(135deg,#0891b2,#164e63)' },
  { id: 'g5', bg: 'linear-gradient(135deg,#059669,#064e3b)' },
  { id: 'g6', bg: 'linear-gradient(135deg,#d97706,#92400e)' },
]

function ImagemPicker({ label, value, onChange, height }: { label: string; value: string; onChange: (v: string) => void; height: number }) {
  return (
    <div>
      <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>{label}</label>
      <div className="rounded-2xl mb-2 flex items-center justify-center" style={{ height, background: value }}>
        <IcoImage size={28} color="rgba(255,255,255,.3)" />
      </div>
      <div className="flex gap-1.5 flex-wrap items-center">
        {GRADIENTS.map(g => (
          <button key={g.id} onClick={() => onChange(g.bg)}
            className="rounded-xl transition-all"
            style={{ width: 36, height: 24, background: g.bg, border: `2px solid ${value === g.bg ? '#fff' : 'transparent'}` }} />
        ))}
        <span className="f-mono text-[9px] ml-1" style={{ color: C.dim }}>JPG/PNG até 5 MB · redimensionada para 1080 px</span>
      </div>
    </div>
  )
}

// ─── Editor de notícia (UC21) ─────────────────────────────────────────────────
function NoticiaEditor({ initial, onBack }: { initial?: Noticia; onBack: () => void }) {
  const { me, role, setNoticias, showToast, showConfirm, audit, online } = useApp()
  const [titulo, setTitulo]     = useState(initial?.titulo ?? '')
  const [conteudo, setConteudo] = useState(initial?.conteudo ?? '')
  const [imagem, setImagem]     = useState(initial?.imagem ?? GRADIENTS[0].bg)
  const [tags, setTags]         = useState<string[]>(initial?.tags ?? [])
  const [novaTag, setNovaTag]   = useState('')
  const [err, setErr]           = useState<string | undefined>()
  const textRef = useRef<HTMLTextAreaElement>(null)

  function insertFormat(open: string, close: string) {
    const ta = textRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const next = conteudo.slice(0, s) + open + conteudo.slice(s, e) + close + conteudo.slice(e)
    setConteudo(next)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + open.length, e + open.length) }, 0)
  }

  function addTag() {
    const t = novaTag.trim().toUpperCase()
    if (t && !tags.includes(t)) setTags(p => [...p, t])
    setNovaTag('')
  }

  function salvar(status: 'Rascunho' | 'Publicada') {
    if (!titulo.trim()) { setErr('Informe o título'); return }
    if (!online()) return
    const agora = nowLocal()
    const publicando = status === 'Publicada' && initial?.status !== 'Publicada'
    const n: Noticia = {
      id: initial?.id ?? `n${Date.now()}`,
      titulo: titulo.trim(), conteudo, imagem, tags, status,
      criadaEm: initial?.criadaEm ?? agora,
      autorId: status === 'Publicada' ? (publicando ? me.id : initial?.autorId ?? me.id) : initial?.autorId,
      publicadaEm: status === 'Publicada' ? (publicando ? agora : initial?.publicadaEm) : undefined,
    }
    setNoticias(p => initial ? p.map(x => x.id === n.id ? n : x) : [n, ...p])
    const acao = status === 'Rascunho'
      ? (initial?.status === 'Publicada' ? 'Despublicou notícia' : 'Salvou rascunho')
      : (publicando ? 'Publicou notícia' : 'Editou notícia')
    audit('Notícias', acao, n.titulo)
    showToast(publicando ? 'Notícia publicada — usuários notificados'
      : acao === 'Despublicou notícia' ? 'Notícia despublicada' : 'Notícia salva', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base flex-1" style={{ color: C.text }}>
          {initial ? 'Editar notícia' : 'Nova notícia'}
        </h3>
        {initial && <Chip label={initial.status.toUpperCase()} color={initial.status === 'Publicada' ? C.green : C.yellow} />}
      </div>

      <ImagemPicker label="Imagem de capa" value={imagem} onChange={setImagem} height={100} />
      <Field label="Título" value={titulo} onChange={v => { setTitulo(v); setErr(undefined) }} placeholder="Título da notícia" error={err} />

      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Conteúdo</label>
        <div className="flex gap-1.5 mb-1.5">
          {[
            { label: 'B', title: 'Negrito', action: () => insertFormat('**', '**') },
            { label: '≡', title: 'Lista', action: () => insertFormat('\n- ', '') },
            { label: '🔗', title: 'Link', action: () => insertFormat('[texto](https://', ')') },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action} title={btn.title}
              className="px-2.5 py-1 rounded-lg f-mono text-[11px] font-bold"
              style={{ background: C.card2, color: C.text, border: `1px solid ${C.bdr}` }}>
              {btn.label}
            </button>
          ))}
        </div>
        <textarea ref={textRef} value={conteudo} onChange={e => setConteudo(e.target.value)}
          placeholder="Conteúdo da notícia..." rows={6}
          className="w-full px-4 py-3 rounded-xl f-mono text-xs outline-none resize-none leading-loose"
          style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
      </div>

      {/* Tags (RN25) */}
      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(t => (
            <button key={t} onClick={() => setTags(p => p.filter(x => x !== t))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full f-mono text-[10px] font-semibold"
              style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}>
              {t} <IcoX size={10} color={C.red} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={novaTag} onChange={e => setNovaTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Nova tag..."
            className="flex-1 px-3 py-2 rounded-xl f-mono text-xs outline-none"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
          <button onClick={addTag} className="flex items-center justify-center rounded-xl px-3" style={{ background: C.red + '22' }}>
            <IcoPlus size={14} color={C.red} />
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {initial?.status !== 'Publicada' && (
          <button onClick={() => salvar('Rascunho')}
            className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>
            Salvar rascunho
          </button>
        )}
        <button onClick={() => salvar('Publicada')}
          className="flex-1 py-3 rounded-2xl f-sora font-bold text-sm"
          style={{ background: C.red, color: '#fff' }}>
          {initial?.status === 'Publicada' ? 'Salvar alterações' : 'Publicar'}
        </button>
      </div>
      {initial?.status === 'Publicada' && (
        <button onClick={() => salvar('Rascunho')}
          className="w-full py-3 rounded-2xl f-sora font-semibold text-sm"
          style={{ background: C.yellow + '18', color: C.yellow, border: `1px solid ${C.yellow}33` }}>
          Despublicar (voltar a rascunho)
        </button>
      )}
      {initial && canDelete(role) && (
        <button onClick={() => showConfirm('Excluir notícia', `Excluir "${initial.titulo}"?`, () => {
          if (!online()) return
          setNoticias(p => p.filter(x => x.id !== initial.id))
          audit('Notícias', 'Excluiu notícia', initial.titulo)
          showToast('Notícia excluída', 'success')
          onBack()
        }, 'Excluir')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl f-sora font-semibold text-sm"
          style={{ background: '#f43f5e1a', color: '#f43f5e', border: '1px solid rgba(244,63,94,.25)' }}>
          <IcoBin size={14} color="#f43f5e" /> Excluir notícia
        </button>
      )}
    </div>
  )
}

// ─── Seção Notícias ───────────────────────────────────────────────────────────
export function NoticiasSection() {
  const { noticias, nomeUsuario } = useApp()
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [selId, setSelId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'Todas' | 'Rascunho' | 'Publicada'>('Todas')

  const ordem = (n: Noticia) => n.publicadaEm ?? n.criadaEm
  const filtered = noticias.filter(n => filter === 'Todas' || n.status === filter)
    .sort((a, b) => ordem(b).localeCompare(ordem(a)))

  if (view === 'editor') {
    return (
      <div className="px-4">
        <NoticiaEditor initial={noticias.find(n => n.id === selId)} onBack={() => { setView('list'); setSelId(null) }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {([['Todas', 'Todas'], ['Publicada', 'Publicadas'], ['Rascunho', 'Rascunhos']] as const).map(([f, l]) => (
          <Pill key={f} label={l} active={filter === f} color={f === 'Publicada' ? C.green : f === 'Rascunho' ? C.yellow : C.muted} onClick={() => setFilter(f)} />
        ))}
      </div>
      <button onClick={() => { setSelId(null); setView('editor') }}
        className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
        style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
        <IcoPlus size={15} /> Nova notícia
      </button>
      {filtered.length === 0
        ? <EmptyState message="Nenhuma notícia" />
        : filtered.map(n => (
          <Card key={n.id} pad="p-3" onClick={() => { setSelId(n.id); setView('editor') }}>
            <div className="flex items-start gap-3">
              <div className="rounded-xl shrink-0" style={{ width: 48, height: 48, background: n.imagem }} />
              <div className="flex-1 min-w-0">
                <div className="f-sora font-semibold text-sm leading-tight" style={{ color: C.text }}>{n.titulo}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Chip label={n.status.toUpperCase()} color={n.status === 'Publicada' ? C.green : C.yellow} />
                  {n.tags.slice(0, 2).map(t => <Chip key={t} label={t} color={C.muted} />)}
                </div>
                <div className="f-mono text-[9px] mt-1" style={{ color: C.dim }}>
                  {n.status === 'Publicada' && n.publicadaEm
                    ? `Publicada por ${n.autorId ? nomeUsuario(n.autorId) : '—'} em ${fmtFull(n.publicadaEm)}`
                    : `Rascunho criado em ${fmtFull(n.criadaEm)}`}
                </div>
              </div>
              <IcoEdit size={14} />
            </div>
          </Card>
        ))}
    </div>
  )
}

// ─── Formulário de banner (UC22) ──────────────────────────────────────────────
function BannerForm({ initial, onBack }: { initial?: Banner; onBack: () => void }) {
  const { setBanners, showToast, audit, online } = useApp()
  const [titulo, setTitulo] = useState(initial?.titulo ?? '')
  const [imagem, setImagem] = useState(initial?.imagem ?? GRADIENTS[0].bg)
  const [link, setLink]     = useState(initial?.link ?? '')
  const [ativo, setAtivo]   = useState(initial?.ativo ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function save() {
    const e: Record<string, string> = {}
    if (!titulo.trim()) e.titulo = 'Informe o título'
    // RN34 / UC22 A2: link opcional, mas sempre HTTPS
    if (link.trim() && !/^https:\/\/\S+\.\S+/.test(link.trim())) e.link = 'O link deve começar com https://'
    setErrors(e)
    if (Object.keys(e).length || !online()) return
    const dados = { titulo: titulo.trim(), imagem, link: link.trim() || undefined, ativo }
    if (initial) setBanners(p => p.map(b => b.id === initial.id ? { ...b, ...dados } : b))
    else setBanners(p => [...p, { id: `b${Date.now()}`, ...dados, ordem: Math.max(0, ...p.map(b => b.ordem)) + 1 }])
    audit('Banners', initial ? 'Editou banner' : 'Criou banner', dados.titulo)
    showToast(initial ? 'Banner atualizado' : 'Banner criado', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>{initial ? 'Editar banner' : 'Novo banner'}</h3>
      </div>
      <ImagemPicker label="Imagem" value={imagem} onChange={setImagem} height={80} />
      <Field label="Título" value={titulo} onChange={setTitulo} placeholder="Título do banner" error={errors.titulo} />
      <Field label="Link (opcional)" value={link} onChange={setLink} placeholder="https://..." error={errors.link} hint="Deve começar com https://" />
      <div className="flex items-center justify-between">
        <span className="f-sora font-medium text-sm" style={{ color: C.text }}>Ativo (exibido na Home)</span>
        <button onClick={() => setAtivo(v => !v)}
          className="rounded-full transition-all" style={{ width: 44, height: 24, background: ativo ? C.green : C.dim, padding: 3 }}>
          <div className="rounded-full transition-all" style={{ width: 18, height: 18, background: '#fff', transform: `translateX(${ativo ? 20 : 0}px)` }} />
        </button>
      </div>
      <button onClick={save}
        className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
        style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
        Salvar banner
      </button>
    </div>
  )
}

// ─── Seção Banners (UC22) ─────────────────────────────────────────────────────
export function BannersSection() {
  const { role, banners, setBanners, showToast, showConfirm, audit, online } = useApp()
  const [view, setView] = useState<'list' | 'form'>('list')
  const [selId, setSelId] = useState<string | null>(null)
  const ordenados = [...banners].sort((a, b) => a.ordem - b.ordem)

  function mover(id: string, delta: -1 | 1) {
    if (!online()) return
    const i = ordenados.findIndex(b => b.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= ordenados.length) return
    const nova = [...ordenados]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    const ordem = new Map(nova.map((b, k) => [b.id, k + 1]))
    setBanners(p => p.map(b => ({ ...b, ordem: ordem.get(b.id) ?? b.ordem })))
    audit('Banners', 'Reordenou banner', ordenados[i].titulo)
  }

  function toggle(b: Banner) {
    if (!online()) return
    setBanners(p => p.map(x => x.id === b.id ? { ...x, ativo: !x.ativo } : x))
    audit('Banners', b.ativo ? 'Desativou banner' : 'Ativou banner', b.titulo)
    showToast(b.ativo ? 'Banner desativado' : 'Banner ativado', 'success')
  }

  if (view === 'form') {
    return (
      <div className="px-4">
        <BannerForm initial={banners.find(b => b.id === selId)} onBack={() => { setView('list'); setSelId(null) }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <button onClick={() => { setSelId(null); setView('form') }}
        className="w-full py-3 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2 mb-1"
        style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
        <IcoPlus size={14} color={C.blueL} /> Novo banner
      </button>
      {ordenados.length === 0 ? <EmptyState message="Nenhum banner" /> : ordenados.map((b, i) => (
        <Card key={b.id} pad="p-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl shrink-0" style={{ width: 52, height: 38, background: b.imagem, opacity: b.ativo ? 1 : .5 }} />
            <div className="flex-1 min-w-0">
              <div className="f-sora font-semibold text-sm truncate" style={{ color: C.text }}>{b.titulo}</div>
              <div className="f-mono text-[9px] mt-px truncate" style={{ color: C.muted }}>#{b.ordem} · {b.link ?? 'sem link'}</div>
            </div>
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => mover(b.id, -1)} disabled={i === 0}
                className="px-1 py-0.5 rounded text-xs" style={{ color: i === 0 ? C.dim : C.muted }}>▲</button>
              <button onClick={() => mover(b.id, 1)} disabled={i === ordenados.length - 1}
                className="px-1 py-0.5 rounded text-xs" style={{ color: i === ordenados.length - 1 ? C.dim : C.muted }}>▼</button>
            </div>
            <button onClick={() => toggle(b)} title={b.ativo ? 'Ativo' : 'Inativo'}
              className="rounded-full transition-all shrink-0"
              style={{ width: 36, height: 20, background: b.ativo ? C.green : C.dim, padding: 2 }}>
              <div className="rounded-full transition-all"
                style={{ width: 16, height: 16, background: '#fff', transform: `translateX(${b.ativo ? 16 : 0}px)` }} />
            </button>
            <button onClick={() => { setSelId(b.id); setView('form') }}
              className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.blue + '22' }}>
              <IcoEdit size={14} />
            </button>
            {canDelete(role) && (
              <button onClick={() => showConfirm('Excluir banner', `Excluir "${b.titulo}"?`, () => {
                if (!online()) return
                setBanners(p => p.filter(x => x.id !== b.id))
                audit('Banners', 'Excluiu banner', b.titulo)
                showToast('Banner excluído', 'success')
              }, 'Excluir')} className="flex items-center justify-center rounded-lg p-1.5" style={{ background: '#f43f5e1a' }}>
                <IcoBin size={14} color="#f43f5e" />
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
