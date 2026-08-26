import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronLeft, ChevronRight, Cpu, Database, FolderOpen, ShieldCheck } from "lucide-react";

import { Button } from "../../components/Button";
import { t } from "../../i18n/dictionary";
import { cx } from "../../lib/cx";
import type { SettingsController } from "../settings/useSettingsController";

const steps = ["data", "storage", "ai", "review"] as const;

export function OnboardingWizard({ controller, onComplete }: { controller: SettingsController; onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("button, input, select")?.focus();
  }, [step]);

  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex='0']") ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  async function finish() {
    setIsFinishing(true);
    const result = await controller.validate(true);
    if (result?.valid) {
      await controller.save();
      onComplete();
    }
    setIsFinishing(false);
  }

  function next() {
    if (step === "storage" && controller.draft.storage_backend === undefined) controller.setValue("storage_backend", "local");
    if (step === "ai") {
      if (controller.draft.ocr_provider === undefined) controller.setValue("ocr_provider", "disabled");
      if (controller.draft.embeddings_provider === undefined) controller.setValue("embeddings_provider", "disabled");
    }
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }

  return (
    <main aria-modal="true" className="fixed inset-0 z-50 grid overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" aria-labelledby="onboarding-title" onKeyDown={trapFocus} role="dialog">
      <section className="m-auto w-full max-w-3xl overflow-hidden rounded-[20px] border border-white/40 bg-app-surface shadow-2xl" ref={dialogRef}>
        <header className="border-b border-app-border bg-gradient-to-br from-teal-50 to-white px-6 py-6 sm:px-9">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-app-accent text-white"><ShieldCheck aria-hidden="true" size={22} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-app-accent">{t("onboarding.eyebrow")}</p><h1 className="text-2xl font-black tracking-tight" id="onboarding-title">{t("onboarding.title")}</h1></div></div>
          <p className="mt-3 max-w-2xl text-sm text-app-text-muted">{t("onboarding.subtitle")}</p>
          <ol className="mt-5 flex gap-2" aria-label={t("onboarding.progress.label")}>
            {steps.map((item, index) => <li className="flex-1" key={item}><span className={cx("block h-1.5 rounded-full", index <= stepIndex ? "bg-app-accent" : "bg-slate-200")} /><span className="sr-only">{index < stepIndex ? t("onboarding.progress.complete") : index === stepIndex ? t("onboarding.progress.current") : t("onboarding.progress.pending")}</span></li>)}
          </ol>
        </header>

        <div className="min-h-72 px-6 py-7 sm:px-9">
          {step === "data" ? <WizardSection icon={Database} title={t("onboarding.data.title")} body={t("onboarding.data.body")}><label className="grid gap-2 text-sm font-semibold"><span>{t("settings.data_dir.label")}</span><div className="flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-app-control border border-app-border px-3 outline-none focus:border-app-accent focus:ring-4 focus:ring-app-accent/10" onChange={(event) => { controller.setValue("data_dir", event.target.value); controller.setDataMigration("use-empty"); }} value={String(controller.draft.data_dir ?? "")} /><Button aria-label={t("settings.path.pick")} onClick={async () => { await controller.pickPath("data_dir"); controller.setDataMigration("use-empty"); }}><FolderOpen aria-hidden="true" size={17} />{t("settings.path.pick")}</Button></div></label><p className="mt-3 text-xs text-app-text-muted">{t("onboarding.data.safe")}</p></WizardSection> : null}
          {step === "storage" ? <WizardSection icon={Bot} title={t("onboarding.storage.title")} body={t("onboarding.storage.body")}><div className="grid gap-3 sm:grid-cols-2"><Choice active={controller.draft.storage_backend !== "telegram"} body={t("onboarding.storage.local.body")} label={t("onboarding.storage.local.title")} onClick={() => controller.setValue("storage_backend", "local")} recommended /><Choice active={controller.draft.storage_backend === "telegram"} body={t("onboarding.storage.telegram.body")} label={t("onboarding.storage.telegram.title")} onClick={() => controller.setValue("storage_backend", "telegram")} /></div>{controller.draft.storage_backend === "telegram" ? <TelegramSetup controller={controller} /> : null}</WizardSection> : null}
          {step === "ai" ? <WizardSection icon={Cpu} title={t("onboarding.ai.title")} body={t("onboarding.ai.body")}><div className="grid gap-3 sm:grid-cols-2"><Choice active={controller.draft.ocr_provider === "rapidocr"} body={t("onboarding.ai.ocr.body")} label={t("onboarding.ai.ocr.title")} onClick={() => controller.setValue("ocr_provider", controller.draft.ocr_provider === "rapidocr" ? "disabled" : "rapidocr")} /><Choice active={controller.draft.embeddings_provider === "jina"} body={t("onboarding.ai.embeddings.body")} label={t("onboarding.ai.embeddings.title")} onClick={() => controller.setValue("embeddings_provider", controller.draft.embeddings_provider === "jina" ? "disabled" : "jina")} /></div><p className="mt-4 rounded-app-control bg-app-surface-muted p-3 text-sm text-app-text-muted">{t("onboarding.ai.optional")}</p></WizardSection> : null}
          {step === "review" ? <WizardSection icon={Check} title={t("onboarding.review.title")} body={t("onboarding.review.body")}><dl className="divide-y divide-app-border rounded-app-card border border-app-border"><Review label={t("settings.data_dir.label")} value={String(controller.draft.data_dir ?? t("common.unknown"))} /><Review label={t("settings.storage_backend.label")} value={controller.draft.storage_backend === "telegram" ? t("settings.storage.telegram") : t("settings.storage.local")} /><Review label={t("settings.category.ai")} value={controller.draft.ocr_provider === "rapidocr" || controller.draft.embeddings_provider === "jina" ? t("onboarding.review.aiEnabled") : t("onboarding.review.aiDisabled")} /></dl></WizardSection> : null}
        </div>

        <footer className="flex items-center justify-between border-t border-app-border bg-app-surface-muted/50 px-6 py-4 sm:px-9"><Button disabled={stepIndex === 0 || isFinishing} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}><ChevronLeft aria-hidden="true" size={17} />{t("onboarding.back")}</Button>{step === "review" ? <Button disabled={isFinishing} onClick={() => void finish()} variant="primary">{isFinishing ? t("settings.applying") : t("onboarding.finish")}</Button> : <Button onClick={next} variant="primary">{t("onboarding.next")}<ChevronRight aria-hidden="true" size={17} /></Button>}</footer>
      </section>
    </main>
  );
}

