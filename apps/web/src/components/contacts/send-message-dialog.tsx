// Send a message to selected contacts (fork: svnix-solutions/kaneo): a
// registered Typebot message flow, or a one-off email / WhatsApp. The glue
// sends; contacts without the needed email or phone are skipped.
import { Send } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import useSendContactMessages from "@/hooks/mutations/contact/use-send-contact-messages";
import useGetPools from "@/hooks/queries/pool/use-get-pools";
import useGetMessageFlows from "@/hooks/queries/screening/use-get-message-flows";
import { toast } from "@/lib/toast";

const PLACEHOLDERS =
  "{{name}} {{first_name}} {{phone}} {{email}} {{pool}} {{link}} {{lead_id}}";
const NONE = "__none";
// These strings show placeholders literally; i18next would otherwise read
// {{pool}} etc. as its own variables.
const LITERAL = {
  pool: "{{pool}}",
  link: "{{link}}",
  first_name: "{{first_name}}",
};

type SendMessageDialogProps = {
  workspaceId: string;
  ids: string[];
  /** On a pool page: the pool the message is about. */
  poolId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  onManageFlows?: () => void;
};

/** Mount with a fresh key per opening. */
export function SendMessageDialog({
  workspaceId,
  ids,
  poolId: fixedPoolId,
  open,
  onOpenChange,
  onSent,
  onManageFlows,
}: SendMessageDialogProps) {
  const { t } = useTranslation();
  const { data: flows = [] } = useGetMessageFlows(workspaceId);
  const { data: pools = [] } = useGetPools(workspaceId);
  const { mutateAsync: send, isPending } = useSendContactMessages();
  const [mode, setMode] = useState<"flow" | "compose">(
    flows.length ? "flow" : "compose",
  );
  const [flowId, setFlowId] = useState(flows[0]?.id ?? "");
  const [poolId, setPoolId] = useState(fixedPoolId ?? "");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("");
  const [language, setLanguage] = useState("en");
  const [params, setParams] = useState("");

  const ready =
    mode === "flow"
      ? !!flowId
      : channel === "email"
        ? !!subject.trim() && !!body.trim()
        : !!body.trim() || !!template.trim();

  const submit = async () => {
    if (!ready) return;
    try {
      const result = await send({
        workspaceId,
        ids,
        poolId: poolId || undefined,
        ...(mode === "flow"
          ? { flowId }
          : {
              compose: {
                channel,
                subject: channel === "email" ? subject : undefined,
                body: body || undefined,
                template:
                  channel === "whatsapp" && template.trim()
                    ? {
                        name: template.trim(),
                        language: language.trim() || "en",
                        params: params
                          .split("\n")
                          .map((p) => p.trim())
                          .filter(Boolean),
                      }
                    : undefined,
              },
            }),
      });
      const summary = t("contacts:send.result", {
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
      });
      if (result.failed) {
        toast.error(summary, {
          description: result.results.find((r) => r.status === "failed")?.error,
        });
      } else {
        toast.success(summary, { icon: Send });
      }
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:send.error")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("contacts:send.title", { count: ids.length })}
          </DialogTitle>
          <DialogDescription>
            {t("contacts:send.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-2">
            <Label>{t("contacts:send.about")}</Label>
            <Select
              value={poolId || NONE}
              disabled={!!fixedPoolId}
              onValueChange={(next) =>
                setPoolId(!next || next === NONE ? "" : String(next))
              }
            >
              <SelectTrigger size="sm" aria-label={t("contacts:send.about")}>
                <SelectValue>
                  {pools.find((p) => p.id === poolId)?.name ??
                    t("contacts:send.noPool")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  {t("contacts:send.noPool")}
                </SelectItem>
                {pools.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {t("contacts:send.aboutHint", LITERAL)}
            </p>
          </div>

          <Tabs
            value={mode}
            onValueChange={(next) => setMode(next as "flow" | "compose")}
          >
            <TabsList>
              <TabsTab value="flow">{t("contacts:send.flowTab")}</TabsTab>
              <TabsTab value="compose">{t("contacts:send.composeTab")}</TabsTab>
            </TabsList>

            <TabsPanel value="flow" className="space-y-2 pt-3">
              {flows.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("contacts:send.noFlows")}
                </p>
              ) : (
                <Select
                  value={flowId || null}
                  onValueChange={(next) => next && setFlowId(String(next))}
                >
                  <SelectTrigger size="sm" aria-label={t("contacts:send.flow")}>
                    <SelectValue>
                      {flows.find((f) => f.id === flowId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {flows.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {onManageFlows ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="px-0 text-muted-foreground"
                  onClick={onManageFlows}
                >
                  {t("contacts:flows.manage")}
                </Button>
              ) : null}
            </TabsPanel>

            <TabsPanel value="compose" className="space-y-3 pt-3">
              <Select
                value={channel}
                onValueChange={(next) =>
                  next && setChannel(next as "email" | "whatsapp")
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label={t("contacts:send.channel")}
                >
                  <SelectValue>
                    {t(`contacts:send.channels.${channel}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    {t("contacts:send.channels.email")}
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    {t("contacts:send.channels.whatsapp")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {channel === "email" ? (
                <Input
                  size="sm"
                  value={subject}
                  aria-label={t("contacts:send.subject")}
                  placeholder={t("contacts:send.subject")}
                  onChange={(e) => setSubject(e.target.value)}
                />
              ) : null}
              <Textarea
                rows={5}
                value={body}
                aria-label={t("contacts:send.body")}
                placeholder={t("contacts:send.bodyPlaceholder", LITERAL)}
                onChange={(e) => setBody(e.target.value)}
              />
              {channel === "whatsapp" ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">
                    {t("contacts:send.templateHint")}
                  </p>
                  <div className="grid grid-cols-[1fr_5rem] gap-2">
                    <Input
                      size="sm"
                      value={template}
                      aria-label={t("contacts:send.template")}
                      placeholder={t("contacts:send.template")}
                      onChange={(e) => setTemplate(e.target.value)}
                    />
                    <Input
                      size="sm"
                      value={language}
                      aria-label={t("contacts:send.language")}
                      onChange={(e) => setLanguage(e.target.value)}
                    />
                  </div>
                  <Textarea
                    rows={3}
                    value={params}
                    aria-label={t("contacts:send.params")}
                    placeholder={t("contacts:send.paramsPlaceholder", LITERAL)}
                    onChange={(e) => setParams(e.target.value)}
                  />
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {t("contacts:send.placeholders", {
                  placeholders: PLACEHOLDERS,
                })}
              </p>
            </TabsPanel>
          </Tabs>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button disabled={!ready || isPending} onClick={() => void submit()}>
            <Send />
            {t("contacts:send.submit", { count: ids.length })}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
