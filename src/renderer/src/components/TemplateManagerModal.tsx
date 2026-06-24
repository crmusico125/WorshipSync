import { useEffect, useMemo, useRef, useState } from "react"
import {
  Plus, Pencil, Copy, Trash2, ListTodo, BookOpen, Megaphone, Timer,
  Music2, Image as ImageIcon, Layers, GripVertical, X, Volume2,
} from "lucide-react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { fmtDur, toFileUrl } from "../lib/utils"

// ── Setlist templates ──────────────────────────────────────────────────────────

export interface SetlistTemplateItem {
  itemType: string
  songId?: number
  songTitle?: string
  title?: string
  scriptureRef?: string
  mediaPath?: string
}

export interface SetlistTemplate {
  id: string
  name: string
  createdAt: string
  updatedAt?: string
  items: SetlistTemplateItem[]
}

export function templateItemDuration(item: SetlistTemplateItem): number {
  if (item.itemType === 'countdown') return 300
  if (item.itemType === 'scripture') {
    try { return (JSON.parse(item.scriptureRef ?? '{}').verses ?? []).length * 12 } catch { return 0 }
  }
  return 0
}

function templateItemIcon(itemType: string) {
  switch (itemType) {
    case 'scripture': return BookOpen
    case 'announcement': return Megaphone
    case 'countdown': return Timer
    case 'media': return ImageIcon
    case 'song': default: return Music2
  }
}

const ADD_TEMPLATE_ITEM_OPTIONS: { type: string; label: string; icon: typeof Music2 }[] = [
  { type: 'section', label: 'Section', icon: Layers },
  { type: 'song', label: 'Song', icon: Music2 },
  { type: 'scripture', label: 'Scripture', icon: BookOpen },
  { type: 'announcement', label: 'Announcement', icon: Megaphone },
  { type: 'countdown', label: 'Countdown', icon: Timer },
  { type: 'media', label: 'Media', icon: ImageIcon },
]

function mediaItemMeta(path: string): { label: string; title: string } {
  const filename = path.split('/').pop() ?? 'Media'
  const isVideo = /\.(mp4|webm|mov)$/i.test(path)
  const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path)
  const label = isVideo ? 'Video' : isAudio ? 'Audio' : 'Image'
  return { label, title: `${label}: ${filename}` }
}

// ── Section color palette ─────────────────────────────────────────────────────

export const SECTION_PALETTE = [
  { dot: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-l-orange-500/60'  },
  { dot: 'bg-green-500',   text: 'text-green-400',   border: 'border-l-green-500/60'   },
  { dot: 'bg-blue-500',    text: 'text-blue-400',    border: 'border-l-blue-500/60'    },
  { dot: 'bg-violet-500',  text: 'text-violet-400',  border: 'border-l-violet-500/60'  },
  { dot: 'bg-cyan-500',    text: 'text-cyan-400',    border: 'border-l-cyan-500/60'    },
  { dot: 'bg-rose-500',    text: 'text-rose-400',    border: 'border-l-rose-500/60'    },
]
export const getSectionColor = (idx: number) => SECTION_PALETTE[idx % SECTION_PALETTE.length]

// ── SortableTemplateItem ──────────────────────────────────────────────────────

function SortableTemplateItem({
  id, item, colorIdx, isEditing, editValue,
  onEditStart, onEditChange, onEditCommit, onEditCancel, onRemove,
}: {
  id: number
  item: SetlistTemplateItem
  colorIdx: number
  isEditing: boolean
  editValue: string
  onEditStart: () => void
  onEditChange: (v: string) => void
  onEditCommit: () => void
  onEditCancel: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : undefined }
  const color = colorIdx >= 0 ? getSectionColor(colorIdx) : null
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (isEditing) inputRef.current?.focus() }, [isEditing])

  if (item.itemType === 'section') {
    return (
      <div ref={setNodeRef} style={style} className={`flex items-center gap-1.5 px-1 py-1.5 mt-2 first:mt-0 border-l-2 ${color?.border ?? 'border-l-transparent'}`}>
        <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none" tabIndex={-1}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${color?.dot ?? 'bg-muted-foreground'}`} />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onEditCommit}
            onKeyDown={e => {
              if (e.key === 'Enter') onEditCommit()
              if (e.key === 'Escape') onEditCancel()
            }}
            className="flex-1 bg-transparent text-[10px] font-bold uppercase tracking-wider outline-none min-w-0"
          />
        ) : (
          <button onClick={onEditStart} className={`flex-1 text-left text-[10px] font-bold uppercase tracking-wider truncate ${color?.text ?? 'text-muted-foreground'}`}>
            {item.title || 'Section'}
          </button>
        )}
        <button onClick={onRemove} className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  const Icon = templateItemIcon(item.itemType)
  const dur = fmtDur(templateItemDuration(item))
  const editable = item.itemType !== 'song' && item.itemType !== 'countdown'
  const title = item.itemType === 'song'
    ? (item.songTitle ?? 'Song')
    : item.itemType === 'countdown'
    ? 'Countdown Timer'
    : (item.title || (item.itemType === 'scripture' ? 'Scripture' : item.itemType === 'announcement' ? 'Announcement' : 'Media'))

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-md mb-1 border border-border bg-card"
    >
      <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none" tabIndex={-1}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onEditCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onEditCommit()
            if (e.key === 'Escape') onEditCancel()
          }}
          className="flex-1 bg-transparent text-xs outline-none min-w-0 border-b border-primary/40"
        />
      ) : (
        <span
          className={`text-xs font-medium truncate flex-1 min-w-0 ${editable ? 'cursor-text' : ''}`}
          onClick={editable ? onEditStart : undefined}
        >
          {title}
        </span>
      )}
      {dur && <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{dur}</span>}
      <button onClick={onRemove} className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── TemplateManagerModal ──────────────────────────────────────────────────────

