import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Contact } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ContactDetail } from "@/components/contacts/contact-detail";
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
import { Skeleton } from "@/components/ui/skeleton";
import useGetContact from "@/hooks/queries/contact/use-get-contact";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/contacts/$contactId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, contactId } = Route.useParams();
  const { data: contact, isLoading } = useGetContact(contactId);
  const title = contact?.name ?? t("contacts:pageTitle");

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout
        title={title}
        headerActions={
          <Button
            variant="ghost"
            size="xs"
            className="gap-1"
            render={
              <Link
                to="/dashboard/workspace/$workspaceId/contacts"
                params={{ workspaceId }}
              />
            }
          >
            <ArrowLeft className="h-3 w-3" />
            {t("contacts:detail.back")}
          </Button>
        }
      >
        {isLoading ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 sm:px-6">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-6 h-32 w-full" />
          </div>
        ) : contact ? (
          <ContactDetail
            key={contact.id}
            contact={contact}
            workspaceId={workspaceId}
          />
        ) : (
          <Empty className="min-h-[60vh]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Contact />
              </EmptyMedia>
              <EmptyTitle>{t("contacts:detail.notFound")}</EmptyTitle>
              <EmptyDescription>
                {t("contacts:detail.notFoundDescription")}
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
