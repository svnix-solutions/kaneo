// Board settings → Screening messages (fork: svnix-solutions/kaneo): the
// Typebot message flows the glue starts for a contact whose task leaves this
// board's backlog, each so many days after the move.
import { useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, MessageSquareText, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { errorMessage } from "@/components/project/error-message";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsNote } from "@/components/settings/settings-note";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { MessageStepInput } from "@/fetchers/screening/replace-message-steps";
import useReplaceMessageSteps from "@/hooks/mutations/screening/use-replace-message-steps";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetMessageSteps from "@/hooks/queries/screening/use-get-message-steps";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type Draft = MessageStepInput & { key: string };

// Variables the glue prefills when it starts a message flow.
const VARIABLES = [
  "lead_id",
  "name",
  "first_name",
  "phone",
  "email",
  "pool",
  "board",
  "link",
  "step",
];

const newKey = () => Math.random().toString(36).slice(2);

export function ScreeningSettingsPage() {
  const { t } = useTranslation();
  const { projectId = "" } = useParams({ strict: false });
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId,
    workspaceId: workspace?.id || "",
  });
  const { data: saved, isLoading } = useGetMessageSteps(projectId);
  const { mutateAsync: replace, isPending } = useReplaceMessageSteps();
  const { canUpdateProjects } = useWorkspacePermission();
  const canEdit = canUpdateProjects();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!saved || dirty) return;
    setDrafts(
      saved.map((s) => ({
        key: s.id,
        name: s.name,
        typebotPublicId: s.typebotPublicId,
        offsetDays: s.offsetDays,
        enabled: s.enabled,
      })),
    );
  }, [saved, dirty]);

  const change = (next: Draft[]) => {
    setDrafts(next);
    setDirty(true);
  };
  const update = (key: string, patch: Partial<Draft>) =>
    change(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const move = (index: number, by: number) => {
    const next = [...drafts];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    change(next);
  };
  const invalid = drafts.some(
    (d) => !d.name.trim() || !d.typebotPublicId.trim() || d.offsetDays < 0,
  );

  const save = async () => {
    try {
      await replace({
        projectId,
        steps: drafts.map(({ key: _key, ...step }) => step),
      });
      setDirty(false);
      toast.success(t("contacts:screening.saved"), {
        icon: MessageSquareText,
      });
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:screening.saveError")));
    }
  };

  return (
    <>
      <PageTitle title={t("contacts:screening.settingsTitle")} />
      <SettingsPage
        title={t("contacts:screening.settingsTitle")}
        description={
          project?.name
            ? t("contacts:screening.settingsDescription", {
                board: project.name,
              })
            : undefined
        }
      >
        <SettingsSection
          title={t("contacts:screening.stepsTitle")}
          description={t("contacts:screening.stepsDescription")}
        >
          <SettingsCard>
            <div className="flex flex-col divide-y divide-border">
              {isLoading ? null : drafts.length === 0 ? (
                <p className="px-4 py-6 text-center text-muted-foreground text-sm">
                  {t("contacts:screening.noSteps")}
                </p>
              ) : (
                drafts.map((draft, index) => (
                  <div
                    key={draft.key}
                    className="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto_auto]"
                  >
                    <Input
                      size="sm"
                      value={draft.name}
                      disabled={!canEdit}
                      aria-label={t("contacts:screening.stepName")}
                      placeholder={t("contacts:screening.stepNamePlaceholder")}
                      onChange={(e) =>
                        update(draft.key, { name: e.target.value })
                      }
                    />
                    <Input
                      size="sm"
                      className="font-mono"
                      value={draft.typebotPublicId}
                      disabled={!canEdit}
                      aria-label={t("contacts:screening.typebot")}
                      placeholder={t("contacts:screening.typebotPlaceholder")}
                      onChange={(e) =>
                        update(draft.key, { typebotPublicId: e.target.value })
                      }
                    />
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <span>{t("contacts:screening.day")}</span>
                      <Input
                        size="sm"
                        type="number"
                        min={0}
                        max={365}
                        value={String(draft.offsetDays)}
                        disabled={!canEdit}
                        aria-label={t("contacts:screening.day")}
                        onChange={(e) =>
                          update(draft.key, {
                            offsetDays: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                      />
                    </div>
                    <Switch
                      checked={draft.enabled ?? true}
                      disabled={!canEdit}
                      aria-label={t("contacts:screening.enabled")}
                      onCheckedChange={(enabled) =>
                        update(draft.key, { enabled })
                      }
                    />
                    {canEdit ? (
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === 0}
                          aria-label={t("contacts:screening.moveUp")}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === drafts.length - 1}
                          aria-label={t("contacts:screening.moveDown")}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t("contacts:screening.removeStep")}
                          onClick={() =>
                            change(drafts.filter((d) => d.key !== draft.key))
                          }
                        >
                          <X />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </SettingsCard>
          {canEdit ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  change([
                    ...drafts,
                    {
                      key: newKey(),
                      name: "",
                      typebotPublicId: "",
                      offsetDays: drafts.length
                        ? (drafts.at(-1)?.offsetDays ?? 0) + 3
                        : 0,
                      enabled: true,
                    },
                  ])
                }
              >
                <Plus className="size-3.5" />
                {t("contacts:screening.addStep")}
              </Button>
              <Button
                size="sm"
                disabled={!dirty || invalid || isPending}
                onClick={() => void save()}
              >
                {t("contacts:save")}
              </Button>
            </div>
          ) : null}
          <SettingsNote>
            {t("contacts:screening.variablesNote", {
              variables: VARIABLES.map((v) => `{{${v}}}`).join(", "),
            })}
          </SettingsNote>
          <SettingsNote>{t("contacts:screening.webhookNote")}</SettingsNote>
        </SettingsSection>
      </SettingsPage>
    </>
  );
}
