class StaticLinePlot {
  constructor(canvas, jointNames) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.jointNames = jointNames;

    this.sequenceData = null;
    this.currentFrame = 0;
    this.metric = "speed";
    this.selectedJointNames = jointNames.slice(0, 6);
    this.speedByJoint = new Map();
    this.accelerationByJoint = new Map();
    this.comparisonScaleByJoint = new Map();
    this.colors = ["#61dafb", "#ff7a59", "#7ee081", "#ffd166", "#c792ea", "#ff9f1c"];
  }

  setSequence(sequenceData) {
    this.sequenceData = sequenceData;
    this.currentFrame = 0;
    this.computeMovementSeries();
    this.draw();
  }

  setFrame(frame) {
    this.currentFrame = frame;
    this.draw();
  }

  setMetric(metric) {
    if (!["speed", "acceleration"].includes(metric)) return;
    this.metric = metric;
    this.draw();
  }

  setSelectedJoints(jointNames) {
    const filtered = jointNames.filter(name => this.jointNames.includes(name));
    this.selectedJointNames = filtered;
    this.draw();
  }

  computeMovementSeries() {
    this.speedByJoint = new Map();
    this.accelerationByJoint = new Map();

    if (!this.sequenceData || !this.sequenceData.length) {
      return;
    }

    const numFrames = this.sequenceData[0].length;

    for (let jointIndex = 0; jointIndex < this.jointNames.length; jointIndex++) {
      const speedSeries = [];

      for (let frame = 0; frame < numFrames; frame++) {
        if (frame === 0) {
          speedSeries.push(0);
          continue;
        }

        const x1 = this.sequenceData[2 * jointIndex][frame - 1];
        const y1 = this.sequenceData[2 * jointIndex + 1][frame - 1];
        const x2 = this.sequenceData[2 * jointIndex][frame];
        const y2 = this.sequenceData[2 * jointIndex + 1][frame];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const value = Math.sqrt(dx * dx + dy * dy);

        speedSeries.push(value);
      }

      const accelerationSeries = speedSeries.map((value, frame) => {
        if (frame < 2) return 0;
        return Math.abs(value - speedSeries[frame - 1]);
      });

      this.speedByJoint.set(this.jointNames[jointIndex], speedSeries);
      this.accelerationByJoint.set(this.jointNames[jointIndex], accelerationSeries);
    }
  }

  formatJointLabel(jointName, compact = false) {
    const label = jointName
      .replace(/_/g, " ")
      .replace(/^left /, "L ")
      .replace(/^right /, "R ");

    return label.replace(/\b[a-z]/g, char => char.toUpperCase());
  }

  drawEmpty(message) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#ccc";
    ctx.font = '18px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(message, 20, 30);
  }

  getSeriesMap() {
    return this.metric === "acceleration"
      ? this.accelerationByJoint
      : this.speedByJoint;
  }

  setComparisonScaleByJoint(scaleByJoint) {
    this.comparisonScaleByJoint = scaleByJoint instanceof Map
      ? new Map(scaleByJoint)
      : new Map(Object.entries(scaleByJoint || {}));
    this.draw();
  }

  getVisibleStartFrame(seriesLength) {
    if (seriesLength <= 1) return 0;
    const startFrame = this.metric === "acceleration" ? 2 : 1;
    return Math.min(startFrame, seriesLength - 1);
  }

  getSeriesScale(series) {
    const startFrame = this.getVisibleStartFrame(series.length);
    let peak = 0;

    for (let frame = startFrame; frame < series.length; frame++) {
      if (series[frame] > peak) {
        peak = series[frame];
      }
    }

    return peak > 0 ? peak * 1.1 : 1;
  }

  getComparisonScaleCandidates() {
    const seriesMap = this.getSeriesMap();
    const scales = new Map();

    this.selectedJointNames.forEach(jointName => {
      scales.set(jointName, this.getSeriesScale(seriesMap.get(jointName) || []));
    });

    return scales;
  }

  drawSeriesInBand(
    series,
    color,
    xAtFrame,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    seriesScale
  ) {
    const ctx = this.ctx;
    const startFrame = this.getVisibleStartFrame(series.length);
    const maxFrame = Math.max(startFrame, series.length - 1);
    const frameSpan = Math.max(1, maxFrame - startFrame);

    if (series.length - 1 < startFrame) {
      return;
    }

    ctx.beginPath();

    for (let frame = startFrame; frame < series.length; frame++) {
      const x = plotLeft + ((frame - startFrame) / frameSpan) * plotWidth;
      const y = plotTop + plotHeight - (series[frame] / seriesScale) * plotHeight;

      if (frame === startFrame) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const clampedFrame = Math.max(
      startFrame,
      Math.min(this.currentFrame, series.length - 1)
    );
    const pointY = plotTop + plotHeight - (series[clampedFrame] / seriesScale) * plotHeight;

    ctx.beginPath();
    ctx.arc(xAtFrame, pointY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  draw() {
    if (!this.sequenceData || !this.sequenceData.length) {
      this.drawEmpty("No static line plot data loaded");
      return;
    }

    if (!this.selectedJointNames.length) {
      this.drawEmpty("No joints selected");
      return;
    }

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const numFrames = this.sequenceData[0].length;
    const clampedFrame = Math.max(0, Math.min(this.currentFrame, numFrames - 1));
    const visibleStartFrame = this.metric === "acceleration" ? 2 : 1;
    const visibleEndFrame = Math.max(visibleStartFrame, numFrames - 1);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const compact = width < 1000;
    const veryCompact = width < 820;
    const leftPad = compareMode
      ? (veryCompact ? 82 : compact ? 88 : 96)
      : (veryCompact ? 80 : compact ? 86 : 90);
    const rightPad = compact ? 16 : 24;
    const topPad = compact ? 18 : 24;
    const bottomPad = compact ? 28 : 34;
    const stackGap = compact ? 10 : 14;
    const labelFontSize = compareMode ? (veryCompact ? 12 : compact ? 13 : 14) : 14;
    const axisFontSize = compact ? 11 : 12;
    const plotWidth = width - leftPad - rightPad;
    const plotHeightTotal = height - topPad - bottomPad;
    const bandHeight = (plotHeightTotal - stackGap * (this.selectedJointNames.length - 1)) / this.selectedJointNames.length;
    const clampedVisibleFrame = Math.max(
      visibleStartFrame,
      Math.min(clampedFrame, visibleEndFrame)
    );
    const xAtFrame = leftPad + (
      (clampedVisibleFrame - visibleStartFrame) /
      Math.max(1, visibleEndFrame - visibleStartFrame)
    ) * plotWidth;

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xAtFrame, topPad);
    ctx.lineTo(xAtFrame, height - bottomPad);
    ctx.stroke();

    const seriesMap = this.getSeriesMap();

    this.selectedJointNames.forEach((jointName, index) => {
      const series = seriesMap.get(jointName) || [];
      const bandTop = topPad + index * (bandHeight + stackGap);
      const plotTop = bandTop + 10;
      const innerHeight = bandHeight - 20;
      const color = this.colors[index % this.colors.length];
      const seriesScale =
        this.comparisonScaleByJoint.get(jointName) ||
        this.getSeriesScale(series);

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(leftPad, bandTop, plotWidth, bandHeight);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(leftPad, bandTop, plotWidth, bandHeight);

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(leftPad, plotTop + innerHeight);
      ctx.lineTo(leftPad + plotWidth, plotTop + innerHeight);
      ctx.stroke();

      ctx.fillStyle = "#cfcfcf";
      ctx.font = `${labelFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(
        this.formatJointLabel(jointName, compact),
        compareMode && compact ? 6 : 10,
        bandTop + bandHeight / 2 + 4
      );

      if (series.length > 0) {
        this.drawSeriesInBand(
          series,
          color,
          xAtFrame,
          leftPad,
          plotTop,
          plotWidth,
          innerHeight,
          seriesScale
        );
      }
    });

    ctx.fillStyle = "#cfcfcf";
    ctx.font = `${axisFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(String(visibleStartFrame), leftPad, height - 12);
    ctx.fillText(String(visibleEndFrame), leftPad + plotWidth - 24, height - 12);
    ctx.fillText("Frame", leftPad + plotWidth / 2 - 14, height - 12);
  }
}

window.StaticLinePlot = StaticLinePlot;
