import type { Direction, FlowEdge, FlowGroup, FlowModel, FlowNode, HeadMarker, TailMarker } from "./model";

/** Letters first (A, B, … Z), then N1, N2, … Skips ids already used by nodes or groups. */
export function nextNodeId(model: FlowModel): string {
  const used = new Set([...model.nodes.map((n) => n.id), ...model.groups.map((g) => g.id)]);
  for (let code = 65; code <= 90; code++) {
    const id = String.fromCharCode(code);
    if (!used.has(id)) return id;
  }
  for (let i = 1; ; i++) {
    const id = `N${i}`;
    if (!used.has(id)) return id;
  }
}

/** Gives every edge the id Mermaid itself assigns: `L_<from>_<to>_<n-th edge between that pair>`. */
export function renumberEdges(model: FlowModel): FlowModel {
  const seen = new Map<string, number>();
  const edges = model.edges.map((edge) => {
    const pair = `${edge.from}\u0000${edge.to}`;
    const n = seen.get(pair) ?? 0;
    seen.set(pair, n + 1);
    return { ...edge, id: `L_${edge.from}_${edge.to}_${n}` };
  });
  return { ...model, edges };
}

function makeEdge(from: string, to: string): FlowEdge {
  return { id: "", from, to, label: "", stroke: "normal", head: "arrow", tail: "none", length: 1, styles: [] };
}

export interface AddNodeOptions {
  label: string;
  shape?: string;
  /** Put the new node in the same group as this node. */
  siblingOf?: string;
  /** Draw an arrow from this node to the new one. */
  connectFrom?: string;
}

export function addNode(model: FlowModel, options: AddNodeOptions): { model: FlowModel; id: string } {
  const id = nextNodeId(model);
  const node: FlowNode = {
    id,
    label: options.label,
    markdown: false,
    shape: options.shape ?? "square",
    props: {},
    styles: [],
    classes: [],
  };
  const anchor = options.siblingOf ?? options.connectFrom;
  const groups = model.groups.map((g) => (anchor && g.children.includes(anchor) ? { ...g, children: [...g.children, id] } : g));
  let next: FlowModel = { ...model, nodes: [...model.nodes, node], groups };
  if (options.connectFrom) next = { ...next, edges: [...next.edges, makeEdge(options.connectFrom, id)] };
  return { model: renumberEdges(next), id };
}

export function updateNode(model: FlowModel, id: string, patch: Partial<Omit<FlowNode, "id">>): FlowModel {
  return { ...model, nodes: model.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function removeNode(model: FlowModel, id: string): FlowModel {
  return renumberEdges({
    ...model,
    nodes: model.nodes.filter((n) => n.id !== id),
    edges: model.edges.filter((e) => e.from !== id && e.to !== id),
    groups: model.groups.map((g) => ({ ...g, children: g.children.filter((c) => c !== id) })),
  });
}

export function duplicateNode(model: FlowModel, id: string): { model: FlowModel; id: string } {
  const source = model.nodes.find((n) => n.id === id);
  if (!source) return { model, id };
  const copyId = nextNodeId(model);
  const copy: FlowNode = { ...source, id: copyId, styles: [...source.styles], classes: [...source.classes], props: { ...source.props } };
  const groups = model.groups.map((g) => (g.children.includes(id) ? { ...g, children: [...g.children, copyId] } : g));
  return { model: { ...model, nodes: [...model.nodes, copy], groups }, id: copyId };
}

export function addEdge(model: FlowModel, from: string, to: string): FlowModel {
  return renumberEdges({ ...model, edges: [...model.edges, makeEdge(from, to)] });
}

export function updateEdge(
  model: FlowModel,
  id: string,
  patch: Partial<Pick<FlowEdge, "label" | "stroke" | "head" | "tail" | "styles" | "length">>,
): FlowModel {
  return { ...model, edges: model.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export function removeEdge(model: FlowModel, id: string): FlowModel {
  return renumberEdges({ ...model, edges: model.edges.filter((e) => e.id !== id) });
}

/** Swaps source and target. Returns the model and the edge's new id. */
export function reverseEdge(model: FlowModel, id: string): { model: FlowModel; id: string } {
  const index = model.edges.findIndex((e) => e.id === id);
  const edge = model.edges[index];
  if (!edge) return { model, id };
  const edges = model.edges.slice();
  edges[index] = { ...edge, from: edge.to, to: edge.from };
  const next = renumberEdges({ ...model, edges });
  return { model: next, id: next.edges[index]!.id };
}

export function setDirection(model: FlowModel, direction: Direction): FlowModel {
  return { ...model, direction };
}

export function updateGroup(model: FlowModel, id: string, patch: Partial<Pick<FlowGroup, "title" | "direction">>): FlowModel {
  return { ...model, groups: model.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
}

/** Dissolves a group. Its children move to the parent group. Arrows that pointed at the group itself are removed. */
export function ungroup(model: FlowModel, id: string): FlowModel {
  const group = model.groups.find((g) => g.id === id);
  if (!group) return model;
  const groups = model.groups
    .filter((g) => g.id !== id)
    .map((g) => {
      const index = g.children.indexOf(id);
      if (index === -1) return g;
      const children = g.children.slice();
      children.splice(index, 1, ...group.children);
      return { ...g, children };
    });
  return renumberEdges({ ...model, groups, edges: model.edges.filter((e) => e.from !== id && e.to !== id) });
}

/** Sets the arrow end. An open (plain) line cannot have an arrow at the other end, so that one is dropped. */
export function setEdgeHead(model: FlowModel, id: string, head: HeadMarker): FlowModel {
  const edge = model.edges.find((e) => e.id === id);
  if (!edge) return model;
  const tail: TailMarker = head === "open" ? "none" : edge.tail === "none" ? "none" : head;
  return updateEdge(model, id, { head, tail });
}

/** Turns the arrow at the start of the edge on or off. It always matches the arrow at the end. */
export function setEdgeBothEnds(model: FlowModel, id: string, on: boolean): FlowModel {
  const edge = model.edges.find((e) => e.id === id);
  if (!edge || edge.head === "open") return model;
  return updateEdge(model, id, { tail: on ? edge.head : "none" });
}
