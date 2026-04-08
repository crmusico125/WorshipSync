interface Props {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  commit: string;
}

export function Placeholder({
  icon,
  title,
  description,
  action,
  commit,
}: Props) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 40,
      }}
      className="animate-fade-in"
    >
      {/* Icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "var(--surface-2)",
          border: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: 0,
          textAlign: "center",
        }}
      >
        {title}
      </h2>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          margin: 0,
          textAlign: "center",
          maxWidth: 380,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      {/* Commit badge */}
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 20,
          padding: "3px 10px",
          letterSpacing: "0.05em",
        }}
      >
        Coming in {commit}
      </div>

      {/* Optional action button */}
      {action && (
        <button
          className="btn btn-primary"
          onClick={action.onClick}
          style={{ marginTop: 4 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
