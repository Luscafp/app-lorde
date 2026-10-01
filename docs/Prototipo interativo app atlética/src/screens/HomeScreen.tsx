import { useState } from 'react'
import { C, ATLETICA } from '../theme'
import { fmtCard, fmtShortDate, fmtFull, canAccessPanel } from '../utils'
import { Card, SH, Chip, Av, Pill, IcoChev, IcoCode, IcoTrophy, IcoCal, IcoSport, IcoBack, IcoNewspaper } from '../components/atoms'
import { EmptyState } from '../components/shared'
import { useApp } from '../AppContext'
import type { Noticia } from '../types'

type HView = 'home' | 'news-list' | 'news-detail'

// ─── News detail ──────────────────────────────────────────────────────────────
function NewsDetail({ n, onBack }: { n: Noticia; onBack: () => void }) {
  return (
    <div className="flex flex-col pb-4 a-up">
      {/* Hero image */}
      <div className="relative" style={{ height: 200, background: n.imagem }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(7,9,13,.9))' }} />
        <button onClick={onBack}
          className="absolute top-4 left-4 flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', border: `1px solid ${C.bdr}` }}>
          <IcoBack />
        </button>
      </div>
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {n.tags.map(t => <Chip key={t} label={t} color={C.red} />)}
          <Chip label={fmtShortDate(n.data)} color={C.muted} />
        </div>
        <h2 className="f-sora font-black text-2xl leading-tight mb-4" style={{ color: C.text }}>{n.titulo}</h2>
        <p className="f-mono text-xs leading-loose" style={{ color: C.muted }}>{n.conteudo}</p>
      </div>
    </div>
  )
}

