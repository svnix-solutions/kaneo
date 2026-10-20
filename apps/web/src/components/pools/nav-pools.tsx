// Pools in the sidebar, like projects (fork: svnix-solutions/kaneo).
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Pool } from "@/fetchers/pool/types";
import useDeletePool from "@/hooks/mutations/pool/use-delete-pool";
import useGetPools from "@/hooks/queries/pool/use-get-pools";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { PoolDialog } from "./pool-dialog";

type Editor = { open: boolean; pool: Pool | null; key: number };

export function NavPools() {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data: pools = [] } = useGetPools(workspaceId);
  const { canCreateProjects, canUpdateProjects, canDeleteProjects } =
    useWorkspacePermission();
  const { mutateAsync: deletePool, isPending: deleting } = useDeletePool();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [editor, setEditor] = useState<Editor>({
    open: false,
    pool: null,
    key: 0,
  });
  const [toDelete, setToDelete] = useState<Pool | null>(null);

  if (!workspace) return null;

  const poolUrl = (poolId: string) =>
    `/dashboard/workspace/${workspaceId}/pools/${poolId}`;
  const openPool = (poolId: string) =>
    navigate({
      to: "/dashboard/workspace/$workspaceId/pools/$poolId",
      params: { workspaceId, poolId },
    });
  const openEditor = (pool: Pool | null) =>
    setEditor((current) => ({ open: true, pool, key: current.key + 1 }));

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deletePool(toDelete.id);
      toast.success(t("contacts:pools.deleted"), { icon: Trash2 });
      if (pathname.startsWith(poolUrl(toDelete.id))) {
        navigate({
          to: "/dashboard/workspace/$workspaceId/contacts",
          params: { workspaceId },
        });
      }
      setToDelete(null);
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:pools.deleteError")));
    }
  };

  return (
    <>
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
          <CollapsibleTrigger
            className="data-panel-open:[&_svg]:rotate-90"
            render={
              <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-0 text-sidebar-accent-foreground" />
            }
          >
            <span>{t("contacts:pools.nav")}</span>
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
          </CollapsibleTrigger>
          {canCreateProjects() && (
            <SidebarGroupAction
              className="top-2 right-2 text-sidebar-foreground/70"
              title={t("contacts:pools.add")}
              onClick={() => openEditor(null)}
            >
              <Plus />
              <span className="sr-only">{t("contacts:pools.add")}</span>
            </SidebarGroupAction>
          )}
          <CollapsiblePanel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {pools.length === 0 ? (
                  <p className="px-2 py-1 text-sidebar-foreground/60 text-xs">
                    {t("contacts:pools.navEmpty")}
                  </p>
                ) : null}
                {pools.map((pool) => (
                  <SidebarMenuItem key={pool.id}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(poolUrl(pool.id))}
                      className="h-8 text-sm"
                      onClick={() => openPool(pool.id)}
                    >
                      <UsersRound aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">
                        {pool.name}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 group-has-data-popup-open/menu-item:opacity-0">
                        {pool.memberCount}
                      </span>
                    </SidebarMenuButton>
                    {canUpdateProjects() || canDeleteProjects() ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-lg p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 after:-inset-2 after:absolute md:after:hidden group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 md:opacity-0"
                            />
                          }
                        >
                          <MoreHorizontal />
                          <span className="sr-only">
                            {t("navigation:sidebar.more")}
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="min-w-44 rounded-lg"
                          side={isMobile ? "bottom" : "right"}
                          align={isMobile ? "end" : "start"}
                        >
                          {canUpdateProjects() && (
                            <DropdownMenuItem
                              className="h-7 cursor-pointer text-sm"
                              onClick={() => openEditor(pool)}
                            >
                              <Pencil className="text-muted-foreground" />
                              <span>{t("contacts:pools.edit")}</span>
                            </DropdownMenuItem>
                          )}
                          {canDeleteProjects() && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="h-7 cursor-pointer text-destructive text-sm"
                                onClick={() => setToDelete(pool)}
                              >
                                <Trash2 className="text-destructive" />
                                <span>{t("contacts:pools.delete")}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>

      <PoolDialog
        key={editor.key}
        workspaceId={workspaceId}
        pool={editor.pool}
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        onSaved={(poolId) => {
          if (!editor.pool) void openPool(poolId);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={t("contacts:pools.deleteTitle", { name: toDelete?.name ?? "" })}
        description={t("contacts:pools.deleteDescription")}
        confirmLabel={t("contacts:pools.delete")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
