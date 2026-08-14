import { Download, Loader2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useUpdaterStore } from "../store/useUpdaterStore"
import MarkdownLite from "./MarkdownLite"

function fmtBytes(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`
  const mb = bytesPerSecond / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`
  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
}

/**
 * The one full update dialog — driven entirely by useUpdaterStore, no local
 * fetching. Only ever opens for states that need a decision (available /
 * downloading / downloaded / error); main process never sends the events that
 * drive those states while a presentation is live, so this never appears
 * mid-service without any live-detection logic living here.
 */
export default function UpdateDialog() {
  const { status, currentVersion, latestVersion, releaseNotes, progress, errorMessage, dismissed, dismiss, downloadUpdate, installUpdate, openReleasePage, checkForUpdates } = useUpdaterStore()

  const open = !dismissed && (status === "available" || status === "manual" || status === "downloading" || status === "downloaded" || status === "error")

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="w-[460px] p-6">
        <DialogTitle>
          {status === "downloaded" ? "Update ready to install" : status === "error" ? "Update check failed" : "Update available"}
        </DialogTitle>

        <div className="mt-3 flex flex-col gap-3">
          {status === "error" ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive max-h-48 overflow-y-auto">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {/* min-w-0 lets the flex item actually shrink to wrap; break-words handles long
                  unbroken tokens (URLs, base64 hashes) that would otherwise overflow the dialog
                  instead of wrapping. select-text overrides the app-wide user-select:none so the
                  operator can copy the raw error to share it. */}
              <span className="min-w-0 flex-1 select-text break-words whitespace-pre-wrap">{errorMessage ?? "Something went wrong while checking for updates."}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current version</span>
                <span className="font-medium tabular-nums">{currentVersion}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Latest version</span>
                <span className="font-semibold tabular-nums text-primary">{latestVersion}</span>
              </div>

              {status === "manual" && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This build isn't signed with an Apple Developer ID, so it can't update itself automatically on macOS. Download the new version from GitHub and install it manually — your data and settings aren't affected.
                </p>
              )}

              {releaseNotes && (
                <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Release notes</p>
                  <MarkdownLite text={releaseNotes} className="text-xs text-foreground/90 leading-relaxed" />
                </div>
              )}

              {status === "downloading" && progress && (
                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{progress.percent.toFixed(0)}%</span>
                    <span>{fmtBytes(progress.bytesPerSecond)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 justify-end mt-1">
            {status === "error" && (
              <>
                <Button variant="outline" size="sm" onClick={dismiss}>Dismiss</Button>
                <Button size="sm" className="gap-1.5" onClick={checkForUpdates}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </>
            )}
            {status === "available" && (
              <>
                <Button variant="outline" size="sm" onClick={dismiss}>Later</Button>
                <Button size="sm" className="gap-1.5" onClick={downloadUpdate}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </>
            )}
            {status === "manual" && (
              <>
                <Button variant="outline" size="sm" onClick={dismiss}>Later</Button>
                <Button size="sm" className="gap-1.5" onClick={() => { openReleasePage(); dismiss() }}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open Download Page
                </Button>
              </>
            )}
            {status === "downloading" && (
              <Button variant="outline" size="sm" disabled className="gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading…
              </Button>
            )}
            {status === "downloaded" && (
              <>
                <Button variant="outline" size="sm" onClick={dismiss}>Later</Button>
                <Button size="sm" className="gap-1.5" onClick={installUpdate}>
                  <RefreshCw className="h-3.5 w-3.5" /> Restart &amp; Install
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
