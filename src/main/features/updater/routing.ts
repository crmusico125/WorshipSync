/**
 * Pure decisions about whether an update notice should interrupt the
 * operator or stay in the background — kept in their own file, with no
 * dependency on `electron-updater` or `electron`, so they're testable
 * without triggering electron-updater's real (Electron-runtime-dependent)
 * singleton construction just by being imported.
 */

/** Whether "update available" should be the full dialog or just a subtle notice. */
export function decideAvailableRoute(live: boolean): 'full' | 'subtle' {
  return live ? 'subtle' : 'full'
}

/** Whether a finished download should prompt immediately or be deferred until the presentation ends. */
export function decideDownloadedRoute(live: boolean): 'full' | 'defer' {
  return live ? 'defer' : 'full'
}
