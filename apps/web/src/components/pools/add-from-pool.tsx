// "Add from pool" on a board (fork: svnix-solutions/kaneo): shortlist pool
// members onto this board, one task each, linked to the member.
import { useParams } from "@tanstack/react-router";
import { Kanban, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toCustomFieldDefinition } from "@/components/contacts/field-adapter";
import { FilterChips } from "@/components/contacts/filters/filter-chips";
import {
  type DraftFilter,
  EMPTY_FILTER,
  toFilterRequest,
} from "@/components/contacts/filters/filter-model";
import { FilterPopover } from "@/components/contacts/filters/filter-popover";
import { useFilterSubjects } from "@/components/contacts/filters/use-filter-subjects";
import { errorMessage } from "@/components/project/error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useAddPoolMembersToBoard from "@/hooks/mutations/pool/use-add-pool-members-to-board";
import useGetPoolFields from "@/hooks/queries/pool/use-get-pool-fields";
import useGetPools from "@/hooks/queries/pool/use-get-pools";
import useQueryPoolMembers from "@/hooks/queries/pool/use-query-pool-members";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import {
  type BoardStage,
  BoardStagePicker,
  resolvedColumnId,
} from "./board-stage-picker";

/** Toolbar button on a board's views; hidden when there is nothing to add. */
export function AddFromPoolButton() {
  const { t } = useTranslation();
  const { workspaceId, projectId } = useParams({ strict: false }) as {
    workspaceId?: string;
    projectId?: string;
  };
  const { data: pools = [] } = useGetPools(workspaceId ?? "");
  const { canCreateTasks } = useWorkspacePermission();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  if (!workspaceId || !projectId || pools.length === 0 || !canCreateTasks())
    return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <UsersRound />
        <span className="max-md:sr-only">
          {t("contacts:pipelines.addFromPool")}
        </span>
      </Button>
      <AddFromPoolDialog
        key={key}
        workspaceId={workspaceId}
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function AddFromPoolDialog({
  workspaceId,
  projectId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: pools = [] } = useGetPools(workspaceId);
  const [poolId, setPoolId] = useState(pools[0]?.id ?? "");
  const pool = pools.find((p) => p.id === poolId);
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 250);
  const { data: rawFields = [] } = useGetPoolFields(poolId);
  const fields = useMemo(
    () => rawFields.map(toCustomFieldDefinition),
    [rawFields],
  );
  const subjects = useFilterSubjects(workspaceId, { fields });
  const [filter, setFilter] = useState<DraftFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterJson = useDebouncedValue(
    JSON.stringify(toFilterRequest(filter, subjects)),
    300,
  );
  const filterRequest = useMemo(
    () => JSON.parse(filterJson) as ReturnType<typeof toFilterRequest>,
    [filterJson],
  );
  const { data, isLoading } = useQueryPoolMembers(
    open ? poolId : "",
    search,
    filterRequest,
  );
  const members = data?.items ?? [];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<BoardStage>({ projectId, columnId: "" });
  const { mutateAsync: add, isPending } = useAddPoolMembersToBoard();

  const onBoard = (m: (typeof members)[number]) =>
    m.pipelines.some((p) => p.projectId === projectId);
  const choosable = members.filter((m) => !onBoard(m));
  const chosen = choosable.filter((m) => picked.has(m.id));

  const switchPool = (next: string) => {
    setPoolId(next);
    setPicked(new Set());
    setFilter(EMPTY_FILTER);
  };

  const submit = async () => {
    if (!pool || chosen.length === 0) return;
    try {
      const { added } = await add({
        poolId: pool.id,
        ids: chosen.map((m) => m.id),
        projectId,
        columnId: resolvedColumnId(stage),
      });
      toast.success(
        t("contacts:pipelines.addedFromPool", {
          count: added,
          pool: pool.name,
        }),
        { icon: Kanban },
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:pipelines.addError")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("contacts:pipelines.addFromPool")}</DialogTitle>
          <DialogDescription>
            {t("contacts:pipelines.addFromPoolDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={poolId || null}
              onValueChange={(next) => next && switchPool(String(next))}
            >
              <SelectTrigger
                size="sm"
                className="w-48"
                aria-label={t("contacts:pools.nav")}
              >
                <SelectValue>{pool?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pools.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InputGroup className="min-w-40 flex-1">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={query}
                aria-label={t("contacts:searchPlaceholder")}
                placeholder={t("contacts:searchPlaceholder")}
                onChange={(event) => setQuery(event.target.value)}
              />
            </InputGroup>
            <FilterPopover
              subjects={subjects}
              filter={filter}
              onChange={setFilter}
              activeCount={filterRequest.conditions.length}
              open={filterOpen}
              onOpenChange={setFilterOpen}
            />
          </div>
          <FilterChips
            subjects={subjects}
            filter={filter}
            onChange={setFilter}
            onEdit={() => setFilterOpen(true)}
          />
          <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-muted-foreground text-sm">
                {t("contacts:pipelines.loading")}
              </p>
            ) : members.length === 0 ? (
              <p className="px-3 py-6 text-center text-muted-foreground text-sm">
                {t("contacts:pipelines.noMembers")}
              </p>
            ) : (
              members.map((member) => {
                const already = onBoard(member);
                return (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm has-disabled:cursor-default has-disabled:opacity-60"
                  >
                    <Checkbox
                      checked={already || picked.has(member.id)}
                      disabled={already}
                      onCheckedChange={(checked) =>
                        setPicked((current) => {
                          const next = new Set(current);
                          if (checked) next.add(member.id);
                          else next.delete(member.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {member.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {already
                        ? t("contacts:pipelines.alreadyOnBoard")
                        : (member.phone ?? member.email ?? "")}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-muted-foreground text-xs hover:text-foreground disabled:opacity-50"
              disabled={choosable.length === 0}
              onClick={() =>
                setPicked(
                  chosen.length === choosable.length
                    ? new Set()
                    : new Set(choosable.map((m) => m.id)),
                )
              }
            >
              {chosen.length === choosable.length && choosable.length > 0
                ? t("contacts:pipelines.selectNone")
                : t("contacts:pipelines.selectAllShown", {
                    count: choosable.length,
                  })}
            </button>
            <div className="w-56">
              <BoardStagePicker
                workspaceId={workspaceId}
                value={stage}
                onChange={setStage}
                fixedProjectId={projectId}
              />
            </div>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={chosen.length === 0 || isPending}
            onClick={() => void submit()}
          >
            {t("contacts:pipelines.addCount", { count: chosen.length })}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
