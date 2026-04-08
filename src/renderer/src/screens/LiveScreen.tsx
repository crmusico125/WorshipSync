import { Placeholder as P6 } from "../components/layout/Placeholder";

interface LiveProps {
  onClose: () => void;
  projectionOpen: boolean;
}

export function LiveScreen({ onClose, projectionOpen }: LiveProps) {
  return (
    <P6
      icon="🖥️"
      title="Live operator panel"
      description={
        projectionOpen
          ? "Projector window is open — operator controls coming in Commit 6"
          : "Open the projector first using the Go Live button in the sidebar"
      }
      action={
        projectionOpen
          ? { label: "Close projection", onClick: onClose }
          : undefined
      }
      commit="Commit 6"
    />
  );
}

export default LiveScreen;
