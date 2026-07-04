const canvas = document.getElementById("viewer");
const ctx = canvas.getContext("2d");
const visualizationCanvas = document.getElementById("visualizationCanvas");
const rightPanel = document.getElementById("rightPanel");
const layoutEl = document.querySelector(".layout");
const mainCanvasWrap = document.getElementById("mainCanvasWrap");
const compareModeView = document.getElementById("compareModeView");
const compareCurrentViewer = document.getElementById("compareCurrentViewer");
const compareCurrentVisualization = document.getElementById("compareCurrentVisualization");
const compareCurrentVizWrap = compareCurrentVisualization?.parentElement || null;
const compareCurrentTitle = document.getElementById("compareCurrentTitle");
const compareCurrentSubtitle = document.getElementById("compareCurrentSubtitle");
const compareNormalViewer = document.getElementById("compareNormalViewer");
const compareNormalVisualization = document.getElementById("compareNormalVisualization");
const compareNormalVizWrap = compareNormalVisualization?.parentElement || null;
const compareNormalTitle = document.getElementById("compareNormalTitle");
const compareNormalSubtitle = document.getElementById("compareNormalSubtitle");
const compareModeStatus = document.getElementById("compareModeStatus");
const compareViewToggleBtn = document.getElementById("compareViewToggleBtn");
const compareWithNormalBtn = document.getElementById("compareWithNormalBtn");
const exitCompareBtn = document.getElementById("exitCompareBtn");
const normalReferencePrevBtn = document.getElementById("normalReferencePrevBtn");
const normalReferenceNextBtn = document.getElementById("normalReferenceNextBtn");

const subjectSelect = document.getElementById("subjectSelect");
const sequenceSelect = document.getElementById("sequenceSelect");
const frameSlider = document.getElementById("frameSlider");
const frameLabel = document.getElementById("frameLabel");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const dynamicViewBtn = document.getElementById("dynamicViewBtn");
const staticViewBtn = document.getElementById("staticViewBtn");
const visualizationTabs = document.getElementById("visualizationTabs");
const visualizationHelp = document.getElementById("visualizationHelp");
const visualizationExplainBtn = document.getElementById("visualizationExplainBtn");
const visualizationExplainModal = document.getElementById("visualizationExplainModal");
const visualizationExplainTitle = document.getElementById("visualizationExplainTitle");
const visualizationExplainBody = document.getElementById("visualizationExplainBody");
const visualizationExplainCloseBtn = document.getElementById("visualizationExplainCloseBtn");
const lineMetricSection = document.getElementById("lineMetricSection");
const lineMetricSpeedBtn = document.getElementById("lineMetricSpeedBtn");
const lineMetricAccelerationBtn = document.getElementById("lineMetricAccelerationBtn");
const jointSelectorSection = document.getElementById("jointSelectorSection");
const jointSelectionHint = document.getElementById("jointSelectionHint");
const jointSelectionList = document.getElementById("jointSelectionList");
const clearJointSelectionBtn = document.getElementById("clearJointSelectionBtn");
const zoomValueLabel = document.getElementById("zoomValueLabel");
const speedValueLabel = document.getElementById("speedValueLabel");

const statusEl = document.getElementById("status");
const metaBox = document.getElementById("metaBox");

let sequenceData = null;   // [34][T]
let currentFrame = 0;
let playing = false;
let visualizationMode = "dynamic";
let activeVisualization = null;
let jointVarianceDataPromise = null;
let jointVarianceBySubject = new Map();
let metadataBySubject = new Map();
let componentSequencePromisesBySubject = new Map();
let componentSequencesBySubject = new Map();
let currentSubjectMetadata = null;
let activeSequenceDescriptor = null;
let visualizationExplanationPromise = null;
let normalReferenceDataPromise = null;
let normalReferenceOptions = [];
let selectedNormalReferenceIndex = 0;
const DEFAULT_VISUALIZATION_CANVAS_HEIGHT = 600;
const DEFAULT_VIEWER_CANVAS_SIZE = 600;
const MAX_LINE_PLOT_JOINTS = 6;
const DEFAULT_SEQUENCE_FILE = "global_reconstruction.json";
const selectedVisualizationByMode = {
  dynamic: "heatmap",
  static: "heatmap"
};
const selectedLineMetricByMode = {
  dynamic: "speed",
  static: "speed"
};
const selectedComponentBySubject = {};
const comparisonState = {
  active: false,
  displayMode: "visual",
  current: {
    subjectId: "",
    sequenceData: null,
    visualization: null
  },
  normal: {
    subjectId: "",
    sequenceData: null,
    visualization: null
  }
};
let caregiverVisualizationExplanations = {};

// Your 17 joints => 34 dims (x,y)
const joints = [
  "nose","left_eye","right_eye","left_ear","right_ear",
  "left_shoulder","right_shoulder","left_elbow","right_elbow",
  "left_wrist","right_wrist","left_hip","right_hip",
  "left_knee","right_knee","left_ankle","right_ankle"
];

// For right-panel visualizations: remove nose, eyes, and ears
const visualizationJointNames = joints.filter(
  j => !["nose", "left_eye", "right_eye", "left_ear", "right_ear"].includes(j)
);
const selectedJointsByVisualization = {
  dynamic: {
    heatmap: visualizationJointNames.slice(),
    lineplot: visualizationJointNames.slice(0, MAX_LINE_PLOT_JOINTS),
    stackedlineplot: visualizationJointNames.slice(0, MAX_LINE_PLOT_JOINTS),
    episodes: visualizationJointNames.slice(0, MAX_LINE_PLOT_JOINTS),
    componentvariance: []
  },
  static: {
    heatmap: visualizationJointNames.slice(),
    lineplot: visualizationJointNames.slice(0, MAX_LINE_PLOT_JOINTS),
    stackedlineplot: visualizationJointNames.slice(0, MAX_LINE_PLOT_JOINTS),
    episodes: visualizationJointNames.slice(0, MAX_LINE_PLOT_JOINTS),
    componentvariance: []
  }
};

const visualizationRegistry = {
  dynamic: [
    {
      id: "heatmap",
      label: "Heatmap",
      help: "Shows where motion accumulates over time for the selected joints.",
      className: "DynamicMovementHeatmap",
      supportsJointSelection: true,
      selectionLimit: null
    },
    {
      id: "lineplot",
      label: "Individual lines",
      help: "Compares frame-to-frame speed or acceleration for up to 6 selected joints through the current frame.",
      className: "DynamicLinePlot",
      supportsJointSelection: true,
      selectionLimit: MAX_LINE_PLOT_JOINTS,
      supportsLineMetric: true
    },
    {
      id: "stackedlineplot",
      label: "Stacked lines",
      help: "Overlays speed or acceleration traces for up to 6 selected joints in one shared chart through the current frame.",
      className: "DynamicStackedLinePlot",
      supportsJointSelection: true,
      selectionLimit: MAX_LINE_PLOT_JOINTS,
      supportsLineMetric: true
    },
    {
      id: "episodes",
      label: "Episodes",
      help: "Shows when stronger movement bouts happen, how long they last, and how intense they are through the current frame.",
      className: "DynamicEpisodePlot",
      supportsJointSelection: true,
      selectionLimit: MAX_LINE_PLOT_JOINTS,
      supportsLineMetric: true
    },
    {
      id: "componentvariance",
      label: "Component variance",
      help: "Shows how left-right joint variance percentages change through the current frame for each DMD component.",
      className: "DynamicComponentVariancePlot"
    }
  ],
  static: [
    {
      id: "heatmap",
      label: "Heatmap",
      help: "Shows how total movement accumulates over time for each selected joint across the full sequence.",
      className: "StaticHeatmap",
      supportsJointSelection: true,
      selectionLimit: null
    },
    {
      id: "lineplot",
      label: "Individual lines",
      help: "Compares full-sequence speed or acceleration traces for up to 6 selected joints, with the current frame marked.",
      className: "StaticLinePlot",
      supportsJointSelection: true,
      selectionLimit: MAX_LINE_PLOT_JOINTS,
      supportsLineMetric: true
    },
    {
      id: "stackedlineplot",
      label: "Stacked lines",
      help: "Overlays full-sequence speed or acceleration traces for up to 6 selected joints in one shared chart, with the current frame marked.",
      className: "StaticStackedLinePlot",
      supportsJointSelection: true,
      selectionLimit: MAX_LINE_PLOT_JOINTS,
      supportsLineMetric: true
    },
    {
      id: "episodes",
      label: "Episodes",
      help: "Shows when stronger movement bouts happen, how long they last, and how intense they are across the full sequence.",
      className: "StaticEpisodePlot",
      supportsJointSelection: true,
      selectionLimit: MAX_LINE_PLOT_JOINTS,
      supportsLineMetric: true
    },
    {
      id: "componentvariance",
      label: "Component variance",
      help: "Shows left-right joint variance for each DMD component as mirrored percentage bars.",
      className: "StaticComponentVariancePlot"
    }
  ]
};

