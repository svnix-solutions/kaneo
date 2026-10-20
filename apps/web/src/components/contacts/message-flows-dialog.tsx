// The workspace's message flows (fork: svnix-solutions/kaneo): Typebot flows
// recruiters can send by hand from the Contacts and pool pages.
import { MessageSquareText, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MessageFlowInput } from "@/fetchers/screening/replace-message-flows";
import useReplaceMessageFlows from "@/hooks/mutations/screening/use-replace-message-flows";
import useGetMessageFlows from "@/hooks/queries/screening/use-get-message-flows";
import { toast } from "@/lib/toast";

type Draft = MessageFlowInput & { key: string };
const newKey = () => Math.random().toString(36).slice(2);

/** Mount with a fresh key per opening. */
export function MessageFlowsDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: flows = [] } = useGetMessageFlows(workspaceId);
  const { mutateAsync: replace, isPending } = useReplaceMessageFlows();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    flows.map((f) => ({
      key: f.id,
      name: f.name,
      typebotPublicId: f.typebotPublicId,
      description: f.description,
    })),
  );
  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  const invalid = drafts.some(
    (d) => !d.name.trim() || !d.typebotPublicId.trim(),
  );

  const save = async () => {
    try {
      await replace({
        workspaceId,
        flows: drafts.map(({ key: _key, ...flow }) => flow),
      });
      toast.success(t("contacts:flows.saved"), { icon: MessageSquareText });
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:flows.saveError")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("contacts:flows.title")}</DialogTitle>
          <DialogDescription>
            {t("contacts:flows.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-2">
          {drafts.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground text-sm">
              {t("contacts:flows.empty")}
            </p>
          ) : (
            drafts.map((d) => (
              <div
                key={d.key}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
              >
                <Input
                  size="sm"
                  value={d.name}
                  aria-label={t("contacts:flows.name")}
                  placeholder={t("contacts:flows.namePlaceholder")}
                  onChange={(e) => update(d.key, { name: e.target.value })}
                />
                <Input
                  size="sm"
                  className="font-mono"
                  value={d.typebotPublicId}
                  aria-label={t("contacts:screening.typebot")}
                  placeholder={t("contacts:screening.typebotPlaceholder")}
                  onChange={(e) =>
                    update(d.key, { typebotPublicId: e.target.value })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("contacts:flows.remove")}
                  onClick={() =>
                    setDrafts((current) =>
                      current.filter((x) => x.key !== d.key),
                    )
                  }
                >
                  <X />
                </Button>
              </div>
            ))
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() =>
              setDrafts((current) => [
                ...current,
                { key: newKey(), name: "", typebotPublicId: "" },
              ])
            }
          >
            <Plus className="size-3.5" />
            {t("contacts:flows.add")}
          </Button>
          <p className="text-muted-foreground text-xs">
            {t("contacts:flows.hint")}
          </p>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button disabled={invalid || isPending} onClick={() => void save()}>
            {t("contacts:save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
