import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { ContactList } from "@/components/contacts/contact-list";
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
import { Skeleton } from "@/components/ui/skeleton";
import useGetPool from "@/hooks/queries/pool/use-get-pool";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/pools/$poolId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, poolId } = Route.useParams();
  const { data: pool, isLoading } = useGetPool(poolId);

  if (pool) {
    return <ContactList key={pool.id} workspaceId={workspaceId} pool={pool} />;
  }

  return (
    <>
      <PageTitle title={t("contacts:pools.nav")} />
      <WorkspaceLayout title={t("contacts:pools.nav")}>
        {isLoading ? (
          <div className="flex flex-col gap-3 px-4 py-6">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Empty className="min-h-[60vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>{t("contacts:pools.notFound")}</EmptyTitle>
              <EmptyDescription>
                {t("contacts:pools.notFoundDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                render={
                  <Link
                    to="/dashboard/workspace/$workspaceId/contacts"
                    params={{ workspaceId }}
                  />
                }
              >
                <ArrowLeft />
                {t("contacts:detail.back")}
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </WorkspaceLayout>
    </>
  );
}
