import { useEffect, useState } from "react"
import { arrayMove } from "@dnd-kit/sortable"
import type { SetlistTemplate, SetlistTemplateItem } from "../components/TemplateManagerModal"

/**
 * Loads/persists setlist templates (stored in app-state.json) and exposes
 * CRUD handlers shared by the Builder's "Setlist Templates" manager and the
 * standalone template manager on the Overview screen.
 */
export function useSetlistTemplates() {
  const [templates, setTemplates] = useState<SetlistTemplate[]>([])

  useEffect(() => {
    window.worshipsync.appState.get().then((state: any) => {
      if (Array.isArray(state.setlistTemplates)) setTemplates(state.setlistTemplates)
    }).catch(() => {})
  }, [])

  const persistTemplates = async (updated: SetlistTemplate[]) => {
    setTemplates(updated)
    await window.worshipsync.appState.set({ setlistTemplates: updated })
  }

  const handleNewBlankTemplate = async (): Promise<string | undefined> => {
    const tpl: SetlistTemplate = {
      id: Date.now().toString(),
      name: "New Template",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    }
    await persistTemplates([...templates, tpl])
    return tpl.id
  }

  const handleDeleteTemplate = async (id: string) => {
    await persistTemplates(templates.filter(t => t.id !== id))
  }

  const handleDuplicateTemplate = async (tpl: SetlistTemplate): Promise<string> => {
    const copy: SetlistTemplate = {
      ...tpl,
      id: Date.now().toString(),
      name: `${tpl.name} copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: tpl.items.map(i => ({ ...i })),
    }
    await persistTemplates([...templates, copy])
    return copy.id
  }

  const handleRenameTemplate = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    await persistTemplates(templates.map(t =>
      t.id === id ? { ...t, name: trimmed, updatedAt: new Date().toISOString() } : t
    ))
  }

  const handleReorderTemplateItems = async (id: string, oldIndex: number, newIndex: number) => {
    await persistTemplates(templates.map(t =>
      t.id === id ? { ...t, items: arrayMove(t.items, oldIndex, newIndex), updatedAt: new Date().toISOString() } : t
    ))
  }

  const handleRemoveTemplateItem = async (id: string, index: number) => {
    await persistTemplates(templates.map(t =>
      t.id === id ? { ...t, items: t.items.filter((_, i) => i !== index), updatedAt: new Date().toISOString() } : t
    ))
  }

  const handleAddTemplateItem = async (id: string, item: SetlistTemplateItem) => {
    await persistTemplates(templates.map(t =>
      t.id === id ? { ...t, items: [...t.items, item], updatedAt: new Date().toISOString() } : t
    ))
  }

  const handleUpdateTemplateItem = async (id: string, index: number, patch: Partial<SetlistTemplateItem>) => {
    await persistTemplates(templates.map(t =>
      t.id === id ? { ...t, items: t.items.map((it, i) => i === index ? { ...it, ...patch } : it), updatedAt: new Date().toISOString() } : t
    ))
  }

  return {
    templates,
    persistTemplates,
    handleNewBlankTemplate,
    handleDeleteTemplate,
    handleDuplicateTemplate,
    handleRenameTemplate,
    handleReorderTemplateItems,
    handleRemoveTemplateItem,
    handleAddTemplateItem,
    handleUpdateTemplateItem,
  }
}
