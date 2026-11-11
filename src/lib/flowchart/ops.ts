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

/** `G1`, `G2`, … Skips ids already used by nodes or groups. */
export function nextGroupId(model: FlowModel): string {
  const used = new Set([...model.nodes.map((n) => n.id), ...model.groups.map((g) => g.id)]);
  for (let i = 1; ; i++) {
    if (!used.has(`G${i}`)) return `G${i}`;
  }
}

/**
 * Puts nodes and/or existing groups into a new group.
 *
 * - Items that already sit inside another selected group stay there (they move with it).
 * - If all items share one parent group, the new group is created inside that parent.
 *   Otherwise it is created at the top level and the items leave their old parents.
 * - Ids that do not exist are ignored. Returns `id: null` and the same model when nothing is left to group.
 */
export function groupItems(model: FlowModel, ids: string[], title: string): { model: FlowModel; id: string | null } {
  const known = new Set([...model.nodes.map((n) => n.id), ...model.groups.map((g) => g.id)]);
  const groupsById = new Map(model.groups.map((g) => [g.id, g]));

  const covered = new Set<string>();
  const collect = (groupId: string) => {
    for (const child of groupsById.get(groupId)?.children ?? []) {
      covered.add(child);
      if (groupsById.has(child)) collect(child);
    }
  };
  const wanted = [...new Set(ids.filter((id) => known.has(id)))];
  for (const id of wanted) if (groupsById.has(id)) collect(id);
  const items = wanted.filter((id) => !covered.has(id));
  if (items.length === 0) return { model, id: null };

  const parentOf = (id: string) => model.groups.find((g) => g.children.includes(id))?.id;
  const parents = new Set(items.map(parentOf));
  const commonParent = parents.size === 1 ? [...parents][0] : undefined;

  const id = nextGroupId(model);
  const group: FlowGroup = { id, title, children: items, classes: [] };
  const groups = model.groups.map((g) => {
    if (g.id === commonParent) {
      // Replace the first item by the new group, drop the others.
      const at = g.children.findIndex((c) => items.includes(c));
      const rest = g.children.filter((c) => !items.includes(c));
      rest.splice(at, 0, id);
      return { ...g, children: rest };
    }
    return { ...g, children: g.children.filter((c) => !items.includes(c)) };
  });
  const pruned = pruneEmptied([...groups, group], model.groups);
  const gone = new Set(model.groups.filter((g) => !pruned.some((p) => p.id === g.id)).map((g) => g.id));
  const edges = model.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
  return { model: renumberEdges({ ...model, groups: pruned, edges }), id };
}

/** Removes groups that this edit emptied (they had children before). Repeats up the tree. */
function pruneEmptied(groups: FlowGroup[], before: FlowGroup[]): FlowGroup[] {
  const hadChildren = new Set(before.filter((g) => g.children.length > 0).map((g) => g.id));
  let current = groups;
  for (;;) {
    const empty = new Set(current.filter((g) => g.children.length === 0 && hadChildren.has(g.id)).map((g) => g.id));
    if (empty.size === 0) return current;
    current = current
      .filter((g) => !empty.has(g.id))
      .map((g) => (g.children.some((c) => empty.has(c)) ? { ...g, children: g.children.filter((c) => !empty.has(c)) } : g));
  }
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
