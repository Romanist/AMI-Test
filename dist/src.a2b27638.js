// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"src/utils.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.colors = exports.file = void 0;
var file = 'https://cdn.rawgit.com/FNNDSC/data/master/nifti/adi_brain/adi_brain.nii.gz';
exports.file = file;
var colors = {
  red: 0xff0000,
  darkGrey: 0x353535
};
exports.colors = colors;
},{}],"src/index.js":[function(require,module,exports) {
"use strict";

var _utils = require("./utils");

// Setup renderer
var container = document.getElementById('container');
var renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setClearColor(_utils.colors.darkGrey, 1);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);
var scene = new THREE.Scene();
var camera = new AMI.OrthographicCamera(container.clientWidth / -2, container.clientWidth / 2, container.clientHeight / 2, container.clientHeight / -2, 0.1, 10000); // Setup controls

var controls = new AMI.TrackballOrthoControl(camera, container);
controls.staticMoving = true;
controls.noRotate = true;
camera.controls = controls;

var onWindowResize = function onWindowResize() {
  camera.canvas = {
    width: container.offsetWidth,
    height: container.offsetHeight
  };
  camera.fitBox(2);
  renderer.setSize(container.offsetWidth, container.offsetHeight);
};

window.addEventListener('resize', onWindowResize, false);
var loader = new AMI.VolumeLoader(container);
loader.load(_utils.file).then(function () {
  var series = loader.data[0].mergeSeries(loader.data);
  var stack = series[0].stack[0];
  loader.free();
  var stackHelper = new AMI.StackHelper(stack);
  stackHelper.bbox.visible = false;
  stackHelper.border.color = _utils.colors.red;
  scene.add(stackHelper);
  gui(stackHelper); // center camera and interactor to center of bouding box
  // for nicer experience
  // set camera

  var worldbb = stack.worldBoundingBox();
  var lpsDims = new THREE.Vector3(worldbb[1] - worldbb[0], worldbb[3] - worldbb[2], worldbb[5] - worldbb[4]);
  var box = {
    center: stack.worldCenter().clone(),
    halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10)
  }; // init and zoom

  var canvas = {
    width: container.clientWidth,
    height: container.clientHeight
  };
  camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
  camera.box = box;
  camera.canvas = canvas;
  camera.update();
  camera.fitBox(2);
}).catch(function (error) {
  window.console.log('oops... something went wrong...');
  window.console.log(error);
});

var animate = function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(function () {
    animate();
  });
};

animate();

var gui = function gui(stackHelper) {
  var gui = new dat.GUI({
    autoPlace: false
  });
  var customContainer = document.getElementById('my-gui-container');
  customContainer.appendChild(gui.domElement);
  var camUtils = {
    invertRows: false,
    invertColumns: false,
    rotate45: false,
    rotate: 0,
    orientation: 'default',
    convention: 'radio'
  }; // camera

  var cameraFolder = gui.addFolder('Camera');
  var invertRows = cameraFolder.add(camUtils, 'invertRows');
  invertRows.onChange(function () {
    camera.invertRows();
  });
  var invertColumns = cameraFolder.add(camUtils, 'invertColumns');
  invertColumns.onChange(function () {
    camera.invertColumns();
  });
  var rotate45 = cameraFolder.add(camUtils, 'rotate45');
  rotate45.onChange(function () {
    camera.rotate();
  });
  cameraFolder.add(camera, 'angle', 0, 360).step(1).listen();
  var orientationUpdate = cameraFolder.add(camUtils, 'orientation', ['default', 'axial', 'coronal', 'sagittal']);
  orientationUpdate.onChange(function (value) {
    camera.orientation = value;
    camera.update();
    camera.fitBox(2);
    stackHelper.orientation = camera.stackOrientation;
  });
  var conventionUpdate = cameraFolder.add(camUtils, 'convention', ['radio', 'neuro']);
  conventionUpdate.onChange(function (value) {
    camera.convention = value;
    camera.update();
    camera.fitBox(2);
  });
  cameraFolder.open();
  var stackFolder = gui.addFolder('Stack');
  stackFolder.add(stackHelper, 'index', 0, stackHelper.stack.dimensionsIJK.z - 1).step(1).listen().onChange(checkStore);
  stackFolder.add(stackHelper.slice, 'interpolation', 0, 1).step(1).listen();
  stackFolder.open(); // colorpicker

  var colorPickerFolder = gui.addFolder('Color Picker');
  var params = {
    color: '#000'
  };

  var update = function update() {
    var colorObj = new THREE.Color(params.color);
    var hex = colorObj.getHexString();
    var css = colorObj.getStyle();
  };

  colorPickerFolder.addColor(params, 'color').onChange(update);
  colorPickerFolder.open(); // new layer adding dots mechanics

  var canvas = document.getElementById('newLayer');

  function canvasWidth() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  canvasWidth();
  window.onresize = canvasWidth;

  function getElementPosition(obj) {
    var curleft = 0,
        curtop = 0;

    if (obj.offsetParent) {
      do {
        curleft += obj.offsetLeft;
        curtop += obj.offsetTop;
      } while (obj = obj.offsetParent);

      return {
        x: curleft,
        y: curtop
      };
    }

    return undefined;
  }

  function getEventLocation(element, event) {
    var pos = getElementPosition(element);
    return {
      x: event.pageX - pos.x,
      y: event.pageY - pos.y
    };
  }

  canvas.addEventListener('click', function (e) {
    var eventLocation = getEventLocation(this, e); // check if clicked area is over the image

    var ifImageClicked = oldLayerCheck(eventLocation);

    if (ifImageClicked) {
      var context = this.getContext('2d');
      context.fillStyle = params.color;
      context.fillRect(eventLocation.x, eventLocation.y, 1, 1);
      keepStates();
    }
  }, false); // save states for each layer mechanics

  var store = new Map(); // save initial state

  function setDefaultState() {
    var context = canvas.getContext('2d');
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    store.set('default', imgData);
  }

  setDefaultState(); // save current state

  function keepStates() {
    var context = canvas.getContext('2d');
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    var imgLvl = stackHelper._index;
    store.set(imgLvl, imgData);
  } // check if choosen layer is in store, if no, return initial state


  function checkStore() {
    var curState = store.get(stackHelper._index);
    var context = canvas.getContext('2d');
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height);

    if (curState) {
      context.putImageData(curState, 0, 0);
    } else {
      context.putImageData(store.get('default'), 0, 0);
    }
  } // check if clicked area is over the image


  function oldLayerCheck(eventLocation) {
    var context = renderer.context;
    var x = eventLocation.x;
    var y = eventLocation.y;
    var pixels = new Uint8Array(context.drawingBufferWidth * context.drawingBufferHeight * 4);
    context.readPixels(0, 0, context.drawingBufferWidth, context.drawingBufferHeight, context.RGBA, context.UNSIGNED_BYTE, pixels);
    var pixelR = pixels[4 * (y * context.drawingBufferWidth + x)];
    var pixelG = pixels[4 * (y * context.drawingBufferWidth + x) + 1];
    var pixelB = pixels[4 * (y * context.drawingBufferWidth + x) + 2];
    var pixelA = pixels[4 * (y * context.drawingBufferWidth + x) + 3]; // change color here if u going to change bgColor

    if (pixelR == 53) {
      return false;
    } else {
      return true;
    }
  }
};
},{"./utils":"src/utils.js"}],"node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "49311" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else {
        window.location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["node_modules/parcel-bundler/src/builtins/hmr-runtime.js","src/index.js"], null)
//# sourceMappingURL=/src.a2b27638.js.map