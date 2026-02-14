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
  const recommendations = [];

  applyAiitRule(blocks, protocolRules.aiitRule, conclusions, recommendations);
  applyLesionsRule(blocks, protocolRules.lesionsRule, conclusions);
  applyLymphRule(blocks, protocolRules.lymphRule, conclusions);

  if (!conclusions.length && !recommendations.length) {
    return "";
  }

  const sections = [`Заключение: ${conclusions.join(" ")}`];
  if (recommendations.length) {
    sections.push(`Рекомендации: ${recommendations.join(" ")}`);
  }

  return sections.join("\n");
}

function getBlockByRule(blocks, rule = {}) {
  if (!rule) return null;
  if (rule.blockTitle) {
    return blocks.find((block) => block.title === rule.blockTitle) || null;
  }
  if (rule.blockStartsWith) {
    return (
      blocks.find((block) =>
        typeof block.content === "string" && block.content.startsWith(rule.blockStartsWith)
      ) || null
    );
  }
  return null;
}

function applyAiitRule(blocks, rule, conclusions, recommendations) {
  if (!rule) return;
  const block = getBlockByRule(blocks, rule);
  if (!block?.rows?.[0]) return;

  const fields = getFieldValues(block.rows[0]);
  const structure = fields[rule.structureFieldIndex ?? 0] || "";
  const echogenicity = fields[rule.echogenicityFieldIndex ?? 1] || "";

  const structureMatch = (rule.structureIncludes || []).some((token) =>
    structure.includes(token)
  );
  const echogenicityMatch = (rule.echogenicityIncludes || []).some((token) =>
    echogenicity.includes(token)
  );

  if (!structureMatch || !echogenicityMatch) return;
  if (rule.conclusion) conclusions.push(rule.conclusion);
  if (rule.recommendation) recommendations.push(rule.recommendation);
}

function applyLesionsRule(blocks, rule, conclusions) {
  if (!rule) return;
  const block = getBlockByRule(blocks, rule);
  if (!block?.rows?.length) return;

  const items = block.rows
    .map((row) => getFieldValues(row))
    .filter((fields) => fields.length > (rule.typeFieldIndex ?? 0))
    .filter((fields) => {
      const location = fields[rule.locationFieldIndex ?? 0] || "";
      return location && !location.includes(rule.skipIfLocationIncludes || "__never__");
    })
    .map((fields) => {
      const locationRaw = fields[rule.locationFieldIndex ?? 0] || "";
      const typeRaw = fields[rule.typeFieldIndex ?? 0] || "";
      const classRaw = fields[rule.classificationFieldIndex ?? 0] || "";

      const location = normalizeSpaces(
        rule.locationPrefixToRemove
          ? locationRaw.replace(new RegExp(`^${rule.locationPrefixToRemove}\\s*`, "i"), "")
          : locationRaw
      );

      const type = normalizeSpaces(
        (rule.typeCleanupPatterns || []).reduce((acc, pattern) => acc.replace(new RegExp(pattern, "gi"), ""), typeRaw)
      );

      const classification = normalizeSpaces(classRaw);
      return [location, type, classification].filter(Boolean).join(", ");
    })
    .filter(Boolean);

  if (!items.length) return;
  const prefix = rule.conclusionPrefix || "Очаговые образования";
  conclusions.push(`${prefix}: ${items.join("; ")}.`);
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

function applyLymphRule(blocks, rule, conclusions) {
  if (!rule) return;
  const lymphRows = collectLymphRows(blocks, rule);
  const significantRows = lymphRows
    .filter(({ fields }) => fields?.length >= 5)
    .filter(({ fields }) => {
      const amount = fields[rule.amountFieldIndex ?? 0] || "";
      return amount && !amount.includes(rule.normalAmountToken || "визуально не изменены");
    });

  if (!significantRows.length) return;

  const statuses = significantRows.map(({ fields }) =>
    normalizeSpaces((fields[rule.statusFieldIndex ?? 4] || "").toLowerCase())
  );

  const pathologicalToken = rule.pathologicalToken || "патологический";
  const reactiveTokens = rule.reactiveTokens || ["реактив", "гиперплаз"];
  const questionableToken = rule.questionMarkToken || "?";

  const hasPathological = statuses.some((status) => status.includes(pathologicalToken));
  const allReactive = statuses.every((status) =>
    reactiveTokens.some((token) => status.includes(token))
  );
  const hasQuestionable = statuses.some((status) => status.includes(questionableToken));

  if (!hasPathological && allReactive && !hasQuestionable && rule.reactiveConclusion) {
    conclusions.push(rule.reactiveConclusion);
    return;
  }

  if (!hasPathological && allReactive && hasQuestionable && rule.reactiveProbableConclusion) {
    conclusions.push(rule.reactiveProbableConclusion);
    return;
  }

  const details = significantRows
    .filter(({ fields }) =>
      normalizeSpaces((fields[rule.statusFieldIndex ?? 4] || "").toLowerCase()).includes(pathologicalToken)
    )
    .map(({ group, fields }) => {
      const amount = normalizeSpaces(fields[rule.amountFieldIndex ?? 0] || "");
      const status = normalizeSpaces(fields[rule.statusFieldIndex ?? 4] || "");
      return `${amount} ${group} (${status})`;
    })
    .filter(Boolean);

  if (!details.length) {
    if (rule.pathologicalFallbackConclusion) {
      conclusions.push(rule.pathologicalFallbackConclusion);
    }
    return;
  }

  const prefix = rule.pathologicalDetailedPrefix || "Патологически изменённые л/у шеи";
  conclusions.push(`${prefix}: ${details.join("; ")}.`);
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
