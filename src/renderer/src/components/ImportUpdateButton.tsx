import { useState } from "react"
import { DownloadCloud, Loader2, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useSyncStore, findUpdateForService } from "../store/useSyncStore"

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

interface ImportUpdateButtonProps {
  /** The local service's own sync_uuid — null/undefined for a service that's never been published or imported. */
  syncUuid: string | null | undefined
  /** The local service's date — used as a fallback match for a same-date package this device hasn't linked by sync_uuid yet. */
  date?: string | null
  variant?: "icon" | "button"
  className?: string
  /** Called after a successful import — e.g. so a screen actively displaying this service's lineup can reload it. */
  onImported?: () => void
}

/**
 * The one place "import a waiting package into this specific local service"
 * is implemented. Renders nothing unless the shared Sync Workspace status
 * has a matching package — by sync_uuid if this device already knows the
 * link, otherwise by date (covers a service created independently on this
 * computer, never synced before). Reuses the manifest already fetched for
 * the availability check, so opening the confirm dialog needs no extra IPC call.
 */
export default function ImportUpdateButton({ syncUuid, date, variant = "icon", className = "", onImported }: ImportUpdateButtonProps) {
  // Subscribed so the button appears/disappears reactively as the store refreshes.
  const pkg = useSyncStore(() => findUpdateForService(syncUuid, date))
  const refreshSync = useSyncStore(s => s.refresh)

  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justImported, setJustImported] = useState(false)

  if (!pkg && !justImported) return null

  const isNew = pkg?.localState === "new"

  const confirmImport = async () => {
    if (!pkg) return
    setImporting(true)
    setError(null)
    try {
      const result = await window.worshipsync.sync.importPackage(pkg.filename)
      if (result.ok) {
        setOpen(false)
        setJustImported(true)
        setTimeout(() => setJustImported(false), 2500)
        refreshSync()
        onImported?.()
      } else {
        setError(result.error ?? "Import failed.")
      }
    } catch (e: any) {
      setError(e?.message ?? "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  const trigger = variant === "icon" ? (
    <Button
      variant="ghost" size="icon"
      className={`h-7 w-7 ${justImported ? "text-green-500" : "text-amber-500 hover:text-amber-400"} ${className}`}
      title={pkg ? (isNew ? `Import from another computer — v${pkg.manifest.version}` : `Update available — v${pkg.manifest.version}`) : "Updated"}
      onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      disabled={!pkg}
    >
      {justImported ? <Check className="h-3.5 w-3.5" /> : <DownloadCloud className="h-3.5 w-3.5" />}
    </Button>
  ) : (
    <Button
      variant="outline" size="sm"
      className={`gap-1.5 ${justImported ? "text-green-500 border-green-500/40" : "text-amber-500 border-amber-500/40"} ${className}`}
      onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      disabled={!pkg}
    >
      {justImported ? <Check className="h-3.5 w-3.5" /> : <DownloadCloud className="h-3.5 w-3.5" />}
      {justImported ? "Updated" : pkg ? (isNew ? `Import v${pkg.manifest.version}` : `Update to v${pkg.manifest.version}`) : "Updated"}
    </Button>
  )

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={(next) => { if (!importing) setOpen(next) }}>
        <DialogContent className="w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
          <DialogTitle>{isNew ? "Import from Another Computer" : "Import Update"}</DialogTitle>
          {pkg && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {pkg.manifest.title} —{" "}
                {isNew ? (
                  <>this service already exists here, but a version published from{" "}
                  {pkg.manifest.publishedByDeviceName} on {new Date(pkg.manifest.publishedAt).toLocaleString()} hasn't been linked yet.</>
                ) : (
                  <>update to{" "}
                  <span className="font-semibold text-foreground">version {pkg.manifest.version}</span>, published by{" "}
                  {pkg.manifest.publishedByDeviceName} on {new Date(pkg.manifest.publishedAt).toLocaleString()}.</>
                )}
              </p>

              <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5 text-[12px] flex flex-col gap-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Songs</span><span className="tabular-nums">{pkg.manifest.counts.songs}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scriptures</span><span className="tabular-nums">{pkg.manifest.counts.scriptures}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Images</span><span className="tabular-nums">{pkg.manifest.counts.images}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Audio</span><span className="tabular-nums">{pkg.manifest.counts.audio}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Video</span><span className="tabular-nums">{pkg.manifest.counts.video}</span></div>
                <div className="flex justify-between font-medium pt-1 border-t border-border mt-1"><span>Package size</span><span className="tabular-nums">{fmtBytes(pkg.manifest.totalSizeBytes)}</span></div>
              </div>

              <p className="text-[12px] text-muted-foreground">
                {isNew
                  ? "This replaces this service's current lineup — including anything planned only on this computer — with the published version. Songs and media already in your library are reused, not duplicated."
                  : "This replaces this service's current lineup with the published version. Songs and media already in your library are reused, not duplicated."}
              </p>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end mt-1">
                <Button variant="outline" size="sm" disabled={importing} onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={importing} onClick={confirmImport} className="gap-1.5">
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
                  {importing ? "Importing…" : isNew ? `Import & Override — v${pkg.manifest.version}` : `Import v${pkg.manifest.version}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