// ─── News list ────────────────────────────────────────────────────────────────
function NewsList({ onBack, onSelect }: { onBack: () => void; onSelect: (n: Noticia) => void }) {
  const { noticias: NOTICIAS } = useApp()
  const published = NOTICIAS.filter(n => n.status === 'Publicada')
  const allTags = Array.from(new Set(published.flatMap(n => n.tags)))
  const [tag, setTag] = useState<string | null>(null)

  const filtered = tag ? published.filter(n => n.tags.includes(tag)) : published
  const sorted = [...filtered].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      <div className="px-4 pt-5 flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
          <IcoBack />
        </button>
        <div>
          <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>Notícias</h2>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{sorted.length} publicações</p>
        </div>
      </div>
      {/* Tag filter */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-1">
        <Pill label="Todas" active={tag === null} color={C.red} onClick={() => setTag(null)} />
        {allTags.map(t => (
          <Pill key={t} label={t} active={tag === t} color={C.red} onClick={() => setTag(tag === t ? null : t)} />
        ))}
      </div>
      {/* List */}
      <div className="flex flex-col gap-3 px-4">
        {sorted.length === 0
          ? <EmptyState message="Nenhuma notícia com esta tag" action="Ver todas" onAction={() => setTag(null)} />
          : sorted.map(n => (
            <Card key={n.id} onClick={() => onSelect(n)} pad="p-0">
              <div className="rounded-t-2xl" style={{ height: 130, background: n.imagem }} />
              <div className="p-4">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {n.tags.map(t => <Chip key={t} label={t} color={C.red} />)}
                </div>
                <h3 className="f-sora font-bold text-base leading-tight mb-1.5" style={{ color: C.text }}>{n.titulo}</h3>
                <p className="f-mono text-[10px] line-clamp-2 mb-2" style={{ color: C.muted }}>{n.conteudo}</p>
                <span className="f-mono text-[10px]" style={{ color: C.dim }}>{fmtFull(n.data)}</span>
              </div>
            </Card>
          ))}
      </div>
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function HomeMain({ onNewsAll, onNewsDetail }: { onNewsAll: () => void; onNewsDetail: (n: Noticia) => void }) {
  const {
    role, setScreen, banners: BANNERS, eventos: EVENTOS, times: TIMES,
    atleticas: ATLETICAS, noticias: NOTICIAS, modalidades: MODALIDADES,
  } = useApp()
  const [bannerIdx, setBannerIdx] = useState(0)

  const activeBanners = BANNERS.filter(b => b.ativo).sort((a, b) => a.ordem - b.ordem)
  const banner = activeBanners[bannerIdx] ?? activeBanners[0]

  const proxEvents = EVENTOS
    .filter(e => {
      const time = TIMES.find(t => t.id === e.timeLordeId)
      const mod = MODALIDADES.find(m => m.id === time?.modalidadeId)
      return time?.ativo !== false && mod?.ativa !== false && (e.status === 'Agendado' || e.status === 'Em andamento')
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 4)

  const noticias = NOTICIAS.filter(n => n.status === 'Publicada')
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 pt-5">
        <div>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>// Bem-vindo de volta</p>
          <h1 className="f-sora font-black text-xl" style={{ color: C.text }}>{ATLETICA.nome}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canAccessPanel(role) && (
            <button onClick={() => setScreen('painel')}
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: C.red + '22', border: `1px solid ${C.bdrR}` }}>
              <IcoCode size={16} color={C.red} />
            </button>
          )}
          <button onClick={() => setScreen('perfil')}>
            <Av s="GL" size={38} bg={`linear-gradient(135deg,${C.red},${C.redD})`} />
          </button>
        </div>
      </div>

      {/* Banner carrossel */}
      {activeBanners.length > 0 && banner && (
        <div className="px-4">
          <button className="w-full relative rounded-2xl overflow-hidden active:scale-[.98] transition-all"
            style={{ height: 138, background: banner.imagem }}
            onClick={() => banner.link && {}}>
            <svg className="absolute inset-0 w-full h-full opacity-[.06]" preserveAspectRatio="none">
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={i} x1={`${i * 14}%`} y1="0" x2={`${i * 14}%`} y2="100%" stroke="#fff" strokeWidth="1" />
              ))}
            </svg>
            <div className="absolute right-[-24px] top-[-24px] rounded-full opacity-[.08]"
              style={{ width: 140, height: 140, background: '#fff' }} />
            <div className="relative z-10 p-4 flex flex-col justify-between h-full">
              <div className="flex items-center gap-2">
                <IcoTrophy size={13} color={C.yellow} />
                <span className="f-mono text-[9px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.55)' }}>
                  {ATLETICA.sigla}
                </span>
              </div>
              <h2 className="f-sora font-black text-xl text-white leading-tight">{banner.titulo}</h2>
            </div>
            {activeBanners.length > 1 && (
              <div className="absolute bottom-3 right-4 flex gap-1.5">
                {activeBanners.map((_, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setBannerIdx(i) }}
                    className="rounded-full transition-all"
                    style={{ width: i === bannerIdx ? 20 : 6, height: 6, background: i === bannerIdx ? '#fff' : 'rgba(255,255,255,.3)' }} />
                ))}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Quick access */}
      <div className="px-4 grid grid-cols-4 gap-2">
        {([
          { Icon: IcoCal,       label: 'Agenda',    sc: 'agenda'      as const, color: C.blue   },
          { Icon: IcoTrophy,    label: 'Placar',     sc: 'agenda'      as const, color: C.yellow  },
          { Icon: IcoSport,     label: 'Times',      sc: 'modalidades' as const, color: C.red     },
          { Icon: IcoNewspaper, label: 'Notícias',   sc: null,                   color: C.muted   },
        ] as { Icon: React.FC<{ size: number; color: string }>; label: string; sc: 'agenda' | 'modalidades' | null; color: string }[]).map(({ Icon, label, sc, color }) => (
          <button key={label}
            onClick={() => sc ? setScreen(sc) : onNewsAll()}
            className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl active:scale-95 transition-all"
            style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
            <Icon size={20} color={color} />
            <span className="text-[10px] font-medium" style={{ color: C.muted }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Próximos eventos */}
      <div className="px-4">
        <SH title="Próximos Eventos" action="Ver agenda" onAction={() => setScreen('agenda')} />
        {proxEvents.length === 0
          ? <p className="f-mono text-xs py-4 text-center" style={{ color: C.muted }}>Nenhum evento agendado</p>
          : (
            <div className="flex flex-col gap-2">
              {proxEvents.map(ev => {
                const tl    = TIMES.find(t => t.id === ev.timeLordeId)
                const ta    = ev.timeAdvId ? TIMES.find(t => t.id === ev.timeAdvId) : null
                const atl   = ta ? ATLETICAS.find(a => a.id === ta.atleticaId) : null
                const mod   = MODALIDADES.find(m => m.id === tl?.modalidadeId)
                const isLive = ev.status === 'Em andamento'
                const isCancelled = ev.status === 'Cancelado'
                return (
                  <Card key={ev.id} pad="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center rounded-xl shrink-0"
                        style={{ width: 44, height: 44, background: (ev.tipo === 'JOGO' ? C.red : C.blue) + '1a', border: `1px solid ${(ev.tipo === 'JOGO' ? C.red : C.blue)}33`, opacity: isCancelled ? .5 : 1 }}>
                        <span className="text-lg">{mod?.emoji ?? '🏅'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-px flex-wrap">
                          <Chip label={isCancelled ? '✕ CANCELADO' : ev.tipo} color={isCancelled ? '#f43f5e' : ev.tipo === 'JOGO' ? C.red : C.blue} />
                          {isLive && <Chip label="AO VIVO" color={C.green} />}
                          {ev.recorrente && !isCancelled && <Chip label="↺ SÉRIE" color={C.muted} />}
                        </div>
                        <p className="f-sora font-semibold text-sm truncate" style={{ color: isCancelled ? C.muted : C.text, textDecoration: isCancelled ? 'line-through' : 'none' }}>
                          {tl?.nome}{atl ? ` × ${atl.nome}` : ''}
                        </p>
                        <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>{fmtCard(ev.inicio)}</p>
                      </div>
                      <IcoChev />
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
      </div>

      {/* Últimas notícias */}
      <div className="px-4">
        <SH title="Últimas Notícias" action="Ver todas" onAction={onNewsAll} />
        {noticias.length === 0
          ? <EmptyState message="Nenhuma notícia publicada" />
          : (
            <div className="flex flex-col gap-2">
              {noticias.map(n => (
                <Card key={n.id} onClick={() => onNewsDetail(n)} pad="p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl shrink-0" style={{ width: 50, height: 50, background: n.imagem }} />
                    <div className="flex-1 min-w-0">
                      <p className="f-sora font-semibold text-sm leading-tight line-clamp-2" style={{ color: C.text }}>
                        {n.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {n.tags.slice(0, 2).map(tag => <Chip key={tag} label={tag} color={C.red} />)}
                        <span className="f-mono text-[10px]" style={{ color: C.muted }}>{fmtShortDate(n.data)}</span>
                      </div>
                    </div>
                    <IcoChev />
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [view, setView] = useState<HView>('home')
  const [selectedNews, setSelectedNews] = useState<Noticia | null>(null)

  if (view === 'news-detail' && selectedNews) {
    return <NewsDetail n={selectedNews} onBack={() => setView('news-list')} />
  }
  if (view === 'news-list') {
    return <NewsList onBack={() => setView('home')} onSelect={n => { setSelectedNews(n); setView('news-detail') }} />
  }
  return (
    <HomeMain
      onNewsAll={() => setView('news-list')}
      onNewsDetail={n => { setSelectedNews(n); setView('news-detail') }}
    />
  )
}
