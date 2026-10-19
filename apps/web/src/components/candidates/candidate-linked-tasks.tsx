import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeader } from "@/components/task/sections/section-header";
import {
  sectionIdClass,
  sectionRowClass,
} from "@/components/task/sections/section-row-class";
import { Badge } from "@/components/ui/badge";
import type { CandidateTask } from "@/fetchers/candidate/types";
import useUnlinkCandidateTask from "@/hooks/mutations/candidate/use-unlink-candidate-task";
import useGetCandidateTasks from "@/hooks/queries/candidate/use-get-candidate-tasks";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type ProjectGroup = {
  projectId: string;
  projectName: string;
  tasks: CandidateTask[];
};

function groupByProject(tasks: CandidateTask[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const task of tasks) {
    const group = groups.get(task.projectId) ?? {
      projectId: task.projectId,
      projectName: task.projectName,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(task.projectId, group);
  }
  return [...groups.values()];
}

export function CandidateLinkedTasks({
  candidateId,
  workspaceId,
}: {
  candidateId: string;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const { data: tasks = [] } = useGetCandidateTasks(candidateId);
  const { mutate: unlink } = useUnlinkCandidateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const groups = groupByProject(tasks);

  return (
    <section className="flex flex-col gap-1">
      <SectionHeader
        title={t("candidates:detail.tasks")}
        meta={
          tasks.length > 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {tasks.length}
            </span>
          )
        }
      />
      {groups.length === 0 ? (
        <p className="px-2 py-1 text-muted-foreground text-xs">
          {t("candidates:detail.noTasks")}
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.projectId} className="flex flex-col">
            <p className="px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs">
              {group.projectName}
            </p>
            {group.tasks.map((task) => (
              <div key={task.taskId} className={sectionRowClass}>
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: task.projectId,
                    taskId: task.taskId,
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 outline-none"
                >
                  <span className={sectionIdClass}>
                    {task.number != null
                      ? `${task.projectSlug}-${task.number}`
                      : task.projectSlug}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {task.title}
                  </span>
                  <Badge variant="outline" className="text-muted-foreground">
                    {task.columnName ?? task.status}
                  </Badge>
                </Link>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={t("candidates:task.unlink")}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() =>
                      unlink(
                        { candidateId, taskId: task.taskId },
                        {
                          onError: () =>
                            toast.error(t("candidates:task.unlinkError")),
                        },
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