export interface TemplateManagerModalProps {
  templates: SetlistTemplate[]
  /** Items in the active lineup. Omit (or leave undefined) when there's no active service. */
  lineupCount?: number
  applyingTemplate?: boolean
  onClose: () => void
  /** Create a template from the current lineup. Mutually exclusive with onNewBlank. */
  onNewFromLineup?: () => Promise<string | undefined>
  /** Create a new empty template. Used when there's no active lineup to copy from. */
  onNewBlank?: () => Promise<string | undefined>
  /** Append this template's items to the current lineup. Omit when there's no active service. */
  onApply?: (tpl: SetlistTemplate) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (tpl: SetlistTemplate) => Promise<string>
  onRename: (id: string, name: string) => Promise<void>
  onReorderItems: (id: string, oldIndex: number, newIndex: number) => Promise<void>
  onRemoveItem: (id: string, index: number) => Promise<void>
  onAddItem: (id: string, item: SetlistTemplateItem) => Promise<void>
  onUpdateItem: (id: string, index: number, patch: Partial<SetlistTemplateItem>) => Promise<void>
}

export function TemplateManagerModal({
  templates, lineupCount = 0, applyingTemplate = false, onClose,
  onNewFromLineup, onNewBlank, onApply, onDelete, onDuplicate, onRename,
  onReorderItems, onRemoveItem, onAddItem, onUpdateItem,
}: TemplateManagerModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [songQuery, setSongQuery] = useState("")
  const [songResults, setSongResults] = useState<{ id: number; title: string; artist: string }[]>([])
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaQuery, setMediaQuery] = useState("")
  const [mediaItems, setMediaItems] = useState<string[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editingItemValue, setEditingItemValue] = useState("")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Keep selection valid as templates are added/removed
  useEffect(() => {
    if (selectedId === null && templates.length > 0) { setSelectedId(templates[0].id); return }
    if (selectedId !== null && !templates.some(t => t.id === selectedId)) {
      setSelectedId(templates[0]?.id ?? null)
    }
  }, [templates, selectedId])

  useEffect(() => {
    if (!showSongPicker) return
    const t = setTimeout(async () => {
      const results = songQuery.trim()
        ? await window.worshipsync.songs.search(songQuery)
        : await window.worshipsync.songs.getAll()
      setSongResults(results.slice(0, 30))
    }, 200)
    return () => clearTimeout(t)
  }, [songQuery, showSongPicker])

  useEffect(() => {
    if (!showMediaPicker) return
    setMediaLoading(true)
    window.worshipsync.backgrounds.listImages()
      .then(setMediaItems)
      .finally(() => setMediaLoading(false))
  }, [showMediaPicker])

  const filteredMedia = useMemo(() => {
    const q = mediaQuery.trim().toLowerCase()
    if (!q) return mediaItems
    return mediaItems.filter(p => (p.split('/').pop() ?? '').toLowerCase().includes(q))
  }, [mediaItems, mediaQuery])

  const selectedTemplate = templates.find(t => t.id === selectedId) ?? null

  // Cluster items under their section header so they render visually nested,
  // mirroring the grouping in the main lineup view.
  const itemGroups = useMemo(() => {
    const items = selectedTemplate?.items ?? []
    const groups: { sectionIdx: number | null; colorIdx: number; childIdxs: number[] }[] = []
    let current: { sectionIdx: number | null; colorIdx: number; childIdxs: number[] } | null = null
    let colorIdx = -1
    items.forEach((item, i) => {
      if (item.itemType === 'section') {
        colorIdx++
        current = { sectionIdx: i, colorIdx, childIdxs: [] }
        groups.push(current)
      } else {
        if (!current) {
          current = { sectionIdx: null, colorIdx: -1, childIdxs: [] }
          groups.push(current)
        }
        current.childIdxs.push(i)
      }
    })
    return groups
  }, [selectedTemplate])

  const selectTemplate = (id: string) => {
    setSelectedId(id)
    setEditingName(false)
    setEditingItemIndex(null)
    setShowAddMenu(false)
    setShowSongPicker(false)
    setShowMediaPicker(false)
  }

  const handleNew = async () => {
    const id = onNewFromLineup ? await onNewFromLineup() : await onNewBlank?.()
    if (id) {
      setSelectedId(id)
      setEditingName(true)
      setNameDraft(onNewFromLineup ? "Untitled Template" : "New Template")
    }
  }

  const commitRename = () => {
    setEditingName(false)
    if (selectedTemplate && nameDraft.trim() && nameDraft.trim() !== selectedTemplate.name) {
      onRename(selectedTemplate.id, nameDraft.trim())
    }
  }

  const handleDuplicate = async () => {
    if (!selectedTemplate) return
    const id = await onDuplicate(selectedTemplate)
    setSelectedId(id)
  }

  const handleDelete = () => {
    if (!selectedTemplate) return
    if (confirm(`Delete template "${selectedTemplate.name}"? This cannot be undone.`)) {
      onDelete(selectedTemplate.id)
    }
  }

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedTemplate) return
    onReorderItems(selectedTemplate.id, Number(active.id), Number(over.id))
  }

  const handleAddOption = (type: string) => {
    setShowAddMenu(false)
    if (!selectedTemplate) return
    if (type === 'song') {
      setSongQuery("")
      setSongResults([])
      setShowMediaPicker(false)
      setShowSongPicker(true)
      return
    }
    if (type === 'media') {
      setMediaQuery("")
      setShowSongPicker(false)
      setShowMediaPicker(true)
      return
    }
    const defaults: Record<string, SetlistTemplateItem> = {
      section: { itemType: 'section', title: 'New Section' },
      scripture: { itemType: 'scripture', title: 'Scripture Reading', scriptureRef: JSON.stringify({ verses: [] }) },
      announcement: { itemType: 'announcement', title: 'Announcement', scriptureRef: '' },
      countdown: { itemType: 'countdown' },
    }
    const item = defaults[type]
    if (item) onAddItem(selectedTemplate.id, item)
  }

  const addSongItem = (song: { id: number; title: string; artist: string }) => {
    if (!selectedTemplate) return
    onAddItem(selectedTemplate.id, { itemType: 'song', songId: song.id, songTitle: song.title })
    setShowSongPicker(false)
  }

  const addMediaItem = (path: string) => {
    if (!selectedTemplate) return
    onAddItem(selectedTemplate.id, { itemType: 'media', title: mediaItemMeta(path).title, mediaPath: path })
    setShowMediaPicker(false)
  }

  const handleBrowseMedia = async () => {
    const path = await window.worshipsync.backgrounds.pickImage()
    if (path) addMediaItem(path)
  }

  const commitItemEdit = () => {
    if (editingItemIndex === null || !selectedTemplate) { setEditingItemIndex(null); return }
    const idx = editingItemIndex
    const trimmed = editingItemValue.trim()
    setEditingItemIndex(null)
    if (trimmed) onUpdateItem(selectedTemplate.id, idx, { title: trimmed })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden rounded-xl border border-border shadow-2xl"
        style={{ width: 720, maxWidth: "95vw" }}
      >
        <div className="flex flex-col bg-background text-foreground h-[32rem] max-h-[80vh]">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
            <DialogTitle className="text-base font-semibold">Setlist Templates</DialogTitle>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* ── Left: template list ── */}
            <div className="w-56 border-r border-border flex flex-col shrink-0">
              <div className="p-3 border-b border-border">
                <Button
                  variant="outline" size="sm" className="w-full gap-1.5 h-8 text-xs"
                  disabled={onNewFromLineup ? lineupCount === 0 : false}
                  onClick={handleNew}
                  title={onNewFromLineup && lineupCount === 0 ? "Add items to the lineup first" : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> {onNewFromLineup ? "New from current lineup" : "New template"}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-4 text-center">No templates yet</p>
                ) : (
                  templates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => selectTemplate(tpl.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                        selectedId === tpl.id ? 'bg-primary/10 border border-primary/30' : 'border border-transparent hover:bg-accent/50'
                      }`}
                    >
                      <p className={`text-xs font-medium truncate ${selectedId === tpl.id ? 'text-primary' : 'text-foreground'}`}>{tpl.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{tpl.items.length} item{tpl.items.length === 1 ? '' : 's'}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ── Right: editor ── */}
            <div className="flex-1 flex flex-col min-w-0">
              {!selectedTemplate ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-1">
                  <p className="text-sm font-medium text-foreground">No template selected</p>
                  <p className="text-xs text-muted-foreground">
                    {onNewFromLineup
                      ? (lineupCount === 0
                          ? "Add items to your lineup, then save it as a template."
                          : 'Create one from your current lineup with "New from current lineup".')
                      : 'Click "New template" to create one, then add items to it.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                    {editingName ? (
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={e => setNameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setEditingName(false)
                        }}
                        className="flex-1 h-8 px-2 text-sm font-semibold bg-background border border-border rounded-md outline-none focus:border-primary/50"
                      />
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{selectedTemplate.name}</p>
                          {selectedTemplate.updatedAt && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Updated {new Date(selectedTemplate.updatedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => { setEditingName(true); setNameDraft(selectedTemplate.name) }}
                          title="Rename"
                          className="shrink-0 h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Items */}
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {selectedTemplate.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No items yet — add one below.</p>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                        <SortableContext items={selectedTemplate.items.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                          {itemGroups.map((group, gi) => {
                            const sectionIdx = group.sectionIdx
                            return (
                              <div key={gi}>
                                {sectionIdx !== null && (
                                  <SortableTemplateItem
                                    key={sectionIdx}
                                    id={sectionIdx}
                                    item={selectedTemplate.items[sectionIdx]}
                                    colorIdx={group.colorIdx}
                                    isEditing={editingItemIndex === sectionIdx}
                                    editValue={editingItemValue}
                                    onEditStart={() => { setEditingItemIndex(sectionIdx); setEditingItemValue(selectedTemplate.items[sectionIdx].title ?? '') }}
                                    onEditChange={setEditingItemValue}
                                    onEditCommit={commitItemEdit}
                                    onEditCancel={() => setEditingItemIndex(null)}
                                    onRemove={() => onRemoveItem(selectedTemplate.id, sectionIdx)}
                                  />
                                )}
                                {group.childIdxs.length > 0 && (
                                  <div className={sectionIdx !== null
                                    ? `ml-4 pl-2 mb-1 border-l-2 ${getSectionColor(group.colorIdx).border} space-y-1`
                                    : "space-y-1"
                                  }>
                                    {group.childIdxs.map(i => (
                                      <SortableTemplateItem
                                        key={i}
                                        id={i}
                                        item={selectedTemplate.items[i]}
                                        colorIdx={-1}
                                        isEditing={editingItemIndex === i}
                                        editValue={editingItemValue}
                                        onEditStart={() => { setEditingItemIndex(i); setEditingItemValue(selectedTemplate.items[i].title ?? '') }}
                                        onEditChange={setEditingItemValue}
                                        onEditCommit={commitItemEdit}
                                        onEditCancel={() => setEditingItemIndex(null)}
                                        onRemove={() => onRemoveItem(selectedTemplate.id, i)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </SortableContext>
                      </DndContext>
                    )}

                    {/* Add item */}
                    <div className="relative mt-2">
                      <Button
                        variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                        onClick={() => setShowAddMenu(v => !v)}
                      >
                        <Plus className="h-3 w-3" /> Add item
                      </Button>
                      {showAddMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                          <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-md border border-border bg-popover shadow-lg py-1">
                            {ADD_TEMPLATE_ITEM_OPTIONS.map(opt => (
                              <button
                                key={opt.type}
                                onClick={() => handleAddOption(opt.type)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                              >
                                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" /> {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Song picker */}
                    {showSongPicker && (
                      <div className="mt-2 border border-border rounded-md p-2">
                        <input
                          autoFocus
                          value={songQuery}
                          onChange={e => setSongQuery(e.target.value)}
                          placeholder="Search songs…"
                          className="w-full h-8 px-2 text-xs bg-background border border-border rounded-md outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
                        />
                        <div className="mt-1 max-h-36 overflow-y-auto">
                          {songResults.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground px-2 py-1.5">No songs found</p>
                          ) : (
                            songResults.map(s => (
                              <button
                                key={s.id}
                                onClick={() => addSongItem(s)}
                                className="w-full flex items-center justify-between gap-2 px-2 py-1 text-xs hover:bg-accent rounded transition-colors text-left"
                              >
                                <span className="truncate">{s.title}</span>
                                <span className="text-muted-foreground text-[10px] shrink-0">{s.artist}</span>
                              </button>
                            ))
                          )}
                        </div>
                        <button
                          onClick={() => setShowSongPicker(false)}
                          className="text-[10px] text-muted-foreground hover:text-foreground mt-1 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Media picker */}
                    {showMediaPicker && (
                      <div className="mt-2 border border-border rounded-md p-2">
                        <input
                          autoFocus
                          value={mediaQuery}
                          onChange={e => setMediaQuery(e.target.value)}
                          placeholder="Search media…"
                          className="w-full h-8 px-2 text-xs bg-background border border-border rounded-md outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/40"
                        />
                        <div className="mt-1 max-h-48 overflow-y-auto">
                          {mediaLoading ? (
                            <p className="text-[10px] text-muted-foreground px-2 py-1.5">Loading…</p>
                          ) : filteredMedia.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground px-2 py-1.5">No media found</p>
                          ) : (
                            <div className="grid grid-cols-4 gap-1.5 p-0.5">
                              {filteredMedia.map(path => {
                                const isVideo = /\.(mp4|webm|mov)$/i.test(path)
                                const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(path)
                                return (
                                  <button
                                    key={path}
                                    onClick={() => addMediaItem(path)}
                                    title={path.split('/').pop()}
                                    className="group relative rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors"
                                    style={{ aspectRatio: "16/9" }}
                                  >
                                    {isAudio ? (
                                      <div className="absolute inset-0 bg-muted flex items-center justify-center">
                                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    ) : isVideo ? (
                                      <video
                                        src={`${toFileUrl(path)}`}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        muted
                                        preload="metadata"
                                      />
                                    ) : (
                                      <div
                                        className="absolute inset-0 bg-cover bg-center"
                                        style={{ backgroundImage: `url("${toFileUrl(path)}")` }}
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                      <p className="text-[8px] text-white truncate">{path.split('/').pop()}</p>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <button
                            onClick={handleBrowseMedia}
                            className="text-[10px] text-primary hover:underline transition-colors"
                          >
                            Browse for file…
                          </button>
                          <button
                            onClick={() => setShowMediaPicker(false)}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {selectedTemplate.items.length} item{selectedTemplate.items.length === 1 ? '' : 's'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleDuplicate}>
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={handleDelete}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                      {onApply && (
                        <Button
                          size="sm" className="h-7 text-xs gap-1.5"
                          disabled={applyingTemplate || selectedTemplate.items.length === 0}
                          onClick={() => onApply(selectedTemplate)}
                        >
                          <ListTodo className="h-3.5 w-3.5" /> Apply to lineup
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
