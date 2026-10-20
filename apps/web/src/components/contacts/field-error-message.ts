import type { TFunction } from "i18next";
import { HttpError } from "@/lib/http-error";

/** Field definitions need workspace settings rights; say so on a 403. */
export function fieldErrorMessage(
  error: unknown,
  t: TFunction,
  fallback: string,
) {
  return error instanceof HttpError && error.status === 403
    ? t("contacts:fields.forbidden")
    : fallback;
}
