export type LciValue = { amount: number; unit: string; type: string };
export type LciaValue = { score: number; unit: string };
export type ProcessContribution = {
  process_id: string;
  process_name: string;
  direct_score: number;
  percentage: number | null;
  scope: 'foreground' | 'background';
};
export type ProcessContributionCategory = {
  id: string;
  label: string;
  unit: string;
  total_score: number;
  processes: ProcessContribution[];
  residual_score: number;
};
export type ActivityContribution = {
  activity_id: string;
  process_name: string;
  database: string;
  scope: 'foreground' | 'background';
  direct_score: number;
  percentage: number | null;
  occurrence_count: number;
};
export type ContributionGraph = {
  id: string;
  label: string;
  unit: string;
  total_score: number;
  status: 'complete' | 'partial' | 'zero_total';
  coverage: number | null;
  activity_contributions: ActivityContribution[];
};
export type LcaResult = {
  result_id: string;
  name: string;
  method: string;
  functional_unit: string;
  result_schema_version: 3;
  lci: Record<string, LciValue>;
  lcia: Record<string, LciaValue>;
  scaling_vector: Record<string, number>;
  process_contributions: { categories: ProcessContributionCategory[] };
  contribution_graphs: ContributionGraph[];
};

type ToolDefinition = { name: string; rest?: { method: string; path: string } };
const API_BASE = (process.env.EXPO_PUBLIC_LCA_API_BASE || 'https://lca.mathplosion.com').replace(/\/$/, '');

async function readJson(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? String(body.detail) : null;
    throw new Error(detail ?? `Request failed (${response.status}).`);
  }
  return body;
}

export async function calculateLca(productGraph: string, signal?: AbortSignal): Promise<LcaResult> {
  const health = await readJson(await fetch(`${API_BASE}/api/health`, { signal })) as { running?: boolean };
  if (!health.running) throw new Error('The LCA calculation engine is not ready.');
  const tools = await readJson(await fetch(`${API_BASE}/api/tools`, { signal })) as ToolDefinition[];
  // The full operation includes cumulative contribution graphs needed by the
  // mobile Contribution view; the compact base operation intentionally omits them.
  const operation = tools.find((tool) => tool.name === 'run_lca');
  if (!operation?.rest || operation.rest.method !== 'POST') {
    throw new Error('The LCA calculation operation is unavailable.');
  }
  const value = await readJson(await fetch(`${API_BASE}${operation.rest.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_graph: productGraph }),
    signal,
  })) as LcaResult;
  if (value.result_schema_version !== 3 || !value.process_contributions?.categories) {
    throw new Error('The calculation engine returned an unsupported result.');
  }
  let contributionGraphs = value.contribution_graphs ?? [];
  if (!contributionGraphs.length && value.process_contributions.categories.length) {
    const contributionOperation = tools.find((tool) => tool.name === 'get_lca_contribution_graphs');
    if (contributionOperation?.rest?.method === 'POST') {
      const batch = await readJson(await fetch(`${API_BASE}${contributionOperation.rest.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_graph: productGraph,
          categories: value.process_contributions.categories.map((category) => category.label),
          result_id: value.result_id,
        }),
        signal,
      })) as { contribution_graphs?: ContributionGraph[] };
      contributionGraphs = batch.contribution_graphs ?? [];
    }
  }
  return { ...value, contribution_graphs: contributionGraphs };
}
