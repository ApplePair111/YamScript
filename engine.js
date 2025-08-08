// Parse YAML from Monaco and run
function runYamScript() {
  if (!window.editor) {
    alert("Editor not ready yet");
    return;
  }
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
  sprites: {},          // runtime sprite data
  uploadedImages: {},   // imageName → dataURL (from Add Sprite)
  variables: {},        // global variables
  code: {},             // parsed YAML scripts
  meta: {},             // meta from YAML

  // ---------- State helpers ----------
  reset() {
    const ga = document.getElementById("game-area");
    if (ga) ga.innerHTML = "";
    this.sprites = {};
    this.variables = {};
  },

  // ---------- Sprite lifecycle ----------
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

  // ---------- Motion ----------
  move(name, dir, amount) {
    const s = this.sprites[name];
    if (!s) return;
    const val = Number(amount) || 0;
    if (dir === "right") s.x += val;
    if (dir === "left")  s.x -= val;
    if (dir === "down")  s.y += val;
    if (dir === "up")    s.y -= val;
    s.el.style.left = s.x + "px";
    s.el.style.top  = s.y + "px";
  },

  // ---------- Visibility ----------
  show(name) {
    const s = this.sprites[name];
    if (s) s.el.style.display = "block";
  },
  hide(name) {
    const s = this.sprites[name];
    if (s) s.el.style.display = "none";
  },

  // ---------- Variables & Values ----------
  getValue(x) {
    // primitives pass-through
    if (typeof x !== 'object' || x === null) return x;
    // { var: "score" } → current value (default 0)
    if ('var' in x) return this.variables[x.var] ?? 0;
    // generic object not recognized → return as is
    return x;
  },

  setVar(name, value) {
    this.variables[name] = this.getValue(value);
  },

  changeVar(name, delta) {
    this.variables[name] = (this.variables[name] || 0) + this.getValue(delta);
  },

  // Legacy convenience (still supported)
  addVar(name, val) {
    this.changeVar(name, val);
  },

  // ---------- Conditions ----------
  evalCond(cond) {
    // cond: { left: <expr>, op: '>', right: <expr> }
    const ops = {
      '==': (a,b)=>a==b,  '===':(a,b)=>a===b,
      '!=': (a,b)=>a!=b,  '!==':(a,b)=>a!==b,
      '>': (a,b)=>a>b,    '<':  (a,b)=>a<b,
      '>=':(a,b)=>a>=b,   '<=': (a,b)=>a<=b,
    };
    const left  = this.getValue(cond?.left);
    const right = this.getValue(cond?.right);
    const fn = ops[cond?.op] || (()=>false);
    return !!fn(left, right);
  },

  // ---------- Looks ----------
  scale(name, multiplier) {
    const s = this.sprites[name];
    if (!s) return;
    s.scale = Number(this.getValue(multiplier)) || 1;
    s.el.style.transform = `scale(${s.scale}) rotate(${s.rotate}deg)`;
    s.el.style.transformOrigin = "center center";
  },

  rotate(name, degrees) {
    const s = this.sprites[name];
    if (!s) return;
    s.rotate += Number(this.getValue(degrees)) || 0;
    s.el.style.transform = `scale(${s.scale}) rotate(${s.rotate}deg)`;
    s.el.style.transformOrigin = "center center";
  },

  say(name, message) {
    const s = this.sprites[name];
    if (!s) return;
    const old = s.el.querySelector(".speech-bubble");
    if (old) old.remove();
    const bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    bubble.innerText = String(this.getValue(message));
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
    setTimeout(() => bubble.remove(), 2000);
  },

  // ---------- Timing ----------
  wait(seconds) {
    return new Promise(resolve => setTimeout(resolve, (Number(this.getValue(seconds)) || 0) * 1000));
  },
};

