class StaticHeatmap {
  constructor(canvas, jointNames) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.jointNames = jointNames;

    this.sequenceData = null;
    this.currentFrame = 0;
    this.selectedJointNames = jointNames.slice();
    this.movementByJoint = new Map();
    this.movementMatrix = [];
    this.maxMovement = 1;
  }

  setSequence(sequenceData) {
    this.sequenceData = sequenceData;
    this.currentFrame = 0;
    this.computeMovementMatrix();
    this.draw();
  }

  setFrame(frame) {
    this.currentFrame = frame;
    this.draw();
  }

  setSelectedJoints(jointNames) {
    const filtered = jointNames.filter(name => this.jointNames.includes(name));
    this.selectedJointNames = filtered;
    this.updateVisibleMovementMatrix();
    this.draw();
  }

  computeMovementMatrix() {
    this.movementByJoint = new Map();

    if (!this.sequenceData || !this.sequenceData.length) {
      this.movementMatrix = [];
      this.maxMovement = 1;
      return;
    }

    const numJoints = this.jointNames.length;
    const numFrames = this.sequenceData[0].length;

    for (let j = 0; j < numJoints; j++) {
      const movement = [];
      let runningTotal = 0;

      for (let t = 0; t < numFrames; t++) {
        if (t === 0) {
          movement.push(0);
          continue;
        }

        const x1 = this.sequenceData[2 * j][t - 1];
        const y1 = this.sequenceData[2 * j + 1][t - 1];
        const x2 = this.sequenceData[2 * j][t];
        const y2 = this.sequenceData[2 * j + 1][t];

        const dx = x2 - x1;
        const dy = y2 - y1;
        runningTotal += Math.sqrt(dx * dx + dy * dy);
        movement.push(runningTotal);
      }

      this.movementByJoint.set(this.jointNames[j], movement);
    }

    this.updateVisibleMovementMatrix();
  }

  updateVisibleMovementMatrix() {
    if (!this.sequenceData || !this.sequenceData.length || !this.movementByJoint.size) {
      this.movementMatrix = [];
      this.maxMovement = 1;
      return;
    }

    this.movementMatrix = this.selectedJointNames.map(
      jointName => this.movementByJoint.get(jointName) || []
    );

    let maxVal = 0;

    for (const row of this.movementMatrix) {
      for (const value of row) {
        if (value > maxVal) {
          maxVal = value;
        }
      }
    }

    this.maxMovement = maxVal > 0 ? maxVal : 1;
  }

  formatJointLabel(jointName) {
    const label = jointName
      .split("_")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return label
      .replace(/^Left /, "L ")
      .replace(/^Right /, "R ");
  }

  getColor(value) {
    const normalized = Math.max(0, Math.min(1, value / this.maxMovement));
    const eased = Math.pow(normalized, 0.82);
    const low = { r: 34, g: 197, b: 94 };
    const mid = { r: 250, g: 204, b: 21 };
    const high = { r: 239, g: 68, b: 68 };
    const from = eased < 0.5 ? low : mid;
    const to = eased < 0.5 ? mid : high;
    const t = eased < 0.5 ? eased / 0.5 : (eased - 0.5) / 0.5;
    const r = Math.round(from.r + (to.r - from.r) * t);
    const g = Math.round(from.g + (to.g - from.g) * t);
    const b = Math.round(from.b + (to.b - from.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  drawLegend(panelX, panelY, panelWidth) {
    const ctx = this.ctx;
    const compact = this.canvas.width < 760;
    const barWidth = Math.min(compact ? 150 : 190, Math.max(110, panelWidth - 42));
    const barHeight = compact ? 9 : 10;
    const x = panelX + panelWidth - barWidth - 18;
    const y = panelY + 4;

    const gradient = ctx.createLinearGradient(x, 0, x + barWidth, 0);
    gradient.addColorStop(0, "rgb(34, 197, 94)");
    gradient.addColorStop(0.5, "rgb(250, 204, 21)");
    gradient.addColorStop(1, "rgb(239, 68, 68)");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.font = `${compact ? 11 : 12}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#9fb0c3";
    ctx.fillText("low risk", x, y + 22);
    ctx.fillText("high risk", x + barWidth - 46, y + 22);
  }

  drawPanelChrome(panelX, panelY, panelWidth, panelHeight) {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    if (!this.movementMatrix.length || !this.movementMatrix[0]?.length) {
      ctx.fillStyle = "#ccc";
      ctx.font = '18px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText("No static heatmap data loaded", 20, 30);
      return;
    }

    const numRows = this.movementMatrix.length;
    const numCols = this.movementMatrix[0].length;
    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const compact = width < 760;
    const veryCompact = width < 620;
    let leftPad = 118;
    let topPad = 96;
    let rightPad = 36;
    let bottomPad = 52;
    let headerPad = 40;
    let labelFontSize = 14;
    let axisFontSize = 12;
    let gridWidth = width - leftPad - rightPad;
    let gridHeight = height - topPad - bottomPad;
    let labelX = 18;

    if (compact) {
      leftPad = veryCompact ? 98 : 116;
      topPad = 84;
      rightPad = 20;
      bottomPad = 46;
      headerPad = 34;
      labelFontSize = compareMode ? (veryCompact ? 10 : 11) : 14;
      axisFontSize = 11;
      gridWidth = width - leftPad - rightPad;
      gridHeight = height - topPad - bottomPad;
      labelX = 12;
    }

    const cellW = gridWidth / numCols;
    const cellH = gridHeight / numRows;
    const panelX = leftPad - 18;
    const panelY = topPad - headerPad;
    const panelWidth = gridWidth + 36;
    const panelHeight = gridHeight + headerPad + 16;

    this.drawPanelChrome(panelX, panelY, panelWidth, panelHeight);
    this.drawLegend(panelX, panelY, panelWidth);

    const frame = Math.max(0, Math.min(this.currentFrame, numCols - 1));
    const highlightX = leftPad + frame * cellW;

    for (let r = 0; r < numRows; r++) {
      const rowY = topPad + r * cellH;

      ctx.fillStyle = r % 2 === 0
        ? "rgba(255,255,255,0.02)"
        : "rgba(255,255,255,0.035)";
      ctx.fillRect(leftPad, rowY, gridWidth, cellH);

      for (let c = 0; c < numCols; c++) {
        ctx.fillStyle = this.getColor(this.movementMatrix[r][c]);
        ctx.fillRect(
          leftPad + c * cellW,
          rowY,
          Math.ceil(cellW),
          Math.ceil(cellH)
        );
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(highlightX, topPad, Math.max(2, cellW), gridHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(leftPad, topPad, gridWidth, gridHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let r = 1; r < numRows; r++) {
      const y = topPad + r * cellH;
      ctx.beginPath();
      ctx.moveTo(leftPad, y);
      ctx.lineTo(leftPad + gridWidth, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#dbe7f4";
    ctx.font = `${labelFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = "middle";

    for (let r = 0; r < numRows; r++) {
      const y = topPad + r * cellH + cellH / 2;
      ctx.fillText(this.formatJointLabel(this.selectedJointNames[r]), labelX, y);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(highlightX, topPad);
    ctx.lineTo(highlightX, topPad + gridHeight);
    ctx.stroke();

    ctx.fillStyle = "#cfd9e5";
    ctx.font = `${axisFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("0", leftPad, height - 18);
    ctx.fillText(String(Math.max(0, numCols - 1)), leftPad + gridWidth - 24, height - 18);
    ctx.fillText("Frame", leftPad + gridWidth / 2 - 14, height - 18);
  }
}

window.StaticHeatmap = StaticHeatmap;
