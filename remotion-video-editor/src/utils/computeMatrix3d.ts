export type Point = { x: number; y: number };
export type Corners = { tl: Point; tr: Point; br: Point; bl: Point };

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }

  return M.map((row, i) => row[n] / row[i]);
}

// Maps a content rectangle (0,0)→(w,h) onto 4 arbitrary corners in video space.
// Returns a CSS matrix3d() string to use as a transform on a w×h div.
export function computeMatrix3d(
  contentWidth: number,
  contentHeight: number,
  { tl, tr, br, bl }: Corners
): string {
  const w = contentWidth;
  const h = contentHeight;

  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const dst = [[tl.x, tl.y], [tr.x, tr.y], [br.x, br.y], [bl.x, bl.y]];

  const A: number[][] = [];
  const bVec: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    bVec.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    bVec.push(dy);
  }

  const sol = gaussianElimination(A, bVec);
  const [h00, h01, h02, h10, h11, h12, h20, h21] = sol;
  const h22 = 1;

  // Embed 3×3 homography into CSS matrix3d (column-major 4×4):
  // [h00 h01  0  h02]
  // [h10 h11  0  h12]
  // [0   0    1  0  ]
  // [h20 h21  0  h22]
  return `matrix3d(${h00},${h10},0,${h20},${h01},${h11},0,${h21},0,0,1,0,${h02},${h12},0,${h22})`;
}