function WizardSection({ body, children, icon: Icon, title }: { body: string; children: React.ReactNode; icon: typeof Database; title: string }) { return <section><div className="mb-6 flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-50 text-app-accent"><Icon aria-hidden="true" size={21} /></span><div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm leading-relaxed text-app-text-muted">{body}</p></div></div>{children}</section>; }
function Choice({ active, body, label, onClick, recommended = false }: { active: boolean; body: string; label: string; onClick: () => void; recommended?: boolean }) { return <button aria-pressed={active} className={cx("relative rounded-app-card border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-app-accent", active ? "border-app-accent bg-teal-50" : "border-app-border hover:border-app-accent/50")} onClick={onClick} type="button">{recommended ? <span className="absolute right-3 top-3 rounded-full bg-app-accent px-2 py-0.5 text-[10px] font-bold text-white">{t("onboarding.recommended")}</span> : null}<strong className="block pr-20">{label}</strong><span className="mt-2 block text-sm text-app-text-muted">{body}</span></button>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-semibold text-app-text-muted">{label}</dt><dd className="break-all text-sm font-bold text-app-text">{value}</dd></div>; }

const telegramSecrets = ["telegram_bot_token", "telegram_api_id", "telegram_api_hash", "telegram_raw_chat_id", "telegram_thumbs_chat_id", "telegram_journal_chat_id", "telegram_webhook_secret"] as const;
function TelegramSetup({ controller }: { controller: SettingsController }) {
  const probe = controller.validation?.probes.find((item) => item.key === "telegram_bot_api_url");
  return <div className="mt-4 rounded-app-card border border-app-border bg-app-surface-muted/40 p-4"><h3 className="font-bold">{t("onboarding.telegram.title")}</h3><p className="mt-1 text-sm text-app-text-muted">{t("onboarding.telegram.body")}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{telegramSecrets.map((key) => <label className="grid gap-1 text-sm font-semibold" key={key}><span>{t(`settings.${key}.label`)}</span><input autoComplete="new-password" className="h-10 rounded-app-control border border-app-border bg-app-surface px-3 outline-none focus:border-app-accent focus:ring-4 focus:ring-app-accent/10" onChange={(event) => controller.setSecret(key, event.target.value ? { operation: "set", value: event.target.value } : null)} type="password" value={controller.secretEdits[key]?.operation === "set" ? controller.secretEdits[key].value : ""} /></label>)}</div><div className="mt-3 flex items-center gap-3"><Button onClick={() => void controller.probe("telegram_bot_api_url", "telegram")}>{t("settings.probe.action")}</Button>{probe ? <span className="text-sm font-semibold" role="status">{probe.status === "ok" ? t("settings.probe.ok") : t("settings.probe.failed")}</span> : null}</div></div>;
}
