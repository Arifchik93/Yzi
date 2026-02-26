const protocols = [
  {
    id: "breast",
    name: "УЗИ молочной железы и лимфоузлов",
    file: "Temp.txt",
  },
  {
    id: "lymph",
    name: "УЗИ лимфатических узлов",
    file: "LymphNodes.txt",
  },
  {
    id: "bladderprostate",
    name: "УЗИ мочевого пузыря и предстательной железы",
    file: "bladderprostate.txt",
  },
  {
    id: "thyroidnecklymph",
    name: "УЗИ щитовидной железы и лимфоузлов шеи",
    file: "ThyroidNeckLymphNodes.txt",
  },
];

const protocolSelect = document.getElementById("protocolSelect");
const formContainer = document.getElementById("formContainer");
const protocolOutput = document.getElementById("protocolOutput");
const loadStatus = document.getElementById("loadStatus");
const editorModal = document.querySelector("[data-template-editor]");
const editorTextarea = document.querySelector("[data-template-editor-text]");
const editorStatus = document.querySelector("[data-template-editor-status]");
const editorFileLabel = document.querySelector("[data-template-editor-file]");
const editorApplyButton = document.querySelector("[data-template-editor-apply]");
const editorSaveButton = document.querySelector("[data-template-editor-save]");
const editorCloseButtons = document.querySelectorAll("[data-template-editor-close]");

const templateCache = new Map();
let currentBlocks = [];
const textMeasureCanvas = document.createElement("canvas");
let editorTemplateLabel = "";
const localTemplatePrefix = "local-template-";
const conclusionRulesFile = "conclusionRules.json";
let conclusionRulesConfig = {};

function populateProtocolOptions() {
  protocols.forEach((protocol) => {
    const option = document.createElement("option");
    option.value = protocol.id;
    option.textContent = protocol.name;
    protocolSelect.appendChild(option);
  });
}

async function loadTemplate(protocolId, { bustCache = false } = {}) {
  const protocol = protocols.find((item) => item.id === protocolId);
  if (!protocol) return null;
  if (!bustCache) {
    const localTemplate = readLocalTemplate(protocol.id);
    if (localTemplate) {
      templateCache.set(protocol.file, localTemplate);
      return localTemplate;
    }
  }
  if (!bustCache && templateCache.has(protocol.file)) {
    return templateCache.get(protocol.file);
  }
  const url = bustCache ? `${protocol.file}?v=${Date.now()}` : protocol.file;
  const response = await fetch(url);
  const data = await response.json();
  templateCache.set(protocol.file, data);
  return data;
}


async function loadConclusionRules() {
  try {
    const response = await fetch(`${conclusionRulesFile}?v=${Date.now()}`);
    if (!response.ok) {
      conclusionRulesConfig = {};
      return;
    }
    const parsed = await response.json();
    conclusionRulesConfig = parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    conclusionRulesConfig = {};
  }
}

function normalizeBlocks(template) {
  if (!template || !Array.isArray(template.blocks)) {
    return [];
  }

  return template.blocks.map((block) => ({
    type: block.type || "text",
    title: block.title || "",
    content: block.content || "",
  }));
}

function parseSegments(text) {
  const segments = [];
  const regex = /\{[^}]*\}/g;
  let lastIndex = 0;
  let match;

  const detectCalcToken = (innerExpression) => {
    const normalized = innerExpression.toLowerCase().replace(/\s+/g, " ");
    const normalizedNumeric = normalized.replace(",", ".");

    const has047 =
      normalizedNumeric.includes("0.47") || normalized.includes("0,47");
    const has052 =
      normalizedNumeric.includes("0.52") ||
      normalized.includes("0,52") ||
      normalized.includes("объем") ||
      normalized.includes("объём") ||
      normalized.includes("эллип");

    if (has047 || has052) {
      return {
        type: "calc",
        formula: has047 ? "ellipse47" : "ellipse52",
      };
    }

    return null;
  };

  const parseOptionTokens = (rawOption) => {
    const tokens = [];
    const placeholderRegex = /__|_ _|<[^>]+>/g;
    let lastTokenIndex = 0;
    let placeholderMatch;
    let inputIndex = 0;

    const pushText = (value) => {
      if (!value) return;
      tokens.push({ type: "text", value });
    };

    while ((placeholderMatch = placeholderRegex.exec(rawOption))) {
      const tokenStart = placeholderMatch.index;
      const tokenValue = placeholderMatch[0];

      if (tokenStart > lastTokenIndex) {
        pushText(rawOption.slice(lastTokenIndex, tokenStart));
      }

      if (tokenValue === "__") {
        tokens.push({
          type: "input",
          inputType: "number",
          inputIndex: inputIndex++,
          placeholder: "число",
        });
      } else if (tokenValue === "_ _") {
        tokens.push({
          type: "input",
          inputType: "text",
          inputIndex: inputIndex++,
          placeholder: "текст",
        });
      } else if (tokenValue.startsWith("<")) {
        const inner = tokenValue.slice(1, -1).trim();
        const calcToken = detectCalcToken(inner);

        if (calcToken) {
          tokens.push(calcToken);
        } else if (inner.toLowerCase().includes("дд.мм.гггг")) {
          tokens.push({
            type: "input",
            inputType: "date",
            inputIndex: inputIndex++,
            placeholder: "дд.мм.гггг",
          });
        } else if (inner.toLowerCase().includes("число")) {
          tokens.push({
            type: "input",
            inputType: "number",
            inputIndex: inputIndex++,
            placeholder: "число",
          });
        } else {
          pushText(tokenValue);
        }
      }

      lastTokenIndex = tokenStart + tokenValue.length;
    }

    if (lastTokenIndex < rawOption.length) {
      pushText(rawOption.slice(lastTokenIndex));
    }

    return {
      raw: rawOption,
      tokens,
      inputValues: Array(inputIndex).fill(""),
    };
  };

  const parseInlineTokens = (rawText) => {
    const tokens = [];
    const placeholderRegex = /__|_ _|<[^>]+>/g;
    let lastTokenIndex = 0;
    let placeholderMatch;
    let inputIndex = 0;

    const pushText = (value) => {
      if (!value) return;
      tokens.push({ type: "text", value });
    };

    while ((placeholderMatch = placeholderRegex.exec(rawText))) {
      const tokenStart = placeholderMatch.index;
      const tokenValue = placeholderMatch[0];

      if (tokenStart > lastTokenIndex) {
        pushText(rawText.slice(lastTokenIndex, tokenStart));
      }

      if (tokenValue === "__") {
        tokens.push({
          type: "input",
          inputType: "number",
          inputIndex: inputIndex++,
          placeholder: "число",
        });
      } else if (tokenValue === "_ _") {
        tokens.push({
          type: "input",
          inputType: "text",
          inputIndex: inputIndex++,
          placeholder: "текст",
        });
      } else if (tokenValue.startsWith("<")) {
        const inner = tokenValue.slice(1, -1).trim();
        const calcToken = detectCalcToken(inner);

        if (calcToken) {
          tokens.push(calcToken);
        } else if (inner.toLowerCase().includes("дд.мм.гггг")) {
          tokens.push({
            type: "input",
            inputType: "date",
            inputIndex: inputIndex++,
            placeholder: "дд.мм.гггг",
          });
        } else if (inner.toLowerCase().includes("число")) {
          tokens.push({
            type: "input",
            inputType: "number",
            inputIndex: inputIndex++,
            placeholder: "число",
          });
        } else {
          pushText(tokenValue);
        }
      }

      lastTokenIndex = tokenStart + tokenValue.length;
    }

    if (lastTokenIndex < rawText.length) {
      pushText(rawText.slice(lastTokenIndex));
    }

    const hasInteractive = tokens.some((token) => token.type !== "text");

    return hasInteractive
      ? {
          type: "inline",
          tokens,
          inputValues: Array(inputIndex).fill(""),
        }
      : { type: "text", value: rawText };
  };

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      const inlineSegment = parseInlineTokens(text.slice(lastIndex, match.index));
      segments.push(inlineSegment);
    }

    const raw = match[0].slice(1, -1);
    const options = raw
      .split("/")
      .map((option) => option.trim())
      .filter((option, index, array) => index === 0 || option !== "" || array[0] === "");

    if (options.length === 0) {
      options.push("");
    }

    const parsedOptions = options.map((option) => parseOptionTokens(option));
    segments.push({
      type: "field",
      options: parsedOptions,
      selectedOptionIndex: 0,
      value: parsedOptions[0] ? assembleOption(parsedOptions[0]) : "",
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(parseInlineTokens(text.slice(lastIndex)));
  }

  return segments;
}

