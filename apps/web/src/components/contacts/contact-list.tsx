import { useNavigate } from "@tanstack/react-router";
import {
  Contact,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import type { Pool } from "@/fetchers/pool/types";
import useQueryContacts from "@/hooks/queries/contact/use-query-contacts";
import useGetPoolFields from "@/hooks/queries/pool/use-get-pool-fields";
import useQueryPoolMembers from "@/hooks/queries/pool/use-query-pool-members";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { BulkBar } from "./bulk-bar";
import { ContactsTable } from "./contacts-table";
import { CreateContactDialog } from "./create-contact-dialog";
import { toCustomFieldDefinition } from "./field-adapter";
import { FilterChips } from "./filters/filter-chips";
import { MessageFlowsDialog } from "./message-flows-dialog";
import { SendMessageDialog } from "./send-message-dialog";
import {
  type DraftFilter,
  EMPTY_FILTER,
  toFilterRequest,
} from "./filters/filter-model";
import { FilterPopover } from "./filters/filter-popover";
import { useFilterSubjects } from "./filters/use-filter-subjects";
import { PoolFieldsDialog } from "./pool-fields-dialog";

type ContactListProps = {
  workspaceId: string;
  /** A pool page lists that pool's members with its fields; else all contacts. */
  pool?: Pool;
};

/** The Contacts page and each pool page: search, filters, table, bulk bar. */
export function ContactList({ workspaceId, pool }: ContactListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const poolId = pool?.id ?? "";
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 250);
  const { data: rawFields = [] } = useGetPoolFields(poolId);
  const fields = useMemo(
    () => rawFields.map(toCustomFieldDefinition),
    [rawFields],
  );
  const subjects = useFilterSubjects(
    workspaceId,
    pool ? { fields, pool } : { pools: true },
  );
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
  const contactsQuery = useQueryContacts(
    pool ? "" : workspaceId,
    search,
    filterRequest,
  );
  const membersQuery = useQueryPoolMembers(poolId, search, filterRequest);
  const { data, isLoading, isError } = pool ? membersQuery : contactsQuery;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { canCreateTasks, canManageSettings } = useWorkspacePermission();
  const canCreate = canCreateTasks();
  const canManageFields = !!pool && canManageSettings();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const canManageFlows = canManageSettings();
  // Dialogs remount on each opening (they copy their initial state).
  const [send, setSend] = useState({ open: false, key: 0 });
  const [flowsDialog, setFlowsDialog] = useState({ open: false, key: 0 });
  const openFlows = () => {
    setSend((s) => ({ ...s, open: false }));
    setFlowsDialog((f) => ({ open: true, key: f.key + 1 }));
  };

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  // Only rows on screen count: a filter change hides, and so drops, the rest.
  const selected = rows.filter((c) => selectedIds.has(c.id));
  const selectAll = useCallback(
    () => setSelectedIds(new Set(rows.map((c) => c.id))),
    [rows],
  );
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const openContact = (contactId: string) =>
    navigate({
      to: "/dashboard/workspace/$workspaceId/contacts/$contactId",
      params: { workspaceId, contactId },
    });

  const title = pool?.name ?? t("contacts:pageTitle");
  const isNarrowed = !!search || activeCount > 0;
  const isEmpty =
    !isLoading &&
    !isNarrowed &&
    filter.conditions.length === 0 &&
    rows.length === 0;

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout
        title={title}
        headerActions={
          <div className="flex items-center gap-1.5">
            {canManageFlows ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={openFlows}
                className="gap-1"
              >
                <MessageSquareText className="h-3 w-3" />
                {t("contacts:flows.title")}
              </Button>
            ) : null}
            {canManageFields ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsFieldsOpen(true)}
                className="gap-1"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {t("contacts:poolFields.manage")}
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
                {t("contacts:newContact")}
              </Button>
            ) : null}
          </div>
        }
      >
        {isEmpty ? (
          <Empty className="min-h-[60vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Contact />
              </EmptyMedia>
              <EmptyTitle>
                {isError
                  ? t("contacts:loadError")
                  : pool
                    ? t("contacts:pools.emptyTitle")
                    : t("contacts:emptyTitle")}
              </EmptyTitle>
              {!isError && (
                <EmptyDescription>
                  {pool
                    ? t("contacts:pools.emptyDescription")
                    : t("contacts:emptyDescription")}
                </EmptyDescription>
              )}
            </EmptyHeader>
            {canCreate && !isError && (
              <EmptyContent>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus />
                  {t("contacts:newContact")}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {pool?.description ? (
              <p className="px-4 pt-4 text-muted-foreground text-sm">
                {pool.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <InputGroup className="max-w-sm">
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
                  activeCount={activeCount}
                  open={isFilterOpen}
                  onOpenChange={setIsFilterOpen}
                />
              </div>
              {total > rows.length ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {t("contacts:showing", { shown: rows.length, total })}
                </span>
              ) : null}
            </div>
            <FilterChips
              subjects={subjects}
              filter={filter}
              onChange={setFilter}
              onEdit={() => setIsFilterOpen(true)}
            />
            <ContactsTable
              contacts={rows}
              fields={fields}
              showPools={!pool}
              showPipelines={!!pool}
              workspaceId={workspaceId}
              isLoading={isLoading}
              onOpen={openContact}
              selection={{ selected: selectedIds, onChange: setSelectedIds }}
            />
            {!isLoading && isNarrowed && rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground text-sm">
                {search && activeCount === 0
                  ? t("contacts:noResults", { query: search })
                  : t("contacts:filter.noResults")}
              </p>
            ) : null}
          </div>
        )}
      </WorkspaceLayout>

      <BulkBar
        workspaceId={workspaceId}
        selected={selected}
        pool={pool}
        fields={fields}
        selectAll={selectAll}
        clearSelection={clearSelection}
        onSendMessage={() => setSend((s) => ({ open: true, key: s.key + 1 }))}
      />
      <SendMessageDialog
        key={`send-${send.key}`}
        workspaceId={workspaceId}
        ids={selected.map((c) => c.id)}
        poolId={pool?.id}
        open={send.open}
        onOpenChange={(open) => setSend((s) => ({ ...s, open }))}
        onManageFlows={canManageFlows ? openFlows : undefined}
      />
      {canManageFlows ? (
        <MessageFlowsDialog
          key={`flows-${flowsDialog.key}`}
          workspaceId={workspaceId}
          open={flowsDialog.open}
          onOpenChange={(open) => setFlowsDialog((f) => ({ ...f, open }))}
        />
      ) : null}
      <CreateContactDialog
        workspaceId={workspaceId}
        poolId={pool?.id}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={openContact}
      />
      {pool && canManageFields ? (
        <PoolFieldsDialog
          poolId={pool.id}
          poolName={pool.name}
          open={isFieldsOpen}
          onOpenChange={setIsFieldsOpen}
        />
      ) : null}
    </>
  );
}
