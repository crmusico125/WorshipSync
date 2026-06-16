import type { AnnouncementCard } from '../../../../shared/types'

interface AnnouncementCardsViewProps {
  title: string
  cards: AnnouncementCard[]
  textColor: string
  accentColor: string
  fontSize: number   // 32/48/64/80 — drives proportional scaling
  compact?: boolean  // true = small fixed-px sizes for confidence monitor / editor preview
}

export default function AnnouncementCardsView({
  title, cards, textColor, accentColor, fontSize, compact = false,
}: AnnouncementCardsViewProps) {
  // Scale relative to the 80-max as a 0–1 factor, clamped sensibly.
  const scale = Math.max(0.4, Math.min(1, fontSize / 80))

  const titleSize  = compact ? `${Math.round(14 * scale)}px` : `${(scale * 3.6).toFixed(2)}cqw`
  const headSize   = compact ? `${Math.round(13 * scale)}px` : `${(scale * 3).toFixed(2)}cqw`
  const detailSize = compact ? `${Math.round(10 * scale)}px` : `${(scale * 1.9).toFixed(2)}cqw`
  const badgeSize  = compact ? `${Math.round(9  * scale)}px` : `${(scale * 1.65).toFixed(2)}cqw`
  const gap        = compact ? `${Math.round(10 * scale)}px` : `${(scale * 1.6).toFixed(2)}cqw`
  const badgeW     = compact ? `${Math.round(36 * scale)}px` : `${(scale * 5).toFixed(2)}cqw`

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap }}>
      {/* Slide title */}
      {title && (
        <div style={{
          textAlign: 'center',
          fontSize: titleSize,
          fontWeight: 700,
          color: textColor,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          lineHeight: 1.2,
          textShadow: compact ? 'none' : `0 2px 12px rgba(0,0,0,0.5)`,
        }}>
          {title}
        </div>
      )}

      {/* Divider */}
      {title && cards.length > 0 && (
        <div style={{ height: 1, background: `${textColor}30`, margin: `0` }} />
      )}

      {/* Cards */}
      {cards.filter(c => c.heading).map(card => (
        <div key={card.id} style={{ display: 'flex', alignItems: 'flex-start', gap }}>
          {/* Day/time badge */}
          {(card.day || card.time) && (
            <div style={{
              flexShrink: 0,
              width: badgeW,
              background: accentColor,
              borderRadius: compact ? 4 : '0.5cqw',
              padding: compact ? '3px 4px' : '0.35cqw 0.5cqw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}>
              {card.day && (
                <div style={{
                  fontSize: badgeSize,
                  fontWeight: 800,
                  color: '#000',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}>
                  {card.day}
                </div>
              )}
              {card.time && (
                <div style={{
                  fontSize: badgeSize,
                  fontWeight: 700,
                  color: '#000',
                  lineHeight: 1.1,
                }}>
                  {card.time}
                </div>
              )}
            </div>
          )}

          {/* Event details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: headSize,
              fontWeight: 700,
              color: textColor,
              lineHeight: 1.25,
              textShadow: compact ? 'none' : `0 1px 8px rgba(0,0,0,0.4)`,
            }}>
              {card.heading}
            </div>
            {card.location && (
              <div style={{
                fontSize: detailSize,
                color: `${textColor}b0`,
                lineHeight: 1.35,
                marginTop: compact ? 1 : '0.2cqw',
              }}>
                {card.location}
              </div>
            )}
            {card.description && (
              <div style={{
                fontSize: detailSize,
                color: `${textColor}90`,
                lineHeight: 1.35,
                marginTop: compact ? 1 : '0.15cqw',
              }}>
                {card.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