function createRow(content) {
  return {
    segments: parseSegments(content),
  };
}

function assembleRow(row) {
  return row.segments
    .map((segment) => {
      if (segment.type === "text") {
        return segment.value;
      }
      if (segment.type === "inline") {
        return assembleInlineSegment(segment);
      }
      return segment.value ?? "";
    })
    .join("");
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
}

function computeEllipseVolume(values, coefficient = 0.52) {
  if (values.length < 3) return "";
  const [a, b, c] = values.map((item) => Number.parseFloat(item));
  if ([a, b, c].some((item) => Number.isNaN(item))) return "";
  const volume = (a * b * c * coefficient) / 1000;
  return volume.toFixed(2);
}

function computeCalcValue(token, inputValues) {
  if (token.formula === "ellipse47") {
    return computeEllipseVolume(inputValues, 0.47);
  }


  return computeEllipseVolume(inputValues, 0.52);
}

function assembleOption(option) {
  return option.tokens
    .map((token) => {
      if (token.type === "text") {
        return token.value;
      }
      if (token.type === "input") {
        const value = option.inputValues[token.inputIndex] ?? "";
        return token.inputType === "date" ? formatDate(value) : value;
      }
      if (token.type === "calc") {
        return computeCalcValue(token, option.inputValues);
      }
      return "";
    })
    .join("");
}

function assembleInlineSegment(segment) {
  return segment.tokens
    .map((token) => {
      if (token.type === "text") {
        return token.value;
      }
      if (token.type === "input") {
        const value = segment.inputValues[token.inputIndex] ?? "";
        return token.inputType === "date" ? formatDate(value) : value;
      }
      if (token.type === "calc") {
        return computeCalcValue(token, segment.inputValues);
      }
      return "";
    })
    .join("");
}

function updateOutput() {
  const text = currentBlocks
    .map((block) => {
      if (block.type === "text") {
        return assembleRow(block.rows[0]);
      }
      const rowsText = block.rows
        .map((row) => assembleRow(row).trim())
        .filter(Boolean);
      return rowsText.join("\n");
    })
    .join("");

  const conclusion = buildAutoConclusion(currentBlocks, protocolSelect.value, conclusionRulesConfig);
  const textWithConclusion = conclusion ? `${text.trim()}\n\n${conclusion}` : text.trim();

  protocolOutput.value = textWithConclusion;
  resizeTextarea(protocolOutput);
}

function getFieldValues(row) {
  return row.segments
    .filter((segment) => segment.type === "field")
    .map((segment) => (segment.value || "").trim());
}

function normalizeSpaces(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function buildAutoConclusion(blocks, protocolId, rulesConfig) {
  const protocolRules = rulesConfig?.[protocolId];
  if (!protocolRules) {
    return "";
  }

  const conclusions = [];
  const recommendationParts = [];
  let maxRiskLevel = "benign";

  const pushConclusion = (value) => {
    if (!value) return;
    if (!conclusions.includes(value)) {
      conclusions.push(value);
    }
  };

  const setRisk = (risk) => {
    const order = { benign: 1, moderate: 2, high: 3 };
    if ((order[risk] || 1) > (order[maxRiskLevel] || 1)) {
      maxRiskLevel = risk;
    }
  };

  const context = protocolId === "breast"
    ? collectBreastContext(blocks, protocolRules)
    : protocolId === "lymph"
      ? collectLymphContext(blocks, protocolRules)
      : collectThyroidContext(blocks, protocolRules);

  if (protocolId === "breast" && context.hasOperation) {
    const postOpConclusions = [];
    const appendOperationConclusion = (sideKey, sideLabel) => {
      const operation = context.operations?.[sideKey] || "";
      if (!operation) return;
      const scarLesions = context.lesions.filter((item) => item.side === sideKey && item.isScarZone);
      const scarText = scarLesions.length
        ? `в зоне п/о рубца: ${scarLesions
          .map((item) => [item.rawType, item.classification].filter(Boolean).join(" "))
          .filter(Boolean)
          .join("; ")}`
        : "зона п/о рубца без дополнительных особенностей";
      postOpConclusions.push(`Состояние после ${operation} ${sideLabel} молочной железы, ${scarText}.`);
    };
    appendOperationConclusion("right", "правой");
    appendOperationConclusion("left", "левой");
    postOpConclusions.forEach(pushConclusion);
    setRisk("high");
    recommendationParts.push("Наблюдение у онколога (онкомаммолога).");
  }

  applyAiitRule(context, protocolRules.aiitRule, pushConclusion, recommendationParts, setRisk);
  applyDiffuseRules(context, protocolRules.diffuseRules || [], pushConclusion, recommendationParts, setRisk);
  applyVolumeRules(context, protocolRules.volumeRules || [], pushConclusion, recommendationParts, setRisk);
  applyIsthmusRules(context, protocolRules.isthmusRules || [], pushConclusion, recommendationParts, setRisk);
  applyTopographyRules(context, protocolRules.topographyRules || [], pushConclusion, recommendationParts, setRisk);
  applyDuctRules(context, protocolRules.ductRules || [], pushConclusion, recommendationParts, setRisk);
  applyMorphotypeRules(context, protocolRules.morphotypeRules || [], pushConclusion, recommendationParts, setRisk);
  applyLesionsRule(context, protocolRules.lesionsRule, pushConclusion);
  applyNoduleRules(
    context,
    protocolRules.noduleRules || [],
    pushConclusion,
    recommendationParts,
    setRisk,
    { suppressConclusion: protocolId === "breast" }
  );
  applyLymphRule(context, protocolRules.lymphRule, pushConclusion, recommendationParts, setRisk);
  applyCombinedRules(context, protocolRules.combinedRules || [], pushConclusion, recommendationParts, setRisk);

  if (!conclusions.length) {
    const fallback = protocolRules.fallbackConclusion || "Значимых изменений по данным УЗИ не выявлено.";
    conclusions.push(fallback);
  }

  const recommendation = buildPatientRecommendation(
    protocolRules,
    maxRiskLevel,
    recommendationParts,
    context,
    protocolId
  );

  const sections = [`Заключение: ${conclusions.join(" ")}`];
  if (recommendation) {
    sections.push(`Рекомендации: ${recommendation}`);
  }

  return sections.join("\n");
}

function collectThyroidContext(blocks, protocolRules) {
  const context = {
    blocks,
    parenchyma: { structure: "", echogenicity: "" },
    vascularity: "",
    location: "",
    acousticAccess: "",
    contours: "",
    isthmus: { thickness: null, state: "" },
    totalVolume: null,
    lesions: [],
    hasLesions: false,
    maxTirads: 0,
    lymphRows: [],
    hasPathologicalLymph: false,
    hasPathologicalQuestionLymph: false,
    hasReactiveQuestionLymph: false,
    allLymphReactive: false,
  };

  const parenchymaBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Структура паренхимы:")
  );
  if (parenchymaBlock?.rows?.[0]) {
    const fields = getFieldValues(parenchymaBlock.rows[0]);
    context.parenchyma.structure = fields[0] || "";
    context.parenchyma.echogenicity = fields[1] || "";
  }

  const vascularityBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Васкуляризация в режиме ЦДК")
  );
  if (vascularityBlock?.rows?.[0]) {
    context.vascularity = getFieldValues(vascularityBlock.rows[0])[0] || "";
  }

  const locationBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Расположение:")
  );
  if (locationBlock?.rows?.[0]) {
    context.location = getFieldValues(locationBlock.rows[0])[0] || "";
  }

  const acousticBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Акустический доступ:")
  );
  if (acousticBlock?.rows?.[0]) {
    context.acousticAccess = getFieldValues(acousticBlock.rows[0])[0] || "";
  }

  const contoursBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Контуры:")
  );
  if (contoursBlock?.rows?.[0]) {
    context.contours = getFieldValues(contoursBlock.rows[0])[0] || "";
  }

  const isthmusBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Перешеек:")
  );
  if (isthmusBlock?.rows?.[0]) {
    const rowText = assembleRow(isthmusBlock.rows[0]);
    context.isthmus.thickness = extractFirstNumber(rowText);
    context.isthmus.state = getFieldValues(isthmusBlock.rows[0])[0] || "";
  }

  const totalVolumeBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("Общий объем:")
  );
  if (totalVolumeBlock?.rows?.[0]) {
    const rowText = assembleRow(totalVolumeBlock.rows[0]);
    context.totalVolume = extractFirstNumber(rowText);
  }

  const lesionBlock = blocks.find((block) => block.title === "Объёмные образования");
  context.lesions = collectLesions(lesionBlock?.rows || []);
  context.hasLesions = context.lesions.length > 0;
  context.maxTirads = context.lesions.reduce((max, item) => Math.max(max, item.tirads || 0), 0);

  context.lymphRows = collectLymphRows(blocks, protocolRules.lymphRule || {});
  const significantLymph = context.lymphRows.filter(({ fields }) => {
    const amount = fields?.[0] || "";
    return amount && !amount.includes((protocolRules.lymphRule || {}).normalAmountToken || "визуально не изменены");
  });
  const statuses = significantLymph.map(({ fields }) => normalizeSpaces((fields?.[4] || "").toLowerCase()));
  context.hasPathologicalLymph = statuses.some((status) =>
    (status.includes("патологический") || lymphoproliferativeTokens.some((token) => token && status.includes(token)))
    && !status.includes("?")
  );
  context.hasPathologicalQuestionLymph = statuses.some((status) => status.includes("патологический?"));
  context.hasReactiveQuestionLymph = statuses.some((status) =>
    (status.includes("реактив") || status.includes("гиперплаз")) && status.includes("?")
  );
  context.allLymphReactive = statuses.length > 0 && statuses.every((status) => status.includes("реактив") || status.includes("гиперплаз"));

  return context;
}

