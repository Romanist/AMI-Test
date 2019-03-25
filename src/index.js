import { colors, file } from './utils';

// Setup renderer
const container = document.getElementById('container');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setClearColor(colors.darkGrey, 1);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new AMI.OrthographicCamera(
  container.clientWidth / -2,
  container.clientWidth / 2,
  container.clientHeight / 2,
  container.clientHeight / -2,
  0.1,
  10000
);

// Setup controls
const controls = new AMI.TrackballOrthoControl(camera, container);
controls.staticMoving = true;
controls.noRotate = true;
camera.controls = controls;

const onWindowResize = () => {
  camera.canvas = {
    width: container.offsetWidth,
    height: container.offsetHeight,
  };
  camera.fitBox(2);

  renderer.setSize(container.offsetWidth, container.offsetHeight);
};
window.addEventListener('resize', onWindowResize, false);

const loader = new AMI.VolumeLoader(container);
loader
  .load(file)
  .then(() => {
    const series = loader.data[0].mergeSeries(loader.data);
    const stack = series[0].stack[0];
    loader.free();

    const stackHelper = new AMI.StackHelper(stack);
    stackHelper.bbox.visible = false;
    stackHelper.border.color = colors.red;
    scene.add(stackHelper);

    gui(stackHelper);

    // center camera and interactor to center of bouding box
    // for nicer experience
    // set camera
    const worldbb = stack.worldBoundingBox();
    const lpsDims = new THREE.Vector3(
      worldbb[1] - worldbb[0],
      worldbb[3] - worldbb[2],
      worldbb[5] - worldbb[4]
    );

    const box = {
      center: stack.worldCenter().clone(),
      halfDimensions: new THREE.Vector3(lpsDims.x + 10, lpsDims.y + 10, lpsDims.z + 10),
    };

    // init and zoom
    const canvas = {
      width: container.clientWidth,
      height: container.clientHeight,
    };

    camera.directions = [stack.xCosine, stack.yCosine, stack.zCosine];
    camera.box = box;
    camera.canvas = canvas;
    camera.update();
    camera.fitBox(2);
  })
  .catch(error => {
    window.console.log('oops... something went wrong...');
    window.console.log(error);
  });

const animate = () => {
  controls.update();
  renderer.render(scene, camera);

  requestAnimationFrame(function() {
    animate();
  });
};

animate();

const gui = stackHelper => {
  const gui = new dat.GUI({
    autoPlace: false,
  });

  const customContainer = document.getElementById('my-gui-container');
  customContainer.appendChild(gui.domElement);
  const camUtils = {
    invertRows: false,
    invertColumns: false,
    rotate45: false,
    rotate: 0,
    orientation: 'default',
    convention: 'radio',
  };

  // camera
  const cameraFolder = gui.addFolder('Camera');
  const invertRows = cameraFolder.add(camUtils, 'invertRows');
  invertRows.onChange(() => {
    camera.invertRows();
  });

  const invertColumns = cameraFolder.add(camUtils, 'invertColumns');
  invertColumns.onChange(() => {
    camera.invertColumns();
  });

  const rotate45 = cameraFolder.add(camUtils, 'rotate45');
  rotate45.onChange(() => {
    camera.rotate();
  });

  cameraFolder
    .add(camera, 'angle', 0, 360)
    .step(1)
    .listen();

  const orientationUpdate = cameraFolder.add(camUtils, 'orientation', [
    'default',
    'axial',
    'coronal',
    'sagittal',
  ]);
  orientationUpdate.onChange(value => {
    camera.orientation = value;
    camera.update();
    camera.fitBox(2);
    stackHelper.orientation = camera.stackOrientation;
  });

  const conventionUpdate = cameraFolder.add(camUtils, 'convention', ['radio', 'neuro']);
  conventionUpdate.onChange(value => {
    camera.convention = value;
    camera.update();
    camera.fitBox(2);
  });

  cameraFolder.open();

  const stackFolder = gui.addFolder('Stack');
  stackFolder
    .add(stackHelper, 'index', 0, stackHelper.stack.dimensionsIJK.z - 1)
    .step(1)
    .listen()
    .onChange(checkStore);
  stackFolder
    .add(stackHelper.slice, 'interpolation', 0, 1)
    .step(1)
    .listen();
  stackFolder.open();

  // colorpicker
  const colorPickerFolder = gui.addFolder('Color Picker');
  var params = {color: '#000'};

  var update = function () {
      var colorObj = new THREE.Color( params.color );
      var hex = colorObj.getHexString();
      var css = colorObj.getStyle();
  };

  colorPickerFolder.addColor(params, 'color').onChange(update);
  colorPickerFolder.open();

  // new layer adding dots mechanics
  var canvas = document.getElementById('newLayer');

  function canvasWidth() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  canvasWidth()
  window.onresize = canvasWidth;

  function getElementPosition(obj) {
    var curleft = 0, curtop = 0;
    if (obj.offsetParent) {
        do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
        } while (obj = obj.offsetParent);
        return { x: curleft, y: curtop };
    }
    return undefined;
  }

  function getEventLocation(element, event) {
    var pos = getElementPosition(element);
    
    return {
        x: (event.pageX - pos.x),
        y: (event.pageY - pos.y)
    };
  }

  canvas.addEventListener('click', function(e) {

    var eventLocation = getEventLocation(this, e);    

    // check if clicked area is over the image
    var ifImageClicked = oldLayerCheck(eventLocation);
    
    if (ifImageClicked) {
      var context = this.getContext('2d');  
      context.fillStyle = params.color;
      context.fillRect(eventLocation.x, eventLocation.y, 1, 1);
      keepStates();
    }

  }, false);

  // save states for each layer mechanics
  var store = new Map()

  // save initial state
  function setDefaultState() {
    var context = canvas.getContext('2d');
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    store.set('default', imgData);
  }
  setDefaultState();

  // save current state
  function keepStates() {
    var context = canvas.getContext('2d');
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    var imgLvl = stackHelper._index;
    store.set(imgLvl, imgData);
  }

  // check if choosen layer is in store, if no, return initial state
  function checkStore() {
    var curState = store.get(stackHelper._index);
    var context = canvas.getContext('2d');
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    if (curState) {
      context.putImageData(curState, 0, 0);
    } else {
      context.putImageData(store.get('default'), 0, 0);
    }
  }

  // check if clicked area is over the image
  function oldLayerCheck(eventLocation) {
    var context = renderer.context;

    var x = eventLocation.x; 
    var y = eventLocation.y;

    var pixels = new Uint8Array(context.drawingBufferWidth * context.drawingBufferHeight * 4); 

    context.readPixels(
        0,
        0,
        context.drawingBufferWidth,
        context.drawingBufferHeight,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixels
    );

    var pixelR = pixels[4 * (y * context.drawingBufferWidth + x)];
    var pixelG = pixels[4 * (y * context.drawingBufferWidth + x) + 1];
    var pixelB = pixels[4 * (y * context.drawingBufferWidth + x) + 2];
    var pixelA = pixels[4 * (y * context.drawingBufferWidth + x) + 3];

    // change color here if u going to change bgColor
    if (pixelR == 53) {
      return false
    } else {
      return true
    }
  }
};