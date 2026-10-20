import { createFileRoute } from "@tanstack/react-router";
import { ScreeningSettingsPage } from "@/components/contacts/screening-settings-page";

// fork: contacts
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/screening",
)({
  component: ScreeningSettingsPage,
});
