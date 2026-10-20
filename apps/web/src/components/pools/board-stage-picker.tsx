import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetProjects from "@/hooks/queries/project/use-get-projects";

export type BoardStage = { projectId: string; columnId: string };

type BoardStagePickerProps = {
  workspaceId: string;
  value: BoardStage;
  onChange: (value: BoardStage) => void;
  /** Fix the board (adding from the board itself): only the stage is picked. */
  fixedProjectId?: string;
};

/** A board, then one of its stages (the first one until another is picked). */
export function BoardStagePicker({
  workspaceId,
  value,
  onChange,
  fixedProjectId,
}: BoardStagePickerProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const projectId = fixedProjectId ?? value.projectId;
  const { data: columns = [] } = useGetColumns(projectId);
  const project = projects.find((p) => p.id === projectId);
  const column =
    columns.find((c) => c.id === value.columnId) ?? columns[0] ?? null;

  return (
    <div className="flex flex-col gap-2">
      {fixedProjectId ? null : (
        <Select
          value={projectId || null}
          onValueChange={(next) =>
            next && onChange({ projectId: String(next), columnId: "" })
          }
        >
          <SelectTrigger size="sm" aria-label={t("contacts:pipelines.board")}>
            <SelectValue placeholder={t("contacts:pipelines.chooseBoard")}>
              {project?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select
        value={column?.id ?? null}
        disabled={!projectId}
        onValueChange={(next) =>
          next && onChange({ projectId, columnId: String(next) })
        }
      >
        <SelectTrigger size="sm" aria-label={t("contacts:pipelines.stage")}>
          <SelectValue placeholder={t("contacts:pipelines.chooseStage")}>
            {column
              ? t("contacts:pipelines.startIn", { stage: column.name })
              : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {columns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The stage to send: the picked one, else the board's first. */
export function resolvedColumnId(value: BoardStage) {
  return value.columnId || undefined;
}