function collectLymphContext(blocks, protocolRules) {
  const context = {
    blocks,
    parenchyma: { structure: "", echogenicity: "" },
    vascularity: "",
    location: "",
    acousticAccess: "",
    contours: "",
    isthmus: { thickness: null, state: "" },
    totalVolume: null,
    lesions: [],
    hasLesions: false,
    maxTirads: 0,
    ducts: "",
    morphotype: "",
    lymphRows: [],
    hasPathologicalLymph: false,
    hasPathologicalQuestionLymph: false,
    hasReactiveQuestionLymph: false,
    allLymphReactive: false,
    hasLymphoproliferativeSuspicion: false,
  };

  context.lymphRows = collectLymphRows(blocks, protocolRules.lymphRule || {});
  const significantLymph = context.lymphRows.filter(({ fields }) => {
    const amount = fields?.[0] || "";
    return amount && !amount.includes((protocolRules.lymphRule || {}).normalAmountToken || "визуально не изменены");
  });

  const statuses = significantLymph.map(({ fields }) => normalizeSpaces((fields?.[4] || "").toLowerCase()));
  const lymphoproliferativeTokens = (protocolRules.lymphRule?.lymphoproliferativeTokens || ["лимфопролифератив"])
    .map((value) => (value || "").toLowerCase());

  context.hasPathologicalLymph = statuses.some((status) =>
    (status.includes("патологический") || lymphoproliferativeTokens.some((token) => token && status.includes(token)))
    && !status.includes("?")
  );
  context.hasPathologicalQuestionLymph = statuses.some((status) => status.includes("патологический?"));
  context.hasReactiveQuestionLymph = statuses.some((status) =>
    (status.includes("реактив") || status.includes("гиперплаз")) && status.includes("?")
  );
  context.allLymphReactive = statuses.length > 0 && statuses.every((status) => status.includes("реактив") || status.includes("гиперплаз"));
  context.hasLymphoproliferativeSuspicion = statuses.some((status) =>
    lymphoproliferativeTokens.some((token) => token && status.includes(token))
  );

  return context;
}

function collectBreastContext(blocks, protocolRules) {
  const context = {
    blocks,
    lesions: [],
    hasLesions: false,
    maxTirads: 0,
    maxBirads: 0,
    morphotype: "",
    operation: "",
    operations: { right: "", left: "" },
    ducts: "",
    ductsBySide: { right: "", left: "" },
    lesionSides: new Set(),
    lesionQuadrants: new Set(),
    lymphRows: [],
    hasPathologicalLymph: false,
    hasPathologicalQuestionLymph: false,
    hasReactiveQuestionLymph: false,
    allLymphReactive: false,
  };

  const morphotypeBlocks = blocks.filter((block) =>
    typeof block.content === "string" && block.content.startsWith("Ультразвуковой морфотип:")
  );
  context.morphotype = morphotypeBlocks
    .map((block) => (block.rows?.[0] ? getFieldValues(block.rows[0])[0] : "") || "")
    .filter(Boolean)
    .join("; ");

  const rightOperationBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("\nПравая молочная железа:")
  );
  const leftOperationBlock = blocks.find((block) =>
    typeof block.content === "string" && block.content.startsWith("\nЛевая молочная железа:")
  );
  context.operations.right = rightOperationBlock?.rows?.[0] ? getFieldValues(rightOperationBlock.rows[0])[0] || "" : "";
  context.operations.left = leftOperationBlock?.rows?.[0] ? getFieldValues(leftOperationBlock.rows[0])[0] || "" : "";
  context.operation = [context.operations.right, context.operations.left].filter(Boolean).join("; ");
  context.hasOperation = Boolean(context.operation);

  const ductsBlocks = blocks.filter((block) =>
    typeof block.content === "string" && block.content.startsWith("Млечные протоки:")
  );
  if (ductsBlocks[0]?.rows?.[0]) {
    context.ductsBySide.right = getFieldValues(ductsBlocks[0].rows[0])[0] || "";
  }
  if (ductsBlocks[1]?.rows?.[0]) {
    context.ductsBySide.left = getFieldValues(ductsBlocks[1].rows[0])[0] || "";
  }
  context.ducts = [context.ductsBySide.right, context.ductsBySide.left].filter(Boolean).join("; ");

  const lesionRows = blocks
    .filter((block) => typeof block.title === "string" && block.title.startsWith("Выявленные образования"))
    .flatMap((block) => {
      const side = block.title.includes("правая") ? "right" : block.title.includes("левая") ? "left" : "";
      return (block.rows || []).map((row) => ({ row, side }));
    });
  context.lesions = collectLesions(lesionRows);
  context.hasLesions = context.lesions.length > 0;
  context.maxBirads = context.lesions.reduce((max, item) => Math.max(max, item.birads || 0), 0);

  context.lesions.forEach((item) => {
    if (item.side) context.lesionSides.add(item.side);
    if (item.quadrant) context.lesionQuadrants.add(item.quadrant);
  });

  context.lymphRows = collectLymphRows(blocks, protocolRules.lymphRule || {});
  const significantLymph = context.lymphRows.filter(({ fields }) => {
    const amount = fields?.[0] || "";
    return amount && !amount.includes((protocolRules.lymphRule || {}).normalAmountToken || "визуально не изменены");
  });

  const statuses = significantLymph.map(({ fields }) => normalizeSpaces((fields?.[4] || "").toLowerCase()));
  context.hasPathologicalLymph = statuses.some((status) => status.includes("патологический") && !status.includes("?"));
  context.hasPathologicalQuestionLymph = statuses.some((status) => status.includes("патологический?"));
  context.hasReactiveQuestionLymph = statuses.some((status) =>
    (status.includes("реактив") || status.includes("гиперплаз")) && status.includes("?")
  );
  context.allLymphReactive = statuses.length > 0 && statuses.every((status) => status.includes("реактив") || status.includes("гиперплаз"));

  return context;
}

