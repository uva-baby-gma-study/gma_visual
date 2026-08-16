class DynamicEpisodePlot {
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

  formatJointLabel(jointName, compact = false) {
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

  setComparisonScaleByJoint(scaleByJoint) {
    this.comparisonScaleByJoint = scaleByJoint instanceof Map
      ? new Map(scaleByJoint)
      : new Map(Object.entries(scaleByJoint || {}));
    this.draw();
  }

  getSeriesPeak(series, lastFrame = null) {
    if (!series.length) return 0;

    const startFrame = this.getVisibleStartFrame(series.length);
    const endFrame = lastFrame === null
      ? Math.max(startFrame, series.length - 1)
      : Math.max(startFrame, Math.min(lastFrame, series.length - 1));

    let peak = 0;
    for (let frame = startFrame; frame <= endFrame; frame++) {
      if (series[frame] > peak) peak = series[frame];
    }
    return peak;
  }

  getComparisonScaleCandidates() {
    const seriesMap = this.getSeriesMap();
    const scales = new Map();
    this.selectedJointNames.forEach(jointName => {
      scales.set(jointName, this.getSeriesPeak(seriesMap.get(jointName) || []));
    });
    return scales;
  }

  buildEpisodes(series, lastFrame, comparisonPeak = null) {
    if (!series.length) return [];

    const startFrame = this.getVisibleStartFrame(series.length);
    const endFrame = Math.max(startFrame, Math.min(lastFrame, series.length - 1));

    if (endFrame < startFrame) return [];

    let peak = 0;
    let total = 0;
    let count = 0;

    for (let frame = startFrame; frame <= endFrame; frame++) {
      peak = Math.max(peak, series[frame]);
      total += series[frame];
      count++;
    }

    if (peak <= 0 || count === 0) return [];

    const intensityPeak = comparisonPeak && comparisonPeak > 0 ? comparisonPeak : peak;
    const mean = total / count;
    const threshold = Math.max(peak * 0.22, mean * 1.15);
    const episodes = [];
    let frame = startFrame;

    while (frame <= endFrame) {
      if (series[frame] < threshold) {
        frame++;
        continue;
      }

      const episodeStart = frame;
      let episodePeak = 0;
      let episodeSum = 0;
      let episodeEnd = frame;

      while (frame <= endFrame && series[frame] >= threshold) {
        episodePeak = Math.max(episodePeak, series[frame]);
        episodeSum += series[frame];
        episodeEnd = frame;
        frame++;
      }

      const duration = episodeEnd - episodeStart + 1;
      episodes.push({
        startFrame: episodeStart,
        endFrame: episodeEnd,
        duration,
        mean: episodeSum / duration,
        peak: episodePeak,
        intensity: intensityPeak > 0 ? episodePeak / intensityPeak : 0
      });
    }

    return episodes;
  }

  drawEpisodeBand(episodes, color, plotLeft, plotTop, plotWidth, plotHeight, startFrame, endFrame) {
    const ctx = this.ctx;
    const frameSpan = Math.max(1, endFrame - startFrame + 1);

    episodes.forEach(episode => {
      const x = plotLeft + ((episode.startFrame - startFrame) / frameSpan) * plotWidth;
      const widthPx = Math.max(4, (episode.duration / frameSpan) * plotWidth);
      const visualIntensity = Math.pow(Math.max(0.04, episode.intensity), 1.9);
      const rawBarHeight = Math.max(
        plotHeight * 0.14,
        plotHeight * (0.16 + 0.78 * visualIntensity)
      );
      const rawY = plotTop + plotHeight - rawBarHeight - plotHeight * 0.08;
      const barX = Math.round(x);
      const barY = Math.round(rawY);
      const barWidth = Math.max(4, Math.round(widthPx));
      const barHeight = Math.max(3, Math.round(rawBarHeight));

      ctx.fillStyle = color.replace("hsl(", "hsla(").replace(")", ", 0.82)");
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(barX + 0.5, barY + 0.5, Math.max(1, barWidth - 1), Math.max(1, barHeight - 1));
    });
  }

  draw() {
    if (!this.sequenceData || !this.sequenceData.length) {
      this.drawEmpty("No dynamic episode data loaded");
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
    const visibleEndFrame = Math.max(visibleStartFrame, clampedFrame);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const compact = width < 1000;
    const veryCompact = width < 820;
    const leftPad = compareMode
      ? (veryCompact ? 82 : compact ? 88 : 96)
      : (veryCompact ? 82 : compact ? 88 : 92);
    const rightPad = compact ? 18 : 28;
    const topPad = compact ? 24 : 32;
    const bottomPad = compact ? 34 : 40;
    const rowGap = compact ? 10 : 14;
    const labelFontSize = compareMode ? (veryCompact ? 12 : compact ? 13 : 14) : 14;
    const axisFontSize = compact ? 11 : 12;
    const plotWidth = width - leftPad - rightPad;
    const plotHeightTotal = height - topPad - bottomPad;
    const bandHeight = (plotHeightTotal - rowGap * (this.selectedJointNames.length - 1)) / this.selectedJointNames.length;

    const seriesMap = this.getSeriesMap();
    const frameSpan = Math.max(1, visibleEndFrame - visibleStartFrame + 1);
    const clampedVisibleFrame = Math.max(
      visibleStartFrame,
      Math.min(clampedFrame, visibleEndFrame)
    );
    const markerX = leftPad + ((clampedVisibleFrame - visibleStartFrame) / frameSpan) * plotWidth;

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(markerX, topPad);
    ctx.lineTo(markerX, height - bottomPad);
    ctx.stroke();

    this.selectedJointNames.forEach((jointName, index) => {
      const series = seriesMap.get(jointName) || [];
      const bandTop = topPad + index * (bandHeight + rowGap);
      const color = `hsl(${198 - index * 10}, 78%, ${60 - Math.min(index, 5) * 4}%)`;
      const comparisonPeak = this.comparisonScaleByJoint.get(jointName) || null;
      const episodes = this.buildEpisodes(series, clampedFrame, comparisonPeak);

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(leftPad, bandTop, plotWidth, bandHeight);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(leftPad, bandTop, plotWidth, bandHeight);

      ctx.fillStyle = "#d0d7e4";
      ctx.font = `${labelFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillText(
        this.formatJointLabel(jointName, compact),
        compareMode && compact ? 6 : 10,
        bandTop + bandHeight / 2 + 4
      );

      this.drawEpisodeBand(
        episodes,
        color,
        leftPad,
        bandTop,
        plotWidth,
        bandHeight,
        visibleStartFrame,
        visibleEndFrame
      );
    });

    ctx.fillStyle = "#cfcfcf";
    ctx.font = `${axisFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(String(visibleStartFrame), leftPad, height - 14);
    ctx.fillText(String(visibleEndFrame), leftPad + plotWidth - 24, height - 14);
    ctx.fillText("Frame", leftPad + plotWidth / 2 - 14, height - 14);
  }
}

window.DynamicEpisodePlot = DynamicEpisodePlot;
