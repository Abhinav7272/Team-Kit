(() => {
  const SHADES = [
    { id: 1, name: "Snow", hex: "#F5F5F2", darkLabel: true },
    { id: 2, name: "Cloud", hex: "#D9D9D6", darkLabel: true },
    { id: 3, name: "Ink", hex: "#1A1A1A" },
    { id: 4, name: "Charcoal", hex: "#3A3A3A" },
    { id: 5, name: "Navy", hex: "#0B1F3A" },
    { id: 6, name: "Midnight", hex: "#12264A" },
    { id: 7, name: "Royal", hex: "#1E4DB7" },
    { id: 8, name: "Cobalt", hex: "#2563EB" },
    { id: 9, name: "Sky", hex: "#4BA3C7" },
    { id: 10, name: "Ice", hex: "#7EC8E3", darkLabel: true },
    { id: 11, name: "Teal", hex: "#0D7377" },
    { id: 12, name: "Aqua", hex: "#14B8A6" },
    { id: 13, name: "Forest", hex: "#1B5E3B" },
    { id: 14, name: "Emerald", hex: "#059669" },
    { id: 15, name: "Lime", hex: "#7CB518", darkLabel: true },
    { id: 16, name: "Mint", hex: "#86EFAC", darkLabel: true },
    { id: 17, name: "Sun", hex: "#F4C430", darkLabel: true },
    { id: 18, name: "Honey", hex: "#EAB308", darkLabel: true },
    { id: 19, name: "Orange", hex: "#E85D04" },
    { id: 20, name: "Coral", hex: "#FF6B4A" },
    { id: 21, name: "Crimson", hex: "#C1121F" },
    { id: 22, name: "Scarlet", hex: "#E11D48" },
    { id: 23, name: "Maroon", hex: "#6A040F" },
    { id: 24, name: "Wine", hex: "#9F1239" },
    { id: 25, name: "Blush", hex: "#E8A0BF", darkLabel: true },
    { id: 26, name: "Rose", hex: "#FB7185", darkLabel: true },
    { id: 27, name: "Violet", hex: "#5A189A" },
    { id: 28, name: "Orchid", hex: "#A855F7" },
    { id: 29, name: "Steel", hex: "#6C757D" },
    { id: 30, name: "Slate", hex: "#475569" },
    { id: 31, name: "Gold", hex: "#C9A227", darkLabel: true },
    { id: 32, name: "Bronze", hex: "#B45309" },
  ];
  const SHADE_BY_ID = new Map(SHADES.map((s) => [s.id, s]));
  const SHOE_SHADE = 3; // Ink — shoes never change
  const DEFAULT_COLOR = 21;
  const REFRESH_MS = 20000;

  // One chosen shade covers the shirt and the pants. Shoes stay black.
  function kitColors(shadeId) {
    return { top: shadeId, bottom: shadeId, shoes: SHOE_SHADE };
  }

  function teamColorId(team) {
    const id = team.colors && team.colors.top;
    return SHADE_BY_ID.has(id) ? id : DEFAULT_COLOR;
  }

  const state = {
    color: DEFAULT_COLOR,
    editingId: null,
    teams: [],
    previewId: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  /* ---------- Colour maths ---------- */

  function hexToRgb(hex) {
    const c = hex.replace("#", "");
    return {
      r: parseInt(c.slice(0, 2), 16),
      g: parseInt(c.slice(2, 4), 16),
      b: parseInt(c.slice(4, 6), 16),
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s, l };
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const hn = h / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
      r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, hn) * 255),
      b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
    };
  }

  /* ---------- Mannequin pixel classes (red polo, navy pants, black/purple shoes) ---------- */

  // Main fabric lightness per piece; shading is kept relative to it.
  const BASE_LIGHTNESS = { top: 0.49, bottom: 0.22, shoes: 0.12 };

  function isSkin(r, g, b) {
    return r > 200 && g > 140 && b > 100 && r > g && g > b && r - b > 40 && g - b < 80;
  }

  function isRedGarment(r, g, b) {
    return r > 140 && g < 90 && b < 90 && r > g + 60 && r > b + 60;
  }

  function isNavyPants(r, g, b) {
    return b > r + 12 && r < 70 && g < 100 && b > 45 && b < 140 && g >= r;
  }

  function isShoePixel(r, g, b) {
    const black = r < 55 && g < 55 && b < 60 && Math.abs(r - g) < 18 && Math.abs(g - b) < 22;
    const purple = b > 90 && r > 70 && b > g + 25 && b >= r - 10 && g < 190;
    return black || purple;
  }

  function tint(r, g, b, piece, target) {
    const { l } = rgbToHsl(r, g, b);
    const delta = (l - BASE_LIGHTNESS[piece]) * 0.6;
    const outL = Math.min(0.97, Math.max(0.04, target.l + delta));
    return hslToRgb(target.h, target.s, outL);
  }

  /* ---------- Kit renderer ---------- */

  let base = null; // { width, height, pixels: Uint8ClampedArray }

  function loadBase() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext("2d", { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        base = {
          width: c.width,
          height: c.height,
          pixels: cx.getImageData(0, 0, c.width, c.height).data,
        };
        resolve();
      };
      img.onerror = reject;
      img.src = "assets/woman-kit.png";
    });
  }

  function renderKit(canvas, colors) {
    if (!base) return;
    const { width, height, pixels } = base;
    canvas.width = width;
    canvas.height = height;
    const out = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const data = out.data;

    const targets = {};
    for (const piece of ["top", "bottom", "shoes"]) {
      const { r, g, b } = hexToRgb(SHADE_BY_ID.get(colors[piece]).hex);
      targets[piece] = rgbToHsl(r, g, b);
    }
    const shoeLine = height * 0.84;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 20) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if ((r > 246 && g > 246 && b > 246) || isSkin(r, g, b)) continue;

        let piece = null;
        if (y > shoeLine && isShoePixel(r, g, b)) piece = "shoes";
        else if (isRedGarment(r, g, b)) piece = "top";
        else if (isNavyPants(r, g, b)) piece = "bottom";
        if (!piece) continue;

        const t = tint(r, g, b, piece, targets[piece]);
        data[i] = t.r;
        data[i + 1] = t.g;
        data[i + 2] = t.b;
      }
    }
    canvas.getContext("2d").putImageData(out, 0, 0);
  }

  /* ---------- Shade wheel ---------- */

  function polar(cx, cy, r, deg) {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function donutSlice(cx, cy, rO, rI, start, end) {
    const [x1, y1] = polar(cx, cy, rO, start);
    const [x2, y2] = polar(cx, cy, rO, end);
    const [x3, y3] = polar(cx, cy, rI, end);
    const [x4, y4] = polar(cx, cy, rI, start);
    return `M ${x1} ${y1} A ${rO} ${rO} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rI} ${rI} 0 0 0 ${x4} ${y4} Z`;
  }

  function buildWheel() {
    const svg = $("#shade-wheel");
    const NS = "http://www.w3.org/2000/svg";
    const step = 360 / SHADES.length;
    SHADES.forEach((shade, i) => {
      const start = 205 + i * step;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", donutSlice(120, 120, 114, 46, start, start + step));
      path.setAttribute("fill", shade.hex);
      path.setAttribute("class", "seg");
      path.setAttribute("role", "option");
      path.setAttribute("aria-label", `Shade ${shade.id} ${shade.name}`);
      path.dataset.shadeId = shade.id;
      path.addEventListener("click", () => pickShade(shade.id));
      const title = document.createElementNS(NS, "title");
      title.textContent = `${shade.id} · ${shade.name}`;
      path.appendChild(title);
      svg.appendChild(path);

      const [tx, ty] = polar(120, 120, 80, start + step / 2);
      const label = document.createElementNS(NS, "text");
      label.setAttribute("x", tx);
      label.setAttribute("y", ty);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "central");
      label.setAttribute("class", `seg-label${shade.darkLabel ? " dark" : ""}`);
      label.textContent = shade.id;
      svg.appendChild(label);
    });
  }

  function syncWheel() {
    const shade = SHADE_BY_ID.get(state.color);
    $("#shade-num").textContent = shade.id;
    $("#shade-name").textContent = shade.name;
    $$(".shade-wheel .seg").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.shadeId) === shade.id);
    });
  }

  function pickShade(id) {
    state.color = id;
    syncWheel();
    renderKit($("#kit-canvas"), kitColors(state.color));
  }

  /* ---------- API ---------- */

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }

  async function refreshTeams() {
    try {
      state.teams = await api("GET", "/api/teams");
      renderTable();
    } catch {
      // keep showing the last good list
    }
  }

  /* ---------- Table ---------- */

  function swatchEl(shadeId) {
    const shade = SHADE_BY_ID.get(shadeId);
    const span = document.createElement("span");
    span.className = "swatch";
    const dot = document.createElement("i");
    dot.style.background = shade.hex;
    span.append(dot, `${shade.id} · ${shade.name}`);
    return span;
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function cell(content, className, label) {
    const td = document.createElement("td");
    if (className) td.className = className;
    if (label) td.dataset.label = label;
    td.append(content);
    return td;
  }

  function actionButton(label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn btn-sm ${className}`;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderTable() {
    const body = $("#teams-body");
    const teams = [...state.teams].sort((a, b) => a.createdAt - b.createdAt);
    body.replaceChildren(
      ...teams.map((team, i) => {
        const tr = document.createElement("tr");
        const actions = document.createElement("div");
        actions.className = "row-actions";
        actions.append(
          actionButton("Preview", "btn-primary", () => openPreview(team.id)),
          actionButton("Edit", "btn-ghost", () => startEdit(team.id))
        );
        tr.append(
          cell(String(i + 1), "muted-cell num-cell"),
          cell(team.team, "team-cell"),
          cell(team.captain, "", "Captain"),
          cell(swatchEl(teamColorId(team)), "", "Team color"),
          cell(formatTime(team.updatedAt), "muted-cell", "Updated"),
          cell(actions, "actions-cell")
        );
        return tr;
      })
    );
    $("#teams-empty").hidden = teams.length > 0;
    $("#team-count").textContent = `${teams.length} ${teams.length === 1 ? "team" : "teams"}`;
  }

  /* ---------- Builder form ---------- */

  function setFormMessage(text) {
    $("#form-msg").textContent = text;
  }

  function resetBuilder() {
    state.editingId = null;
    state.color = DEFAULT_COLOR;
    $("#kit-form").reset();
    $$(".field input").forEach((el) => el.classList.remove("is-invalid"));
    $("#save-btn").textContent = "Save team";
    $("#cancel-edit").hidden = true;
    $("#edit-badge").hidden = true;
    setFormMessage("");
    syncWheel();
    renderKit($("#kit-canvas"), kitColors(state.color));
  }

  function startEdit(id) {
    const team = state.teams.find((t) => t.id === id);
    if (!team) return;
    state.editingId = id;
    state.color = teamColorId(team);
    $("#team-name").value = team.team;
    $("#captain-name").value = team.captain;
    $("#save-btn").textContent = "Update team";
    $("#cancel-edit").hidden = false;
    $("#edit-badge").hidden = false;
    setFormMessage("");
    syncWheel();
    renderKit($("#kit-canvas"), kitColors(state.color));
    $("#kit-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSave(event) {
    event.preventDefault();
    const teamInput = $("#team-name");
    const captainInput = $("#captain-name");
    const team = teamInput.value.trim();
    const captain = captainInput.value.trim();
    teamInput.classList.toggle("is-invalid", !team);
    captainInput.classList.toggle("is-invalid", !captain);
    if (!team || !captain) {
      setFormMessage("Please enter both the team name and the captain name.");
      (team ? captainInput : teamInput).focus();
      return;
    }

    const saveBtn = $("#save-btn");
    saveBtn.disabled = true;
    setFormMessage("");
    const payload = { team, captain, colors: kitColors(state.color) };
    try {
      const wasEditing = Boolean(state.editingId);
      if (wasEditing) await api("PUT", `/api/teams/${state.editingId}`, payload);
      else await api("POST", "/api/teams", payload);
      await refreshTeams();
      resetBuilder();
      showToast(wasEditing ? `${team} updated` : `${team} saved — see the table below`);
    } catch (err) {
      setFormMessage(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  /* ---------- Preview popup ---------- */

  const modal = $("#preview-modal");

  function openPreview(id) {
    const team = state.teams.find((t) => t.id === id);
    if (!team) return;
    state.previewId = id;
    const colorId = teamColorId(team);
    renderKit($("#modal-canvas"), kitColors(colorId));
    $("#modal-team").textContent = team.team;
    $("#modal-captain").textContent = team.captain;
    $("#modal-updated").textContent = `Last updated ${formatTime(team.updatedAt)}`;
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = "Team color";
    const dd = document.createElement("dd");
    dd.append(swatchEl(colorId));
    row.append(dt, dd);
    $("#modal-colors").replaceChildren(row);
    hideConfirm();
    modal.showModal();
  }

  function closePreview() {
    modal.close();
  }

  function showConfirm() {
    const team = state.teams.find((t) => t.id === state.previewId);
    $("#confirm-team").textContent = team ? team.team : "this team";
    $("#modal-actions").hidden = true;
    $("#confirm-box").hidden = false;
    $("#confirm-cancel").focus();
  }

  function hideConfirm() {
    $("#modal-actions").hidden = false;
    $("#confirm-box").hidden = true;
  }

  async function confirmDelete() {
    const id = state.previewId;
    const team = state.teams.find((t) => t.id === id);
    const btn = $("#confirm-delete");
    btn.disabled = true;
    try {
      await api("DELETE", `/api/teams/${id}`);
      if (state.editingId === id) resetBuilder();
      await refreshTeams();
      closePreview();
      showToast(`${team ? team.team : "Team"} deleted`);
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Toast ---------- */

  let toastTimer;
  function showToast(text) {
    const toast = $("#toast");
    toast.textContent = text;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  /* ---------- Wire up ---------- */

  function bindUI() {
    $("#kit-form").addEventListener("submit", handleSave);
    $("#cancel-edit").addEventListener("click", resetBuilder);
    $$(".field input").forEach((el) =>
      el.addEventListener("input", () => {
        el.classList.remove("is-invalid");
        setFormMessage("");
      })
    );

    $("#modal-close").addEventListener("click", closePreview);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePreview();
    });
    $("#modal-edit").addEventListener("click", () => {
      const id = state.previewId;
      closePreview();
      startEdit(id);
    });
    $("#modal-delete").addEventListener("click", showConfirm);
    $("#confirm-cancel").addEventListener("click", hideConfirm);
    $("#confirm-delete").addEventListener("click", confirmDelete);

    setInterval(refreshTeams, REFRESH_MS);
    window.addEventListener("focus", refreshTeams);
  }

  buildWheel();
  bindUI();
  syncWheel();
  loadBase()
    .then(() => renderKit($("#kit-canvas"), kitColors(state.color)))
    .catch(() => setFormMessage("Could not load the kit image."));
  refreshTeams();
})();
