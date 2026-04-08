import { Placeholder as P2 } from "../components/layout/Placeholder";

interface BuilderProps {
  onGoLive: () => void;
}

export function BuilderScreen({ onGoLive }: BuilderProps) {
  return (
    <P2
      icon="🎵"
      title="Service builder"
      description="Drag songs into the lineup, pick sections, preview slides"
      action={{ label: "Go live →", onClick: onGoLive }}
      commit="Commit 5"
    />
  );
}

export default BuilderScreen;
