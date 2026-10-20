import { FolderPlus } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { Pool } from "@/fetchers/pool/types";
import useCreatePool from "@/hooks/mutations/pool/use-create-pool";
import useUpdatePool from "@/hooks/mutations/pool/use-update-pool";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type PoolDialogProps = {
  workspaceId: string;
  /** Edit this pool; omit to create one. */
  pool?: Pool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (poolId: string) => void;
};

/** Create or edit a pool. Mount with a fresh key per opening. */
export function PoolDialog({
  workspaceId,
  pool,
  open,
  onOpenChange,
  onSaved,
}: PoolDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: createPool, isPending: creating } = useCreatePool();
  const { mutateAsync: updatePool, isPending: updating } = useUpdatePool();
  const [name, setName] = useState(pool?.name ?? "");
  const [slug, setSlug] = useState(pool?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!pool);
  const [description, setDescription] = useState(pool?.description ?? "");
  const [screeningProjectId, setScreeningProjectId] = useState(
    pool?.screeningProjectId ?? "",
  );
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const NO_BOARD = "__none";
  const id = useId();
  const pending = creating || updating;
  const effectiveSlug = slugTouched ? slug.trim() : slugify(name);
  const slugInvalid = effectiveSlug !== "" && !SLUG.test(effectiveSlug);
  const canSubmit = name.trim() !== "" && !slugInvalid && !pending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      const body = {
        name: name.trim(),
        slug: effectiveSlug || undefined,
        description: description.trim() || null,
        screeningProjectId: screeningProjectId || null,
      };
      const saved = pool
        ? await updatePool({ poolId: pool.id, ...body })
        : await createPool({ workspaceId, ...body });
      toast.success(
        pool ? t("contacts:pools.updated") : t("contacts:pools.created"),
        { icon: FolderPlus },
      );
      onOpenChange(false);
      onSaved?.(saved.id);
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:pools.saveError")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <form className="contents" noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {pool
                ? t("contacts:pools.editTitle")
                : t("contacts:pools.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("contacts:pools.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>{t("contacts:pools.name")}</Label>
              <Input
                id={`${id}-name`}
                autoFocus
                autoComplete="off"
                placeholder={t("contacts:pools.namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-slug`}>{t("contacts:pools.slug")}</Label>
              <Input
                id={`${id}-slug`}
                autoComplete="off"
                className="font-mono"
                value={effectiveSlug}
                aria-invalid={slugInvalid ? true : undefined}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
              />
              <p
                className={
                  slugInvalid
                    ? "text-destructive-foreground text-xs"
                    : "text-muted-foreground text-xs"
                }
              >
                {slugInvalid
                  ? t("contacts:pools.slugInvalid")
                  : t("contacts:pools.slugHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-description`}>
                {t("contacts:pools.description")}
              </Label>
              <Textarea
                id={`${id}-description`}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("contacts:pools.screeningBoard")}</Label>
              <Select
                value={screeningProjectId || NO_BOARD}
                onValueChange={(next) =>
                  setScreeningProjectId(
                    !next || next === NO_BOARD ? "" : String(next),
                  )
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label={t("contacts:pools.screeningBoard")}
                >
                  <SelectValue>
                    {projects.find((p) => p.id === screeningProjectId)?.name ??
                      t("contacts:pools.noScreeningBoard")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_BOARD}>
                    {t("contacts:pools.noScreeningBoard")}
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {t("contacts:pools.screeningBoardHint")}
              </p>
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pool ? t("contacts:save") : t("contacts:pools.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
