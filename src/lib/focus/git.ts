import { parseGitGraph, type GitEntry } from "@/lib/git-graph";
import { norm } from "./dom";
import { entryItems } from "./lines";
import type { FocusAdapter, FocusItem } from "./types";

/** The commands that make Mermaid draw a commit. A line the editor does not read can hold several of them (`a; b`). */
const COMMIT_STATEMENT = /^\s*(?:commit|merge|cherry-pick)\b/;

/** How far (in SVG units) the tag of a commit is drawn from the commit. A tag sits about 20 away, the next commit 50. */
const TAG_REACH = 35;

/** The code an entry was read from. */
const sourceOf = (entry: GitEntry): string => (entry.type === "raw" ? entry.text : (entry.origin?.raw ?? ""));

/** The commits a line the editor does not read makes (a cherry-pick, a commit with an option it cannot edit, …). */
const rawCommits = (line: string): number => line.split(";").filter((statement) => COMMIT_STATEMENT.test(statement)).length;

/** A commit is drawn as one or more elements with the class `commit` and its id. */
interface DrawnCommit {
  id: string;
  elements: Element[];
}

/** Classes of a commit element that are not its id. */
const MODIFIERS = new Set(["commit", "commit-merge", "commit-reverse"]);

const idOfCommitElement = (element: Element): string | undefined => [...element.classList].find((name) => !MODIFIERS.has(name));

/** The commits in the order Mermaid draws them, which is the order of the commands in the code. A merge is drawn as two circles. */
function drawnCommits(root: SVGSVGElement): DrawnCommit[] {
  const commits: DrawnCommit[] = [];
  root.querySelectorAll("g.commit-bullets .commit").forEach((element) => {
    const id = idOfCommitElement(element);
    if (id === undefined) return;
    const last = commits.at(-1);
    if (last?.id === id) last.elements.push(element);
    else commits.push({ id, elements: [element] });
  });
  return commits;
}

/** Items of commits and merges are matched by their id, or by their place among the commits when the id is made up by Mermaid. */
const placeText = (place: number): string => `#${place}`;
const hasId = (id: string): boolean => /^\S+$/.test(id);

