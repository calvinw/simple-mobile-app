import dagre from '@dagrejs/dagre';
import { parse } from 'yaml';

export type ProductGraphFile = {
  id: string;
  filename: string;
  name: string;
  product_graph: string;
};

export type ProductGraphCatalog = {
  default_id: string;
  product_graphs: ProductGraphFile[];
};

type FlowAmount = {
  flow?: string;
  amount?: number;
  unit?: string;
  database?: string;
  location?: string;
};

type YamlProcess = {
  name?: string;
  reference_output?: FlowAmount;
  inputs?: FlowAmount[];
  emissions?: FlowAmount[];
  extractions?: FlowAmount[];
  resources?: FlowAmount[];
  resource_inputs?: FlowAmount[];
};

type YamlGraph = {
  name?: string;
  products?: Array<{ name?: string; unit?: string }>;
  processes?: YamlProcess[];
  reference_process?: string;
};

export type GraphNode = {
  id: string;
  name: string;
  kind: 'Foreground' | 'Background';
  output: string;
  amount?: number;
  unit?: string;
  database?: string;
  location?: string;
  inputs: FlowAmount[];
  emissions: FlowAmount[];
  x: number;
  y: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  flow: string;
};

export type MobileProductGraph = {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
};

const NODE_WIDTH = 236;
const NODE_HEIGHT = 66;

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function buildMobileGraph(source: string): MobileProductGraph {
  const document = parse(source) as YamlGraph;
  const processes = Array.isArray(document?.processes) ? document.processes : [];
  if (!processes.length) throw new Error('YAML must include a non-empty processes list.');

  const productUnits = new Map(
    (document.products ?? []).map((product) => [product.name ?? '', product.unit ?? ''])
  );
  const foreground = processes.map((process, index) => {
    if (!process.name || !process.reference_output?.flow) {
      throw new Error('Every process needs a name and reference output.');
    }
    return {
      process,
      id: `${slug(process.name) || 'process'}-${index}`,
    };
  });
  const providerByFlow = new Map(
    foreground.map(({ process, id }) => [process.reference_output!.flow!, id])
  );

  const nodes: Omit<GraphNode, 'x' | 'y'>[] = foreground.map(({ process, id }) => ({
    id,
    name: process.name!,
    kind: 'Foreground',
    output: process.reference_output!.flow!,
    amount: process.reference_output!.amount,
    unit: process.reference_output!.unit ?? productUnits.get(process.reference_output!.flow!),
    inputs: process.inputs ?? [],
    emissions: process.emissions ?? [],
  }));

  const backgroundByKey = new Map<string, Omit<GraphNode, 'x' | 'y'>>();
  processes.flatMap((process) => process.inputs ?? []).forEach((input) => {
    if (!input.database || !input.flow) return;
    const key = `${input.database}|${input.flow}|${input.location ?? ''}`;
    if (backgroundByKey.has(key)) return;
    backgroundByKey.set(key, {
      id: `background-${slug(input.flow)}-${backgroundByKey.size}`,
      name: input.flow,
      kind: 'Background',
      output: input.flow,
      amount: input.amount,
      unit: input.unit,
      database: input.database,
      location: input.location,
      inputs: [],
      emissions: [],
    });
  });
  nodes.push(...backgroundByKey.values());

  const backgroundId = new Map([...backgroundByKey.entries()].map(([key, node]) => [key, node.id]));
  const edges: GraphEdge[] = [];
  foreground.forEach(({ process, id: target }) => {
    (process.inputs ?? []).forEach((input, index) => {
      if (!input.flow) return;
      const key = `${input.database}|${input.flow}|${input.location ?? ''}`;
      const source = input.database ? backgroundId.get(key) : providerByFlow.get(input.flow);
      if (!source) return;
      edges.push({ id: `${source}-${target}-${index}`, source, target, flow: input.flow });
    });
  });

  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: 'TB', ranksep: 78, nodesep: 34, marginx: 34, marginy: 36 });
  layout.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((node) => layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => layout.setEdge(edge.source, edge.target));
  dagre.layout(layout);

  const positioned = nodes.map((node) => {
    const point = layout.node(node.id);
    return { ...node, x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 };
  });
  const dimensions = layout.graph();

  return {
    name: document.name ?? 'Product graph',
    nodes: positioned,
    edges,
    width: Math.max(dimensions.width ?? 0, NODE_WIDTH + 68),
    height: Math.max(dimensions.height ?? 0, NODE_HEIGHT + 72),
  };
}

export const graphNodeSize = { width: NODE_WIDTH, height: NODE_HEIGHT };
