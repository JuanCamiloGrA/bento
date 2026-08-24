import { ProgressEvent, RestartPlan, SettingsApplyRequest, SettingsApplyResult } from "../shared/contracts";
import { BootstrapState, BootstrapStore } from "./bootstrap";
import { SecureSecretStore } from "./secrets";
import { SidecarSupervisor } from "./sidecars";
import { DataDirectoryMigrator } from "./data-directory";

interface SnapshotEntry { value?: unknown; configured?: boolean; source: string; locked: boolean; apply_mode: string }
interface SnapshotResponse { revision: number; values: Record<string, SnapshotEntry> }
interface ValidationResponse {
  valid: boolean;
  errors: Array<{ key: string; code: string; message: string }>;
  restart_plan: { mode: string; services: string[]; affected_keys: string[] };
}
interface PatchResponse extends SnapshotResponse { restart_plan: ValidationResponse["restart_plan"] }

export class SettingsTransaction {
  constructor(
    private readonly sidecars: SidecarSupervisor,
    private readonly secrets: SecureSecretStore,
    private readonly bootstrap: BootstrapStore,
    private bootstrapState: BootstrapState,
    private readonly dataDirectories = new DataDirectoryMigrator(),
  ) {}

  async apply(request: SettingsApplyRequest, progress: (event: ProgressEvent) => void): Promise<SettingsApplyResult> {
    const previous = await this.sidecars.apiJson<SnapshotResponse>("/api/settings/values");
    const previousReferences = await this.secrets.references();
    const requestedDataDir = typeof request.values.data_dir === "string" ? request.values.data_dir : undefined;
    const changesDataDir = requestedDataDir !== undefined && requestedDataDir !== this.bootstrapState.dataDir;
    let validatedDataDir: string | undefined;
    let persistedOriginal = false;
    const actualSecretChanges = Object.fromEntries(Object.entries(request.secrets).filter(([, item]) => item.operation !== "unchanged"));
    let prepared: Awaited<ReturnType<SecureSecretStore["prepare"]>> | null = null;
    let previousSecretValues: Record<string, string> | null = null;
    try {
      progress({ phase: "validating", status: "started" });
      if (changesDataDir) {
        validatedDataDir = await this.dataDirectories.validate(this.bootstrapState.dataDir, requestedDataDir!, request.dataMigration);
      }
      if (Object.keys(actualSecretChanges).length) {
        previousSecretValues = await this.secrets.values();
        prepared = await this.secrets.prepare(request.secrets);
      }
      const references = prepared?.references ?? Object.fromEntries(Object.keys(request.secrets).map((key) => [key, {
        reference: previousReferences[key] ?? null,
        configured: Boolean(previousReferences[key]),
      }]));
      const validation = await this.sidecars.apiJson<ValidationResponse>("/api/settings/validate", jsonRequest({
        values: request.values,
        secret_references: references,
        run_probes: false,
      }));
      if (!validation.valid) {
        progress({ phase: "validating", status: "failed" });
        return { ok: false, revision: previous.revision, errors: validation.errors };
      }
      progress({ phase: "validating", status: "ok" });

      progress({ phase: "persisting", status: "started" });
      let applied: PatchResponse;
      if (changesDataDir && request.dataMigration === "use-empty") {
        applied = {
          ...previous,
          restart_plan: validation.restart_plan,
        };
      } else {
        applied = await this.sidecars.apiJson<PatchResponse>("/api/settings/values", jsonRequest({
          revision: request.revision,
          values: request.values,
          secret_references: references,
          run_probes: false,
        }, "PATCH"));
        persistedOriginal = true;
      }
      progress({ phase: "persisting", status: "ok" });

      progress({ phase: "secrets", status: "started" });
      if (prepared) await prepared.commit();
      progress({ phase: "secrets", status: "ok" });

      const plan = restartPlan(applied.restart_plan);
      const secretValues = prepared?.values ?? await this.secrets.values();
      let effectiveRevision = applied.revision;
      progress({ phase: "restarting", status: "started" });
      if (changesDataDir) {
        await this.sidecars.stop();
        await this.dataDirectories.execute(this.bootstrapState.dataDir, validatedDataDir!, request.dataMigration!);
        this.sidecars.setDataDir(validatedDataDir!);
        this.sidecars.setSecretEnvironment(secretValues);
        await this.bootstrap.save({ ...this.bootstrapState, dataDir: validatedDataDir! });
        await this.sidecars.start();
        if (request.dataMigration === "use-empty") {
          const emptySnapshot = await this.sidecars.apiJson<SnapshotResponse>("/api/settings/values");
          const existingValues = Object.fromEntries(Object.entries(previous.values).flatMap(([key, entry]) =>
            !entry.locked && "value" in entry ? [[key, entry.value]] : [],
          ));
          const migratedValues = { ...existingValues, ...request.values, data_dir: validatedDataDir! };
          const existingReferences = Object.fromEntries(Object.entries(previousReferences).map(([key, reference]) => [
            key,
            { reference, configured: true },
          ]));
          const migratedReferences = { ...existingReferences, ...references };
          const migratedValidation = await this.sidecars.apiJson<ValidationResponse>("/api/settings/validate", jsonRequest({
            values: migratedValues,
            secret_references: migratedReferences,
            run_probes: false,
          }));
          if (!migratedValidation.valid) throw new Error("Settings could not be restored in the new data directory");
          const migrated = await this.sidecars.apiJson<PatchResponse>("/api/settings/values", jsonRequest({
            revision: emptySnapshot.revision,
            values: migratedValues,
            secret_references: migratedReferences,
            run_probes: false,
          }, "PATCH"));
          effectiveRevision = migrated.revision;
          await this.sidecars.restart(migrated.restart_plan.services, secretValues);
        }
      } else {
        await this.sidecars.restart(plan.services, secretValues);
      }
      progress({ phase: "restarting", status: "ok" });
      progress({ phase: "verifying", status: "started" });
      await this.sidecars.verify();
      progress({ phase: "verifying", status: "ok" });
      if (changesDataDir && request.dataMigration === "copy") {
        effectiveRevision = (await this.sidecars.apiJson<SnapshotResponse>("/api/settings/values")).revision;
      }
      this.bootstrapState = { ...this.bootstrapState, dataDir: validatedDataDir ?? this.bootstrapState.dataDir, lastKnownGoodRevision: effectiveRevision };
      await this.bootstrap.save(this.bootstrapState);
      progress({ phase: "complete", status: "ok" });
      return { ok: true, revision: effectiveRevision, restartPlan: plan };
    } catch (error) {
      progress({ phase: "rolling-back", status: "started", message: safeError(error) });
      try {
        if (prepared) await prepared.rollback();
        const rollbackSecretValues = previousSecretValues ?? await this.secrets.values();
        if (changesDataDir) {
          await this.sidecars.stop();
          this.sidecars.setDataDir(this.bootstrapState.dataDir);
          this.sidecars.setSecretEnvironment(rollbackSecretValues);
          await this.bootstrap.save(this.bootstrapState);
          await this.sidecars.start();
        }
        const current = await this.sidecars.apiJson<SnapshotResponse>("/api/settings/values");
        if (!persistedOriginal) {
          await this.sidecars.verify();
          progress({ phase: "rolling-back", status: "ok" });
          return { ok: false, revision: current.revision, rolledBack: true, errors: [{ key: "_", code: "desktop_apply_rolled_back", message: safeError(error) }] };
        }
        const rollbackValues = Object.fromEntries(Object.keys(request.values).flatMap((key) => {
          const entry = previous.values[key];
          return entry && "value" in entry ? [[key, entry.value]] : [];
        }));
        const rollbackReferences = Object.fromEntries(Object.keys(request.secrets).map((key) => [key, {
          reference: previousReferences[key] ?? null,
          configured: Boolean(previousReferences[key]),
        }]));
        const rolledBack = await this.sidecars.apiJson<PatchResponse>("/api/settings/values", jsonRequest({
          revision: current.revision,
          values: rollbackValues,
          secret_references: rollbackReferences,
          run_probes: false,
        }, "PATCH"));
        await this.sidecars.restart(rolledBack.restart_plan.services, rollbackSecretValues);
        await this.sidecars.verify();
        progress({ phase: "rolling-back", status: "ok" });
        return { ok: false, revision: rolledBack.revision, rolledBack: true, errors: [{ key: "_", code: "desktop_apply_rolled_back", message: safeError(error) }] };
      } catch (rollbackError) {
        progress({ phase: "rolling-back", status: "failed", message: safeError(rollbackError) });
        return { ok: false, revision: previous.revision, rolledBack: false, errors: [{ key: "_", code: "desktop_recovery_required", message: "Bento could not restore the last known good configuration" }] };
      }
    }
  }
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function restartPlan(value: ValidationResponse["restart_plan"]): RestartPlan {
  return { mode: value.mode, services: value.services, affectedKeys: value.affected_keys };
}

function safeError(value: unknown): string {
  return value instanceof Error ? value.message.replace(/Bearer\s+\S+/giu, "Bearer [REDACTED]") : "Desktop settings apply failed";
}
