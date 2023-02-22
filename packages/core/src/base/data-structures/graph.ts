export class Graph<T> {
  data: T;
  private adjacent: Set<Graph<T>>;

  constructor(data: T) {
    this.data = data;
    this.adjacent = new Set();
  }

  addAdjacent(node: Graph<T>): boolean {
    if (this.adjacent.has(node)) {
      return false;
    }
    this.adjacent.add(node);
    node.adjacent.add(this);
    return true;
  }

  removeAdjacent(node: Graph<T>): boolean {
    if (!this.adjacent.has(node)) {
      return false;
    }
    this.adjacent.delete(node);
    node.adjacent.delete(this);
    return true;
  }

  /**
   * Create an edge between two nodes
   */
  addEdge(source: Graph<T>, destination: Graph<T>): boolean {
    if (!this.removeAdjacent(destination)) {
      return false;
    }
    this.addAdjacent(source);
    source.addAdjacent(destination);
    return true;
  }

  /**
   * Remove an edge between two nodes
   */
  removeEdge(source: Graph<T>, destination: Graph<T>): boolean {
    if (!source.adjacent.has(this) || !source.adjacent.has(destination)) {
      return false;
    }
    source.removeAdjacent(this);
    source.removeAdjacent(destination);
    return this.addAdjacent(destination);
  }

  walkRead(depth: number): Set<Graph<T>> {
    const visited: Set<Graph<T>> = new Set();
    const stack: [Graph<T>, number][] = [[this, depth]];
    while (stack.length) {
      const next = stack.pop();
      if (!next) {
        continue;
      }
      const [node, depthLeft] = next;
      visited.add(node);
      if (depthLeft !== 0) {
        const children = Array.from(node.adjacent).filter(c => !visited.has(c));
        for (const child of children) {
          visited.add(child);
          stack.push([child, depthLeft - 1]);
        }
      }
    }
    return visited;
  }

  // TODO return iterable?
  nodes(): Graph<T>[] {
    return Array.from(this.walkRead(-1));
  }
}
