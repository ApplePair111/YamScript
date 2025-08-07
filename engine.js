function runYamScript() {
  const rawYAML = window.editor.getValue(); // Monaco code
  let gameData;

  try {
    gameData = jsyaml.load(rawYAML); // imported in index.html
    console.log("Parsed YAML:", gameData);
    runGame(gameData);
  } catch (err) {
    alert("YAML Error: " + err.message);
  }
}
const engine = {
  sprites: {},           // runtime sprite data (DOM, position, etc.)
  uploadedImages: {},    // imageName → dataURL (from Add Sprite)
  variables: {},         // global vars for math-add etc.
  code: {},              // parsed YAML logic
  meta: {},              // name, author, etc.

  reset() {
    // Clear DOM + internal state
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
    this.sprites[name] = { el, x: 0, y: 0 };
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
  }
};
function runGame(data) {
  engine.reset();
  engine.meta = data.meta || {};
  engine.code = data.code || {};

  // Create sprites
  for (const [spriteName, imageName] of Object.entries(data.sprites || {})) {
    engine.createSprite(spriteName, imageName);
  }

  // Execute sprite code
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
        default:
          console.warn("Unknown command:", fn);
      }
    }
  }
}
