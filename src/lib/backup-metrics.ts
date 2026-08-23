type BackupMetricState = {
  successCount: number;
  failureCount: number;
  lastSuccessAt: number;
  lastFailureAt: number;
};

const root = globalThis as typeof globalThis & { __taskappBackupMetrics?: BackupMetricState };

function state(): BackupMetricState {
  return root.__taskappBackupMetrics ??= {
    successCount: 0,
    failureCount: 0,
    lastSuccessAt: 0,
    lastFailureAt: 0,
  };
}

export function recordBackupSuccess(): void {
  const current = state();
  current.successCount += 1;
  current.lastSuccessAt = Date.now();
}

export function recordBackupFailure(): void {
  const current = state();
  current.failureCount += 1;
  current.lastFailureAt = Date.now();
}

export function getBackupMetrics(): BackupMetricState {
  return { ...state() };
}