// Run a block list (supports nesting, waits, forever, etc.)
async function runInstructions(spriteName, instructions) {
  for (const instr of (instructions || [])) {
    const [fn, val] = Object.entries(instr)[0];
    const [ns, cmd] = fn.split('-');

    switch (ns) {
      case 'motion': {
        engine.move(spriteName, cmd, engine.getValue(val));
        break;
      }

      case 'visibility': {
        if (cmd === 'show') engine.show(spriteName);
        if (cmd === 'hide') engine.hide(spriteName);
        break;
      }

      case 'looks': {
        if (cmd === 'scale')  engine.scale(spriteName, val);
        if (cmd === 'rotate') engine.rotate(spriteName, val);
        if (cmd === 'say')    engine.say(spriteName, val);
        break;
      }

      case 'data': {
        // data-set: { var: 'score', value: 0 }
        // data-change: { var: 'score', by: 1 }
        if (cmd === 'set')    engine.setVar(val.var, val.value);
        if (cmd === 'change') engine.changeVar(val.var, val.by);
        break;
      }

      case 'math': {
        // math-add:       { var: 'score', value: 1 }
        // math-subtract:  { var: 'score', value: 1 }
        // math-multiply:  { var: 'score', value: 2 }
        // math-divide:    { var: 'score', value: 2 }
        // math-mod:       { var: 'score', value: 10 }
        const vname = val?.var;
        const current = Number(engine.variables[vname] || 0);
        const operand = Number(engine.getValue(val?.value) ?? 0);

        if (typeof vname !== 'string') {
          console.warn('math-* requires { var, value }');
          break;
        }

        let result = current;
        if (cmd === 'add')       result = current + operand;
        if (cmd === 'subtract')  result = current - operand;
        if (cmd === 'multiply')  result = current * operand;
        if (cmd === 'divide')    result = operand === 0 ? current : current / operand;
        if (cmd === 'mod')       result = operand === 0 ? current : (current % operand);

        engine.variables[vname] = result;
        break;
      }

      case 'control': {
        if (cmd === 'wait') {
          await engine.wait(val);
        }

        if (cmd === 'repeat') {
          // control-repeat:
          //   times: 10
          //   do: [ ... ]
          const times = Math.max(0, Math.floor(Number(engine.getValue(val?.times)) || 0));
          for (let i = 0; i < times; i++) {
            await runInstructions(spriteName, val?.do || []);
          }
        }

        if (cmd === 'if') {
          // control-if:
          //   cond: { left: {var: score}, op: '>', right: 10 }
          //   then: [ ... ]
          if (engine.evalCond(val?.cond)) {
            await runInstructions(spriteName, val?.then || []);
          }
        }

        if (cmd === 'ifelse') {
          // control-ifelse:
          //   cond: ...
          //   then: [ ... ]
          //   else: [ ... ]
          if (engine.evalCond(val?.cond)) {
            await runInstructions(spriteName, val?.then || []);
          } else {
            await runInstructions(spriteName, val?.else || []);
          }
        }

        if (cmd === 'forever') {
          // control-forever:
          //   do: [ ... ]
          while (true) {
            await runInstructions(spriteName, val?.do || []);
            await engine.wait(0); // yield for UI
          }
        }
        break;
      }

      default: {
        console.warn('Unknown command:', fn);
      }
    }
  }
}

// Run game: reset, create sprites, then run each sprite script concurrently
async function runGame(data) {
  engine.reset();
  engine.meta = data?.meta || {};
  engine.code = data?.code || {};

  for (const [spriteName, imageName] of Object.entries(data?.sprites || {})) {
    engine.createSprite(spriteName, imageName);
  }

  const tasks = [];
  for (const [spriteName, instructions] of Object.entries(engine.code || {})) {
    tasks.push(runInstructions(spriteName, instructions || []));
  }
  await Promise.all(tasks);
}

// Sprite image upload (used by the "Add Sprite" button)
function triggerImageUpload() {
  const input = document.getElementById("image-upload");
  input.click();
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const dataURL = e.target.result;
      const imageName = prompt("Enter an image name (e.g. cat_img):");
      if (!imageName) return alert("Image name is required.");
      engine.uploadedImages[imageName] = dataURL;
      alert(`✅ Sprite "${imageName}" added! Use it in the sprites section.`);
    };
    reader.readAsDataURL(file);
  };
}

// Expose handlers for inline onclick (GitHub Pages friendly)
window.runYamScript = runYamScript;
window.triggerImageUpload = triggerImageUpload;