// Connections as provided
const connections = {
  nose:["left_eye","right_eye"],
  right_ear:["right_eye"],
  left_ear:["left_eye"],
  right_elbow:["right_wrist","right_shoulder"],
  left_elbow:["left_wrist","left_shoulder"],
  left_knee:["left_ankle"],
  right_knee:["right_ankle"],
  left_hip:["left_knee","left_shoulder","right_hip"],
  right_hip:["right_knee","right_shoulder"],
  left_shoulder:["right_shoulder"]
};

// --------- Path resolution helpers ----------
function withTrailingSlash(p) {
  return p.endsWith("/") ? p : (p + "/");
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return await res.json();
}

async function loadVisualizationExplanations() {
  if (visualizationExplanationPromise) {
    return visualizationExplanationPromise;
  }

  visualizationExplanationPromise = (async () => {
    try {
      const url = new URL("visualization_explanations.json", window.location.href).toString();
      caregiverVisualizationExplanations = await fetchJson(url);
      return caregiverVisualizationExplanations;
    } catch (error) {
      console.error("Failed to load visualization explanations:", error);
      caregiverVisualizationExplanations = {};
      return caregiverVisualizationExplanations;
    }
  })();

  return visualizationExplanationPromise;
}

function getNormalReferenceSubject() {
  return normalReferenceOptions[selectedNormalReferenceIndex]?.subjectId || "";
}

function getNormalReferenceLabel() {
  return normalReferenceOptions[selectedNormalReferenceIndex]?.label || "";
}

function isNormalReferenceSubject(subject) {
  if (!subject) return false;
  return normalReferenceOptions.some(option => option.subjectId === String(subject));
}

function getSubjectDisplayName(subject) {
  if (!subject) return "No subject";
  const normalIndex = normalReferenceOptions.findIndex(
    option => option.subjectId === String(subject)
  );
  return normalIndex >= 0
    ? `Normal Baby ${normalReferenceOptions[normalIndex].label || normalIndex + 1}`
    : `Infant ${subject}`;
}

async function listSubjectFolders(dirUrl) {
  const html = await fetchText(dirUrl);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const hrefs = Array.from(doc.querySelectorAll("a"))
    .map(a => a.getAttribute("href"))
    .filter(Boolean);

  const folders = hrefs
    .filter(h => h.endsWith("/") && h !== "../" && h !== "./")
    .map(h => h.replace(/\/$/, ""))
    .filter(name => name.length > 0);

  return folders;
}

async function resolveReconDir() {
  const candidates = [
    new URL("/output/app_reconstructions/", window.location.href).toString(),
    new URL("../output/app_reconstructions/", window.location.href).toString(),
  ].map(withTrailingSlash);

  for (const c of candidates) {
    try {
      const indexUrl = new URL("index.json", c).toString();
      const manifestSubjects = await fetchJson(indexUrl);
      if (Array.isArray(manifestSubjects) && manifestSubjects.length > 0) {
        return { dir: c, subjects: manifestSubjects };
      }
    } catch (e) {
      // keep trying
    }

    try {
      const folders = await listSubjectFolders(c);
      if (folders.length > 0) {
        return { dir: c, subjects: folders };
      }
    } catch (e) {
      // keep trying
    }
  }

  throw new Error(
    "Could not load infants. Make sure /output/app_reconstructions/ is reachable " +
    "and that index.json is present for servers that do not allow folder listing."
  );
}

function parseSimpleCsvRow(line) {
  return line.split(",").map(value => value.trim());
}

function parseJointVarianceCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return new Map();
  }

  const headers = parseSimpleCsvRow(lines[0]);
  const valueHeaders = headers.slice(2);
  const subjectMap = new Map();

  for (let index = 1; index < lines.length; index++) {
    const values = parseSimpleCsvRow(lines[index]);
    if (values.length !== headers.length) {
      continue;
    }

    const subjectId = values[0];
    const componentNumber = Number.parseInt(values[1], 10);
    const jointValues = {};

    valueHeaders.forEach((jointName, jointIndex) => {
      jointValues[jointName] = Number.parseFloat(values[jointIndex + 2]) || 0;
    });

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, []);
    }

    subjectMap.get(subjectId).push({
      component: componentNumber,
      componentNumber,
      componentId: Math.max(0, componentNumber - 1),
      values: jointValues
    });
  }

  subjectMap.forEach(components => {
    components.sort((a, b) => a.componentId - b.componentId);
  });

  return subjectMap;
}

async function ensureJointVarianceData() {
  if (jointVarianceDataPromise) {
    return jointVarianceDataPromise;
  }

  const base = window.__RECON_BASE__;
  if (!base) {
    return jointVarianceBySubject;
  }

  jointVarianceDataPromise = (async () => {
    try {
      const url = new URL(
        "all_subjects_body_joint_percent_variance.csv",
        base
      ).toString();
      const csvText = await fetchText(url);
      jointVarianceBySubject = parseJointVarianceCsv(csvText);
      return jointVarianceBySubject;
    } catch (error) {
      jointVarianceDataPromise = null;
      throw error;
    }
  })();

  return jointVarianceDataPromise;
}

async function ensureNormalReferenceOptions() {
  if (normalReferenceDataPromise) {
    return normalReferenceDataPromise;
  }

  const base = window.__RECON_BASE__;
  if (!base) {
    normalReferenceOptions = [];
    return normalReferenceOptions;
  }

  normalReferenceDataPromise = (async () => {
    try {
      const url = new URL("normal_index.json", base).toString();
      const rows = await fetchJson(url);
      normalReferenceOptions = Array.isArray(rows)
        ? rows
            .map((row, index) => ({
              subjectId: String(row.subjectId ?? row.subject_id ?? ""),
              label: String(row.label ?? index + 1)
            }))
            .filter(row => row.subjectId)
        : [];
      selectedNormalReferenceIndex = Math.min(
        selectedNormalReferenceIndex,
        Math.max(0, normalReferenceOptions.length - 1)
      );
      return normalReferenceOptions;
    } catch (error) {
      console.warn("No normal reference index found:", error);
      normalReferenceOptions = [];
      return normalReferenceOptions;
    }
  })();

  return normalReferenceDataPromise;
}

async function ensureSubjectMetadata(subject) {
  if (!subject || !window.__RECON_BASE__) {
    return null;
  }

  if (metadataBySubject.has(subject)) {
    return metadataBySubject.get(subject);
  }

  const url = new URL(`${subject}/component_metadata.json`, window.__RECON_BASE__).toString();
  const meta = await fetchJson(url);
  metadataBySubject.set(subject, meta);

  const firstComponentId = meta?.components?.[0]?.id;
  if (
    firstComponentId !== undefined &&
    (selectedComponentBySubject[subject] === undefined ||
      selectedComponentBySubject[subject] === null ||
      selectedComponentBySubject[subject] === "")
  ) {
    selectedComponentBySubject[subject] = String(firstComponentId);
  }

  return meta;
}

async function fetchSequenceData(subject, descriptor) {
  const base = window.__RECON_BASE__;
  if (!base || !subject || !descriptor?.path) {
    return null;
  }

  const url = new URL(`${subject}/${descriptor.path}`, base).toString();
  return await fetchJson(url);
}

async function syncVarianceVisualizationData() {
  if (
    !activeVisualization ||
    typeof activeVisualization.setVarianceData !== "function"
  ) {
    return;
  }

  const view = activeVisualization;
  const subjectId = subjectSelect?.value || "";

  if (!subjectId) {
    updateVisualizationCanvasLayout([]);
    view.setVarianceData("", []);
    return;
  }

  try {
    const varianceData = await ensureJointVarianceData();
    if (activeVisualization !== view) {
      return;
    }
    const components = varianceData.get(subjectId) || [];
    updateVisualizationCanvasLayout(components);
    view.setVarianceData(subjectId, components);
    if (typeof view.setSelectedComponent === "function") {
      view.setSelectedComponent(getSelectedComponentId(subjectId));
    }
  } catch (error) {
    console.error("Failed to load joint variance CSV:", error);
    if (activeVisualization === view) {
      updateVisualizationCanvasLayout([]);
      view.setVarianceData(subjectId, []);
    }
  }
}

