import { useEffect, useState } from "react";
import { useSongStore } from "../store/useSongStore";
import type { Song } from "../../../../shared/types";

const SECTION_TYPE_COLORS: Record<string, string> = {
  verse: "#4d8ef0",
  chorus: "#3ecf8e",
  bridge: "#f5a623",
  "pre-chorus": "#9f7aea",
  outro: "#888",
  intro: "#888",
  tag: "#f05252",
  interlude: "#888",
};

const BG_COLORS = [
  "#1a1a4e",
  "#1e3a1a",
  "#3d1010",
  "#2a1a00",
  "#1a0a2e",
  "#0a2e1a",
  "#2e1a0a",
  "#0a1a2e",
];

function songBgColor(id: number) {
  return BG_COLORS[id % BG_COLORS.length];
}

function groupAlphabetically(songs: Song[]) {
  const groups: Record<string, Song[]> = {};
  for (const song of songs) {
    const letter = song.title[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(song);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function LibraryScreen() {
  const {
    songs,
    selectedSong,
    searchQuery,
    loading,
    loadSongs,
    selectSong,
    setSearchQuery,
  } = useSongStore();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadSongs();
  }, []);

  const grouped = searchQuery ? null : groupAlphabetically(songs);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Left: song list ─────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Search by title or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className="btn btn-success"
            onClick={() => setShowAddModal(true)}
          >
            + New song
          </button>
        </div>

        {/* Count */}
        <div
          style={{
            padding: "6px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {loading ? "Loading..." : `${songs.length} songs`}
          </span>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {searchQuery
            ? // Flat search results
              songs.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  selected={selectedSong?.id === song.id}
                  onClick={() => selectSong(song.id)}
                />
              ))
            : // Grouped alphabetically
              grouped?.map(([letter, group]) => (
                <div key={letter} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      paddingBottom: 4,
                      marginBottom: 5,
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    {letter}
                  </div>
                  {group.map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      selected={selectedSong?.id === song.id}
                      onClick={() => selectSong(song.id)}
                    />
                  ))}
                </div>
              ))}
        </div>
      </div>

      {/* ── Right: detail panel ─────────────────────────────────────────── */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {selectedSong ? (
          <>
            {/* Header */}
            <div className="card">
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: songBgColor(selectedSong.id),
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {selectedSong.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {selectedSong.artist}
                    {selectedSong.ccliNumber &&
                      ` · CCLI #${selectedSong.ccliNumber}`}
                  </div>
                </div>
              </div>

              {/* Meta grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {[
                  ["Key", selectedSong.key ?? "—"],
                  ["Tempo", selectedSong.tempo ?? "—"],
                  ["Sections", `${selectedSong.sections.length}`],
                  [
                    "Tags",
                    JSON.parse(selectedSong.tags || "[]").join(", ") || "—",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background: "var(--surface-2)",
                      borderRadius: 6,
                      padding: "6px 8px",
                    }}
                  >
                    <div className="label" style={{ marginBottom: 2 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Sections */}
              <div className="label" style={{ marginBottom: 6 }}>
                Sections
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {selectedSong.sections.map((sec) => (
                  <div
                    key={sec.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "7px 9px",
                      borderRadius: 6,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        minWidth: 58,
                        paddingTop: 1,
                        color:
                          SECTION_TYPE_COLORS[sec.type] ?? "var(--text-muted)",
                      }}
                    >
                      {sec.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        flex: 1,
                      }}
                    >
                      {sec.lyrics.split("\n")[0]}
                      {sec.lyrics.split("\n").length > 1 && (
                        <span style={{ color: "var(--text-muted)" }}> ...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 12,
              textAlign: "center",
              padding: 24,
            }}
          >
            Select a song to see its details
          </div>
        )}
      </div>

      {/* Add song modal — placeholder for now */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            loadSongs();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

function SongRow({
  song,
  selected,
  onClick,
}: {
  song: Song;
  selected: boolean;
  onClick: () => void;
}) {
  const tags = JSON.parse(song.tags || "[]") as string[];
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderRadius: 8,
        marginBottom: 4,
        cursor: "pointer",
        border: `1px solid ${selected ? "rgba(77,142,240,0.3)" : "var(--border-subtle)"}`,
        background: selected ? "var(--accent-blue-dim)" : "var(--surface-1)",
        transition: "background 0.1s",
      }}
    >
      {/* Color swatch */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 6,
          flexShrink: 0,
          background: songBgColor(song.id),
        }}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: selected ? "var(--accent-blue)" : "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {song.title}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            marginTop: 2,
            display: "flex",
            gap: 5,
            alignItems: "center",
          }}
        >
          <span>{song.artist}</span>
          {song.key && (
            <>
              <span>·</span>
              <span>Key of {song.key}</span>
            </>
          )}
          {tags[0] && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 10,
                background: "var(--surface-3)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {tags[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AddSongModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await window.worshipsync.songs.create({
      title: title.trim(),
      artist: artist.trim(),
      key: key.trim() || null,
      tags: "[]",
      sections: [],
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 24,
          width: 400,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>Add new song</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className="label">Title</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            autoFocus
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className="label">Artist</label>
          <input
            className="input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist or band"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className="label">Key</label>
          <input
            className="input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. G, A, Bb"
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? "Saving..." : "Save song"}
          </button>
        </div>
      </div>
    </div>
  );
}
