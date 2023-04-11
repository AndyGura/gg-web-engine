export class Graph<T> {
  /**
   * Creates a new Graph instance from an array of elements, where each element in the array is a node in the graph.
   * The first element of the array is used as the root node of the graph.
   * @param array The array of elements to create the graph from.
   * @param closed An optional boolean indicating whether the graph is closed, meaning that the last node is adjacent to the first node.
   * @returns A new Graph instance created from the array.
   * @typeparam T The type of elements in the array and nodes in the graph.
   */
  static fromArray<T>(array: T[], closed: boolean = false): Graph<T> {
    const root = new Graph(array[0]);
    let tail = root;
    for (let i = 1; i < array.length; i++) {
      const newTail = new Graph<T>(array[i]);
      tail.addAdjacent(newTail);
      tail = newTail;
    }
    if (closed) {
      tail.addAdjacent(root);
    }
    return root;
  }

  /**
   * Creates a new Graph instance from a two-dimensional square grid of elements, where each element in the grid is a node in the graph.
   * The top-left element of the grid is used as the root node of the graph.
   * The nodes in the graph are created in the same order as the elements in the grid, from left to right and then from top to bottom.
   * @param grid The two-dimensional square grid of elements to create the graph from.
   * @returns A new Graph instance created from the square grid.
   * @typeparam T The type of elements in the square grid and nodes in the graph.
   */
  static fromSquareGrid<T>(grid: T[][]): Graph<T> {
    const nodes = grid.map(sgrid => sgrid.map(item => new Graph<T>(item)));
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
      const next = stack.shift()!;
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
      const next = stack.shift()!;
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
