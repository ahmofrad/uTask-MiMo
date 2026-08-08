-- Allow concurrent refreshes of the single-row organization statistics view.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_org_stats_singleton
  ON mv_org_stats ((1));
