import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  Download,
  FolderOpen,
  Gauge,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { Button } from "../../components/Button";
import { Checkbox } from "../../components/Checkbox";
import { Dialog } from "../../components/Dialog";
import { ErrorState, LoadingState } from "../../components/States";
import { hasMessage, t } from "../../i18n/dictionary";
import type { MessageKey } from "../../i18n/dictionary";
import { cx } from "../../lib/cx";
import type { ApplyMode, FieldIssue, SettingDefinition } from "../../api/settings";
import type { SettingsController } from "./useSettingsController";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";

type Category = "overview" | "general" | "storage" | "telegram" | "ai" | "performance" | "advanced";

const categories: { icon: typeof Settings2; key: Category; label: MessageKey }[] = [
  { icon: ShieldCheck, key: "overview", label: "settings.category.overview" },
  { icon: Settings2, key: "general", label: "settings.category.general" },
  { icon: Database, key: "storage", label: "settings.category.storage" },
  { icon: Bot, key: "telegram", label: "settings.category.telegram" },
  { icon: Cpu, key: "ai", label: "settings.category.ai" },
  { icon: Gauge, key: "performance", label: "settings.category.performance" },
  { icon: KeyRound, key: "advanced", label: "settings.category.advanced" },
];

export function EditableSettingsPage({ controller }: { controller: SettingsController }) {
  const [category, setCategory] = useState<Category>("overview");
  const [query, setQuery] = useState("");
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    try { return window.localStorage.getItem("bento:onboarding-complete") === "1"; } catch { return false; }
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const fields = controller.schema?.fields ?? [];
  const visibleFields = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return fields.filter((field) => {
      if (category !== "overview" && field.group !== category) return false;
      if (!normalized) return true;
      return `${fieldLabel(field)} ${fieldHelp(field)} ${field.env_aliases.join(" ")}`.toLocaleLowerCase("es").includes(normalized);
    });
  }, [category, fields, query]);

  if (controller.isLoading) return <PageState><LoadingState /></PageState>;
  if (controller.error && !controller.schema) return <PageState><ErrorState body={t("settings.settingsError.body")} onRetry={() => void controller.refresh()} /></PageState>;

  function completeOnboarding() {
    try { window.localStorage.setItem("bento:onboarding-complete", "1"); } catch { /* A private browser can deny storage. */ }
    setOnboardingComplete(true);
  }

  return (
    <div className="mx-auto w-full max-w-7xl pb-24">
      {controller.desktop && !onboardingComplete ? <OnboardingWizard controller={controller} onComplete={completeOnboarding} /> : null}
      <header className="mb-5 flex flex-col gap-4 border-b border-app-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-app-accent">{t("settings.eyebrow")}</p>
          <h1 className="text-2xl font-black tracking-tight text-app-text">{t("settings.header.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-app-text-muted">{t("settings.editable.subtitle")}</p>
        </div>
        <label className="relative block w-full lg:w-80">
          <span className="sr-only">{t("settings.search.label")}</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 text-app-text-muted" aria-hidden="true" size={18} />
          <input
            className="h-10 w-full rounded-app-control border border-app-border bg-app-surface pl-10 pr-3 text-sm outline-none focus:border-app-accent focus:ring-4 focus:ring-app-accent/10"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("settings.search.placeholder")}
            ref={searchRef}
            type="search"
            value={query}
          />
        </label>
      </header>

      {controller.desktop?.recoveryMode ? <Notice tone="danger" title={t("settings.recovery.title")} body={t("settings.recovery.body")} /> : null}
      {!controller.desktop ? <Notice tone="info" title={t("settings.headless.title")} body={t("settings.headless.body")} /> : null}
      {controller.desktop?.secureStorage === "unavailable" ? <Notice tone="warning" title={t("settings.secureStorage.title")} body={t("settings.secureStorage.body")} /> : null}
      {controller.conflict ? (
        <div className="mb-4 flex flex-col gap-3 rounded-app-card border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div><strong>{t("settings.conflict.title")}</strong><p className="text-sm text-amber-900">{t("settings.conflict.body")}</p></div>
          <Button onClick={() => void controller.refresh()}><RefreshCw aria-hidden="true" size={16} />{t("settings.conflict.reload")}</Button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label={t("settings.categories.label")} className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex gap-1 overflow-x-auto rounded-app-card border border-app-border bg-app-surface p-2 lg:grid">
            {categories.map((item) => {
              const Icon = item.icon;
              const active = category === item.key;
              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={cx("flex min-w-max items-center gap-2 rounded-app-control px-3 py-2 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-app-accent", active ? "bg-app-accent text-white" : "text-app-text-muted hover:bg-app-surface-muted hover:text-app-text")}
                  key={item.key}
                  onClick={() => { setCategory(item.key); if (query) searchRef.current?.focus(); }}
                  type="button"
                >
                  <Icon aria-hidden="true" size={17} />{t(item.label)}
                </button>
              );
            })}
          </div>
        </nav>

        <main className="min-w-0" aria-live="polite">
          {category === "overview" && !query ? <HealthOverview controller={controller} onOpen={setCategory} /> : (
            <section aria-labelledby="settings-section-title" className="overflow-hidden rounded-app-card border border-app-border bg-app-surface shadow-xs">
              <div className="flex items-start justify-between gap-4 border-b border-app-border p-5">
                <div>
                  <h2 className="text-lg font-black text-app-text" id="settings-section-title">{t(categories.find((item) => item.key === category)?.label ?? "settings.header.title")}</h2>
                  <p className="mt-1 text-sm text-app-text-muted">{query ? t("settings.search.results") : categoryHelp(category)}</p>
                </div>
                {category !== "overview" ? <Button onClick={() => controller.resetGroup(category)}><RotateCcw aria-hidden="true" size={15} />{t("settings.reset.section")}</Button> : null}
              </div>
              <div className="divide-y divide-app-border">
                {visibleFields.length ? visibleFields.map((field) => <SettingField controller={controller} field={field} key={field.key} />) : <p className="p-8 text-center text-sm text-app-text-muted">{t("settings.search.empty")}</p>}
              </div>
              {category === "advanced" ? <AdvancedTools controller={controller} /> : null}
            </section>
          )}

          {controller.validation ? <ValidationSummary controller={controller} /> : null}
          {controller.applyProgress.length ? <ApplyProgressList controller={controller} /> : null}
          {controller.applyOutcome?.rolledBack ? <Notice tone="danger" title={t("settings.rollback.title")} body={t("settings.rollback.body")} /> : null}
          {controller.applyOutcome && !controller.applyOutcome.rolledBack ? <Notice tone="success" title={t("settings.saved.title")} body={t("settings.saved.body")} /> : null}
        </main>
      </div>

      {controller.dirty ? <DirtyBar controller={controller} /> : null}
    </div>
  );
}

function HealthOverview({ controller, onOpen }: { controller: SettingsController; onOpen: (category: Category) => void }) {
  const [confirmReclaim, setConfirmReclaim] = useState(false);
  const publicSettings = controller.publicSettings;
  const cards = [
    { category: "storage" as const, good: publicSettings?.storage_backend === "local" || Boolean(publicSettings?.telegram_configured), label: t("settings.health.storage"), value: publicSettings?.storage_backend === "telegram" ? t("settings.storage.telegram") : t("settings.storage.local") },
    { category: "telegram" as const, good: Boolean(publicSettings?.telegram_configured), label: t("settings.health.telegram"), value: publicSettings?.telegram_configured ? t("settings.telegram.configured") : t("settings.telegram.notConfigured") },
    { category: "ai" as const, good: publicSettings?.ocr_state !== "error" && publicSettings?.embeddings_state !== "error", label: t("settings.health.indexing"), value: publicSettings?.embeddings_state === "ready" || publicSettings?.ocr_state === "ready" ? t("settings.provider.ready") : t("settings.provider.disabled") },
    { category: "performance" as const, good: publicSettings?.worker_status !== "degraded", label: t("settings.health.worker"), value: publicSettings?.worker_status === "running" ? t("settings.worker.running") : t("settings.worker.stopped") },
  ];
  return (
    <section aria-labelledby="health-title">
      <div className="mb-4"><h2 className="text-lg font-black" id="health-title">{t("settings.health.title")}</h2><p className="text-sm text-app-text-muted">{t("settings.health.body")}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <button className="group flex items-center gap-4 rounded-app-card border border-app-border bg-app-surface p-5 text-left shadow-2xs outline-none hover:border-app-accent/40 focus-visible:ring-2 focus-visible:ring-app-accent" key={card.category} onClick={() => onOpen(card.category)} type="button">
            <span className={cx("grid size-10 shrink-0 place-items-center rounded-full", card.good ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>{card.good ? <CheckCircle2 aria-hidden="true" size={21} /> : <AlertCircle aria-hidden="true" size={21} />}</span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase tracking-wider text-app-text-muted">{card.label}</span><span className="mt-1 block font-bold text-app-text">{card.value}</span></span>
            <ChevronRight className="text-app-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" size={18} />
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-app-card border border-app-border bg-app-surface-muted/50 p-5">
        <h3 className="font-bold">{t("settings.desktopStatus.title")}</h3>
        <p className="mt-1 text-sm text-app-text-muted">{controller.desktop ? t("settings.desktopStatus.desktop") : t("settings.desktopStatus.browser")}</p>
      </div>
      {publicSettings?.storage_maintenance ? <div className="mt-4 flex flex-col gap-3 rounded-app-card border border-app-border bg-app-surface p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">{t("settings.space.title")}</h3><p className="mt-1 text-sm text-app-text-muted">{t("settings.space.reclaimable")}: {formatBytes(publicSettings.storage_maintenance.reclaimable_bytes)}</p></div><Button disabled={!publicSettings.storage_maintenance.can_reclaim || controller.isReclaiming} onClick={() => setConfirmReclaim(true)}>{controller.isReclaiming ? t("settings.space.reclaiming") : t("settings.space.action")}</Button></div> : null}
      {controller.reclaimResult ? <p className="mt-3 rounded-app-control bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{t("settings.space.success")} {formatBytes(controller.reclaimResult.freed_bytes)}</p> : null}
      {controller.reclaimError ? <p className="mt-3 rounded-app-control bg-red-50 p-3 text-sm text-red-800" role="alert">{t("settings.space.error")}</p> : null}
      <Dialog actions={<><Button onClick={() => setConfirmReclaim(false)}>{t("common.close")}</Button><Button onClick={() => { setConfirmReclaim(false); void controller.reclaim(); }} variant="primary">{t("settings.space.confirm")}</Button></>} onOpenChange={setConfirmReclaim} open={confirmReclaim} title={t("settings.space.dialogTitle")}><p>{t("settings.space.dialogBody")}</p></Dialog>
    </section>
  );
}

function SettingField({ controller, field }: { controller: SettingsController; field: SettingDefinition }) {
  const current = controller.values?.values[field.key];
  const disabled = !field.editable || field.locked;
  const error = controller.fieldErrors[field.key]?.[0];
  return (
    <div className="grid gap-4 p-5 xl:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.2fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-app-text">{fieldLabel(field)}</h3>{field.locked ? <Badge><LockKeyhole aria-hidden="true" size={12} />{sourceLabel(current?.source ?? field.source)}</Badge> : null}</div>
        <p className="mt-1 text-sm leading-relaxed text-app-text-muted">{fieldHelp(field)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5"><Badge>{sourceLabel(current?.source ?? field.source)}</Badge><Badge>{applyLabel(field.apply_mode)}</Badge></div>
        {field.locked && field.env_aliases[0] ? <p className="mt-2 text-xs text-app-text-muted">{t("settings.locked.byEnvironment")} <code>{field.env_aliases[0]}</code></p> : null}
      </div>
      <div className="self-center">
        {field.secret ? <SecretControl controller={controller} disabled={disabled} field={field} /> : <ValueControl controller={controller} disabled={disabled} field={field} />}
        {field.key === "data_dir" && JSON.stringify(controller.draft.data_dir) !== JSON.stringify(controller.values?.values.data_dir?.value) ? <DataMigrationChoice controller={controller} /> : null}
        {field.probe && field.probe !== "storage" && controller.desktop ? <div className="mt-2 flex items-center gap-2"><Button onClick={() => void controller.probe(field.key, field.probe!)}>{t("settings.probe.action")}</Button>{controller.validation?.probes.find((probe) => probe.key === field.key) ? <span className="text-sm font-semibold" role="status">{controller.validation.probes.find((probe) => probe.key === field.key)?.status === "ok" ? t("settings.probe.ok") : t("settings.probe.failed")}</span> : null}</div> : null}
        {error ? <p className="mt-2 text-sm font-semibold text-red-700" id={`${field.key}-error`} role="alert">{issueMessage(error)}</p> : null}
      </div>
    </div>
  );
}

function ValueControl({ controller, disabled, field }: { controller: SettingsController; disabled: boolean; field: SettingDefinition }) {
  const value = controller.draft[field.key];
  const common = { "aria-describedby": controller.fieldErrors[field.key] ? `${field.key}-error` : undefined, "aria-label": fieldLabel(field), disabled, id: `setting-${field.key}` };
  if (field.type === "boolean") return <Checkbox checked={Boolean(value)} label={fieldLabel(field)} onChange={(event) => controller.setValue(field.key, event.target.checked)} {...common} />;
  if (field.type === "choice") return <select className="h-10 w-full rounded-app-control border border-app-border bg-app-surface px-3 text-sm outline-none focus:border-app-accent focus:ring-4 focus:ring-app-accent/10 disabled:bg-app-surface-muted" onChange={(event) => controller.setValue(field.key, event.target.value)} value={String(value ?? "")} {...common}>{field.constraints.choices.map((choice) => <option key={choice} value={choice}>{choiceLabel(field.key, choice)}</option>)}</select>;
  const input = <input className="h-10 w-full rounded-app-control border border-app-border bg-app-surface px-3 text-sm outline-none focus:border-app-accent focus:ring-4 focus:ring-app-accent/10 disabled:bg-app-surface-muted" max={field.constraints.maximum ?? undefined} min={field.constraints.minimum ?? undefined} onChange={(event) => controller.setValue(field.key, field.type === "integer" || field.type === "number" ? event.target.valueAsNumber : event.target.value)} step={field.type === "integer" ? 1 : field.type === "number" ? "any" : undefined} type={field.type === "integer" || field.type === "number" ? "number" : "text"} value={String(value ?? "")} {...common} />;
  if (field.type !== "path") return input;
  return <div className="flex gap-2">{input}{controller.desktop ? <Button aria-label={t("settings.path.pick")} onClick={() => void controller.pickPath(field.key, field.key === "jina_model_path")}><FolderOpen aria-hidden="true" size={17} /><span className="hidden sm:inline">{t("settings.path.pick")}</span></Button> : null}</div>;
}

function SecretControl({ controller, disabled, field }: { controller: SettingsController; disabled: boolean; field: SettingDefinition }) {
  const current = controller.values?.values[field.key];
  const edit = controller.secretEdits[field.key];
  const canEdit = !disabled && Boolean(controller.desktop) && controller.desktop?.secureStorage === "available";
  return (
    <div className="rounded-app-control border border-app-border bg-app-surface-muted/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><span className={cx("size-2 rounded-full", current?.configured ? "bg-emerald-500" : "bg-slate-300")} />{current?.configured ? t("settings.secret.configured") : t("settings.secret.missing")}</span>
        {!controller.desktop ? <Badge>{t("settings.secret.desktopOnly")}</Badge> : null}
      </div>
      {edit?.operation === "set" ? <input aria-label={fieldLabel(field)} autoComplete="new-password" className="h-10 w-full rounded-app-control border border-app-border bg-app-surface px-3 text-sm outline-none focus:border-app-accent focus:ring-4 focus:ring-app-accent/10" onBlur={(event) => { if (!event.target.value) controller.setSecret(field.key, null); }} onChange={(event) => controller.setSecret(field.key, { operation: "set", value: event.target.value })} type="password" value={edit.value} /> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button disabled={!canEdit} onClick={() => controller.setSecret(field.key, { operation: "set", value: "" })}>{current?.configured ? t("settings.secret.change") : t("settings.secret.add")}</Button>
        {current?.configured ? <Button disabled={!canEdit} onClick={() => controller.setSecret(field.key, edit?.operation === "clear" ? null : { operation: "clear" })} variant={edit?.operation === "clear" ? "danger" : "secondary"}>{edit?.operation === "clear" ? t("settings.secret.clearPending") : t("settings.secret.clear")}</Button> : null}
      </div>
    </div>
  );
}

function DataMigrationChoice({ controller }: { controller: SettingsController }) {
  return <fieldset className="mt-3 rounded-app-control border border-amber-200 bg-amber-50 p-3"><legend className="px-1 text-sm font-bold text-amber-950">{t("settings.dataMigration.title")}</legend><p className="mb-2 text-xs text-amber-900">{t("settings.dataMigration.body")}</p><label className="flex cursor-pointer items-start gap-2 py-1 text-sm"><input checked={controller.dataMigration === "copy"} className="mt-0.5" name="data-migration" onChange={() => controller.setDataMigration("copy")} type="radio" /><span><strong>{t("settings.dataMigration.copy")}</strong><span className="block text-xs text-app-text-muted">{t("settings.dataMigration.copyHelp")}</span></span></label><label className="flex cursor-pointer items-start gap-2 py-1 text-sm"><input checked={controller.dataMigration === "use-empty"} className="mt-0.5" name="data-migration" onChange={() => controller.setDataMigration("use-empty")} type="radio" /><span><strong>{t("settings.dataMigration.empty")}</strong><span className="block text-xs text-app-text-muted">{t("settings.dataMigration.emptyHelp")}</span></span></label></fieldset>;
}

function DirtyBar({ controller }: { controller: SettingsController }) {
  const restart = controller.validation?.restart_plan;
  const changedKeys = new Set([
    ...Object.keys(controller.secretEdits),
    ...Object.entries(controller.draft).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(controller.values?.values[key]?.value)).map(([key]) => key),
  ]);
  const predictedMode = controller.schema?.fields.filter((field) => changedKeys.has(field.key)).map((field) => field.apply_mode).sort((left, right) => applyModeRank(right) - applyModeRank(left))[0] ?? "live";
  const needsRestart = (restart?.mode ?? predictedMode) !== "live";
  const needsMigrationChoice = changedKeys.has("data_dir") && !controller.dataMigration;
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-4xl flex-col gap-3 rounded-app-card border border-app-border bg-app-surface/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between" role="region" aria-label={t("settings.unsaved.label")}>
      <div className="min-w-0"><p className="font-bold text-app-text">{t("settings.unsaved.title")}</p><p className="truncate text-xs text-app-text-muted">{needsMigrationChoice ? t("settings.dataMigration.required") : needsRestart ? t("settings.unsaved.restart") : t("settings.unsaved.body")}</p></div>
      <div className="flex shrink-0 gap-2"><Button disabled={controller.isApplying} onClick={controller.discard}>{t("settings.discard")}</Button><Button disabled={controller.isApplying || controller.isValidating} onClick={() => void controller.validate(true)}>{controller.isValidating ? t("settings.validating") : t("settings.validate")}</Button><Button disabled={controller.isApplying || needsMigrationChoice} onClick={() => void controller.save()} variant="primary">{controller.isApplying ? t("settings.applying") : needsRestart ? t("settings.saveRestart") : t("settings.save")}</Button></div>
    </div>
  );
}

function ValidationSummary({ controller }: { controller: SettingsController }) {
  const result = controller.validation;
  if (!result) return null;
  return <section className={cx("mt-4 rounded-app-card border p-4", result.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")} aria-live="assertive"><h2 className="font-bold">{result.valid ? t("settings.validation.ok") : t("settings.validation.failed")}</h2><p className="mt-1 text-sm">{result.valid ? restartDescription(result.restart_plan.mode) : t("settings.validation.fix")}</p>{result.warnings.length ? <ul className="mt-2 list-disc pl-5 text-sm">{result.warnings.map((warning) => <li key={`${warning.key}-${warning.code}`}>{issueMessage(warning)}</li>)}</ul> : null}</section>;
}

function ApplyProgressList({ controller }: { controller: SettingsController }) {
  return <section className="mt-4 rounded-app-card border border-app-border bg-app-surface p-4" role="status" aria-live="polite"><h2 className="font-bold">{t("settings.progress.title")}</h2><ol className="mt-3 grid gap-2">{controller.applyProgress.map((event, index) => <li className="flex items-center gap-2 text-sm" key={`${event.phase}-${index}`}>{event.status === "ok" ? <CheckCircle2 className="text-emerald-600" aria-hidden="true" size={16} /> : event.status === "failed" ? <AlertCircle className="text-red-600" aria-hidden="true" size={16} /> : <RefreshCw className="animate-spin text-app-accent motion-reduce:animate-none" aria-hidden="true" size={16} />}<span>{progressLabel(event.phase)}</span></li>)}</ol></section>;
}

function AdvancedTools({ controller }: { controller: SettingsController }) {
  const unknown = controller.importPreview?.unknown_keys ?? controller.importPreview?.unknown;
  return <div className="border-t border-app-border bg-app-surface-muted/40 p-5"><h3 className="font-bold">{t("settings.portability.title")}</h3><p className="mt-1 text-sm text-app-text-muted">{t("settings.portability.body")}</p><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-app-control border border-app-border bg-app-surface px-4 text-sm font-medium hover:bg-slate-50 focus-within:ring-2 focus-within:ring-app-accent"><Upload aria-hidden="true" size={16} />{t("settings.import.action")}<input accept=".env,text/plain" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void controller.importPreviewFromFile(file); event.target.value = ""; }} type="file" /></label><Button onClick={() => void controller.exportSafe()}><Download aria-hidden="true" size={16} />{t("settings.export.action")}</Button></div>{controller.importPreview ? <div className="mt-4 rounded-app-control border border-app-border bg-app-surface p-4" role="status"><h4 className="font-bold">{t("settings.import.previewTitle")}</h4><p className="mt-1 text-sm text-app-text-muted">{t("settings.import.previewBody")}</p>{unknown?.length ? <p className="mt-2 text-sm text-amber-800">{t("settings.import.unknown")}: {unknown.join(", ")}</p> : null}<div className="mt-3 flex gap-2"><Button onClick={() => controller.importValues()} variant="primary">{t("settings.import.use")}</Button><Button onClick={() => controller.dismissImport()}>{t("common.close")}</Button></div></div> : null}</div>;
}

function Notice({ body, title, tone }: { body: string; title: string; tone: "danger" | "info" | "success" | "warning" }) {
  const classes = { danger: "border-red-200 bg-red-50 text-red-900", info: "border-sky-200 bg-sky-50 text-sky-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900", warning: "border-amber-200 bg-amber-50 text-amber-900" };
  return <div className={cx("mb-4 rounded-app-card border p-4", classes[tone])} role={tone === "danger" ? "alert" : "status"}><strong>{title}</strong><p className="mt-1 text-sm">{body}</p></div>;
}

function PageState({ children }: { children: React.ReactNode }) { return <div className="mx-auto grid w-full max-w-7xl gap-5"><header className="border-b border-app-border pb-4"><h1 className="text-2xl font-black">{t("settings.header.title")}</h1><p className="mt-1 text-sm text-app-text-muted">{t("settings.editable.subtitle")}</p></header>{children}</div>; }

function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex items-center gap-1 rounded-full border border-app-border bg-app-surface-muted px-2 py-0.5 text-[11px] font-bold text-app-text-muted">{children}</span>; }
function fieldLabel(field: SettingDefinition) { return hasMessage(field.label_key) ? t(field.label_key) : field.key.replaceAll("_", " "); }
function fieldHelp(field: SettingDefinition) { return hasMessage(field.help_key) ? t(field.help_key) : t("settings.field.defaultHelp"); }
function sourceLabel(source: string) { const key = `settings.source.${source}`; return hasMessage(key) ? t(key) : t("common.unknown"); }
function applyLabel(mode: ApplyMode) { return t(`settings.applyMode.${mode}` as MessageKey); }
function restartDescription(mode: ApplyMode) { return mode === "live" ? t("settings.validation.live") : t("settings.validation.restart"); }
function issueMessage(issue: FieldIssue) { const key = `settings.error.${issue.code}`; return hasMessage(key) ? t(key) : t("settings.error.generic"); }
function progressLabel(phase: string) { const key = `settings.progress.${phase}`; return hasMessage(key) ? t(key) : t("settings.progress.working"); }
function choiceLabel(field: string, choice: string) { const key = `settings.choice.${field}.${choice}`; return hasMessage(key) ? t(key) : choice; }
function categoryHelp(category: Category) { const key = `settings.category.${category}.help`; return hasMessage(key) ? t(key) : t("settings.field.defaultHelp"); }
function applyModeRank(mode: ApplyMode) { return { live: 0, restart_worker: 1, restart_services: 2, restart_app: 3 }[mode]; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; const units = ["KB", "MB", "GB", "TB"]; const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length); return `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(bytes / 1024 ** exponent)} ${units[exponent - 1]}`; }
