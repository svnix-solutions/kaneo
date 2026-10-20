import { Kanban } from "lucide-react";
import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useAddPoolMembersToBoard from "@/hooks/mutations/pool/use-add-pool-members-to-board";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";
import {
  type BoardStage,
  BoardStagePicker,
  resolvedColumnId,
} from "./board-stage-picker";

type AddToBoardPopoverProps = {
  workspaceId: string;
  poolId: string;
  /** Contact ids of the pool members to put on the board. */
  ids: string[];
  trigger: ReactElement;
  side?: "top" | "bottom";
  onDone?: () => void;
};

/** Pick a board and stage, then put the members on it (one task each). */
export function AddToBoardPopover({
  workspaceId,
  poolId,
  ids,
  trigger,
  side = "bottom",
  onDone,
}: AddToBoardPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<BoardStage>({
    projectId: "",
    columnId: "",
  });
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const { mutateAsync: add, isPending } = useAddPoolMembersToBoard();

  const submit = async () => {
    if (!value.projectId) return;
    const board = projects.find((p) => p.id === value.projectId)?.name ?? "";
    try {
      const { added, skipped } = await add({
        poolId,
        ids,
        projectId: value.projectId,
        columnId: resolvedColumnId(value),
      });
      toast.success(t("contacts:pipelines.added", { count: added, board }), {
        icon: Kanban,
        description: skipped
          ? t("contacts:pipelines.skipped", { count: skipped })
          : undefined,
      });
      setOpen(false);
      onDone?.();
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:pipelines.addError")));
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue({ projectId: "", columnId: "" });
      }}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent side={side} align="start" sideOffset={8} className="w-72">
        <div className="flex flex-col gap-3">
          <p className="font-medium text-sm">
            {t("contacts:pipelines.addTitle", { count: ids.length })}
          </p>
          <BoardStagePicker
            workspaceId={workspaceId}
            value={value}
            onChange={setValue}
          />
          <Button
            size="sm"
            disabled={!value.projectId || isPending}
            onClick={() => void submit()}
          >
            {t("contacts:pipelines.add")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
