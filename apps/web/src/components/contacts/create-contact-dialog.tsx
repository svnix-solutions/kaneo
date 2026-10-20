import { UserPlus } from "lucide-react";
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
import useCreateContact from "@/hooks/mutations/contact/use-create-contact";
import useUpsertPoolMember from "@/hooks/mutations/pool/use-upsert-pool-member";
import { toast } from "@/lib/toast";

type CreateContactDialogProps = {
  workspaceId: string;
  /** On a pool page: also add the new contact to this pool. */
  poolId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (contactId: string) => void;
};

const EMPTY = { name: "", phone: "", email: "", externalId: "", source: "" };
type FormKey = keyof typeof EMPTY;

const optional = (value: string) => value.trim() || null;

export function CreateContactDialog({
  workspaceId,
  poolId,
  open,
  onOpenChange,
  onCreated,
}: CreateContactDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: createContact, isPending: creating } =
    useCreateContact();
  const { mutateAsync: addToPool, isPending: adding } = useUpsertPoolMember();
  const isPending = creating || adding;
  const [form, setForm] = useState(EMPTY);
  const [nameError, setNameError] = useState("");
  const baseId = useId();

  const close = () => {
    onOpenChange(false);
    setForm(EMPTY);
    setNameError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const name = form.name.trim();
    if (!name) {
      setNameError(t("contacts:create.nameRequired"));
      return;
    }
    try {
      const contact = await createContact({
        workspaceId,
        name,
        phone: optional(form.phone),
        email: optional(form.email),
        externalId: optional(form.externalId),
        source: optional(form.source),
      });
      if (poolId) await addToPool({ poolId, contactId: contact.id });
      toast.success(t("contacts:create.success"), { icon: UserPlus });
      close();
      onCreated?.(contact.id);
    } catch (error) {
      toast.error(errorMessage(error, t("contacts:create.error")));
    }
  };

  const fields: { key: FormKey; type?: string }[] = [
    { key: "name" },
    { key: "phone", type: "tel" },
    { key: "email", type: "email" },
    { key: "externalId" },
    { key: "source" },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("contacts:create.title")}</DialogTitle>
            <DialogDescription>
              {t("contacts:create.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            {fields.map(({ key, type }) => {
              const id = `${baseId}-${key}`;
              const isName = key === "name";
              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={id}>{t(`contacts:columns.${key}`)}</Label>
                  <Input
                    id={id}
                    type={type ?? "text"}
                    autoComplete="off"
                    autoFocus={isName}
                    value={form[key]}
                    aria-invalid={isName && nameError ? true : undefined}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((current) => ({ ...current, [key]: value }));
                      if (isName) setNameError("");
                    }}
                  />
                  {isName && nameError ? (
                    <p className="text-destructive-foreground text-xs">
                      {nameError}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("contacts:create.creating")
                : t("contacts:create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
