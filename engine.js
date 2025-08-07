function runYamScript() {
  const rawYAML = window.editor.getValue();
  let gameData;

  try {
    gameData = jsyaml.load(rawYAML);
    console.log("Parsed YAML:", gameData);
    runGame(gameData);
  } catch (err) {
    alert("YAML Error: " + err.message);
  }
}

const engine = {
  sprites: {},
  uploadedImages: {},
  variables: {},
  code: {},
  meta: {},

  reset() {
    document.getElementById("game-area").innerHTML = "";
    this.sprites = {};
    this.variables = {};
  },

  createSprite(name, imageName) {
    const src = this.uploadedImages[imageName];
    if (!src) {
      alert(`Missing image "${imageName}"`);
      return;
    }

    const el = document.createElement("div");
    el.className = "sprite";
    el.style.backgroundImage = `url(${src})`;
    el.style.position = "absolute";
    el.style.width = "50px";
    el.style.height = "50px";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.backgroundSize = "cover";

    document.getElementById("game-area").appendChild(el);
    this.sprites[name] = { el, x: 0, y: 0, scale: 1, rotate: 0 };
  },

  move(name, dir, amount) {
    const s = this.sprites[name];
    if (!s) return;

    if (dir === "right") s.x += amount;
    if (dir === "left") s.x -= amount;
    if (dir === "down") s.y += amount;
    if (dir === "up") s.y -= amount;

    s.el.style.left = s.x + "px";
    s.el.style.top = s.y + "px";
  },

  show(name) {
    const s = this.sprites[name];
    if (s) s.el.style.display = "block";
  },

  hide(name) {
    const s = this.sprites[name];
    if (s) s.el.style.display = "none";
  },

  addVar(name, val) {
    this.variables[name] = (this.variables[name] || 0) + val;
  },

  scale(name, multiplier) {
    const s = this.sprites[name];
    if (!s) return;

    s.scale = multiplier;
    s.el.style.transform = `scale(${s.scale}) rotate(${s.rotate}deg)`;
  },

  rotate(name, degrees) {
    const s = this.sprites[name];
    if (!s) return;

    s.rotate += degrees;
    s.el.style.transform = `scale(${s.scale}) rotate(${s.rotate}deg)`;
  },

  say(name, message) {
    const s = this.sprites[name];
    if (!s) return;

    // Remove previous bubble
    const old = s.el.querySelector(".speech-bubble");
    if (old) old.remove();

    const bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    bubble.innerText = message;
    bubble.style.position = "absolute";
    bubble.style.bottom = "60px";
    bubble.style.left = "0";
    bubble.style.padding = "4px 8px";
    bubble.style.background = "#fff";
    bubble.style.color = "#000";
    bubble.style.borderRadius = "6px";
    bubble.style.fontSize = "14px";
    bubble.style.whiteSpace = "nowrap";

    s.el.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2000); // auto-remove after 2s
  },

  wait(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
};

async function runGame(data) {
  engine.reset();
  engine.meta = data.meta || {};
  engine.code = data.code || {};

  for (const [spriteName, imageName] of Object.entries(data.sprites || {})) {
    engine.createSprite(spriteName, imageName);
  }

  for (const [spriteName, instructions] of Object.entries(data.code || {})) {
    for (const instr of instructions) {
      const [fn, val] = Object.entries(instr)[0];
      const [ns, cmd] = fn.split("-");

      switch (ns) {
        case "motion":
          engine.move(spriteName, cmd, val);
          break;
        case "visibility":
          if (cmd === "show") engine.show(spriteName);
          if (cmd === "hide") engine.hide(spriteName);
          break;
        case "math":
          if (cmd === "add") engine.addVar(val.var, val.value);
          break;
        case "control":
          if (cmd === "wait") await engine.wait(val);
          break;
        case "looks":
          if (cmd === "scale") engine.scale(spriteName, val);
          if (cmd === "rotate") engine.rotate(spriteName, val);
          if (cmd === "say") engine.say(spriteName, val);
          break;
        default:
          console.warn("Unknown command:", fn);
      }
    }
  }
}

function triggerImageUpload() {
  const input = document.getElementById("image-upload");
  input.click();

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload =
