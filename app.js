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
];

const protocolSelect = document.getElementById("protocolSelect");
const formContainer = document.getElementById("formContainer");
const protocolOutput = document.getElementById("protocolOutput");
const loadStatus = document.getElementById("loadStatus");

const templateCache = new Map();
let currentBlocks = [];
const textMeasureCanvas = document.createElement("canvas");

function populateProtocolOptions() {
  protocols.forEach((protocol) => {
    const option = document.createElement("option");
    option.value = protocol.id;
    option.textContent = protocol.name;
    protocolSelect.appendChild(option);
  });
}

async function loadTemplate(protocolId) {
  const protocol = protocols.find((item) => item.id === protocolId);
  if (!protocol) return null;
  if (templateCache.has(protocol.file)) {
    return templateCache.get(protocol.file);
  }
  const response = await fetch(protocol.file);
  const data = await response.json();
  templateCache.set(protocol.file, data);
  return data;
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

  const parseOptionTokens = (rawOption) => {
    const tokens = [];
    const placeholderRegex = /__|<[^>]+>/g;
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
      } else if (tokenValue.startsWith("<")) {
        const inner = tokenValue.slice(1, -1).trim();
        const normalized = inner.toLowerCase().replace(/\s+/g, " ");
        const normalizedNumeric = normalized.replace(",", ".");

        if (normalized.includes("дд.мм.гггг")) {
          tokens.push({
            type: "input",
            inputType: "date",
            inputIndex: inputIndex++,
            placeholder: "дд.мм.гггг",
          });
        } else if (normalized.includes("число")) {
          tokens.push({
            type: "input",
            inputType: "number",
            inputIndex: inputIndex++,
            placeholder: "число",
          });
        } else if (
          normalizedNumeric.includes("0.52") ||
          normalized.includes("0,52") ||
          normalized.includes("объем") ||
          normalized.includes("объём") ||
          normalized.includes("эллип")
        ) {
          tokens.push({
            type: "calc",
            formula: "ellipse",
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
    const placeholderRegex = /__|<[^>]+>/g;
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
      } else if (tokenValue.startsWith("<")) {
        const inner = tokenValue.slice(1, -1).trim();
        const normalized = inner.toLowerCase().replace(/\s+/g, " ");
        const normalizedNumeric = normalized.replace(",", ".");

        if (normalized.includes("дд.мм.гггг")) {
          tokens.push({
            type: "input",
            inputType: "date",
            inputIndex: inputIndex++,
            placeholder: "дд.мм.гггг",
          });
        } else if (normalized.includes("число")) {
          tokens.push({
            type: "input",
            inputType: "number",
            inputIndex: inputIndex++,
            placeholder: "число",
          });
        } else if (
          normalizedNumeric.includes("0.52") ||
          normalized.includes("0,52") ||
          normalized.includes("объем") ||
          normalized.includes("объём") ||
          normalized.includes("эллип")
        ) {
          tokens.push({
            type: "calc",
            formula: "ellipse",
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

function computeEllipseVolume(values) {
  if (values.length < 3) return "";
  const [a, b, c] = values.map((item) => Number.parseFloat(item));
  if ([a, b, c].some((item) => Number.isNaN(item))) return "";
  const volume = (a * b * c * 0.52) / 1000;
  return volume.toFixed(2);
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
        return computeEllipseVolume(option.inputValues);
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
        return computeEllipseVolume(segment.inputValues);
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

  protocolOutput.value = text.trim();
  resizeTextarea(protocolOutput);
}

function renderField(segment, onChange) {
  const wrapper = document.createElement("span");
  wrapper.className = "field";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "field-select-input";

  const datalist = document.createElement("datalist");
  datalist.id = `field-options-${Math.random().toString(16).slice(2)}`;
  input.setAttribute("list", datalist.id);

  segment.options.forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option.raw || "—";
    datalist.appendChild(optionEl);
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
        output.textContent = computeEllipseVolume(option.inputValues);
        extras.appendChild(output);
      }
    });

    updateSegmentValue();
  };

  const updateCalcOutputs = () => {
    const option = segment.options[segment.selectedOptionIndex];
    if (!option) return;
    extras.querySelectorAll(".calc-output").forEach((el) => {
      el.textContent = computeEllipseVolume(option.inputValues);
    });
  };

  const syncCustomValue = () => {
    input.value = segment.value || "";
    autoSizeInput(input);
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
  });

  if (segment.selectedOptionIndex >= 0) {
    renderExtras();
  } else {
    syncCustomValue();
  }

  wrapper.appendChild(input);
  wrapper.appendChild(datalist);
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
    wrapper.querySelectorAll(".calc-output").forEach((el) => {
      el.textContent = computeEllipseVolume(segment.inputValues);
    });
  };

  segment.tokens.forEach((token) => {
    if (token.type === "text") {
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
      output.textContent = computeEllipseVolume(segment.inputValues);
      wrapper.appendChild(output);
    }
  });

  return wrapper;
}

function renderRow(row, onChange) {
  const rowEl = document.createElement("div");
  rowEl.className = "form-row";

  row.segments.forEach((segment) => {
    if (segment.type === "text") {
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

async function handleProtocolChange() {
  loadStatus.textContent = "Загрузка...";
  const template = await loadTemplate(protocolSelect.value);
  currentBlocks = normalizeBlocks(template).map((block) => ({
    ...block,
    rows: [createRow(block.content)],
  }));

  renderBlocks(currentBlocks);
  updateOutput();
  loadStatus.textContent = "Готово";
}

protocolSelect.addEventListener("change", handleProtocolChange);

populateProtocolOptions();
handleProtocolChange();

function resizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function autoSizeInput(input) {
  const text = input.value || input.placeholder || "0";
  const extraPadding = getTextWidth(input, "0000");
  const width = Math.max(getTextWidth(input, text) + extraPadding + 24, 70);
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
  if (platform === "max" && navigator.share) {
    navigator.share({ text }).catch(() => {});
    return;
  }
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

  const fallbackTimeout = window.setTimeout(() => {
    window.open(target.web, "_blank", "noopener,noreferrer");
  }, 700);

  window.addEventListener(
    "pagehide",
    () => {
      window.clearTimeout(fallbackTimeout);
    },
    { once: true }
  );

  window.location.href = target.app;
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
});

protocolOutput.addEventListener("input", () => resizeTextarea(protocolOutput));
