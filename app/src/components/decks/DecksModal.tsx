import React, { useEffect, useState } from 'react'
import { BookOpen, Download, Layers, Loader2, RefreshCw, X } from 'lucide-react'
import { deckCardIds, getDecksState, type DeckState } from '../../db/decks'
import {
  downloadBlock,
  fetchIndex,
  fetchManifest,
  type DeckBlockMeta,
  type DeckManifest,
  type DeckSummary,
} from '../../domain/deckDownloader'

interface DecksModalProps {
  isOpen: boolean
  onClose: () => void
  /** Se llama tras una descarga para refrescar conteos del dashboard. */
  onDownloaded?: () => void
  /** Vincula la sesión de Google (la API exige cookie de servidor). */
  onLogin?: () => void
  /** Inicia un repaso con las tarjetas descargadas de un mazo. */
  onStudyDeck?: (cardIds: string[]) => void
}

export const DecksModal: React.FC<DecksModalProps> = ({
  isOpen,
  onClose,
  onDownloaded,
  onLogin,
  onStudyDeck,
}) => {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [manifests, setManifests] = useState<Record<string, DeckManifest>>({})
  const [state, setState] = useState<DeckState>({ blocks: {}, nextDayIndex: 0 })
  const [newPerDay, setNewPerDay] = useState(20)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function load() {
      setError(null)
      setMessage(null)
      setNeedsAuth(false)
      try {
        const index = await fetchIndex()
        if (cancelled) return
        setDecks(index.decks)
        setNewPerDay(index.new_per_day ?? 20)

        const loaded = await Promise.all(
          index.decks.map((d) => fetchManifest(d.id).catch(() => null)),
        )
        if (cancelled) return
        const byId: Record<string, DeckManifest> = {}
        for (const m of loaded) {
          if (m) byId[m.id] = m
        }
        setManifests(byId)
        setState(await getDecksState())
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : 'No se pudieron cargar los mazos'
          if (msg.includes('401')) {
            setNeedsAuth(true)
            setError('Inicia sesión para descargar los mazos.')
          } else {
            setError(msg)
          }
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  async function handleUpdateDeck(
    deckId: string,
    title: string,
    blocks: DeckBlockMeta[],
  ) {
    setBusy(`deck:${deckId}`)
    setError(null)
    setMessage(null)
    try {
      for (const block of blocks) {
        await downloadBlock(deckId, block.file, newPerDay, Date.now(), block.hash)
      }
      setState(await getDecksState())
      setMessage(`${title}: ${blocks.length} bloque(s) actualizado(s)`)
      onDownloaded?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar el mazo')
    } finally {
      setBusy(null)
    }
  }

  async function handleDownload(deckId: string, file: string, hash: string) {
    const key = `${deckId}/${file}`
    setBusy(key)
    setMessage(null)
    try {
      const result = await downloadBlock(deckId, file, newPerDay, Date.now(), hash)
      setState(await getDecksState())
      setMessage(
        `${deckId} ${file}: ${result.added} nuevas, ${result.removed} retiradas`,
      )
      onDownloaded?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar el bloque')
    } finally {
      setBusy(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="clinical-home flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-[var(--ch-border-strong)] bg-[var(--ch-bg-elevated)] text-[var(--ch-text-primary)] shadow-[var(--ch-shadow-modal)]">
        <header className="flex items-center justify-between border-b border-[var(--ch-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--ch-accent)]" />
            <h2 className="m-0 text-base font-bold">Mazos de estudio</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-[var(--ch-bg-muted)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mt-0 text-xs text-[var(--ch-text-secondary)]">
            Descarga los bloques que quieras estudiar. Cada bloque se reparte a{' '}
            {newPerDay} tarjetas nuevas por día.
          </p>

          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
              {message}
            </p>
          )}

          {needsAuth && onLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="mb-3 w-full rounded-lg bg-[var(--ch-accent-solid)] px-3 py-2 text-xs font-semibold text-white"
            >
              Iniciar sesión con Google
            </button>
          )}

          {decks.length === 0 && !error && (
            <p className="text-xs text-[var(--ch-text-secondary)]">
              No hay mazos publicados todavía.
            </p>
          )}

          {decks.map((deck) => {
            const manifest = manifests[deck.id]
            const cardIds = deckCardIds(state, deck.id)
            const outdated = (manifest?.blocks ?? []).filter((block) => {
              const saved = state.blocks[`${deck.id}/${block.file}`]
              return saved && saved.hash !== block.hash
            })
            const deckBusy = busy === `deck:${deck.id}`
            return (
              <section
                key={deck.id}
                className="mt-3 rounded-xl border border-[var(--ch-border)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-sm font-bold">{deck.title}</h3>
                  <span className="font-mono text-xs text-[var(--ch-text-secondary)]">
                    {deck.cards} tarjetas
                  </span>
                </div>

                {cardIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {onStudyDeck && (
                      <button
                        type="button"
                        onClick={() => onStudyDeck(cardIds)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ch-accent-solid)] px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <BookOpen className="h-3 w-3" />
                        Estudiar este mazo ({cardIds.length})
                      </button>
                    )}
                    {outdated.length > 0 && (
                      <button
                        type="button"
                        disabled={deckBusy}
                        onClick={() =>
                          void handleUpdateDeck(deck.id, deck.title, outdated)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ch-border)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--ch-bg-muted)] disabled:opacity-60"
                      >
                        {deckBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {deckBusy
                          ? 'Actualizando…'
                          : `Actualizar mazo (${outdated.length})`}
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {(manifest?.blocks ?? []).map((block) => {
                    const key = `${deck.id}/${block.file}`
                    const saved = state.blocks[key]
                    const upToDate = saved?.hash === block.hash
                    const isBusy = busy === key
                    return (
                      <button
                        key={block.file}
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDownload(deck.id, block.file, block.hash)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ch-border)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--ch-bg-muted)] disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : upToDate ? (
                          <RefreshCw className="h-3 w-3" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        {isBusy
                          ? 'Descargando…'
                          : upToDate
                            ? `${block.file} al día`
                            : saved
                              ? `Actualizar ${block.file}`
                              : `Bajar ${block.file} (${block.count})`}
                      </button>
                    )
                  })}
                  {!manifest && (
                    <span className="text-xs text-[var(--ch-text-secondary)]">
                      Cargando bloques…
                    </span>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

