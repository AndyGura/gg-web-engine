import { Graph } from '../../../src/base/data-structures/graph';

describe(`Graph<T>`, () => {

  const testGrid = Array(150).fill(null).map((_, i) => (
    Array(151).fill(null).map((_, j) => ({ i, j }))
  ));
  const testGridGraph = Graph.fromSquareGrid(testGrid);
  const nodesArray: Graph<{ i: number, j: number }>[][] = Array(150).fill(null).map((_, i) => (
    Array(151).fill(null).map((_, j) => null!)
  ));
  for (const node of testGridGraph.nodes()) {
    nodesArray[node.data.i][node.data.j] = node;
  }
  const middleNode = nodesArray[75][75];

  describe(`walkRead`, () => {
    it('should return correct amount for depth 0', () => {
      const result = middleNode.walkRead(0);
      expect(result.size).toBe(1);
      expect(result.has(middleNode)).toBe(true);
    });
    it('should return correct amount for depth 4', () => {
      const result = middleNode.walkRead(4);
      expect(result.size).toBe(41);
    });
    it('should return correct amount for depth 5', () => {
      const result = middleNode.walkRead(5);
      expect(result.size).toBe(61);
    });
    it('should return correct amount for depth 6', () => {
      const result = middleNode.walkRead(6);
      expect(result.size).toBe(85);
    });
    it('should return correct amount for depth 7', () => {
      const result = middleNode.walkRead(7);
      expect(result.size).toBe(113);
    });
  });
  describe(`walkReadPreserveDepth`, () => {
    it('should return correct amounts for depth 0', () => {
      const result = middleNode.walkReadPreserveDepth(0);
      expect(result.length).toBe(1);
      expect(result[0].size).toBe(1);
      expect(result[0].has(middleNode)).toBe(true);
    });
    it('should return correct amounts for depth 4', () => {
      const result = middleNode.walkReadPreserveDepth(4);
      expect(result.length).toBe(5);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].size).toBe(i > 0 ? i * 4 : 1);
      }
    });
    it('should return correct amounts for depth 5', () => {
      const result = middleNode.walkReadPreserveDepth(5);
      expect(result.length).toBe(6);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].size).toBe(i > 0 ? i * 4 : 1);
      }
    });
    it('should return correct amounts for depth 6', () => {
      const result = middleNode.walkReadPreserveDepth(6);
      expect(result.length).toBe(7);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].size).toBe(i > 0 ? i * 4 : 1);
      }
    });
    it('should return correct amounts for depth 7', () => {
      const result = middleNode.walkReadPreserveDepth(7);
      expect(result.length).toBe(8);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].size).toBe(i > 0 ? i * 4 : 1);
      }
    });
  });
});
