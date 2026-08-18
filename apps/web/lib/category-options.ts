import type { EntityFilterOption } from "@/components/forms/entity-filter-select";

/** What `GET /products/categories` answers: a tree, with the count per node. */
export interface CategoryNode {
  id: string;
  name: string;
  parentId?: string | null;
  _count?: { products?: number };
  children?: CategoryNode[];
}

/** Non-breaking spaces so the indentation survives inside a `<SelectItem>`. */
const INDENT = "  ";

/**
 * Flattens the category tree into select options, depth first.
 *
 * The API returns categories nested by `children`, and a `<Select>` is a flat
 * list — without indentation "Áudio" and "Eletrônicos" look like siblings.
 * The product count comes along as a hint so the operator sees which category
 * is worth filtering by before choosing it.
 *
 * The visited set is not paranoia: `parentId` has no cycle constraint in the
 * schema, and a cycle here would blow the stack while rendering a dropdown.
 */
export function toCategoryOptions(
  nodes: CategoryNode[] | undefined,
  depth = 0,
  visited: Set<string> = new Set()
): EntityFilterOption[] {
  if (!nodes?.length) {return [];}

  const options: EntityFilterOption[] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) {continue;}
    visited.add(node.id);

    const count = node._count?.products;
    options.push({
      value: node.id,
      label: `${INDENT.repeat(depth)}${node.name}`,
      hint: typeof count === "number" ? `(${count})` : undefined,
    });
    options.push(...toCategoryOptions(node.children, depth + 1, visited));
  }
  return options;
}

/** Simple `{ id, name }` lists — brands, warehouses, cash registers. */
export function toEntityOptions(
  items: { id: string; name: string }[] | undefined
): EntityFilterOption[] {
  return (items ?? []).map((item) => ({ value: item.id, label: item.name }));
}
