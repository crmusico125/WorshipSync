import { Placeholder } from "../components/layout/Placeholder";

interface Props {
  onOpenBuilder: () => void;
}

export function PlannerScreen({ onOpenBuilder }: Props) {
  return (
    <Placeholder
      icon="📅"
      title="Service planner"
      description="Calendar view — select a Sunday to prepare its lineup"
      action={{ label: "Open builder →", onClick: onOpenBuilder }}
      commit="Commit 5"
    />
  );
}

export default PlannerScreen;
