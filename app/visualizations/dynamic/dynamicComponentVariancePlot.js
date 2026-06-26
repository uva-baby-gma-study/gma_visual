class DynamicComponentVariancePlot {
  constructor(canvas, jointNames) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.jointNames = jointNames;
    this.subjectId = "";
    this.components = [];
    this.componentSeriesById = new Map();
    this.componentSequencesReady = false;
    this.selectedComponentId = null;
    this.sequenceData = null;
    this.currentFrame = 0;
    this.cardRegions = [];
    this.alertThreshold = 39;
    this.fullJointNames = [
      "nose", "left_eye", "right_eye", "left_ear", "right_ear",
      "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
      "left_wrist", "right_wrist", "left_hip", "right_hip",
      "left_knee", "right_knee", "left_ankle", "right_ankle"
    ];
    this.fullJointIndexByName = new Map(
      this.fullJointNames.map((jointName, index) => [jointName, index])
    );
    this.pairs = [
      {
        label: "Shoulder",
        left: "left_shoulder",
        right: "right_shoulder",
        leftColor: "#7dd3fc",
        rightColor: "#38bdf8"
      },
      {
        label: "Elbow",
        left: "left_elbow",
        right: "right_elbow",
        leftColor: "#86efac",
        rightColor: "#4ade80"
      },
      {
        label: "Wrist",
        left: "left_wrist",
        right: "right_wrist",
        leftColor: "#f9a8d4",
        rightColor: "#f472b6"
      },
      {
        label: "Hip",
        left: "left_hip",
        right: "right_hip",
        leftColor: "#fcd34d",
        rightColor: "#f59e0b"
      },
      {
        label: "Knee",
        left: "left_knee",
        right: "right_knee",
        leftColor: "#c4b5fd",
        rightColor: "#8b5cf6"
      },
      {
        label: "Ankle",
        left: "left_ankle",
        right: "right_ankle",
        leftColor: "#fdba74",
        rightColor: "#f97316"
      }
    ];
  }

  setSequence(sequenceData) {
    this.sequenceData = sequenceData;
    this.draw();
  }

  setFrame(frame) {
    this.currentFrame = Number.isFinite(frame) ? frame : 0;
    this.draw();
  }

  setVarianceData(subjectId, components) {
    if (subjectId !== this.subjectId) {
      this.componentSeriesById = new Map();
      this.componentSequencesReady = false;
    }
    this.subjectId = subjectId;
    this.components = Array.isArray(components) ? components.slice() : [];
    this.draw();
  }

  setComponentMetadata(subjectId, components) {
    if (subjectId !== this.subjectId) {
      this.componentSeriesById = new Map();
    }
    this.subjectId = subjectId;
    this.components = Array.isArray(components) ? components.slice() : [];
    this.componentSequencesReady = false;
    this.draw();
  }

  setComponentSequences(subjectId, components, sequenceMap) {
    this.subjectId = subjectId;
    this.components = Array.isArray(components) ? components.slice() : [];
    this.componentSeriesById = this.buildComponentSeries(sequenceMap);
    this.componentSequencesReady = true;
    this.draw();
  }

  setSelectedComponent(componentId) {
    this.selectedComponentId =
      componentId === null || componentId === undefined || componentId === ""
        ? null
        : Number.parseInt(componentId, 10);
    this.draw();
  }

  handleClick(canvasX, canvasY) {
    const hitRegion = this.cardRegions.find(region =>
      canvasX >= region.x &&
      canvasX <= region.x + region.width &&
      canvasY >= region.y &&
      canvasY <= region.y + region.height
    );

    return hitRegion ? hitRegion.componentId : null;
  }

  buildComponentSeries(sequenceMap) {
    const componentSeries = new Map();

    if (!(sequenceMap instanceof Map)) {
      return componentSeries;
    }

    sequenceMap.forEach((sequenceData, componentId) => {
      componentSeries.set(
        Number.parseInt(componentId, 10),
        this.buildVarianceSeries(sequenceData)
      );
    });

    return componentSeries;
  }

  buildVarianceSeries(sequenceData) {
    const frameCount = sequenceData?.[0]?.length || 0;
    const jointVarianceByFrame = {};
    const totalVarianceByFrame = new Array(frameCount).fill(0);

    this.jointNames.forEach(jointName => {
      const jointIndex = this.fullJointIndexByName.get(jointName);
      const xSeries = sequenceData?.[jointIndex * 2] || [];
      const ySeries = sequenceData?.[jointIndex * 2 + 1] || [];
      const jointVariance = new Array(frameCount).fill(0);
      let sumX = 0;
      let sumXSquared = 0;
      let sumY = 0;
      let sumYSquared = 0;

      for (let frame = 0; frame < frameCount; frame++) {
        const x = Number.parseFloat(xSeries[frame]) || 0;
        const y = Number.parseFloat(ySeries[frame]) || 0;
        const sampleCount = frame + 1;

        sumX += x;
        sumXSquared += x * x;
        sumY += y;
        sumYSquared += y * y;

        const meanX = sumX / sampleCount;
        const meanY = sumY / sampleCount;
        const varianceX = Math.max(0, sumXSquared / sampleCount - meanX * meanX);
        const varianceY = Math.max(0, sumYSquared / sampleCount - meanY * meanY);
        const totalJointVariance = varianceX + varianceY;

        jointVariance[frame] = totalJointVariance;
        totalVarianceByFrame[frame] += totalJointVariance;
      }

      jointVarianceByFrame[jointName] = jointVariance;
    });

    const percentByJoint = {};
    this.jointNames.forEach(jointName => {
      percentByJoint[jointName] = (jointVarianceByFrame[jointName] || []).map(
        (jointVariance, frame) => {
          const totalVariance = totalVarianceByFrame[frame] || 0;
          return totalVariance > 0 ? (jointVariance / totalVariance) * 100 : 0;
        }
      );
    });

    return {
      frameCount,
      percentByJoint
    };
  }

  getCurrentComponentValues(component) {
    const componentId = Number.parseInt(
      component?.componentId ?? component?.component ?? 0,
      10
    );
    const series = this.componentSeriesById.get(componentId);

    if (!series?.frameCount) {
      return component?.values || {};
    }

    const frameIndex = Math.max(
      0,
      Math.min(this.currentFrame, series.frameCount - 1)
    );
    const values = {};

    this.jointNames.forEach(jointName => {
      values[jointName] = series.percentByJoint?.[jointName]?.[frameIndex] || 0;
    });

    return values;
  }

  drawEmpty(message, detail = "") {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#d7dbe2";
    ctx.font = '20px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(message, 28, 42);

    if (detail) {
      ctx.fillStyle = "#8b94a3";
      ctx.font = '15px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(detail, 28, 72);
    }
  }

  getScaleMax() {
    let peak = 0;

    this.components.forEach(component => {
      const values = this.getCurrentComponentValues(component);
      this.pairs.forEach(pair => {
        peak = Math.max(
          peak,
          values[pair.left] || 0,
          values[pair.right] || 0
        );
      });
    });

    if (peak <= 0) {
      return 10;
    }

    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
    const normalized = peak / magnitude;
    let rounded = 10;

    if (normalized <= 2) {
      rounded = 2;
    } else if (normalized <= 5) {
      rounded = 5;
    }

    return rounded * magnitude;
  }

  getAxisTicks(scaleMax, compact = false) {
    return compact ? [0, scaleMax] : [0, scaleMax * 0.5, scaleMax];
  }

  getSortedPairs(component) {
    const values = this.getCurrentComponentValues(component);

    return this.pairs
      .map(pair => {
        const leftValue = values[pair.left] || 0;
        const rightValue = values[pair.right] || 0;
        return {
          ...pair,
          leftValue,
          rightValue,
          peakValue: Math.max(leftValue, rightValue)
        };
      })
      .sort((a, b) => b.peakValue - a.peakValue);
  }

  formatPercent(value) {
    if (value >= 10) {
      return `${value.toFixed(0)}%`;
    }

    if (value >= 1) {
      return `${value.toFixed(1)}%`;
    }

    return `${value.toFixed(2)}%`;
  }

  drawBar(x, y, width, height, color) {
    const ctx = this.ctx;
    if (width <= 0 || height <= 0) {
      return;
    }

    const barX = Math.round(x);
    const barY = Math.round(y);
    const barWidth = Math.max(1, Math.round(width));
    const barHeight = Math.max(1, Math.round(height));

    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.strokeRect(
      barX + 0.5,
      barY + 0.5,
      Math.max(1, barWidth - 1),
      Math.max(1, barHeight - 1)
    );
  }

  drawAlertMarker(x, y, width, height) {
    const ctx = this.ctx;
    if (width <= 0 || height <= 0) {
      return;
    }

    const markerX = x + width / 2;
    const markerY = y + height / 2;
    const markerSize = Math.max(12, Math.min(18, height + 3));

    ctx.save();
    ctx.font = `bold ${markerSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.strokeText("!", markerX, markerY + 0.5);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("!", markerX, markerY + 0.5);
    ctx.restore();
  }

  drawComponentCard(component, x, y, width, height, scaleMax) {
    const ctx = this.ctx;
    const sortedPairs = this.getSortedPairs(component);
    const componentId = component.componentId ?? component.component ?? 0;
    const componentNumber =
      component.componentNumber ?? component.component ?? (componentId + 1);
    const isSelected = this.selectedComponentId === componentId;
    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const compact = !compareMode && width < 760;
    const veryCompact = !compareMode && width < 760;
    const labelWidth = compareMode ? 104 : veryCompact ? 64 : compact ? 76 : Math.min(154, width * 0.19);
    const innerPad = compareMode ? 24 : veryCompact ? 14 : compact ? 18 : 38;
    const outerLabelPad = compareMode ? 58 : veryCompact ? 28 : compact ? 38 : 82;
    const headerHeight = compareMode ? 44 : compact ? 38 : 54;
    const axisHeight = compareMode ? 32 : compact ? 30 : 42;
    const plotLeft = x + innerPad + labelWidth;
    const plotRight = x + width - innerPad - outerLabelPad;
    const plotTop = y + headerHeight + (compareMode ? 10 : compact ? 14 : 24);
    const plotBottom = y + height - axisHeight - (compareMode ? 10 : compact ? 12 : 20);
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;
    const centerX = plotLeft + plotWidth / 2;
    const halfWidth = plotWidth / 2;
    const rowGap = compareMode ? 7 : compact ? 7 : 12;
    const rowHeight = (plotHeight - rowGap * (this.pairs.length - 1)) / this.pairs.length;
    const barHeight = Math.max(compareMode ? 12 : compact ? 12 : 20, rowHeight * (compareMode ? 0.5 : compact ? 0.52 : 0.58));
    const labelGap = compareMode ? 7 : compact ? 7 : 11;
    const titleFontSize = compareMode ? 18 : compact ? 14 : 18;
    const rowFontSize = compareMode ? 14 : compact ? 13 : 16;
    const valueFontSize = compareMode ? 13 : compact ? 12 : 15;
    const axisFontSize = compareMode ? 12 : compact ? 11 : 14;

    ctx.fillStyle = isSelected
      ? "rgba(44,108,255,0.10)"
      : "rgba(255,255,255,0.03)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = isSelected
      ? "rgba(92,135,255,0.95)"
      : "rgba(255,255,255,0.08)";
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(
      x + (isSelected ? 1 : 0.5),
      y + (isSelected ? 1 : 0.5),
      width - (isSelected ? 2 : 1),
      height - (isSelected ? 2 : 1)
    );

    ctx.fillStyle = "#edf2f7";
    ctx.font = `${titleFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`Component ${componentNumber}`, x + innerPad, y + (compareMode ? 28 : compact ? 24 : 34));

    const axisTicks = this.getAxisTicks(scaleMax, compact || compareMode);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;

    axisTicks.forEach(tick => {
      const ratio = scaleMax > 0 ? tick / scaleMax : 0;
      const offset = ratio * halfWidth;
      const leftX = centerX - offset;
      const rightX = centerX + offset;

      ctx.beginPath();
      ctx.moveTo(leftX, plotTop);
      ctx.lineTo(leftX, plotBottom);
      ctx.stroke();

      if (tick !== 0) {
        ctx.beginPath();
        ctx.moveTo(rightX, plotTop);
        ctx.lineTo(rightX, plotBottom);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(centerX, plotTop - 4);
    ctx.lineTo(centerX, plotBottom + 4);
    ctx.stroke();

    sortedPairs.forEach((pair, pairIndex) => {
      const rowTop = plotTop + pairIndex * (rowHeight + rowGap);
      const rowCenter = rowTop + rowHeight / 2;
      const barTop = rowCenter - barHeight / 2;
      const leftAlert = pair.leftValue > this.alertThreshold;
      const rightAlert = pair.rightValue > this.alertThreshold;
      const leftWidth = scaleMax > 0 ? (pair.leftValue / scaleMax) * halfWidth : 0;
      const rightWidth = scaleMax > 0 ? (pair.rightValue / scaleMax) * halfWidth : 0;

      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(plotLeft, rowTop, plotWidth, rowHeight);

      ctx.fillStyle = "#93a0b2";
      ctx.font = `${rowFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(pair.label, plotLeft - (compareMode ? 8 : compact ? 10 : 14), rowCenter + 4);

      this.drawBar(centerX - leftWidth, barTop, leftWidth, barHeight, pair.leftColor);
      this.drawBar(centerX, barTop, rightWidth, barHeight, pair.rightColor);

      if (leftAlert) {
        this.drawAlertMarker(centerX - leftWidth, barTop, leftWidth, barHeight);
      }

      if (rightAlert) {
        this.drawAlertMarker(centerX, barTop, rightWidth, barHeight);
      }

      if (pair.leftValue > 0) {
        ctx.textAlign = "right";
        ctx.fillStyle = leftAlert ? "#ef4444" : "rgba(255,255,255,0.82)";
        ctx.font = `${leftAlert ? "bold " : ""}${valueFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(
          this.formatPercent(pair.leftValue),
          centerX - leftWidth - labelGap,
          rowCenter + 5
        );
      }

      if (pair.rightValue > 0) {
        ctx.textAlign = "left";
        ctx.fillStyle = rightAlert ? "#ef4444" : "rgba(255,255,255,0.82)";
        ctx.font = `${rightAlert ? "bold " : ""}${valueFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
        ctx.fillText(
          this.formatPercent(pair.rightValue),
          centerX + rightWidth + labelGap,
          rowCenter + 5
        );
      }
    });

    ctx.fillStyle = "#7f8b99";
    ctx.font = `${axisFontSize}px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "center";
    axisTicks.forEach(tick => {
      const ratio = scaleMax > 0 ? tick / scaleMax : 0;
      const offset = ratio * halfWidth;
      const label = tick === 0 ? "0" : `${tick.toFixed(0)}%`;

      ctx.fillText(label, centerX - offset, y + height - 10);
      if (tick !== 0) {
        ctx.fillText(label, centerX + offset, y + height - 10);
      }
    });
  }

  draw() {
    if (!this.subjectId) {
      this.drawEmpty(
        "Select an infant to view component variance",
        "This dynamic view updates each component's joint variance through the current frame."
      );
      return;
    }

    if (!this.components.length) {
      this.drawEmpty(
        `No component variance data found for infant ${this.subjectId}`,
        "Check that metadata and component files exist for this subject."
      );
      return;
    }

    if (!this.componentSequencesReady) {
      this.drawEmpty(
        `Loading component variance for infant ${this.subjectId}`,
        "The bar values will update as soon as the component motion sequences are ready."
      );
      return;
    }

    if (!this.componentSeriesById.size) {
      this.drawEmpty(
        `No component sequences found for infant ${this.subjectId}`,
        "Check the component files under output/app_reconstructions/<subject>/components."
      );
      return;
    }

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const compareMode = !!this.canvas.closest?.(".compareModeView");
    const compact = !compareMode && width < 760;
    const componentsToDraw = this.components;
    const rows = componentsToDraw.length;
    const outerLeft = compareMode ? 18 : compact ? 14 : 26;
    const outerRight = compareMode ? 18 : compact ? 14 : 26;
    const outerTop = compareMode ? 18 : compact ? 14 : 28;
    const outerBottom = compareMode ? 18 : compact ? 14 : 24;
    const gapY = compareMode ? 14 : compact ? 14 : 22;
    const usableWidth = width - outerLeft - outerRight;
    const usableHeight = height - outerTop - outerBottom;
    const cardWidth = usableWidth;
    const cardHeight = (usableHeight - gapY * Math.max(0, rows - 1)) / Math.max(1, rows);
    const scaleMax = this.getScaleMax();
    this.cardRegions = [];

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    componentsToDraw.forEach((component, index) => {
      const x = outerLeft;
      const y = outerTop + index * (cardHeight + gapY);
      this.cardRegions.push({
        componentId: component.componentId ?? component.component ?? 0,
        x,
        y,
        width: cardWidth,
        height: cardHeight
      });

      this.drawComponentCard(component, x, y, cardWidth, cardHeight, scaleMax);
    });
  }
}

window.DynamicComponentVariancePlot = DynamicComponentVariancePlot;
