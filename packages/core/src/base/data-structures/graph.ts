export class Graph<T> {

  static fromArray<T>(array: T[]): Graph<T> {
    const root = new Graph(array[0]);
    let tail = root;
    for (let i = 1; i < array.length; i++) {
      const newTail = new Graph<T>(array[i]);
      tail.addAdjacent(newTail);
      tail = newTail;
    }
    return root;
  }
  static fromSquareGrid<T>(grid: T[][]): Graph<T> {
    const nodes = grid.map((sgrid) => sgrid.map(item => new Graph<T>(item)));
    // bind them
    for (let j = 0; j < nodes.length; j++) {
      for (let i = 0; i < nodes.length; i++) {
        if (i > 0) {
          nodes[j][i].addAdjacent(nodes[j][i - 1]);
        }
        if (j > 0) {
          nodes[j][i].addAdjacent(nodes[j - 1][i]);
        }
      }
    }
    return nodes[0][0];
  }

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
    visited.add(this);
    while (stack.length) {
      const next = stack.shift();
      if (!next) {
        continue;
      }
      const [node, depthLeft] = next;
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

  // the same as "walkRead", but returns array of sets (per depth), so distance to each found node can be tracked
  walkReadPreserveDepth(depth: number): Set<Graph<T>>[] {
    const visited: Set<Graph<T>> = new Set();
    const result: Set<Graph<T>>[] = [];
    const stack: [Graph<T>, number][] = [[this, depth]];
    visited.add(this);
    while (stack.length) {
      const next = stack.shift();
      if (!next) {
        continue;
      }
      const [node, depthLeft] = next;
      const distance = depth - depthLeft;
      if (!result[distance]) {
        result[distance] = new Set<Graph<T>>();
      }
      result[distance].add(node);
      if (depthLeft !== 0) {
        const children = Array.from(node.adjacent).filter(c => !visited.has(c));
        for (const child of children) {
          visited.add(child);
          stack.push([child, depthLeft - 1]);
        }
      }
    }
    return result;
  }

  // TODO return iterable?
  nodes(): Graph<T>[] {
    return Array.from(this.walkRead(-1));
  }
}