function extractFirstNumber(value) {
  const match = (value || "").replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
}

function collectLesions(rows) {
  return rows
    .map((entry) => {
      if (entry?.row) {
        return { fields: getFieldValues(entry.row), sideHint: entry.side || "" };
      }
      return { fields: getFieldValues(entry), sideHint: "" };
    })
    .filter(({ fields }) => fields.length >= 8)
    .map(({ fields, sideHint }) => {
      const isBreastRow = fields.length >= 9 || /BI-RADS/i.test(fields[fields.length - 1] || "");

      if (isBreastRow) {
        const quadrant = normalizeSpaces(fields[0] || "");
        const location = normalizeSpaces(fields[1] || "");
        const contour = normalizeSpaces(fields[2] || "");
        const composition = normalizeSpaces(fields[3] || "");
        const echogenicity = normalizeSpaces(fields[4] || "");
        const orientation = normalizeSpaces(fields[5] || "");
        const vascularity = normalizeSpaces(fields[6] || "");
        const rawType = normalizeSpaces(fields[7] || "");
        const type = normalizeSpaces(rawType.replace(/[()]/g, ""));
        const classification = normalizeSpaces(fields[8] || "");
        const biradsMatch = classification.match(/BI-RADS\s*(\d)/i);
        const birads = biradsMatch ? Number.parseInt(biradsMatch[1], 10) : 0;

        let side = sideHint || "";
        if (!side && location.toLowerCase().includes("левой")) side = "left";
        if (!side && location.toLowerCase().includes("правой")) side = "right";

        return {
          quadrant,
          location: [quadrant, location].filter(Boolean).join(", "),
          sideLabel: side === "left" ? "левой" : side === "right" ? "правой" : "",
          isScarZone: location.toLowerCase().includes("послеоперационного рубца"),
          side,
          contour,
          composition,
          echogenicity,
          orientation,
          vascularity,
          rawType,
          type,
          classification,
          birads,
          tirads: 0,
        };
      }

      const location = normalizeSpaces((fields[0] || "").replace(/^визуализируется\s*/i, ""));
      const contour = normalizeSpaces(fields[1] || "");
      const composition = normalizeSpaces(fields[2] || "");
      const echogenicity = normalizeSpaces(fields[3] || "");
      const orientation = normalizeSpaces(fields[4] || "");
      const vascularity = normalizeSpaces(fields[5] || "");
      const rawType = normalizeSpaces(fields[6] || "");
      const type = normalizeSpaces(
        rawType
          .replace(/[\d\s*.,]+мм/gi, "")
          .replace(/[\d\s*.,]+см/gi, "")
      );
      const classification = normalizeSpaces(fields[7] || "");
      const tiradsMatch = classification.match(/TI-RADS\s*(\d)/i);
      const tirads = tiradsMatch ? Number.parseInt(tiradsMatch[1], 10) : 0;

      return {
        quadrant: "",
        side: "",
        location,
        contour,
        composition,
        echogenicity,
        orientation,
        vascularity,
        rawType,
        type,
        classification,
        tirads,
        birads: 0,
      };
    })
    .filter((item) => item.location && !item.location.includes("не визуализируются"));
}

function applyAiitRule(context, rule, pushConclusion, recommendationParts, setRisk) {
  if (!rule) return;
  const structure = context.parenchyma.structure;
  const echogenicity = context.parenchyma.echogenicity;

  const structureMatch = (rule.structureIncludes || []).some((token) => structure.includes(token));
  const echogenicityMatch = (rule.echogenicityIncludes || []).some((token) => echogenicity.includes(token));

  if (!structureMatch || !echogenicityMatch) return;
  pushConclusion(rule.conclusion);
  if (rule.recommendation) recommendationParts.push(rule.recommendation);
  setRisk(rule.riskLevel || "benign");
}

function applyDiffuseRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  rules.forEach((rule) => {
    if (!rule) return;
    const structure = context.parenchyma.structure;
    const echogenicity = context.parenchyma.echogenicity;
    const vascularity = context.vascularity;

    const structureOk = !rule.structureIncludes || rule.structureIncludes.some((token) => structure.includes(token));
    const echogenicityOk = !rule.echogenicityIncludes || rule.echogenicityIncludes.some((token) => echogenicity.includes(token));
    const vascularityOk = !rule.vascularityIncludes || rule.vascularityIncludes.some((token) => vascularity.includes(token));

    if (!(structureOk && echogenicityOk && vascularityOk)) return;
    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function applyVolumeRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  rules.forEach((rule) => {
    if (!rule) return;
    const volume = context.totalVolume;
    if (volume == null) return;
    const minOk = rule.minVolume == null || volume >= rule.minVolume;
    const maxOk = rule.maxVolume == null || volume <= rule.maxVolume;
    if (!(minOk && maxOk)) return;

    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function applyIsthmusRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  rules.forEach((rule) => {
    if (!rule) return;
    const state = context.isthmus.state;
    const stateOk = !rule.stateIncludes || rule.stateIncludes.some((token) => state.includes(token));
    if (!stateOk) return;
    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function applyTopographyRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  rules.forEach((rule) => {
    if (!rule) return;

    const locationOk = !rule.locationIncludes || rule.locationIncludes.some((token) => context.location.includes(token));
    const accessOk = !rule.acousticAccessIncludes || rule.acousticAccessIncludes.some((token) => context.acousticAccess.includes(token));
    const contourOk = !rule.contoursIncludes || rule.contoursIncludes.some((token) => context.contours.includes(token));

    if (!(locationOk && accessOk && contourOk)) return;
    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function applyDuctRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  const sideLabels = { right: "справа", left: "слева" };

  if (context?.ductsBySide && (context.ductsBySide.right || context.ductsBySide.left)) {
    rules.forEach((rule) => {
      if (!rule) return;
      ["right", "left"].forEach((sideKey) => {
        const ducts = context.ductsBySide[sideKey] || "";
        if (!ducts) return;
        const ductsOk = !rule.ductsIncludes || rule.ductsIncludes.some((token) => ducts.includes(token));
        if (!ductsOk) return;

        const sideConclusion = rule.conclusion?.replace(/\.$/, "") + ` ${sideLabels[sideKey]}.`;
        pushConclusion(sideConclusion);
        if (rule.recommendation) recommendationParts.push(rule.recommendation);
        setRisk(rule.riskLevel || "benign");
      });
    });
    return;
  }

  rules.forEach((rule) => {
    if (!rule) return;
    const ducts = context.ducts || "";
    const ductsOk = !rule.ductsIncludes || rule.ductsIncludes.some((token) => ducts.includes(token));
    if (!ductsOk) return;

    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function applyMorphotypeRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  rules.forEach((rule) => {
    if (!rule) return;
    const morphotype = context.morphotype || "";
    const morphotypeOk = !rule.morphotypeIncludes || rule.morphotypeIncludes.some((token) => morphotype.includes(token));
    const noLesionsOk = !rule.requireNoLesions || !context.hasLesions;
    if (!(morphotypeOk && noLesionsOk)) return;

    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function applyLesionsRule(context, rule, pushConclusion) {
  if (!rule || rule.enabled === false) return;
  if (!context.hasLesions) {
    if (rule.noLesionsConclusion) {
      pushConclusion(rule.noLesionsConclusion);
    }
    return;
  }

  const sourceLesions = context.hasOperation
    ? context.lesions.filter((item) => !item.isScarZone)
    : context.lesions;

  const items = sourceLesions
    .map((item) => {
      const sideText = item.sideLabel ? `${item.sideLabel} молочной железы` : "";
      return [sideText, item.location, item.type, item.classification].filter(Boolean).join(", ");
    })
    .filter(Boolean);

  if (!items.length) return;
  const prefix = rule.conclusionPrefix || "Очаговые образования";
  pushConclusion(`${prefix}: ${items.join("; ")}.`);
}

function applyNoduleRules(context, rules, pushConclusion, recommendationParts, setRisk, options = {}) {
  const { suppressConclusion = false } = options;
  const mainRules = rules.filter((rule) => ["tirads-main", "birads-main"].includes(rule?.group));
  const otherRules = rules.filter((rule) => !["tirads-main", "birads-main"].includes(rule?.group));

  const matchRule = (rule) => {
    const hasTirads = rule.tiradsEquals ? context.lesions.some((item) => item.tirads === rule.tiradsEquals) : true;
    const hasTiradsIn = rule.tiradsIn ? context.lesions.some((item) => rule.tiradsIn.includes(item.tirads)) : true;
    const hasBirads = rule.biradsEquals ? context.lesions.some((item) => item.birads === rule.biradsEquals) : true;
    const hasBiradsIn = rule.biradsIn ? context.lesions.some((item) => rule.biradsIn.includes(item.birads)) : true;
    const hasVertical = rule.requireVertical
      ? context.lesions.some((item) => item.orientation.includes("вертикально"))
      : true;
    const hasIrregularContours = rule.requireIrregularContours
      ? context.lesions.some((item) => item.contour.includes("неров") || item.contour.includes("нечет"))
      : true;
    const hasChaoticFlow = rule.requireChaoticFlow
      ? context.lesions.some((item) => item.vascularity.includes("хаот"))
      : true;
    const hasCystAvascular = rule.requireCystAvascular
      ? context.lesions.some((item) => item.type.includes("киста") && item.vascularity.includes("аваск"))
      : true;
    const hasMacrocalcinate = rule.requireMacrocalcinate
      ? context.lesions.some((item) => item.type.includes("макрокальцинат"))
      : true;

    const orientationOk = !rule.orientationIncludes
      || context.lesions.some((item) => rule.orientationIncludes.some((token) => item.orientation.includes(token)));
    const contoursOk = !rule.contoursIncludes
      || context.lesions.some((item) => rule.contoursIncludes.some((token) => item.contour.includes(token)));
    const vascularityOk = !rule.vascularityIncludes
      || context.lesions.some((item) => rule.vascularityIncludes.some((token) => item.vascularity.includes(token)));
    const tagOk = !rule.tagIncludes
      || context.lesions.some((item) => rule.tagIncludes.some((token) => item.type.includes(token)));
    const minBiradsCountOk = rule.minBiradsCount == null
      || context.lesions.filter((item) => item.birads === rule.biradsEquals).length >= rule.minBiradsCount;
    const quadrantCountOk = rule.requireQuadrantCount == null || (context.lesionQuadrants?.size || 0) >= rule.requireQuadrantCount;
    const bothSidesOk = !rule.requireBothSides || (context.lesionSides?.has("left") && context.lesionSides?.has("right"));

    return hasTirads
      && hasTiradsIn
      && hasBirads
      && hasBiradsIn
      && hasVertical
      && hasIrregularContours
      && hasChaoticFlow
      && hasCystAvascular
      && hasMacrocalcinate
      && orientationOk
      && contoursOk
      && vascularityOk
      && tagOk
      && minBiradsCountOk
      && quadrantCountOk
      && bothSidesOk;
  };

  if (mainRules.length) {
    const matchedMainRules = mainRules.filter((rule) => rule && matchRule(rule));

    if (matchedMainRules.length) {
      const pickScore = (rule) => {
        if (rule.biradsEquals != null) return rule.biradsEquals;
        if (Array.isArray(rule.biradsIn) && rule.biradsIn.length) return Math.max(...rule.biradsIn);
        if (rule.tiradsEquals != null) return rule.tiradsEquals;
        if (Array.isArray(rule.tiradsIn) && rule.tiradsIn.length) return Math.max(...rule.tiradsIn);
        return 0;
      };

      const bestRule = matchedMainRules.sort((a, b) => pickScore(b) - pickScore(a))[0];
      if (!suppressConclusion) {
        pushConclusion(bestRule.conclusion);
      }
      if (bestRule.recommendation) recommendationParts.push(bestRule.recommendation);
      setRisk(bestRule.riskLevel || "benign");
    }
  }

  otherRules.forEach((rule) => {
    if (!rule || !matchRule(rule)) return;
    if (!suppressConclusion) {
      pushConclusion(rule.conclusion);
    }
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "benign");
  });
}

function collectLymphRows(blocks, rule) {
  const result = [];
  const regex = new RegExp(rule.predefinedBlockPattern || "^$", "i");

  blocks
    .filter((block) => block.type === "text" && regex.test(block.content || ""))
    .forEach((block) => {
      const fields = getFieldValues(block.rows[0] || { segments: [] });
      const group = normalizeSpaces((block.content || "").split("{")[0]);
      result.push({ group, fields });
    });

  const additionalBlock = blocks.find((block) => block.title === rule.additionalBlockTitle);
  (additionalBlock?.rows || []).forEach((row) => {
    const fields = getFieldValues(row);
    if (!fields.length || !fields[rule.additionalGroupFieldIndex ?? 0]) return;

    const side = fields[rule.additionalSideFieldIndex ?? 2] || "";
    const group = normalizeSpaces(
      `${fields[rule.additionalGroupFieldIndex ?? 0]}${side ? ` ${side}` : ""}`
    );

    result.push({
      group,
      fields: [
        fields[rule.additionalAmountFieldIndex ?? 1],
        fields[rule.additionalMorphologyFieldIndex ?? 3],
        fields[rule.additionalVascularFieldIndex ?? 4],
        fields[rule.additionalKmdFieldIndex ?? 5],
        fields[rule.additionalStatusFieldIndex ?? 6],
      ],
    });
  });

  return result;
}

function applyLymphRule(context, rule, pushConclusion, recommendationParts, setRisk) {
  if (!rule) return;
  const significantRows = context.lymphRows
    .filter(({ fields }) => fields?.length >= 5)
    .filter(({ fields }) => {
      const amount = fields[rule.amountFieldIndex ?? 0] || "";
      return amount && !amount.includes(rule.normalAmountToken || "визуально не изменены");
    });

  if (!significantRows.length) {
    return;
  }

  const statuses = significantRows.map(({ fields }) =>
    normalizeSpaces((fields[rule.statusFieldIndex ?? 4] || "").toLowerCase())
  );

  const pathologicalToken = rule.pathologicalToken || "патологический";
  const reactiveTokens = rule.reactiveTokens || ["реактив", "гиперплаз"];
  const questionableToken = rule.questionMarkToken || "?";
  const lymphoproliferativeTokens = (rule.lymphoproliferativeTokens || ["лимфопролифератив"])
    .map((token) => (token || "").toLowerCase());

  const hasPathological = statuses.some((status) =>
    status.includes(pathologicalToken)
    || lymphoproliferativeTokens.some((token) => token && status.includes(token))
  );
  const allReactive = statuses.every((status) =>
    reactiveTokens.some((token) => status.includes(token))
  );
  const hasQuestionable = statuses.some((status) => status.includes(questionableToken));
  const hasConglomerate = significantRows.some(({ fields }) =>
    normalizeSpaces(fields[rule.amountFieldIndex ?? 0] || "").includes("конгломерат")
  );
  const hasLymphoproliferative = statuses.some((status) =>
    lymphoproliferativeTokens.some((token) => token && status.includes(token))
  );

  if (hasLymphoproliferative && rule.lymphoproliferativeConclusion) {
    pushConclusion(rule.lymphoproliferativeConclusion);
    if (rule.lymphoproliferativeRecommendation) recommendationParts.push(rule.lymphoproliferativeRecommendation);
    setRisk(rule.lymphoproliferativeRiskLevel || "high");
  }

  if (!hasPathological && allReactive && !hasQuestionable && rule.reactiveConclusion) {
    pushConclusion(rule.reactiveConclusion);
    if (rule.reactiveRecommendation) recommendationParts.push(rule.reactiveRecommendation);
    setRisk(rule.reactiveRiskLevel || "benign");
    return;
  }

  if (!hasPathological && allReactive && hasQuestionable && rule.reactiveProbableConclusion) {
    pushConclusion(rule.reactiveProbableConclusion);
    if (rule.reactiveProbableRecommendation) recommendationParts.push(rule.reactiveProbableRecommendation);
    setRisk(rule.reactiveProbableRiskLevel || "moderate");
    return;
  }

  const details = significantRows
    .filter(({ fields }) => {
      const status = normalizeSpaces((fields[rule.statusFieldIndex ?? 4] || "").toLowerCase());
      return status.includes(pathologicalToken)
        || lymphoproliferativeTokens.some((token) => token && status.includes(token));
    })
    .map(({ group, fields }) => {
      const amount = normalizeSpaces(fields[rule.amountFieldIndex ?? 0] || "");
      const status = normalizeSpaces(fields[rule.statusFieldIndex ?? 4] || "");
      return `${amount} ${group} (${status})`;
    })
    .filter(Boolean);

  const reactiveDetails = significantRows
    .filter(({ fields }) => {
      const status = normalizeSpaces((fields[rule.statusFieldIndex ?? 4] || "").toLowerCase());
      return reactiveTokens.some((token) => status.includes(token));
    })
    .map(({ group, fields }) => {
      const amount = normalizeSpaces(fields[rule.amountFieldIndex ?? 0] || "");
      const status = normalizeSpaces(fields[rule.statusFieldIndex ?? 4] || "");
      return `${amount} ${group} (${status})`;
    })
    .filter(Boolean);

  if (hasConglomerate && rule.conglomerateConclusion) {
    pushConclusion(rule.conglomerateConclusion);
  }

  if (!details.length) {
    if (rule.pathologicalFallbackConclusion) {
      pushConclusion(rule.pathologicalFallbackConclusion);
      if (rule.pathologicalRecommendation) recommendationParts.push(rule.pathologicalRecommendation);
      setRisk(rule.pathologicalRiskLevel || "high");
    }
    if (reactiveDetails.length) {
      const reactivePrefix = rule.reactiveAdditionalPrefix || "Также реактивно измененные лимфоузлы";
      pushConclusion(`${reactivePrefix}: ${reactiveDetails.join("; ")}.`);
    }
    return;
  }

  const prefix = rule.pathologicalDetailedPrefix || "Патологически изменённые л/у шеи";
  pushConclusion(`${prefix}: ${details.join("; ")}.`);

  if (reactiveDetails.length) {
    const reactivePrefix = rule.reactiveAdditionalPrefix || "Также реактивно измененные лимфоузлы";
    pushConclusion(`${reactivePrefix}: ${reactiveDetails.join("; ")}.`);
  }

  if (rule.pathologicalRecommendation) recommendationParts.push(rule.pathologicalRecommendation);
  setRisk(rule.pathologicalRiskLevel || "high");
}

function applyCombinedRules(context, rules, pushConclusion, recommendationParts, setRisk) {
  rules.forEach((rule) => {
    if (!rule) return;

    const aiitMatch =
      !rule.requireAiit ||
      ((rule.aiitStructureIncludes || []).some((token) => (context.parenchyma?.structure || "").includes(token)) &&
        (rule.aiitEchogenicityIncludes || []).some((token) => (context.parenchyma?.echogenicity || "").includes(token)));

    const tiradsMatch = !rule.requireTiradsIn || context.lesions.some((item) => rule.requireTiradsIn.includes(item.tirads));
    const biradsMatch = !rule.requireBiradsIn || context.lesions.some((item) => rule.requireBiradsIn.includes(item.birads));
    const noPathologicalLymphMatch = !rule.requireNoPathologicalLymph || !context.hasPathologicalLymph;
    const pathologicalLymphMatch = !rule.requirePathologicalLymph || context.hasPathologicalLymph || context.hasPathologicalQuestionLymph;
    const pathologicalOrQuestionLymphMatch = !rule.requirePathologicalOrQuestionLymph
      || context.hasPathologicalLymph
      || context.hasPathologicalQuestionLymph;
    const reactiveLymphMatch = !rule.requireReactiveLymph || context.allLymphReactive;
    const lymphoproliferativeMatch = !rule.requireLymphoproliferative || context.hasLymphoproliferativeSuspicion;

    const significantLymphRows = (context.lymphRows || []).filter((row) => {
      const amount = row?.fields?.[0] || "";
      return amount && !amount.includes("визуально не изменены");
    });
    const noLesionsMatch = !rule.requireNoLesions || !context.hasLesions;
    const singleLesionMatch = !rule.requireSingleLesion || context.lesions.length === 1;
    const minLesionsCountMatch = rule.minLesionsCount == null || context.lesions.length >= rule.minLesionsCount;
    const bothSidesMatch = !rule.requireBothSides || (context.lesionSides?.has("left") && context.lesionSides?.has("right"));
    const orientationMatch = !rule.requireOrientationIncludes
      || context.lesions.some((item) => rule.requireOrientationIncludes.some((token) => item.orientation.includes(token)));
    const echogenicityMatch = !rule.requireEchogenicityIncludes
      || context.lesions.some((item) => rule.requireEchogenicityIncludes.some((token) => item.echogenicity.includes(token)));
    const vascularityMatch = !rule.requireVascularityIncludes
      || context.lesions.some((item) => rule.requireVascularityIncludes.some((token) => item.vascularity.includes(token)));
    const tagMatch = !rule.requireTagIncludes
      || context.lesions.some((item) => rule.requireTagIncludes.some((token) => item.type.includes(token)));
    const morphotypeMatch = !rule.requireMorphotypeIncludes
      || rule.requireMorphotypeIncludes.some((token) => (context.morphotype || "").includes(token));
    const operationMatch = !rule.requireOperationIncludes
      || rule.requireOperationIncludes.some((token) => (context.operation || "").includes(token));
    const lesionLocationMatch = !rule.requireLesionLocationIncludes
      || context.lesions.some((item) =>
        rule.requireLesionLocationIncludes.every((token) => (item.location || "").includes(token))
      );
    const ductsExpandedMatch = !rule.requireDuctsExpanded || (context.ducts || "").includes("расширены");
    const onlyAxillaryLymphMatch = !rule.requireOnlyAxillaryLymph
      || significantLymphRows.every((row) => row.group.toLowerCase().includes("подмышеч"));
    const lymphSideMatch = !rule.requireLymphSides
      || rule.requireLymphSides.every((token) =>
        significantLymphRows.some((row) => row.group.toLowerCase().includes(token.toLowerCase()))
      );
    const lymphGroupMatch = !rule.requireLymphGroupIn
      || rule.requireLymphGroupIn.every((token) =>
        significantLymphRows.some((row) => row.group.toLowerCase().includes(token.toLowerCase()))
      );

    if (!(
      aiitMatch
      && tiradsMatch
      && biradsMatch
      && noPathologicalLymphMatch
      && pathologicalLymphMatch
      && pathologicalOrQuestionLymphMatch
      && reactiveLymphMatch
      && lymphoproliferativeMatch
      && noLesionsMatch
      && singleLesionMatch
      && minLesionsCountMatch
      && bothSidesMatch
      && orientationMatch
      && echogenicityMatch
      && vascularityMatch
      && tagMatch
      && morphotypeMatch
      && operationMatch
      && lesionLocationMatch
      && ductsExpandedMatch
      && onlyAxillaryLymphMatch
      && lymphSideMatch
      && lymphGroupMatch
    )) {
      return;
    }

    pushConclusion(rule.conclusion);
    if (rule.recommendation) recommendationParts.push(rule.recommendation);
    setRisk(rule.riskLevel || "moderate");
  });
}

function buildPatientRecommendation(protocolRules, riskLevel, recommendationParts, context = {}, protocolId = "") {
  const templates = protocolRules.recommendationTemplates || {};
  const followUpMonthsByRisk = protocolRules.followUpMonthsByRisk || { benign: 12, moderate: 6, high: 3 };

  const followUpMonths = followUpMonthsByRisk[riskLevel] || 12;
  const isOncoRisk = riskLevel === "moderate" || riskLevel === "high";

  if (protocolId === "breast" && context?.hasOperation) {
    const followUpText = (templates.followUpPrefix || "Контрольное УЗИ") + ` через ${followUpMonths} мес.`;
    return `Наблюдение у онколога (онкомаммолога). ${followUpText}`;
  }

  const hasUrgentRecommendation = recommendationParts.some((value) =>
    (value || "").toLowerCase().includes("сроч")
  );

  const uniqueParts = recommendationParts
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (hasUrgentRecommendation && normalized.includes("консультация онколога") && !normalized.includes("сроч")) {
        return false;
      }
      if (isOncoRisk && normalized.includes("консультация онколога") && !normalized.includes("сроч")) {
        return false;
      }
      if (!isOncoRisk && normalized.includes("консультация эндокринолога")) {
        return false;
      }
      return true;
    });

  if (riskLevel === "high") {
    if (!hasUrgentRecommendation) {
      uniqueParts.unshift(
        templates.highRisk ||
          "Консультация онколога, решение вопроса о проведении тонкоигольной аспирационной биопсии (ТАБ)."
      );
    }
  } else if (riskLevel === "moderate") {
    uniqueParts.unshift(
      templates.moderateRisk ||
        "Консультация онколога, решение вопроса о проведении тонкоигольной аспирационной биопсии (ТАБ)."
    );
  } else {
    uniqueParts.unshift(
      templates.benignRisk ||
        "Консультация эндокринолога и дообследование: ТТГ, свободный Т4, антитела к тиреопероксидазе (АТ к ТПО)."
    );
  }

  const followUpText = (templates.followUpPrefix || "Контрольное УЗИ") + ` через ${followUpMonths} мес.`;
  uniqueParts.push(followUpText);

  return uniqueParts.filter(Boolean).join(" ");
}

function renderField(segment, onChange) {
  const wrapper = document.createElement("span");
  wrapper.className = "field";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "field-select-input";

  const optionsList = document.createElement("div");
  optionsList.className = "field-options";

  segment.options.forEach((option, index) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "field-option";
    optionButton.textContent = option.raw || "—";
    optionButton.addEventListener("click", () => {
      segment.selectedOptionIndex = index;
      renderExtras();
      hideOptions();
    });
    optionsList.appendChild(optionButton);
  });

  const extras = document.createElement("span");
  extras.className = "field-extras";

  const renderExtras = () => {
    extras.innerHTML = "";
    const option = segment.options[segment.selectedOptionIndex];
    if (!option) return;

    const updateSegmentValue = () => {
      segment.value = assembleOption(option);
      onChange();
    };

    input.value = option.raw || "";
    autoSizeInput(input);

    option.tokens.forEach((token) => {
      if (token.type === "input") {
        const input = document.createElement("input");
        input.type = token.inputType;
        input.value = option.inputValues[token.inputIndex] ?? "";
        input.placeholder = token.placeholder;
        input.className = "field-input field-input--compact";
        if (token.inputType === "number") {
          input.inputMode = "decimal";
          input.step = "any";
        }
        if (token.inputType === "date") {
          input.classList.add("field-input--date");
        }
        autoSizeInput(input);
        input.addEventListener("input", (event) => {
          option.inputValues[token.inputIndex] = event.target.value;
          autoSizeInput(input);
          updateSegmentValue();
          updateCalcOutputs();
        });
        extras.appendChild(input);
        return;
      }

      if (token.type === "calc") {
        const output = document.createElement("span");
        output.className = "calc-output";
        output.textContent = computeCalcValue(token, option.inputValues);
        extras.appendChild(output);
      }
    });

    updateSegmentValue();
    updateCalcOutputs();
  };

  const updateCalcOutputs = () => {
    const option = segment.options[segment.selectedOptionIndex];
    if (!option) return;

    const calcTokens = option.tokens.filter((token) => token.type === "calc");
    const outputs = extras.querySelectorAll(".calc-output");

    calcTokens.forEach((token, index) => {
      const calcValue = computeCalcValue(token, option.inputValues);
      if (outputs[index]) {
        outputs[index].textContent = calcValue;
      }
    });
  };

  const syncCustomValue = () => {
    input.value = segment.value || "";
    autoSizeInput(input);
  };

  const showOptions = () => {
    optionsList.style.display = "flex";
  };

  const hideOptions = () => {
    optionsList.style.display = "none";
  };

  input.addEventListener("input", () => {
    const value = input.value;
    const matchIndex = segment.options.findIndex((option) => option.raw === value);
    if (matchIndex >= 0) {
      segment.selectedOptionIndex = matchIndex;
      renderExtras();
    } else {
      segment.selectedOptionIndex = -1;
      extras.innerHTML = "";
      segment.value = value;
      onChange();
    }
    autoSizeInput(input);
    showOptions();
  });

  input.addEventListener("focus", () => {
    showOptions();
  });

  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (!optionsList.contains(document.activeElement)) {
        hideOptions();
      }
    }, 120);
  });

  if (segment.selectedOptionIndex >= 0) {
    renderExtras();
  } else {
    syncCustomValue();
  }

  wrapper.appendChild(input);
  wrapper.appendChild(optionsList);
  wrapper.appendChild(extras);
  return wrapper;
}

function renderInlineSegment(segment, onChange) {
  const wrapper = document.createElement("span");
  wrapper.className = "inline-field";

  const updateSegmentValue = () => {
    onChange();
  };

  const updateCalcOutputs = () => {
    const calcTokens = segment.tokens.filter((token) => token.type === "calc");
    const outputs = wrapper.querySelectorAll(".calc-output");

    calcTokens.forEach((token, index) => {
      const calcValue = computeCalcValue(token, segment.inputValues);
      if (outputs[index]) {
        outputs[index].textContent = calcValue;
      }
    });
  };

  segment.tokens.forEach((token) => {
    if (token.type === "text") {
      if (!token.value.trim()) {
        wrapper.appendChild(document.createTextNode(token.value));
        return;
      }
      const span = document.createElement("span");
      span.className = "text-segment";
      span.textContent = token.value;
      wrapper.appendChild(span);
      return;
    }

    if (token.type === "input") {
      const input = document.createElement("input");
      input.type = token.inputType;
      input.value = segment.inputValues[token.inputIndex] ?? "";
      input.placeholder = token.placeholder;
      input.className = "field-input field-input--compact";
      if (token.inputType === "number") {
        input.inputMode = "decimal";
        input.step = "any";
      }
      if (token.inputType === "date") {
        input.classList.add("field-input--date");
      }
      autoSizeInput(input);
      input.addEventListener("input", (event) => {
        segment.inputValues[token.inputIndex] = event.target.value;
        autoSizeInput(input);
        updateSegmentValue();
        updateCalcOutputs();
      });
      wrapper.appendChild(input);
      return;
    }

    if (token.type === "calc") {
      const output = document.createElement("span");
      output.className = "calc-output";
      output.textContent = computeCalcValue(token, segment.inputValues);
      wrapper.appendChild(output);
    }
  });

  updateCalcOutputs();
  return wrapper;
}

function renderRow(row, onChange) {
  const rowEl = document.createElement("div");
  rowEl.className = "form-row";

  row.segments.forEach((segment) => {
    if (segment.type === "text") {
      if (!segment.value.trim()) {
        rowEl.appendChild(document.createTextNode(segment.value));
        return;
      }
      const span = document.createElement("span");
      span.className = "text-segment";
      span.textContent = segment.value;
      rowEl.appendChild(span);
      return;
    }

    if (segment.type === "inline") {
      rowEl.appendChild(renderInlineSegment(segment, onChange));
      return;
    }

    rowEl.appendChild(renderField(segment, onChange));
  });

  return rowEl;
}

function renderBlocks(blocks) {
  formContainer.innerHTML = "";

  blocks.forEach((block) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-block";

    if (block.title) {
      const title = document.createElement("h2");
      title.className = "form-title";
      title.textContent = block.title;
      wrapper.appendChild(title);
    }

    const rowsContainer = document.createElement("div");
    rowsContainer.className = "rows";
    wrapper.appendChild(rowsContainer);

    const renderRows = () => {
      rowsContainer.innerHTML = "";
      block.rows.forEach((row, index) => {
        const rowEl = renderRow(row, updateOutput);
        rowsContainer.appendChild(rowEl);

        if (block.type === "repeat") {
          const controls = document.createElement("div");
          controls.className = "repeat-controls";
          if (block.rows.length > 1) {
            const removeButton = document.createElement("button");
            removeButton.className = "secondary";
            removeButton.textContent = "Удалить строку";
            removeButton.addEventListener("click", () => {
              block.rows.splice(index, 1);
              renderRows();
              updateOutput();
            });
            controls.appendChild(removeButton);
          }
          rowEl.appendChild(controls);
        }
      });
    };

    renderRows();

    if (block.type === "repeat") {
      const addButton = document.createElement("button");
      addButton.textContent = "Добавить строку";
      addButton.addEventListener("click", () => {
        block.rows.push(createRow(block.content));
        renderRows();
        updateOutput();
      });
      wrapper.appendChild(addButton);
    }

    formContainer.appendChild(wrapper);
  });
}

function applyTemplate(template) {
  currentBlocks = normalizeBlocks(template).map((block) => ({
    ...block,
    rows: [createRow(block.content)],
  }));

  renderBlocks(currentBlocks);
  updateOutput();
}

function getCurrentProtocol() {
  return protocols.find((item) => item.id === protocolSelect.value);
}

function getLocalTemplateKey(protocolId) {
  return `${localTemplatePrefix}${protocolId}`;
}

function readLocalTemplate(protocolId) {
  const raw = localStorage.getItem(getLocalTemplateKey(protocolId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    localStorage.removeItem(getLocalTemplateKey(protocolId));
    return null;
  }
}

function writeLocalTemplate(protocolId, text) {
  localStorage.setItem(getLocalTemplateKey(protocolId), text);
}

function clearLocalTemplate(protocolId) {
  localStorage.removeItem(getLocalTemplateKey(protocolId));
}

async function handleProtocolChange() {
  loadStatus.textContent = "Загрузка...";
  const template = await loadTemplate(protocolSelect.value);
  applyTemplate(template);
  loadStatus.textContent = "Готово";
}

protocolSelect.addEventListener("change", handleProtocolChange);

populateProtocolOptions();
(async () => {
  await loadConclusionRules();
  await handleProtocolChange();
})();

function resizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function autoSizeInput(input) {
  if (window.matchMedia("(max-width: 768px)").matches) {
    input.style.width = "";
    return;
  }
  const text = input.value || input.placeholder || "0";
  const extraPadding = getTextWidth(input, "0000");
  const width = getTextWidth(input, text) + extraPadding + 24;
  input.style.width = `${width}px`;
}

function getTextWidth(el, text) {
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return text.length * 8;
  const style = getComputedStyle(el);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

function copyProtocol() {
  const text = protocolOutput.value.trim();
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    return;
  }
  protocolOutput.focus();
  protocolOutput.select();
  document.execCommand("copy");
}

function shareProtocol(platform) {
  const text = protocolOutput.value.trim();
  if (!text) return;
  const encoded = encodeURIComponent(text);
  const targets = {
    telegram: {
      app: `tg://msg?text=${encoded}`,
      web: `https://t.me/share/url?text=${encoded}`,
    },
    max: {
      app: `max://share?text=${encoded}`,
      web: `https://max.ru/share?text=${encoded}`,
    },
  };

  const target = targets[platform];
  if (!target) return;

  if (platform === "max") {
    window.location.href = target.app;
    window.setTimeout(() => {
      window.location.href = target.web;
    }, 500);
    return;
  }

  if (platform === "telegram") {
    window.location.href = target.app;
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches("[data-copy]")) {
    copyProtocol();
  }
  if (target.matches("[data-share]")) {
    shareProtocol(target.dataset.share);
  }
  if (target.matches("[data-template-action]")) {
    handleTemplateAction(target.dataset.templateAction);
  }
});

protocolOutput.addEventListener("input", () => resizeTextarea(protocolOutput));

async function handleTemplateAction(action) {
  const protocol = getCurrentProtocol();
  if (!protocol) return;

  if (action === "refresh") {
    loadStatus.textContent = "Обновление...";
    clearLocalTemplate(protocol.id);
    templateCache.delete(protocol.file);
    await loadConclusionRules();
    const template = await loadTemplate(protocol.id, { bustCache: true });
    applyTemplate(template);
    loadStatus.textContent = "Готово";
    return;
  }

  if (action === "edit") {
    openTemplateEditor();
    return;
  }

  if (action === "download") {
    const url = `${protocol.file}?v=${Date.now()}`;
    const response = await fetch(url);
    const text = await response.text();
    const blob = new Blob([text], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = protocol.file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }
}

function setEditorStatus(message, isError = false) {
  if (!editorStatus) return;
  editorStatus.textContent = message;
  editorStatus.style.color = isError ? "#b3261e" : "#0061a8";
}

function showEditor() {
  if (!editorModal) return;
  editorModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function hideEditor() {
  if (!editorModal) return;
  editorModal.hidden = true;
  document.body.style.overflow = "";
  setEditorStatus("");
}

function setEditorContent(text, label) {
  if (editorTextarea) {
    editorTextarea.value = text;
  }
  editorTemplateLabel = label || "";
  if (editorFileLabel) {
    editorFileLabel.textContent = editorTemplateLabel
      ? `Шаблон: ${editorTemplateLabel}`
      : "Шаблон из памяти браузера";
  }
  setEditorStatus("");
}

async function openTemplateEditor() {
  const protocol = getCurrentProtocol();
  if (!protocol) return;

  const cached = templateCache.get(protocol.file) ?? (await loadTemplate(protocol.id));
  if (!cached) {
    setEditorStatus("Шаблон не найден.", true);
    return;
  }
  const text = JSON.stringify(cached, null, 2);
  setEditorContent(text, protocol.name);
  setEditorStatus("Правки сохраняются в память браузера.");
  showEditor();
}

function applyEditorTemplate() {
  const protocol = getCurrentProtocol();
  if (!protocol) return;
  const text = editorTextarea?.value ?? "";
  if (!text.trim()) {
    setEditorStatus("Файл пустой.", true);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    setEditorStatus("Ошибка JSON: проверьте формат файла.", true);
    return;
  }

  if (!parsed || !Array.isArray(parsed.blocks)) {
    setEditorStatus("Файл не содержит корректный шаблон.", true);
    return;
  }

  templateCache.set(protocol.file, parsed);
  writeLocalTemplate(protocol.id, text);
  applyTemplate(parsed);
  loadStatus.textContent = "Локальные правки применены";
  setEditorStatus("Шаблон применён.");
}

async function saveEditorTemplate() {
  const protocol = getCurrentProtocol();
  if (!protocol) return;
  const text = editorTextarea?.value ?? "";
  if (!text.trim()) {
    setEditorStatus("Нечего сохранять: файл пустой.", true);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    setEditorStatus("Ошибка JSON: проверьте формат файла.", true);
    return;
  }

  if (!parsed || !Array.isArray(parsed.blocks)) {
    setEditorStatus("Файл не содержит корректный шаблон.", true);
    return;
  }

  templateCache.set(protocol.file, parsed);
  writeLocalTemplate(protocol.id, text);
  setEditorStatus("Сохранено в памяти браузера.");
  loadStatus.textContent = "Локальные правки сохранены";
}

editorCloseButtons.forEach((button) => {
  button.addEventListener("click", () => hideEditor());
});

if (editorApplyButton) {
  editorApplyButton.addEventListener("click", () => applyEditorTemplate());
}

if (editorSaveButton) {
  editorSaveButton.addEventListener("click", () => saveEditorTemplate());
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editorModal && !editorModal.hidden) {
    hideEditor();
  }
});
