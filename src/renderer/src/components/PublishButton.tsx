import { useState } from "react"
import { UploadCloud, Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useSyncStore } from "../store/useSyncStore"

type Preview = Awaited<ReturnType<typeof window.worshipsync.sync.previewPublish>>

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const LARGE_PACKAGE_THRESHOLD_BYTES = 1024 * 1024 * 1024 // 1 GB

interface PublishButtonProps {
  serviceId: number
  /** "icon" for compact rows/toolbars, "button" for a labeled outline button. */
  variant?: "icon" | "button"
  className?: string
}

/**
 * The one place "publish this service to the Sync Workspace" is implemented —
 * every screen (Overview, Planner, Builder) renders this instead of its own
 * copy. Always previews counts/size and asks for confirmation before
 * publishing, both so large packages aren't triggered by a misclick and so
 * republishing an already-published service is a deliberate choice, not an
 * accident.
 */
export default function PublishButton({ serviceId, variant = "icon", className = "" }: PublishButtonProps) {
  const workspaceReady = useSyncStore(s => s.workspaceReady)
  const refreshSync = useSyncStore(s => s.refresh)

  const [open, setOpen] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [justPublished, setJustPublished] = useState(false)

  if (!workspaceReady) return null

  const openPreview = async () => {
    setOpen(true)
    setLoadingPreview(true)
    setPreviewError(null)
    setPublishError(null)
    try {
      const result = await window.worshipsync.sync.previewPublish(serviceId)
      setPreview(result)
    } catch (e: any) {
      setPreviewError(e?.message ?? "Could not preview this service.")
    } finally {
      setLoadingPreview(false)
    }
  }

  const confirmPublish = async () => {
    setPublishing(true)
    setPublishError(null)
    try {
      const result = await window.worshipsync.sync.publishService(serviceId)
      if (result.ok) {
        setOpen(false)
        setPreview(null)
        setJustPublished(true)
        setTimeout(() => setJustPublished(false), 2500)
        refreshSync()
      } else {
        setPublishError(result.error ?? "Publish failed.")
      }
    } catch (e: any) {
      setPublishError(e?.message ?? "Publish failed.")
    } finally {
      setPublishing(false)
    }
  }

  const trigger = variant === "icon" ? (
    <Button
      variant="ghost" size="icon"
      className={`h-7 w-7 ${justPublished ? "text-green-500" : "text-muted-foreground hover:text-foreground"} ${className}`}
      title="Publish to Sync Workspace"
      onClick={(e) => { e.stopPropagation(); openPreview() }}
    >
      {justPublished ? <Check className="h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
    </Button>
  ) : (
    <Button
      variant="outline" size="sm"
      className={`gap-1.5 ${justPublished ? "text-green-500 border-green-500/40" : ""} ${className}`}
      title="Publish to Sync Workspace"
      onClick={(e) => { e.stopPropagation(); openPreview() }}
    >
      {justPublished ? <Check className="h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
      {justPublished ? "Published" : "Publish"}
    </Button>
  )

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={(next) => { if (!publishing) setOpen(next) }}>
        <DialogContent className="w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
          <DialogTitle>Publish to Sync Workspace</DialogTitle>

          {loadingPreview ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : previewError ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{previewError}</span>
            </div>
          ) : preview && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {preview.title} — this will publish{" "}
                <span className="font-semibold text-foreground">version {preview.nextVersion}</span>
                {preview.nextVersion > 1 ? " (this service was already published before)." : "."}
              </p>

              <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5 text-[12px] flex flex-col gap-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Songs</span><span className="tabular-nums">{preview.counts.songs}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scriptures</span><span className="tabular-nums">{preview.counts.scriptures}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Images</span><span className="tabular-nums">{preview.counts.images}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Audio</span><span className="tabular-nums">{preview.counts.audio}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Video</span><span className="tabular-nums">{preview.counts.video}</span></div>
                <div className="flex justify-between font-medium pt-1 border-t border-border mt-1"><span>Package size</span><span className="tabular-nums">{fmtBytes(preview.totalSizeBytes)}</span></div>
              </div>

              {preview.totalSizeBytes > LARGE_PACKAGE_THRESHOLD_BYTES && (
                <p className="text-[12px] text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> This is a large package — it may take a while for your sync provider to upload.
                </p>
              )}
              {preview.hasMusicPlayerItem && (
                <p className="text-[12px] text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> The music player folder won't be included — the receiving computer will need to set its own.
                </p>
              )}

              {publishError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{publishError}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end mt-1">
                <Button variant="outline" size="sm" disabled={publishing} onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={publishing} onClick={confirmPublish} className="gap-1.5">
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                  {publishing ? "Publishing…" : `Publish v${preview.nextVersion}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
