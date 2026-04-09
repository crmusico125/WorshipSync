import { useState } from "react";

const PRESET_COLORS = [
  { label: "Deep blue", value: "color:#0a0a2e" },
  { label: "Forest green", value: "color:#0a1a0a" },
  { label: "Deep red", value: "color:#1a0505" },
  { label: "Dark amber", value: "color:#1a1000" },
  { label: "Deep purple", value: "color:#12062a" },
  { label: "Teal", value: "color:#051a1a" },
  { label: "Pure black", value: "color:#000000" },
  { label: "Dark gray", value: "color:#111111" },
];

const COLOR_HEX: Record<string, string> = {
  "color:#0a0a2e": "#0a0a2e",
  "color:#0a1a0a": "#0a1a0a",
  "color:#1a0505": "#1a0505",
  "color:#1a1000": "#1a1000",
  "color:#12062a": "#12062a",
  "color:#051a1a": "#051a1a",
  "color:#000000": "#000000",
  "color:#111111": "#111111",
};

interface Props {
  songId: number;
  songTitle: string;
  currentBackground: string | null;
  onChanged: (newPath: string | null) => void;
}

export default function BackgroundPicker({
  songId,
  songTitle,
  currentBackground,
  onChanged,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const isColor = currentBackground?.startsWith("color:");
  const isImage = currentBackground && !isColor;

  const handlePickImage = async () => {
    setUploading(true);
    try {
      const path = await window.worshipsync.backgrounds.pickImage();
      if (path) {
        await window.worshipsync.backgrounds.setBackground(songId, path);
        onChanged(path);
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePickColor = async (colorValue: string) => {
    await window.worshipsync.backgrounds.setBackground(songId, colorValue);
    onChanged(colorValue);
  };

  const handleClear = async () => {
    await window.worshipsync.backgrounds.setBackground(songId, null);
    onChanged(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Current background preview */}
      <div
        style={{
          aspectRatio: "16/9",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border-default)",
          position: "relative",
          background: "#07070f",
        }}
      >
        {isImage && (
          <img
            src={`file://${currentBackground}`}
            alt="Background"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {isColor && (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: COLOR_HEX[currentBackground!] ?? "#000",
            }}
          />
        )}
        {!currentBackground && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              No background set
            </span>
          </div>
        )}

        {/* Overlay preview with song title */}
        {currentBackground && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                textAlign: "center",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              }}
            >
              {songTitle}
            </div>
          </div>
        )}
      </div>

      {/* Preset color swatches */}
      <div>
        <div className="label" style={{ marginBottom: 6 }}>
          Preset colors
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PRESET_COLORS.map((preset) => (
            <div
              key={preset.value}
              onClick={() => handlePickColor(preset.value)}
              title={preset.label}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: COLOR_HEX[preset.value],
                cursor: "pointer",
                border:
                  currentBackground === preset.value
                    ? "2px solid var(--accent-blue)"
                    : "1px solid var(--border-strong)",
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 7 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: 11, justifyContent: "center" }}
          onClick={handlePickImage}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "📁 Upload image"}
        </button>
        {currentBackground && (
          <button
            className="btn"
            style={{ fontSize: 11, color: "var(--accent-red)" }}
            onClick={handleClear}
          >
            Clear
          </button>
        )}
      </div>

      <div
        style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        Supported: JPG, PNG, WebP. Image is copied to app storage — original can
        be moved or deleted.
      </div>
    </div>
  );
}
