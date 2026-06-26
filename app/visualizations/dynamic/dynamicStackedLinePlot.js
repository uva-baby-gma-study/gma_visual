class DynamicStackedLinePlot {
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
        speedSeries.push(Math.sqrt(dx * dx + dy * dy));
      }

      const accelerationSeries = speedSeries.map((value, frame) => {
        if (frame < 2) return 0;
        return Math.abs(value - speedSeries[frame - 1]);
      });

      this.speedByJoint.set(this.jointNames[jointIndex], speedSeries);
      this.accelerationByJoint.set(this.jointNames[jointIndex], accelerationSeries);
    }
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

  formatJointLabel(jointName) {
    const label = jointName
      .replace(/_/g, " ")
      .replace(/^left /, "L ")
      .replace(/^right /, "R ");

    return label.replace(/\b[a-z]/g, char => char.toUpperCase());
  }

  getSeriesMap() {
    return this.metric === "acceleration"
      ? this.accelerationByJoint
      : this.speedByJoint;
  }

  getVisibleStartFrame(seriesLength) {
    if (seriesLength <= 1) return 0;
    const startFrame = this.metric === "acceleration" ? 2 : 1;
    return Math.min(startFrame, seriesLength - 1);
  }

  getSharedScale(seriesList, lastFrame) {
    let peak = 0;

    seriesList.forEach(series => {
      const startFrame = this.getVisibleStartFrame(series.length);
      const finalFrame = Math.max(0, Math.min(lastFrame, series.length - 1));

      for (let frame = startFrame; frame <= finalFrame; frame++) {
        if (series[frame] > peak) {
          peak = series[frame];
        }
      }
    });

    return peak > 0 ? peak * 1.1 : 1;
  }

  drawLegend(legendX, legendY, legendWidth, compact = false) {
    const ctx = this.ctx;
    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const columns = Math.max(1, Math.min(3, this.selectedJointNames.length || 1));
    const columnWidth = legendWidth / columns;
    const rowHeight = compact ? 22 : 26;
    const fontSize = compareMode ? (compact ? 16 : 18) : 14;

    ctx.font = `${fontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;

    this.selectedJointNames.slice(0, 6).forEach((jointName, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = legendX + column * columnWidth;
      const y = legendY + row * rowHeight;

      ctx.fillStyle = this.colors[index % this.colors.length];
      ctx.fillRect(x, y - 11, compact ? 13 : 14, compact ? 13 : 14);
      ctx.fillStyle = "#cfd7e3";
      ctx.fillText(this.formatJointLabel(jointName), x + 16, y);
    });

    return Math.ceil(Math.min(6, this.selectedJointNames.length || 1) / columns) * rowHeight;
  }

  draw() {
    if (!this.sequenceData || !this.sequenceData.length) {
      this.drawEmpty("No dynamic stacked line data loaded");
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
    const frameSpan = Math.max(1, visibleEndFrame - visibleStartFrame);
    const seriesMap = this.getSeriesMap();
    const seriesList = this.selectedJointNames.map(name => seriesMap.get(name) || []);
    const sharedScale = this.getSharedScale(seriesList, clampedFrame);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const compact = width < 1000;
    const leftPad = compareMode ? (compact ? 12 : 84) : 28;
    const rightPad = compareMode ? (compact ? 10 : 28) : 28;
    const legendY = compact ? 20 : 28;
    const legendRowsHeight = this.drawLegend(leftPad, legendY, width - leftPad - rightPad, compact);
    const topPad = legendY + legendRowsHeight + (compact ? 12 : 14);
    const bottomPad = compact ? 36 : 44;
    const plotWidth = width - leftPad - rightPad;
    const plotHeight = height - topPad - bottomPad;

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(leftPad, topPad, plotWidth, plotHeight);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.strokeRect(leftPad, topPad, plotWidth, plotHeight);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = topPad + (i / 4) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(leftPad, y);
      ctx.lineTo(leftPad + plotWidth, y);
      ctx.stroke();
    }

    const finalFrame = Math.max(visibleStartFrame, Math.min(clampedFrame, visibleEndFrame));
    const markerX = leftPad + ((finalFrame - visibleStartFrame) / frameSpan) * plotWidth;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(markerX, topPad);
    ctx.lineTo(markerX, topPad + plotHeight);
    ctx.stroke();

    this.selectedJointNames.forEach((jointName, index) => {
      const series = seriesMap.get(jointName) || [];
      const startFrame = this.getVisibleStartFrame(series.length);
      const endFrame = Math.max(startFrame, Math.min(clampedFrame, series.length - 1));
      const color = this.colors[index % this.colors.length];

      if (endFrame < startFrame) {
        return;
      }

      ctx.beginPath();

      for (let frame = startFrame; frame <= endFrame; frame++) {
        const x = leftPad + ((frame - visibleStartFrame) / frameSpan) * plotWidth;
        const y = topPad + plotHeight - (series[frame] / sharedScale) * plotHeight;

        if (frame === startFrame) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      const pointY = topPad + plotHeight - (series[endFrame] / sharedScale) * plotHeight;
      ctx.beginPath();
      ctx.arc(markerX, pointY, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    ctx.fillStyle = "#cfcfcf";
    ctx.font = `${compact ? 11 : 12}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(String(visibleStartFrame), leftPad, height - 14);
    ctx.fillText(String(visibleEndFrame), leftPad + plotWidth - 24, height - 14);
    ctx.fillText("Frame", leftPad + plotWidth / 2 - 14, height - 14);
  }
}

window.DynamicStackedLinePlot = DynamicStackedLinePlot;
