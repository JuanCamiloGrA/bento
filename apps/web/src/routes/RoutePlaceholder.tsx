import { EmptyState } from "../components/States";
import { t } from "../i18n/dictionary";
import type { MessageKey } from "../i18n/dictionary";

export type RoutePlaceholderProps = {
  bodyKey: MessageKey;
  titleKey: MessageKey;
};

export function RoutePlaceholder({ bodyKey, titleKey }: RoutePlaceholderProps) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <EmptyState body={t(bodyKey)} title={t(titleKey)} />
    </div>
  );
}
