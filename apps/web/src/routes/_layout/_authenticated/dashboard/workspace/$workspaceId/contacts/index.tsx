import { createFileRoute } from "@tanstack/react-router";
import { ContactList } from "@/components/contacts/contact-list";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/contacts/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return <ContactList workspaceId={workspaceId} />;
}
