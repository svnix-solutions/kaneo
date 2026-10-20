import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { PoolState } from "./contact-row";

/** The stage words for a pool state: a board stage, or Backlog / Not queued / Member. */
export function usePoolStateLabel() {
  const { t } = useTranslation();
  return (s: PoolState) =>
    s.state === "in_progress" || s.state === "final"
      ? (s.stage ?? t(`contacts:poolState.${s.state}`))
      : t(`contacts:poolState.${s.state}`);
}

const TONE: Record<PoolState["state"], string> = {
  not_queued: "border-dashed text-muted-foreground",
  backlog: "text-muted-foreground",
  in_progress: "border-info/40 text-info-foreground",
  final: "border-success/40 text-success-foreground",
  member: "",
};

/** "Nurse pool · Screening"; withPool false shows only the stage. */
export function PoolStateChip({
  state,
  withPool = true,
}: {
  state: PoolState;
  withPool?: boolean;
}) {
  const label = usePoolStateLabel()(state);
  return (
    <Badge
      variant="outline"
      className={cn("max-w-56", TONE[state.state])}
      title={`${state.name} · ${label}`}
    >
      <span className="truncate">
        {withPool ? `${state.name} · ${label}` : label}
      </span>
    </Badge>
  );
}
