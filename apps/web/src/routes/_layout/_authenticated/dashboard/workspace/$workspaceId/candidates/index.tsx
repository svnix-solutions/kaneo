import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Contact, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toCustomFieldDefinition } from "@/components/candidates/candidate-field-adapter";
import { CandidateFieldsDialog } from "@/components/candidates/candidate-fields-dialog";
import { CandidatesBulkBar } from "@/components/candidates/candidates-bulk-bar";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CreateCandidateDialog } from "@/components/candidates/create-candidate-dialog";
import { CandidateFilterPopover } from "@/components/candidates/filters/candidate-filter-popover";
import { FilterChips } from "@/components/candidates/filters/filter-chips";
import {
  type DraftFilter,
  EMPTY_FILTER,
  toFilterRequest,
} from "@/components/candidates/filters/filter-model";
import { useFilterSubjects } from "@/components/candidates/filters/use-filter-subjects";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import useGetCandidateFields from "@/hooks/queries/candidate/use-get-candidate-fields";
import useQueryCandidates from "@/hooks/queries/candidate/use-query-candidates";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/candidates/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 250);
  const { data: rawFields = [] } = useGetCandidateFields(workspaceId);
  const fields = useMemo(
    () => rawFields.map(toCustomFieldDefinition),
    [rawFields],
  );
  const subjects = useFilterSubjects(workspaceId, fields);
  const [filter, setFilter] = useState<DraftFilter>(EMPTY_FILTER);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // Debounce the serialized request so typing a value doesn't refetch per key.
  const filterJson = useDebouncedValue(
    JSON.stringify(toFilterRequest(filter, subjects)),
    300,
  );
  const filterRequest = useMemo(
    () => JSON.parse(filterJson) as ReturnType<typeof toFilterRequest>,
    [filterJson],
  );
  const activeCount = filterRequest.conditions.length;
  const { data, isLoading, isError } = useQueryCandidates(
    workspaceId,
    search,
    filterRequest,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { canCreateTasks, canManageSettings } = useWorkspacePermission();
  const canCreate = canCreateTasks();
  const canManageFields = canManageSettings();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);

  const candidates = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  // Only rows on screen count: a filter change hides, and so drops, the rest.
  const selected = candidates.filter((c) => selectedIds.has(c.id));
  const selectAll = useCallback(
    () => setSelectedIds(new Set(candidates.map((c) => c.id))),
    [candidates],
  );
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const openCandidate = (candidateId: string) =>
    navigate({
      to: "/dashboard/workspace/$workspaceId/candidates/$candidateId",
      params: { workspaceId, candidateId },
    });

  const isNarrowed = !!search || activeCount > 0;
  const isEmptyWorkspace =
    !isLoading &&
    !isNarrowed &&
    filter.conditions.length === 0 &&
    candidates.length === 0;

  return (
    <>
      <PageTitle title={t("candidates:pageTitle")} />
      <WorkspaceLayout
        title={t("candidates:pageTitle")}
        headerActions={
          <div className="flex items-center gap-1.5">
            {canManageFields ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsFieldsOpen(true)}
                className="gap-1"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {t("candidates:fields.manage")}
              </Button>
            ) : null}
            {canCreate ? (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsCreateOpen(true)}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                {t("candidates:newCandidate")}
              </Button>
            ) : null}
          </div>
        }
      >
        {isEmptyWorkspace ? (
          <Empty className="min-h-[60vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Contact />
              </EmptyMedia>
              <EmptyTitle>
                {isError
                  ? t("candidates:loadError")
                  : t("candidates:emptyTitle")}
              </EmptyTitle>
              {!isError && (
                <EmptyDescription>
                  {t("candidates:emptyDescription")}
                </EmptyDescription>
              )}
            </EmptyHeader>
            {canCreate && !isError && (
              <EmptyContent>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus />
                  {t("candidates:newCandidate")}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <InputGroup className="max-w-sm">
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    value={query}
                    aria-label={t("candidates:searchPlaceholder")}
                    placeholder={t("candidates:searchPlaceholder")}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </InputGroup>
                <CandidateFilterPopover
                  subjects={subjects}
                  filter={filter}
                  onChange={setFilter}
                  activeCount={activeCount}
                  open={isFilterOpen}
                  onOpenChange={setIsFilterOpen}
                />
              </div>
              {total > candidates.length ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t("candidates:showing", {
                    shown: candidates.length,
                    total,
                  })}
                </span>
              ) : null}
            </div>
            <FilterChips
              subjects={subjects}
              filter={filter}
              onChange={setFilter}
              onEdit={() => setIsFilterOpen(true)}
            />
            <CandidatesTable
              candidates={candidates}
              fields={fields}
              isLoading={isLoading}
              onOpen={openCandidate}
              selection={{ selected: selectedIds, onChange: setSelectedIds }}
            />
            {!isLoading && isNarrowed && candidates.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground text-sm">
                {search && activeCount === 0
                  ? t("candidates:noResults", { query: search })
                  : t("candidates:filter.noResults")}
              </p>
            ) : null}
          </div>
        )}
      </WorkspaceLayout>

      <CandidatesBulkBar
        workspaceId={workspaceId}
        selected={selected}
        fields={fields}
        selectAll={selectAll}
        clearSelection={clearSelection}
      />
      <CreateCandidateDialog
        workspaceId={workspaceId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={openCandidate}
      />
      {canManageFields ? (
        <CandidateFieldsDialog
          workspaceId={workspaceId}
          open={isFieldsOpen}
          onOpenChange={setIsFieldsOpen}
        />
      ) : null}
    </>
  );
}