async function ensureComponentSequences(subject = getCurrentSubject()) {
  if (!subject) {
    return new Map();
  }

  if (componentSequencesBySubject.has(subject)) {
    return componentSequencesBySubject.get(subject);
  }

  if (componentSequencePromisesBySubject.has(subject)) {
    return componentSequencePromisesBySubject.get(subject);
  }

  const subjectMeta =
    subject === getCurrentSubject()
      ? currentSubjectMetadata
      : metadataBySubject.get(subject);

  if (!subjectMeta?.components?.length || !window.__RECON_BASE__) {
    return new Map();
  }

  const promise = (async () => {
    const entries = await Promise.all(
      subjectMeta.components.map(async component => {
        const componentId = Number.parseInt(component.id, 10);
        const url = new URL(
          `${subject}/${getComponentFileName(componentId)}`,
          window.__RECON_BASE__
        ).toString();
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText} for ${url}`);
        }

        const sequence = await res.json();
        return [componentId, sequence];
      })
    );

    const sequenceMap = new Map(entries);
    componentSequencesBySubject.set(subject, sequenceMap);
    componentSequencePromisesBySubject.delete(subject);
    return sequenceMap;
  })().catch(error => {
    componentSequencePromisesBySubject.delete(subject);
    throw error;
  });

  componentSequencePromisesBySubject.set(subject, promise);
  return promise;
}

function getSubjectComponentDefinitions(subject = getCurrentSubject()) {
  const subjectMeta =
    subject === getCurrentSubject()
      ? currentSubjectMetadata
      : metadataBySubject.get(subject);
  const metaComponents = subjectMeta?.components || [];

  return metaComponents.map(component => ({
    component: component.id + 1,
    componentNumber: component.id + 1,
    componentId: component.id,
    type: component.type || "",
    values: {}
  }));
}

async function syncComponentVarianceSequences() {
  if (
    !activeVisualization ||
    typeof activeVisualization.setComponentSequences !== "function"
  ) {
    return;
  }

  const view = activeVisualization;
  const subjectId = getCurrentSubject();

  if (!subjectId) {
    if (typeof view.setComponentMetadata === "function") {
      view.setComponentMetadata("", []);
    }
    view.setComponentSequences("", [], new Map());
    return;
  }

  const varianceComponents = jointVarianceBySubject.get(subjectId) || [];
  const metadataComponents = getSubjectComponentDefinitions(subjectId);
  const componentDefinitions =
    varianceComponents.length > 0 ? varianceComponents : metadataComponents;

  updateVisualizationCanvasLayout(componentDefinitions);

  if (
    typeof view.setComponentMetadata === "function" &&
    !componentSequencesBySubject.has(subjectId)
  ) {
    view.setComponentMetadata(subjectId, componentDefinitions);
  }

  try {
    const sequenceMap = await ensureComponentSequences(subjectId);
    if (activeVisualization !== view) {
      return;
    }

    view.setComponentSequences(subjectId, componentDefinitions, sequenceMap);

    if (typeof view.setSelectedComponent === "function") {
      view.setSelectedComponent(getSelectedComponentId(subjectId));
    }
  } catch (error) {
    console.error("Failed to load component sequences:", error);
    if (activeVisualization === view) {
      view.setComponentSequences(subjectId, componentDefinitions, new Map());
    }
  }
}

async function syncSourceForCurrentView() {
  updateSourceControls();

  const subject = getCurrentSubject();
  if (!subject) {
    return;
  }

  const desiredDescriptor = getDesiredSequenceDescriptor();
  const currentPath = activeSequenceDescriptor?.path || "";
  const desiredPath = desiredDescriptor?.path || "";

  if (!desiredDescriptor) {
    return;
  }

  if (currentPath === desiredPath && sequenceData) {
    return;
  }

  await loadCurrentSequenceSource();
}

function isComponentVarianceActive() {
  return getActiveVisualizationId() === "componentvariance";
}

function getCurrentSubject() {
  return subjectSelect?.value || "";
}

function updateCompareButtonVisibility() {
  if (!compareWithNormalBtn) {
    return;
  }

  const subject = getCurrentSubject();
  compareWithNormalBtn.hidden =
    comparisonState.active ||
    !subject ||
    isNormalReferenceSubject(subject) ||
    normalReferenceOptions.length === 0;
}

function updateNormalReferenceControls() {
  const hasMultipleReferences = normalReferenceOptions.length > 1;
  if (normalReferencePrevBtn) {
    normalReferencePrevBtn.disabled = !hasMultipleReferences;
  }
  if (normalReferenceNextBtn) {
    normalReferenceNextBtn.disabled = !hasMultipleReferences;
  }
}

function selectNormalReference(delta) {
  if (!normalReferenceOptions.length) {
    return;
  }

  const count = normalReferenceOptions.length;
  selectedNormalReferenceIndex =
    (selectedNormalReferenceIndex + delta + count) % count;
  comparisonState.normal.subjectId = getNormalReferenceSubject();
  updateComparisonTitles();

  if (comparisonState.active) {
    requestComparisonRefresh();
  }
}

function getSelectedComponentId(subject = getCurrentSubject()) {
  if (!subject) return "";
  const storedId = selectedComponentBySubject[subject];
  if (storedId !== undefined && storedId !== null && storedId !== "") {
    return storedId;
  }

  const subjectMeta =
    subject === getCurrentSubject()
      ? currentSubjectMetadata
      : metadataBySubject.get(subject);
  const fallbackId = subjectMeta?.components?.[0]?.id;

  return fallbackId === undefined ? "" : String(fallbackId);
}

function buildComponentOptionLabel(component) {
  const componentNumber = (component?.id ?? 0) + 1;
  const typeLabel = component?.type ? ` (${component.type})` : "";
  return `Component ${componentNumber}${typeLabel}`;
}

function getComponentFileName(componentId) {
  return `components/component_${componentId}.json`;
}

function setActiveSequenceDescriptor(descriptor) {
  activeSequenceDescriptor = descriptor;
}

function updateSourceControls() {
  const componentMode = isComponentVarianceActive();
  const subject = getCurrentSubject();
  const components = currentSubjectMetadata?.components || [];

  if (sequenceSelect) {
    sequenceSelect.disabled = componentMode;
  }

  const preferredId = getSelectedComponentId(subject);
  const fallbackId = components[0] ? String(components[0].id) : "";
  const availableIds = new Set(components.map(component => String(component.id)));
  const selectedId = availableIds.has(String(preferredId))
    ? String(preferredId)
    : fallbackId;

  if (selectedId) {
    selectedComponentBySubject[subject] = selectedId;
  }

  updateCompareButtonVisibility();
}

// --------- Visualization ----------
function buildVisualizationSequence(fullSequenceData) {
  if (!fullSequenceData || !fullSequenceData.length) return fullSequenceData;

  const excluded = new Set([
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear"
  ]);

  const reduced = [];

  for (let i = 0; i < joints.length; i++) {
    if (!excluded.has(joints[i])) {
      reduced.push(fullSequenceData[2 * i]);       // x
      reduced.push(fullSequenceData[2 * i + 1]);   // y
    }
  }

  return reduced;
}

function updateVisualizationButtons() {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  const dynamicLocked = visualizationMode === "static" && !!activeDef?.locksModeToStatic;

  if (dynamicViewBtn) {
    dynamicViewBtn.classList.toggle(
      "is-active",
      visualizationMode === "dynamic"
    );
    dynamicViewBtn.disabled = dynamicLocked;
    dynamicViewBtn.classList.toggle("is-disabled", dynamicLocked);
  }

  if (staticViewBtn) {
    staticViewBtn.classList.toggle(
      "is-active",
      visualizationMode === "static"
    );
    staticViewBtn.classList.remove("is-disabled");
  }
}

function resizeCanvasToDisplaySize(targetCanvas, width, height) {
  if (!targetCanvas) {
    return false;
  }

  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  const needsResize =
    targetCanvas.width !== targetWidth ||
    targetCanvas.height !== targetHeight;

  if (needsResize) {
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
  }

  return needsResize;
}

function updateRangeFill(rangeEl) {
  if (!rangeEl) {
    return;
  }

  const min = Number.parseFloat(rangeEl.min ?? "0");
  const max = Number.parseFloat(rangeEl.max ?? "100");
  const value = Number.parseFloat(rangeEl.value ?? String(min));
  const span = max - min;
  const progress = span <= 0 ? 0 : ((value - min) / span) * 100;
  rangeEl.style.setProperty("--range-progress", `${progress}%`);
}

function formatMultiplierLabel(value) {
  return `${value.toFixed(1)}x`;
}

function updateControlValueLabels() {
  if (zoomSlider && zoomValueLabel) {
    const zoomMultiplier = parseFloat(zoomSlider.value) / 300;
    zoomValueLabel.textContent = formatMultiplierLabel(zoomMultiplier);
  }

  if (speedSlider && speedValueLabel) {
    const speedMultiplier = parseFloat(speedSlider.value);
    speedValueLabel.textContent = formatMultiplierLabel(speedMultiplier);
  }
}

function getPreferredVisualizationCanvasHeight(componentData = null, targetCanvas = null) {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );

  if (activeDef?.id === "componentvariance") {
    const isCompareCanvas = !!targetCanvas?.closest?.(".compareModeView");
    const componentCount = Array.isArray(componentData)
      ? componentData.length
      : 0;
    const rows = Math.max(1, componentCount);
    const cardHeight = isCompareCanvas ? 204 : 312;
    const topBottomSpace = isCompareCanvas ? 62 : 136;
    const gap = isCompareCanvas ? 18 : 28;
    return Math.max(
      DEFAULT_VISUALIZATION_CANVAS_HEIGHT,
      topBottomSpace + rows * cardHeight + Math.max(0, rows - 1) * gap
    );
  }

  return DEFAULT_VISUALIZATION_CANVAS_HEIGHT;
}

function updateVisualizationSurfaceLayout(targetCanvas, containerEl, componentData = null) {
  if (!targetCanvas) {
    return;
  }

  const preferredHeight = Math.round(
    getPreferredVisualizationCanvasHeight(componentData, targetCanvas)
  );

  targetCanvas.height = preferredHeight;
  targetCanvas.style.height =
    preferredHeight > DEFAULT_VISUALIZATION_CANVAS_HEIGHT
      ? `${preferredHeight}px`
      : "100%";

  if (containerEl) {
    containerEl.style.overflowY =
      preferredHeight > DEFAULT_VISUALIZATION_CANVAS_HEIGHT ? "auto" : "hidden";
  }

  const visualWidth = targetCanvas.clientWidth || containerEl?.clientWidth || 1100;
  const visualHeight = preferredHeight > DEFAULT_VISUALIZATION_CANVAS_HEIGHT
    ? preferredHeight
    : (targetCanvas.clientHeight || DEFAULT_VISUALIZATION_CANVAS_HEIGHT);
  resizeCanvasToDisplaySize(targetCanvas, visualWidth, visualHeight);
}

function updateVisualizationCanvasLayout(componentData = null) {
  if (!visualizationCanvas) {
    return;
  }

  updateVisualizationSurfaceLayout(visualizationCanvas, rightPanel, componentData);
}

function updateViewerSurfaceLayout(targetCanvas) {
  if (!targetCanvas) {
    return;
  }

  const viewerWidth = targetCanvas.clientWidth || DEFAULT_VIEWER_CANVAS_SIZE;
  const viewerHeight = targetCanvas.clientHeight || DEFAULT_VIEWER_CANVAS_SIZE;
  resizeCanvasToDisplaySize(targetCanvas, viewerWidth, viewerHeight);
}

function updateViewerCanvasLayout() {
  updateViewerSurfaceLayout(canvas);
}

function syncAllCanvasLayouts(componentData = null) {
  updateViewerCanvasLayout();
  updateVisualizationCanvasLayout(componentData);
}

function updateCompareCanvasLayouts(currentComponentData = null, normalComponentData = null) {
  updateViewerSurfaceLayout(compareCurrentViewer);
  updateViewerSurfaceLayout(compareNormalViewer);
  updateVisualizationSurfaceLayout(
    compareCurrentVisualization,
    compareCurrentVizWrap,
    currentComponentData
  );
  updateVisualizationSurfaceLayout(
    compareNormalVisualization,
    compareNormalVizWrap,
    normalComponentData
  );
}

function updateComparisonDisplayModeUi() {
  if (!compareModeView) {
    return;
  }

  const skeletonMode = comparisonState.displayMode === "skeleton";
  compareModeView.classList.toggle("compareShowsSkeleton", skeletonMode);
  compareModeView.classList.toggle("compareShowsVisual", !skeletonMode);

  if (compareViewToggleBtn) {
    compareViewToggleBtn.textContent = skeletonMode
      ? "Compare Visuals"
      : "Compare Skeletons";
  }
}

function setComparisonDisplayMode(displayMode) {
  if (!["visual", "skeleton"].includes(displayMode)) {
    return;
  }

  comparisonState.displayMode = displayMode;
  updateComparisonDisplayModeUi();

  if (comparisonState.active) {
    updateCompareCanvasLayouts(
      comparisonState.current.visualization?.components || [],
      comparisonState.normal.visualization?.components || []
    );
    updateComparisonTitles();
    drawFrame();
  }
}

function handleCanvasResize() {
  syncAllCanvasLayouts(
    getActiveVisualizationId() === "componentvariance"
      ? activeVisualization?.components || []
      : null
  );

  if (comparisonState.active) {
    updateCompareCanvasLayouts(
      comparisonState.current.visualization?.components || [],
      comparisonState.normal.visualization?.components || []
    );
  }

  if (sequenceData) {
    drawFrame();
    return;
  }

  if (activeVisualization && typeof activeVisualization.draw === "function") {
    activeVisualization.draw();
  }
}

function getVisualizationDefinition(mode, visualizationId) {
  const defs = visualizationRegistry[mode] || [];
  return defs.find(def => def.id === visualizationId) || defs[0] || null;
}

function getActiveVisualizationId() {
  return selectedVisualizationByMode[visualizationMode];
}

function getSelectedJoints(mode = visualizationMode, visualizationId = getActiveVisualizationId()) {
  return selectedJointsByVisualization[mode]?.[visualizationId] || [];
}

function getSelectedLineMetric(mode = visualizationMode) {
  return selectedLineMetricByMode[mode] || "speed";
}

function formatJointLabel(jointName) {
  return jointName
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getVisualizationSummaryText(definition) {
  switch (definition?.id) {
    case "heatmap":
      return visualizationMode === "dynamic"
        ? "Shows where motion builds up over time for the selected joints."
        : "Shows how movement accumulates over time for each selected joint.";
    case "lineplot":
      return visualizationMode === "dynamic"
        ? "Shows per-joint speed or acceleration through the current frame."
        : "Shows full-sequence speed or acceleration for each selected joint.";
    case "stackedlineplot":
      return visualizationMode === "dynamic"
        ? "Shows selected joints together in one shared speed or acceleration chart through the current frame."
        : "Shows selected joints together in one shared full-sequence speed or acceleration chart.";
    case "episodes":
      return visualizationMode === "dynamic"
        ? "Shows when stronger movement bouts happen through the current frame."
        : "Shows when stronger movement bouts happen across the full sequence.";
    case "componentvariance":
      return visualizationMode === "dynamic"
        ? "Shows how left-right joint variance percentages change up to the current frame for each DMD component."
        : "Shows left-right joint variance for each DMD component as mirrored percentage bars.";
    default:
      return definition?.help || "";
  }
}

function getVisualizationOptionsText(definition) {
  const options = [];

  options.push(
    definition?.locksModeToStatic
      ? "Static mode only."
      : "Switch between Dynamic and Static modes."
  );

  if (definition?.supportsLineMetric) {
    options.push("Toggle Speed or Acceleration.");
  }

  if (definition?.supportsJointSelection) {
    const limit = definition.selectionLimit;
    options.push(
      limit === null
        ? "Select one or more joints."
        : `Select up to ${limit} joints.`
    );
  }

  if (definition?.id === "componentvariance") {
    options.push("Click a component plot to preview its motion on the left.");
    if (visualizationMode === "dynamic") {
      options.push("Scrub frames or press Play to update the variance bars over time.");
    }
  }

  return options;
}

function getVisualizationExplanation(definition) {
  const modeText = caregiverVisualizationExplanations[visualizationMode] || {};
  return (
    modeText[definition?.id] || {
      title: definition?.label || "Visualization",
      description: [
        "This view shows one way of looking at the movement in the recording."
      ],
      compareWithNormal: [
        "Use the controls in the sidebar to change what you see and compare patterns over time."
      ]
    }
  );
}

function renderExplanationSection(title, paragraphs) {
  const safeParagraphs = Array.isArray(paragraphs) ? paragraphs : [];
  if (!safeParagraphs.length) {
    return "";
  }

  return (
    `<section class="modalSection">` +
    `<div class="modalSectionTitle">${escapeHtml(title)}</div>` +
    safeParagraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("") +
    `</section>`
  );
}

async function openVisualizationExplanationModal() {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  if (!activeDef || !visualizationExplainModal || !visualizationExplainTitle || !visualizationExplainBody) {
    return;
  }

  await loadVisualizationExplanations();
  const explanation = getVisualizationExplanation(activeDef);
  visualizationExplainTitle.textContent = explanation.title;
  visualizationExplainBody.innerHTML =
    renderExplanationSection("Description", explanation.description) +
    renderExplanationSection(
      "What to compare with normal infant movement",
      explanation.compareWithNormal
    );

  visualizationExplainModal.hidden = false;
  visualizationExplainModal.setAttribute("aria-hidden", "false");
}

function closeVisualizationExplanationModal() {
  if (!visualizationExplainModal) {
    return;
  }

  visualizationExplainModal.hidden = true;
  visualizationExplainModal.setAttribute("aria-hidden", "true");
}

function renderLineMetricToggle() {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  const supportsLineMetric = !!activeDef?.supportsLineMetric;
  const selectedMetric = getSelectedLineMetric();

  if (lineMetricSection) {
    lineMetricSection.hidden = !supportsLineMetric;
  }

  if (!supportsLineMetric) {
    return;
  }

  if (lineMetricSpeedBtn) {
    lineMetricSpeedBtn.classList.toggle("is-active", selectedMetric === "speed");
  }

  if (lineMetricAccelerationBtn) {
    lineMetricAccelerationBtn.classList.toggle(
      "is-active",
      selectedMetric === "acceleration"
    );
  }
}

function renderJointSelector() {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  const supportsJointSelection = !!activeDef?.supportsJointSelection;
  const selectedJoints = getSelectedJoints();
  const selectionLimit = activeDef?.selectionLimit ?? null;

  if (jointSelectorSection) {
    jointSelectorSection.hidden = !supportsJointSelection;
  }

  if (clearJointSelectionBtn) {
    clearJointSelectionBtn.hidden = !supportsJointSelection;
    clearJointSelectionBtn.disabled = selectedJoints.length === 0;
  }

  if (!supportsJointSelection || !jointSelectionList) {
    return;
  }

  const selectedSet = new Set(selectedJoints);
  const limitReached =
    selectionLimit !== null && selectedJoints.length >= selectionLimit;

  jointSelectionList.innerHTML = "";

  visualizationJointNames.forEach(jointName => {
    const label = document.createElement("label");
    label.className = "jointOption";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selectedSet.has(jointName);
    input.disabled = !input.checked && limitReached;
    input.onchange = () => toggleJointSelection(jointName, input.checked);

    const text = document.createElement("span");
    text.textContent = formatJointLabel(jointName);

    label.appendChild(input);
    label.appendChild(text);
    jointSelectionList.appendChild(label);
  });

  if (jointSelectionHint) {
    jointSelectionHint.textContent = selectionLimit === null
      ? `Select 1 or more joints (${selectedJoints.length} selected).`
      : `Select 1 to ${selectionLimit} joints (${selectedJoints.length} selected).`;
  }
}

function toggleJointSelection(jointName, shouldSelect) {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  const selectedJoints = getSelectedJoints();
  const selectedSet = new Set(selectedJoints);
  const selectionLimit = activeDef?.selectionLimit ?? null;

  if (shouldSelect) {
    if (selectedSet.has(jointName)) {
      renderJointSelector();
      return;
    }

    if (
      selectionLimit !== null &&
      selectedJoints.length >= selectionLimit
    ) {
      renderJointSelector();
      return;
    }

    selectedSet.add(jointName);
  } else {
    if (!selectedSet.has(jointName)) {
      renderJointSelector();
      return;
    }

    selectedSet.delete(jointName);
  }

  selectedJointsByVisualization[visualizationMode][getActiveVisualizationId()] =
    visualizationJointNames.filter(name => selectedSet.has(name));

  if (
    activeVisualization &&
    typeof activeVisualization.setSelectedJoints === "function"
  ) {
    activeVisualization.setSelectedJoints(getSelectedJoints());
  }

  renderLineMetricToggle();
  renderJointSelector();

  if (comparisonState.active) {
    requestComparisonRefresh();
  }
}

function clearJointSelection() {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );

  if (!activeDef?.supportsJointSelection) {
    return;
  }

  selectedJointsByVisualization[visualizationMode][getActiveVisualizationId()] = [];

  if (
    activeVisualization &&
    typeof activeVisualization.setSelectedJoints === "function"
  ) {
    activeVisualization.setSelectedJoints([]);
  }

  renderLineMetricToggle();
  renderJointSelector();

  if (comparisonState.active) {
    requestComparisonRefresh();
  }
}

function setLineMetric(metric) {
  if (!["speed", "acceleration"].includes(metric)) return;

  selectedLineMetricByMode[visualizationMode] = metric;

  if (
    activeVisualization &&
    typeof activeVisualization.setMetric === "function"
  ) {
    activeVisualization.setMetric(metric);
  }

  renderLineMetricToggle();

  if (comparisonState.active) {
    requestComparisonRefresh();
  }
}

function renderVisualizationTabs() {
  if (!visualizationTabs) return;

  const defs = visualizationRegistry[visualizationMode] || [];
  const activeId = selectedVisualizationByMode[visualizationMode];

  visualizationTabs.innerHTML = "";

  defs.forEach(def => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "visTabBtn";
    btn.textContent = def.label;
    btn.classList.toggle("is-active", def.id === activeId);
    btn.onclick = () => setVisualizationType(def.id);
    visualizationTabs.appendChild(btn);
  });

  const activeDef = getVisualizationDefinition(visualizationMode, activeId);
  if (visualizationHelp) {
    const options = getVisualizationOptionsText(activeDef);
    const optionItems = options
      .map(option => `<li>${escapeHtml(option)}</li>`)
      .join("");
    visualizationHelp.innerHTML =
      `<div class="helpRow">- <strong>Options</strong>:</div>` +
      `<ul class="helpOptions">${optionItems}</ul>`;
  }

  if (visualizationExplainBtn) {
    visualizationExplainBtn.hidden = !activeDef;
  }

  updateSourceControls();
  renderLineMetricToggle();
  renderJointSelector();
}

function createVisualization() {
  if (!visualizationCanvas) return;

  const activeDef = getVisualizationDefinition(
    visualizationMode,
    selectedVisualizationByMode[visualizationMode]
  );

  if (!activeDef) {
    statusEl.textContent = `No visualizations are configured for "${visualizationMode}".`;
    return;
  }

  const ViewClass = window[activeDef.className];

  if (!ViewClass) {
    statusEl.textContent = `${activeDef.label} is unavailable for ${visualizationMode} mode.`;
    return;
  }

  activeVisualization = new ViewClass(
    visualizationCanvas,
    visualizationJointNames
  );

  syncAllCanvasLayouts();

  if (
    activeDef.supportsJointSelection &&
    typeof activeVisualization.setSelectedJoints === "function"
  ) {
    activeVisualization.setSelectedJoints(getSelectedJoints());
  }

  if (
    activeDef.supportsLineMetric &&
    typeof activeVisualization.setMetric === "function"
  ) {
    activeVisualization.setMetric(getSelectedLineMetric());
  }

  if (sequenceData) {
    activeVisualization.setSequence(buildVisualizationSequence(sequenceData));
    activeVisualization.setFrame(currentFrame);
  } else {
    activeVisualization.draw();
  }

  syncVarianceVisualizationData();
  syncComponentVarianceSequences();

  updateVisualizationButtons();
  renderVisualizationTabs();

  if (comparisonState.active) {
    requestComparisonRefresh();
  }
}

function setVisualizationMode(mode) {
  if (!["dynamic", "static"].includes(mode)) return;

  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  if (
    mode === "dynamic" &&
    visualizationMode === "static" &&
    activeDef?.locksModeToStatic
  ) {
    updateVisualizationButtons();
    return;
  }

  const currentVisualizationId = getActiveVisualizationId();
  if (getVisualizationDefinition(mode, currentVisualizationId)) {
    selectedVisualizationByMode[mode] = currentVisualizationId;
  }

  if (!getVisualizationDefinition(mode, selectedVisualizationByMode[mode])) {
    const firstDef = visualizationRegistry[mode]?.[0];
    if (firstDef) {
      selectedVisualizationByMode[mode] = firstDef.id;
    }
  }

  if (visualizationMode === mode && activeVisualization) {
    updateVisualizationButtons();
    renderVisualizationTabs();
    return;
  }

  visualizationMode = mode;
  createVisualization();
  syncSourceForCurrentView().catch(error => {
    console.error("Failed to sync source for mode change:", error);
  });
}

function setVisualizationType(visualizationId) {
  const currentId = selectedVisualizationByMode[visualizationMode];
  if (currentId === visualizationId && activeVisualization) {
    renderVisualizationTabs();
    return;
  }

  selectedVisualizationByMode[visualizationMode] = visualizationId;
  createVisualization();
  syncSourceForCurrentView().catch(error => {
    console.error("Failed to sync source for visualization change:", error);
  });
}

async function handleVisualizationCanvasClick(event) {
  if (
    !activeVisualization ||
    typeof activeVisualization.handleClick !== "function" ||
    !isComponentVarianceActive()
  ) {
    return;
  }

  const subject = getCurrentSubject();
  if (!subject) {
    return;
  }

  const bounds = visualizationCanvas.getBoundingClientRect();
  const scaleX = visualizationCanvas.width / bounds.width;
  const scaleY = visualizationCanvas.height / bounds.height;
  const canvasX = (event.clientX - bounds.left) * scaleX;
  const canvasY = (event.clientY - bounds.top) * scaleY;
  const selectedComponentId = activeVisualization.handleClick(canvasX, canvasY);

  if (selectedComponentId === null || selectedComponentId === undefined) {
    return;
  }

  const normalizedId = String(selectedComponentId);
  if (getSelectedComponentId(subject) === normalizedId) {
    return;
  }

  selectedComponentBySubject[subject] = normalizedId;

  if (typeof activeVisualization.setSelectedComponent === "function") {
    activeVisualization.setSelectedComponent(normalizedId);
  }

  try {
    await loadCurrentSequenceSource();
  } catch (error) {
    console.error("Failed to load clicked component sequence:", error);
  }
}

if (lineMetricSpeedBtn) {
  lineMetricSpeedBtn.onclick = () => setLineMetric("speed");
}

if (lineMetricAccelerationBtn) {
  lineMetricAccelerationBtn.onclick = () => setLineMetric("acceleration");
}

if (clearJointSelectionBtn) {
  clearJointSelectionBtn.onclick = () => clearJointSelection();
}

if (visualizationExplainBtn) {
  visualizationExplainBtn.onclick = () => {
    openVisualizationExplanationModal().catch(error => {
      console.error("Failed to open visualization explanation:", error);
    });
  };
}

if (compareWithNormalBtn) {
  compareWithNormalBtn.onclick = () => enterComparisonMode();
}

if (compareCurrentVisualization) {
  compareCurrentVisualization.onclick = event => {
    handleComparisonVisualizationClick(event, "current").catch(error => {
      console.error("Failed to select current comparison component:", error);
    });
  };
}

if (compareNormalVisualization) {
  compareNormalVisualization.onclick = event => {
    handleComparisonVisualizationClick(event, "normal").catch(error => {
      console.error("Failed to select normal comparison component:", error);
    });
  };
}

if (normalReferencePrevBtn) {
  normalReferencePrevBtn.onclick = () => selectNormalReference(-1);
}

if (normalReferenceNextBtn) {
  normalReferenceNextBtn.onclick = () => selectNormalReference(1);
}

if (exitCompareBtn) {
  exitCompareBtn.onclick = () => exitComparisonMode();
}

if (visualizationExplainCloseBtn) {
  visualizationExplainCloseBtn.onclick = () => closeVisualizationExplanationModal();
}

if (visualizationExplainModal) {
  visualizationExplainModal.addEventListener("click", event => {
    if (event.target === visualizationExplainModal) {
      closeVisualizationExplanationModal();
    }
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && visualizationExplainModal && !visualizationExplainModal.hidden) {
    closeVisualizationExplanationModal();
  }
});

// --------- Data loading ----------
async function loadSubjects() {
  statusEl.textContent = "Loading infants…";

  try {
    const { dir, subjects } = await resolveReconDir();
    window.__RECON_BASE__ = dir;
    await ensureNormalReferenceOptions();
    updateNormalReferenceControls();

    const visibleSubjects = subjects.filter(subject => !isNormalReferenceSubject(subject));

    subjectSelect.innerHTML = `<option value="">-- Select Infant --</option>`;
    visibleSubjects.sort().forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      subjectSelect.appendChild(opt);
    });

    statusEl.textContent = `Found ${visibleSubjects.length} infants.`;
  } catch (err) {
    console.error(err);
    subjectSelect.innerHTML = `<option value="">(no infants found)</option>`;
    statusEl.textContent = `ERROR: ${err.message}`;
  }
}

async function loadSequenceSource(subject, descriptor) {
  const base = window.__RECON_BASE__;
  if (!base) return;

  const sequencePath = descriptor?.path || DEFAULT_SEQUENCE_FILE;
  const descriptorLabel = descriptor?.label || sequencePath;
  statusEl.textContent = `Loading ${subject}/${descriptorLabel}…`;

  try {
    sequenceData = await fetchSequenceData(subject, descriptor);
  } catch (error) {
    statusEl.textContent = `Failed to load ${descriptorLabel} for ${subject}`;
    throw error;
  }
  setActiveSequenceDescriptor(descriptor);

  const T = sequenceData?.[0]?.length ?? 0;
  frameSlider.max = Math.max(0, T - 1);
  frameSlider.value = "0";
  updateRangeFill(frameSlider);
  currentFrame = 0;

  statusEl.textContent = `Loaded ${descriptorLabel} (${T} frames).`;

  if (activeVisualization) {
    activeVisualization.setSequence(buildVisualizationSequence(sequenceData));
  }

  syncVarianceVisualizationData();
  syncComponentVarianceSequences();

  drawFrame();

  if (comparisonState.active) {
    requestComparisonRefresh();
  }
}

function getDefaultSequenceDescriptor() {
  return {
    type: "sequence",
    path: sequenceSelect?.value || DEFAULT_SEQUENCE_FILE,
    label: sequenceSelect?.selectedOptions?.[0]?.textContent || "Sequence"
  };
}

function getSelectedComponentDescriptor(subject = getCurrentSubject()) {
  const componentId = getSelectedComponentId(subject);
  if (componentId === "" || componentId === null || componentId === undefined) {
    return null;
  }

  const numericId = Number.parseInt(componentId, 10);
  const subjectMeta =
    subject === getCurrentSubject()
      ? currentSubjectMetadata
      : metadataBySubject.get(subject);
  const componentMeta = subjectMeta?.components?.find(
    component => component.id === numericId
  );

  return {
    type: "component",
    componentId: numericId,
    path: getComponentFileName(numericId),
    label: componentMeta
      ? buildComponentOptionLabel(componentMeta)
      : `Component ${numericId + 1}`
  };
}

function getDesiredSequenceDescriptor() {
  return isComponentVarianceActive()
    ? getSelectedComponentDescriptor()
    : getDefaultSequenceDescriptor();
}

function getDesiredSequenceDescriptorForSubject(subject) {
  return isComponentVarianceActive()
    ? getSelectedComponentDescriptor(subject)
    : getDefaultSequenceDescriptor();
}

async function loadCurrentSequenceSource() {
  const subject = getCurrentSubject();
  if (!subject) return;

  const descriptor = getDesiredSequenceDescriptor();
  if (!descriptor) {
    sequenceData = null;
    activeSequenceDescriptor = null;
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    statusEl.textContent = "Select a component to preview its motion.";
    frameSlider.max = "0";
    frameSlider.value = "0";
    updateRangeFill(frameSlider);
    frameLabel.textContent = "0";
    currentFrame = 0;
    if (activeVisualization && typeof activeVisualization.setFrame === "function") {
      activeVisualization.setFrame(0);
    }
    return;
  }

  await loadSequenceSource(subject, descriptor);
}

async function loadMetadata(subject) {
  try {
    const meta = await ensureSubjectMetadata(subject);
    currentSubjectMetadata = meta;

    metaBox.innerHTML =
      `<div><b>subject_id:</b> ${meta.subject_id ?? subject}</div>` +
      `<div><b>target:</b> ${meta.target ?? ""}</div>` +
      `<div><b>gma:</b> ${meta.gma ?? ""}</div>` +
      `<div><b>sequence_length:</b> ${meta.sequence_length ?? ""}</div>` +
      `<div><b>optimal_ranks:</b> ${meta.optimal_ranks ?? ""}</div>` +
      `<div><b>n_components:</b> ${meta.n_components ?? ""}</div>`;
    updateSourceControls();
  } catch (e) {
    currentSubjectMetadata = null;
    metadataBySubject.delete(subject);
    metaBox.textContent = "No metadata file found for this infant.";
    updateSourceControls();
  }
}

// --------- Rendering ----------
function clearCanvasSurface(targetCtx, targetCanvas) {
  if (!targetCtx || !targetCanvas) {
    return;
  }

  targetCtx.fillStyle = "#0d0d0d";
  targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
}

function getViewerScale() {
  return parseFloat(zoomSlider?.value ?? "600");
}

function drawSkeletonFrame(targetCtx, targetCanvas, targetSequence, frame) {
  if (!targetCtx || !targetCanvas) {
    return;
  }

  clearCanvasSurface(targetCtx, targetCanvas);

  if (!targetSequence || !targetSequence.length) {
    return;
  }

  const clampedFrame = Math.max(
    0,
    Math.min(frame, (targetSequence[0]?.length || 1) - 1)
  );
  const scale = getViewerScale();
  const cx = targetCanvas.width / 2;
  const cy = targetCanvas.height / 2;
  const pts = {};

  for (let i = 0; i < joints.length; i++) {
    const x = targetSequence[2 * i]?.[clampedFrame];
    const y = targetSequence[2 * i + 1]?.[clampedFrame];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }

    const px = cx + x * scale;
    const py = cy + y * scale;

    pts[joints[i]] = [px, py];

    targetCtx.beginPath();
    targetCtx.arc(px, py, 4, 0, Math.PI * 2);
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fill();
  }

  for (const j in connections) {
    for (const k of connections[j]) {
      const a = pts[j];
      const b = pts[k];
      if (!a || !b) continue;

      targetCtx.beginPath();
      targetCtx.moveTo(a[0], a[1]);
      targetCtx.lineTo(b[0], b[1]);
      targetCtx.strokeStyle = "#1aa6a6";
      targetCtx.lineWidth = 2;
      targetCtx.stroke();
    }
  }
}

function requestComparisonRefresh() {
  refreshComparisonMode().catch(error => {
    console.error("Failed to refresh comparison mode:", error);
  });
}

function mergeComparisonScaleMaps(leftMap, rightMap) {
  const merged = new Map();

  [leftMap, rightMap].forEach(scaleMap => {
    if (!(scaleMap instanceof Map)) {
      return;
    }

    scaleMap.forEach((value, key) => {
      const numericValue = Number.parseFloat(value) || 0;
      merged.set(key, Math.max(merged.get(key) || 0, numericValue));
    });
  });

  return merged;
}

function syncComparisonVisualizationScales() {
  const currentView = comparisonState.current.visualization;
  const normalView = comparisonState.normal.visualization;
  const supportsSharedScale =
    currentView &&
    normalView &&
    typeof currentView.getComparisonScaleCandidates === "function" &&
    typeof normalView.getComparisonScaleCandidates === "function" &&
    typeof currentView.setComparisonScaleByJoint === "function" &&
    typeof normalView.setComparisonScaleByJoint === "function";

  if (!supportsSharedScale) {
    return;
  }

  const sharedScales = mergeComparisonScaleMaps(
    currentView.getComparisonScaleCandidates(),
    normalView.getComparisonScaleCandidates()
  );

  currentView.setComparisonScaleByJoint(sharedScales);
  normalView.setComparisonScaleByJoint(sharedScales);
}

async function syncVisualizationInstanceData(view, subject) {
  if (!view || !subject) {
    return;
  }

  if (typeof view.setVarianceData === "function") {
    const varianceData = await ensureJointVarianceData();
    const components = varianceData.get(subject) || [];
    view.setVarianceData(subject, components);
    if (typeof view.setSelectedComponent === "function") {
      view.setSelectedComponent(getSelectedComponentId(subject));
    }
  }

  if (typeof view.setComponentSequences === "function") {
    const varianceComponents = jointVarianceBySubject.get(subject) || [];
    const metadataComponents = getSubjectComponentDefinitions(subject);
    const componentDefinitions =
      varianceComponents.length > 0 ? varianceComponents : metadataComponents;

    if (
      typeof view.setComponentMetadata === "function" &&
      !componentSequencesBySubject.has(subject)
    ) {
      view.setComponentMetadata(subject, componentDefinitions);
    }

    const sequenceMap = await ensureComponentSequences(subject);
    view.setComponentSequences(subject, componentDefinitions, sequenceMap);
    if (typeof view.setSelectedComponent === "function") {
      view.setSelectedComponent(getSelectedComponentId(subject));
    }
  }
}

async function buildComparisonVisualization(targetCanvas, subject, sequence, componentData = null) {
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );
  const ViewClass = window[activeDef?.className];

  if (!targetCanvas || !activeDef || !ViewClass) {
    return null;
  }

  const view = new ViewClass(targetCanvas, visualizationJointNames);

  if (
    activeDef.supportsJointSelection &&
    typeof view.setSelectedJoints === "function"
  ) {
    view.setSelectedJoints(getSelectedJoints());
  }

  if (
    activeDef.supportsLineMetric &&
    typeof view.setMetric === "function"
  ) {
    view.setMetric(getSelectedLineMetric());
  }

  if (sequence) {
    view.setSequence(buildVisualizationSequence(sequence));
  } else if (typeof view.draw === "function") {
    view.draw();
  }

  if (activeDef.id === "componentvariance") {
    updateVisualizationSurfaceLayout(targetCanvas, targetCanvas.parentElement, componentData);
  }

  await syncVisualizationInstanceData(view, subject);
  view.setFrame(currentFrame);
  return view;
}

async function updateComparisonSideSequence(sideKey, subject) {
  if (!comparisonState.active || !subject) {
    return;
  }

  const descriptor = getDesiredSequenceDescriptorForSubject(subject);
  const sequence = await fetchSequenceData(subject, descriptor);
  const sideState = comparisonState[sideKey];
  const targetCanvas =
    sideKey === "normal" ? compareNormalViewer : compareCurrentViewer;

  if (!sideState) {
    return;
  }

  sideState.sequenceData = sequence;
  drawSkeletonFrame(
    targetCanvas?.getContext("2d"),
    targetCanvas,
    sequence,
    currentFrame
  );
}

async function handleComparisonVisualizationClick(event, sideKey) {
  if (
    !comparisonState.active ||
    getActiveVisualizationId() !== "componentvariance"
  ) {
    return;
  }

  const targetCanvas =
    sideKey === "normal" ? compareNormalVisualization : compareCurrentVisualization;
  const view =
    sideKey === "normal"
      ? comparisonState.normal.visualization
      : comparisonState.current.visualization;
  const subject =
    sideKey === "normal" ? getNormalReferenceSubject() : getCurrentSubject();

  if (
    !targetCanvas ||
    !view ||
    !subject ||
    typeof view.handleClick !== "function"
  ) {
    return;
  }

  const bounds = targetCanvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    return;
  }

  const scaleX = targetCanvas.width / bounds.width;
  const scaleY = targetCanvas.height / bounds.height;
  const canvasX = (event.clientX - bounds.left) * scaleX;
  const canvasY = (event.clientY - bounds.top) * scaleY;
  const selectedComponentId = view.handleClick(canvasX, canvasY);

  if (selectedComponentId === null || selectedComponentId === undefined) {
    return;
  }

  const normalizedId = String(selectedComponentId);
  selectedComponentBySubject[subject] = normalizedId;

  if (typeof view.setSelectedComponent === "function") {
    view.setSelectedComponent(normalizedId);
  }

  if (
    sideKey === "current" &&
    typeof activeVisualization?.setSelectedComponent === "function"
  ) {
    activeVisualization.setSelectedComponent(normalizedId);
  }

  await updateComparisonSideSequence(sideKey, subject);
}

function updateComparisonTitles() {
  const currentSubject = getCurrentSubject();
  const activeDef = getVisualizationDefinition(
    visualizationMode,
    getActiveVisualizationId()
  );

  if (compareCurrentTitle) {
    compareCurrentTitle.textContent = getSubjectDisplayName(currentSubject);
  }
  if (compareCurrentSubtitle) {
    compareCurrentSubtitle.textContent =
      activeDef?.label ? `${activeDef.label} view` : "Current subject";
  }
  if (compareNormalTitle) {
    const normalLabel = getNormalReferenceLabel();
    compareNormalTitle.textContent = normalLabel
      ? `Normal Baby ${normalLabel}`
      : "Normal Baby";
  }
  if (compareNormalSubtitle) {
    compareNormalSubtitle.textContent =
      activeDef?.label ? `${activeDef.label} reference` : "Reference subject";
  }
  if (compareModeStatus) {
    const modeLabel = comparisonState.displayMode === "skeleton"
      ? "Skeleton comparison"
      : "Visual comparison";
    compareModeStatus.textContent = `${modeLabel} with shared frame controls`;
  }
}

async function refreshComparisonMode() {
  if (!comparisonState.active) {
    return;
  }

  const currentSubject = getCurrentSubject();
  if (!currentSubject || isNormalReferenceSubject(currentSubject)) {
    exitComparisonMode();
    return;
  }
  const normalSubject = getNormalReferenceSubject();
  if (!normalSubject) {
    exitComparisonMode();
    return;
  }

  try {
    const activeDef = getVisualizationDefinition(
      visualizationMode,
      getActiveVisualizationId()
    );
    await ensureSubjectMetadata(currentSubject);
    await ensureSubjectMetadata(normalSubject);
    comparisonState.current.subjectId = currentSubject;
    comparisonState.normal.subjectId = normalSubject;

    const currentDescriptor = getDesiredSequenceDescriptorForSubject(currentSubject);
    const normalDescriptor = getDesiredSequenceDescriptorForSubject(normalSubject);

    const [currentSequence, normalSequence] = await Promise.all([
      fetchSequenceData(currentSubject, currentDescriptor),
      fetchSequenceData(normalSubject, normalDescriptor)
    ]);

    comparisonState.current.sequenceData = currentSequence;
    comparisonState.normal.sequenceData = normalSequence;

    const varianceData = await ensureJointVarianceData();
    const currentComponents = activeDef?.id === "componentvariance"
      ? (varianceData.get(currentSubject) || getSubjectComponentDefinitions(currentSubject))
      : null;
    const normalComponents = activeDef?.id === "componentvariance"
      ? (varianceData.get(normalSubject) || getSubjectComponentDefinitions(normalSubject))
      : null;

    updateCompareCanvasLayouts(currentComponents, normalComponents);
    updateComparisonTitles();

    comparisonState.current.visualization = await buildComparisonVisualization(
      compareCurrentVisualization,
      currentSubject,
      currentSequence,
      currentComponents
    );
    comparisonState.normal.visualization = await buildComparisonVisualization(
      compareNormalVisualization,
      normalSubject,
      normalSequence,
      normalComponents
    );
    syncComparisonVisualizationScales();

    drawSkeletonFrame(
      compareCurrentViewer?.getContext("2d"),
      compareCurrentViewer,
      currentSequence,
      currentFrame
    );
    drawSkeletonFrame(
      compareNormalViewer?.getContext("2d"),
      compareNormalViewer,
      normalSequence,
      currentFrame
    );
  } catch (error) {
    console.error("Failed to refresh comparison mode:", error);
  }
}

function enterComparisonMode() {
  const currentSubject = getCurrentSubject();
  const normalSubject = getNormalReferenceSubject();
  if (!currentSubject || isNormalReferenceSubject(currentSubject) || !normalSubject) {
    return;
  }

  comparisonState.active = true;
  comparisonState.displayMode = "visual";
  comparisonState.normal.subjectId = normalSubject;
  if (layoutEl) {
    layoutEl.classList.add("compareModeActive");
  }
  if (compareModeView) {
    compareModeView.hidden = false;
  }
  updateComparisonDisplayModeUi();
  updateNormalReferenceControls();
  updateCompareButtonVisibility();
  requestComparisonRefresh();
}

function exitComparisonMode() {
  comparisonState.active = false;
  comparisonState.displayMode = "visual";
  comparisonState.current.sequenceData = null;
  comparisonState.normal.sequenceData = null;
  comparisonState.current.visualization = null;
  comparisonState.normal.visualization = null;

  if (layoutEl) {
    layoutEl.classList.remove("compareModeActive");
  }
  if (compareModeView) {
    compareModeView.hidden = true;
  }
  updateComparisonDisplayModeUi();
  updateNormalReferenceControls();

  updateCompareButtonVisibility();
}

function drawFrame() {
  if (!sequenceData) {
    clearCanvasSurface(ctx, canvas);
    return;
  }

  drawSkeletonFrame(ctx, canvas, sequenceData, currentFrame);

  frameLabel.textContent = String(currentFrame);

  if (activeVisualization) {
    activeVisualization.setFrame(currentFrame);
  }

  if (comparisonState.active) {
    drawSkeletonFrame(
      compareCurrentViewer?.getContext("2d"),
      compareCurrentViewer,
      comparisonState.current.sequenceData,
      currentFrame
    );
    drawSkeletonFrame(
      compareNormalViewer?.getContext("2d"),
      compareNormalViewer,
      comparisonState.normal.sequenceData,
      currentFrame
    );

    if (comparisonState.current.visualization) {
      comparisonState.current.visualization.setFrame(currentFrame);
    }
    if (comparisonState.normal.visualization) {
      comparisonState.normal.visualization.setFrame(currentFrame);
    }
  }
}

function animate() {
  if (!playing) return;

  currentFrame++;
  if (currentFrame > parseInt(frameSlider.max, 10)) currentFrame = 0;

  frameSlider.value = String(currentFrame);
  updateRangeFill(frameSlider);
  drawFrame();

  const speedFactor = parseFloat(speedSlider?.value ?? "1");
  const delayMs = Math.max(8, Math.round(30 / Math.max(0.1, speedFactor)));

  setTimeout(() => requestAnimationFrame(animate), delayMs);
}

// --------- UI events ----------
playBtn.onclick = () => {
  if (playing) return;
  playing = true;
  animate();
};

pauseBtn.onclick = () => {
  playing = false;
};

if (compareViewToggleBtn) {
  compareViewToggleBtn.onclick = () => {
    setComparisonDisplayMode(
      comparisonState.displayMode === "skeleton" ? "visual" : "skeleton"
    );
  };
}

frameSlider.oninput = () => {
  currentFrame = parseInt(frameSlider.value, 10);
  updateRangeFill(frameSlider);
  drawFrame();
};

subjectSelect.onchange = async () => {
  const subject = subjectSelect.value;
  sequenceSelect.innerHTML = `
    <option value="global_reconstruction.json">Global Reconstruction</option>
    <option value="ground_truth.json">Ground Truth</option>
  `;
  currentSubjectMetadata = null;
  updateSourceControls();

  if (!subject) {
    if (comparisonState.active) {
      exitComparisonMode();
    }
    return;
  }

  await loadMetadata(subject);
  await loadCurrentSequenceSource();
};

sequenceSelect.onchange = async () => {
  const subject = subjectSelect.value;
  if (!subject) return;
  await loadCurrentSequenceSource();
};

const zoomSlider = document.getElementById("zoomSlider");
if (zoomSlider) {
  zoomSlider.oninput = () => {
    updateRangeFill(zoomSlider);
    updateControlValueLabels();
    drawFrame();
  };
}

const speedSlider = document.getElementById("speedSlider");
if (speedSlider) {
  speedSlider.oninput = () => {
    updateRangeFill(speedSlider);
    updateControlValueLabels();
  };
}

if (dynamicViewBtn) {
  dynamicViewBtn.onclick = () => setVisualizationMode("dynamic");
}

if (staticViewBtn) {
  staticViewBtn.onclick = () => setVisualizationMode("static");
}

if (visualizationCanvas) {
  visualizationCanvas.addEventListener("click", event => {
    handleVisualizationCanvasClick(event);
  });
}

// --------- Startup ----------
window.addEventListener("resize", handleCanvasResize);
loadVisualizationExplanations();
createVisualization();
syncAllCanvasLayouts();
updateRangeFill(frameSlider);
updateRangeFill(zoomSlider);
updateRangeFill(speedSlider);
updateControlValueLabels();
updateCompareButtonVisibility();
loadSubjects();
