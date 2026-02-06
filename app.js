const protocols = [
  {
    id: "breast",
    name: "УЗИ молочной железы и лимфоузлов",
    file: "Temp.txt",
  },
];

const protocolSelect = document.getElementById("protocolSelect");
const formContainer = document.getElementById("formContainer");
const protocolOutput = document.getElementById("protocolOutput");
const loadStatus = document.getElementById("loadStatus");

const templateCache = new Map();
let currentBlocks = [];
let lastGenerated = "";

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
  if (!protocol) return "";
  if (templateCache.has(protocol.file)) {
    return templateCache.get(protocol.file);
  }
  const response = await fetch(protocol.file);
  const text = await response.text();
  templateCache.set(protocol.file, text);
  return text;
}

function splitBlocks(template) {
  const multiStart = "<многострочное заполнение>";
  const multiEnd = "</многострочное заполнение>";
  const blocks = [];
  let index = 0;

  while (index < template.length) {
    const start = template.indexOf(multiStart, index);
    if (start === -1) {
      blocks.push({ type: "normal", content: template.slice(index) });
      break;
    }

    if (start > index) {
      blocks.push({ type: "normal", content: template.slice(index, start) });
    }

    const end = template.indexOf(multiEnd, start + multiStart.length);
    if (end === -1) {
      blocks.push({ type: "normal", content: template.slice(start) });
      break;
    }

    const content = template.slice(start + multiStart.length, end);
    blocks.push({ type: "repeat", content });
    index = end + multiEnd.length;
  }

  return blocks.map((block) => ({
    ...block,
    content: block.content.replace(/<добавить строку\s*>/gi, ""),
  }));
}

function parseSegments(text) {
  const segments = [];
  const regex = /\{[^}]*\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const raw = match[0].slice(1, -1);
    const options = raw
      .split("/")
      .map((option) => option.trim())
      .filter((option, index, array) => index === 0 || option !== "" || array[0] === "");

    if (options.length === 0) {
      options.push("");
    }

    segments.push({ type: "field", options, valueIndex: 0 });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
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
      return segment.options[segment.valueIndex] ?? "";
    })
    .join("");
}

function updateOutput() {
  const text = currentBlocks
    .map((block) => {
      if (block.type === "normal") {
        return assembleRow(block.rows[0]);
      }
      const rowsText = block.rows.map((row) => assembleRow(row).trim()).filter(Boolean);
      return rowsText.join("\n");
    })
    .join("");

  lastGenerated = text.trim();
  protocolOutput.value = lastGenerated;
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

    const select = document.createElement("select");
    segment.options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option === "" ? "—" : option;
      select.appendChild(optionEl);
    });
    select.value = segment.options[segment.valueIndex] ?? "";
    select.addEventListener("change", (event) => {
      const value = event.target.value;
      segment.valueIndex = segment.options.indexOf(value);
      onChange();
    });
    rowEl.appendChild(select);
  });

  return rowEl;
}

function renderBlocks(blocks) {
  formContainer.innerHTML = "";

  blocks.forEach((block) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-block";

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
  currentBlocks = splitBlocks(template).map((block) => ({
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
