export interface MediaCollectionConfig {
  items: string[]
  autoAdvance: boolean
  intervalSeconds: number
  loop: boolean
}

export const DEFAULT_MEDIA_COLLECTION: MediaCollectionConfig = {
  items: [],
  autoAdvance: false,
  intervalSeconds: 5,
  loop: false,
}

export function parseMediaCollection(json: string | null | undefined): MediaCollectionConfig {
  if (!json) return DEFAULT_MEDIA_COLLECTION
  try { return { ...DEFAULT_MEDIA_COLLECTION, ...JSON.parse(json) } } catch { return DEFAULT_MEDIA_COLLECTION }
}