function centerOf(element: Element): { x: number; y: number } {
  const box = (element as SVGGraphicsElement).getBBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const distance = (a: Element, b: Element): number => {
  const [from, to] = [centerOf(a), centerOf(b)];
  return Math.hypot(from.x - to.x, from.y - to.y);
};

/** A tag is drawn as a polygon, a hole and a text, one after the other. */
const tagParts = (polygon: Element): Element[] => {
  const hole = polygon.nextElementSibling;
  const text = hole?.nextElementSibling;
  return [polygon, hole, text].filter((part): part is Element => Boolean(part));
};

/** The polygon of the tag that `part` belongs to. */
function tagPolygonOf(part: Element): Element | null {
  if (part.matches("polygon.tag-label-bkg")) return part;
  if (part.matches("circle.tag-hole")) return part.previousElementSibling;
  return part.matches("text.tag-label") ? (part.previousElementSibling?.previousElementSibling ?? null) : null;
}

/** The tag that is drawn next to the commit, if it has one. Tags carry no id, so the nearest one wins. */
function tagOf(root: SVGSVGElement, commit: DrawnCommit): Element[] {
  const [anchor] = commit.elements;
  if (!anchor) return [];
  const nearest = [...root.querySelectorAll("polygon.tag-label-bkg")]
    .map((polygon) => ({ polygon, away: distance(anchor, polygon) }))
    .filter(({ away }) => away < TAG_REACH)
    .sort((a, b) => a.away - b.away)[0];
  return nearest ? tagParts(nearest.polygon) : [];
}

/** The commit whose tag is `polygon`: the commit nearest to it. */
function commitOfTag(commits: DrawnCommit[], polygon: Element): DrawnCommit | undefined {
  return commits
    .map((commit) => ({ commit, away: distance(commit.elements[0] as Element, polygon) }))
    .filter(({ away }) => away < TAG_REACH)
    .sort((a, b) => a.away - b.away)[0]?.commit;
}

/** The label of a commit is a text in a group. A merge has none, unless it has an id of its own. */
const labelGroupsOf = (root: SVGSVGElement, id: string): Element[] =>
  [...root.querySelectorAll("g.commit-labels > g")].filter((group) => norm(group.querySelector("text.commit-label")?.textContent) === id);

/** A branch is a line, a label and the box behind the label. They are drawn in the same order. */
const BRANCH_PARTS = ["line.branch", "g.branchLabel", "rect.branchLabelBkg"] as const;

const branchNames = (root: SVGSVGElement): string[] => [...root.querySelectorAll("g.branchLabel")].map((label) => norm(label.textContent));

function branchElements(root: SVGSVGElement, name: string): Element[] {
  const place = branchNames(root).indexOf(name);
  if (place === -1) return [];
  return BRANCH_PARTS.map((selector) => root.querySelectorAll(selector)[place]).filter((element): element is Element => Boolean(element));
}

/** The name of the branch that `target` is a part of. */
function branchAt(root: SVGSVGElement, target: Element): string | null {
  for (const selector of BRANCH_PARTS) {
    const part = target.closest(selector);
    const place = part ? [...root.querySelectorAll(selector)].indexOf(part) : -1;
    if (place !== -1) return branchNames(root)[place] ?? null;
  }
  return null;
}

/** The commit that `target` is a part of: its circle, its label or its tag. */
function commitAt(root: SVGSVGElement, target: Element): { commit: DrawnCommit; place: number } | null {
  const commits = drawnCommits(root);
  const bullet = target.closest("g.commit-bullets .commit");
  const labelGroup = target.closest("g.commit-labels > g");
  const polygon = tagPolygonOf(target);
  const found = bullet
    ? commits.find((commit) => commit.id === idOfCommitElement(bullet))
    : labelGroup
      ? commits.find((commit) => commit.id === norm(labelGroup.querySelector("text.commit-label")?.textContent))
      : polygon && commitOfTag(commits, polygon);
  return found ? { commit: found, place: commits.indexOf(found) } : null;
}

export const gitFocus: FocusAdapter = {
  /**
   * Items are keyed by the index of their entry. The panel rows use the same index.
   * A commit or merge has the id it was given as `text`, or `#n` when it is the n-th commit (counting from 0).
   * A branch or checkout has the name of the branch.
   */
  items(code) {
    const model = parseGitGraph(code);
    if (!model) return [];
    const commitPlaces: number[] = [];
    let place = 0;
    model.entries.forEach((entry, index) => {
      commitPlaces[index] = place;
      place += entry.type === "commit" || entry.type === "merge" ? 1 : entry.type === "raw" ? rawCommits(entry.text) : 0;
    });
    return entryItems(code, model.entries, sourceOf, (entry, index) => (entry.type === "raw" ? null : String(index))).map((item): FocusItem => {
      const entry = model.entries[Number(item.key)] as Exclude<GitEntry, { type: "raw" }>;
      if (entry.type === "branch" || entry.type === "checkout") return { ...item, kind: entry.type, text: entry.name };
      const id = entry.id.trim();
      return { ...item, kind: entry.type, text: hasId(id) ? id : placeText(commitPlaces[Number(item.key)] ?? 0) };
    });
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item?.text) return [];
    if (item.kind === "branch" || item.kind === "checkout") return branchElements(root, item.text);
    const commits = drawnCommits(root);
    const commit = item.text.startsWith("#") ? commits[Number(item.text.slice(1))] : commits.find((candidate) => candidate.id === item.text);
    if (!commit) return [];
    return [...commit.elements, ...labelGroupsOf(root, commit.id), ...tagOf(root, commit)];
  },

  pick(root, items, target) {
    const branch = branchAt(root, target);
    if (branch !== null) return items.find((item) => item.kind === "branch" && item.text === branch)?.key ?? null;
    const found = commitAt(root, target);
    if (!found) return null;
    return items.find((item) => (item.kind === "commit" || item.kind === "merge") && (item.text === found.commit.id || item.text === placeText(found.place)))?.key ?? null;
  },
};
