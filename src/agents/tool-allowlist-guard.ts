export type ExplicitToolAllowlistSource = {
  label: string;
  entries: string[];
};

export function collectExplicitToolAllowlistSources(
  sources: Array<{ label: string; allow?: string[] }>,
): ExplicitToolAllowlistSource[] {
  return sources.flatMap((source) => {
    const entries = (source.allow ?? []).map((entry) => entry.trim()).filter(Boolean);
    return entries.length ? [{ label: source.label, entries }] : [];
  });
}

export function buildEmptyExplicitToolAllowlistError(params: {
  sources: ExplicitToolAllowlistSource[];
  callableToolNames: string[];
  toolsEnabled: boolean;
  disableTools?: boolean;
}): Error | null {
  void params;
  return null;
}
