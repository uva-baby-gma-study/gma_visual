class DynamicMovementHeatmap {
  constructor(canvas, jointNames) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.jointNames = jointNames;
    this.connectionPairs = [
      ["left_shoulder", "right_shoulder"],
      ["left_shoulder", "left_elbow"],
      ["left_elbow", "left_wrist"],
      ["right_shoulder", "right_elbow"],
      ["right_elbow", "right_wrist"],
      ["left_shoulder", "left_hip"],
      ["right_shoulder", "right_hip"],
      ["left_hip", "right_hip"],
      ["left_hip", "left_knee"],
      ["left_knee", "left_ankle"],
      ["right_hip", "right_knee"],
      ["right_knee", "right_ankle"]
    ];
    this.fullJointNames = [
      "nose", "left_eye", "right_eye", "left_ear", "right_ear",
      "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
      "left_wrist", "right_wrist", "left_hip", "right_hip",
      "left_knee", "right_knee", "left_ankle", "right_ankle"
    ];

    this.sequenceData = null;
    this.fullSequenceData = null;
    this.currentFrame = 0;
    this.selectedJointNames = jointNames.slice();

    this.scale = 600;
    this.cellSize = 6;
    this.depositSteps = 12;
    this.depositAmount = 1.0;
    this.blurPasses = 4;
    this.threshold = 0.03;
    this.gamma = 0.7;

    this.gridCols = 0;
    this.gridRows = 0;
    this.cumulativeBlurredGrids = [];
    this.finalMax = 1;
  }

  setSequence(sequenceData) {
    this.sequenceData = sequenceData;
    this.currentFrame = 0;
    this.precomputeAllFrames();
    this.draw();
  }

  setFullSequence(sequenceData) {
    this.fullSequenceData = sequenceData;
  }

  setFrame(frame) {
    this.currentFrame = frame;
    this.draw();
  }

  setSelectedJoints(jointNames) {
    const filtered = jointNames.filter(name => this.jointNames.includes(name));
    this.selectedJointNames = filtered;
    this.precomputeAllFrames();
    this.draw();
  }

  initEmptyGrid() {
    this.gridCols = Math.ceil(this.canvas.width / this.cellSize);
    this.gridRows = Math.ceil(this.canvas.height / this.cellSize);

    return Array.from(
      { length: this.gridRows },
      () => new Float32Array(this.gridCols)
    );
  }

  cloneGrid(grid) {
    return grid.map(row => Float32Array.from(row));
  }

  getJointScreenPosition(jointIndex, frame) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    const x = this.sequenceData[2 * jointIndex][frame];
    const y = this.sequenceData[2 * jointIndex + 1][frame];

    return {
      x: cx + x * this.scale,
      y: cy + y * this.scale
    };
  }

  depositToGrid(grid, x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    if (
      row < 0 || row >= this.gridRows ||
      col < 0 || col >= this.gridCols
    ) {
      return;
    }

    grid[row][col] += this.depositAmount;
  }

  depositMovementBetweenFrames(grid, prevFrame, currFrame) {
    for (const jointName of this.selectedJointNames) {
      const j = this.jointNames.indexOf(jointName);
      if (j < 0) continue;

      const p1 = this.getJointScreenPosition(j, prevFrame);
      const p2 = this.getJointScreenPosition(j, currFrame);

      for (let s = 0; s <= this.depositSteps; s++) {
        const a = s / this.depositSteps;
        const x = p1.x * (1 - a) + p2.x * a;
        const y = p1.y * (1 - a) + p2.y * a;
        this.depositToGrid(grid, x, y);
      }
    }
  }

  blurGrid(grid) {
    let src = this.cloneGrid(grid);

    for (let pass = 0; pass < this.blurPasses; pass++) {
      const dst = Array.from(
        { length: this.gridRows },
        () => new Float32Array(this.gridCols)
      );

      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          let sum = 0;
          let weightSum = 0;

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const rr = r + dr;
              const cc = c + dc;

              if (
                rr >= 0 && rr < this.gridRows &&
                cc >= 0 && cc < this.gridCols
              ) {
                const weight = (dr === 0 && dc === 0) ? 4 : 1;
                sum += src[rr][cc] * weight;
                weightSum += weight;
              }
            }
          }

          dst[r][c] = sum / weightSum;
        }
      }

      src = dst;
    }

    return src;
  }

  getGridMax(grid) {
    let maxVal = 0;

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (grid[r][c] > maxVal) {
          maxVal = grid[r][c];
        }
      }
    }

    return maxVal > 0 ? maxVal : 1;
  }

  precomputeAllFrames() {
    this.cumulativeBlurredGrids = [];

    if (!this.sequenceData || !this.sequenceData.length) {
      this.finalMax = 1;
      return;
    }

    const numFrames = this.sequenceData[0].length;
    let runningGrid = this.initEmptyGrid();

    this.cumulativeBlurredGrids[0] = this.blurGrid(runningGrid);

    for (let t = 1; t < numFrames; t++) {
      this.depositMovementBetweenFrames(runningGrid, t - 1, t);
      this.cumulativeBlurredGrids[t] = this.blurGrid(runningGrid);
    }

    this.finalMax = this.getGridMax(
      this.cumulativeBlurredGrids[numFrames - 1]
    );
  }

  colorMap(v) {
    const t = Math.max(0, Math.min(1, v));

    const low = { r: 34, g: 197, b: 94 };
    const mid = { r: 250, g: 204, b: 21 };
    const high = { r: 239, g: 68, b: 68 };
    const from = t < 0.5 ? low : mid;
    const to = t < 0.5 ? mid : high;
    const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    const r = Math.round(from.r + (to.r - from.r) * u);
    const g = Math.round(from.g + (to.g - from.g) * u);
    const b = Math.round(from.b + (to.b - from.b) * u);

    return [r, g, b];
  }

  drawLegend() {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(12, 12, 180, 54);

    ctx.fillStyle = "#ffffff";
    ctx.font = '15px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("Movement density", 22, 30);

    const gx = 22;
    const gy = 42;
    const gw = 130;
    const gh = 10;

    const grad = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    grad.addColorStop(0.0, "rgb(34, 197, 94)");
    grad.addColorStop(0.5, "rgb(250, 204, 21)");
    grad.addColorStop(1.0, "rgb(239, 68, 68)");

    ctx.fillStyle = grad;
    ctx.fillRect(gx, gy, gw, gh);

    ctx.fillStyle = "#ffffff";
    ctx.font = '12px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("low risk", gx, gy + 22);
    ctx.fillText("high risk", gx + gw - 45, gy + 22);
  }

  getJointPositionMap(frame) {
    const positions = new Map();
    const sequence = this.fullSequenceData || this.sequenceData;
    const sourceJointNames = this.fullSequenceData ? this.fullJointNames : this.jointNames;

    sourceJointNames.forEach((jointName, index) => {
      const xSeries = sequence?.[2 * index];
      const ySeries = sequence?.[2 * index + 1];
      if (!xSeries || !ySeries) return;

      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      const x = xSeries[frame];
      const y = ySeries[frame];

      positions.set(jointName, {
        x: cx + x * this.scale,
        y: cy + y * this.scale
      });
    });

    return positions;
  }

  drawSkeletonOverlay(frame) {
    const ctx = this.ctx;
    const positions = this.getJointPositionMap(frame);
    const selectedSet = new Set(this.selectedJointNames);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.connectionPairs.forEach(([a, b]) => {
      const start = positions.get(a);
      const end = positions.get(b);

      if (!start || !end) return;

      const bothSelected = selectedSet.has(a) && selectedSet.has(b);
      ctx.strokeStyle = bothSelected
        ? "rgba(255,255,255,0.72)"
        : "rgba(255,255,255,0.26)";
      ctx.lineWidth = bothSelected ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    positions.forEach((point, jointName) => {
      const isSelected = selectedSet.has(jointName);
      ctx.beginPath();
      ctx.arc(point.x, point.y, isSelected ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? "rgba(255,255,255,0.9)"
        : "rgba(255,255,255,0.45)";
      ctx.fill();
    });

    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, w, h);

    if (
      !this.sequenceData ||
      !this.selectedJointNames.length ||
      !this.cumulativeBlurredGrids.length
    ) {
      ctx.fillStyle = "#ccc";
      ctx.font = '18px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText("No dynamic heatmap data loaded", 20, 30);
      return;
    }

    const frame = Math.max(
      0,
      Math.min(this.currentFrame, this.cumulativeBlurredGrids.length - 1)
    );

    const grid = this.cumulativeBlurredGrids[frame];
    const maxVal = this.finalMax > 0 ? this.finalMax : 1;

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        let t = grid[r][c] / maxVal;
        t = Math.pow(t, this.gamma);

        if (t < this.threshold) continue;

        const [rr, gg, bb] = this.colorMap(t);
        ctx.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;
        ctx.fillRect(
          c * this.cellSize,
          r * this.cellSize,
          this.cellSize,
          this.cellSize
        );
      }
    }

    this.drawSkeletonOverlay(frame);
    this.drawLegend();
  }
}

window.DynamicMovementHeatmap = DynamicMovementHeatmap;
