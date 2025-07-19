import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

// Create scene, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ alpha: true }); // Use alpha: true for transparency
renderer.setClearColor(0x000000, 0); // Transparent background
renderer.physicallyCorrectLights = true; // Use physically correct lighting for better illumination

// Set renderer size and append to container
renderer.setSize(window.innerWidth, window.innerHeight);
const container = document.getElementById("canvas-container-about");
if (!container) {
  console.error("Container element 'canvas-container-about' not found!");
} else {
  container.appendChild(renderer.domElement);

  // Set initial cursor style
  document.body.style.cursor = "grab";
}

// Add ambient light to the scene - increased intensity for better exposure
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Add directional light to the scene - increased intensity
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Add a second directional light from another angle for better illumination
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight2.position.set(-5, 3, 3);
scene.add(directionalLight2);

// Setup GLTF loader - DRACOLoader removed
const loader = new GLTFLoader();

// Array to store all loaded models
const models = [];

// Calculate screen boundaries based on camera view
function updateBounds() {
  // Get the camera's field of view in radians
  const fov = camera.fov * (Math.PI / 180);
  // Get the distance from camera to the viewport
  const distance = camera.position.z;
  // Calculate visible height at that distance
  const visibleHeight = 2 * Math.tan(fov / 2) * distance;
  // Calculate visible width using aspect ratio
  const visibleWidth = visibleHeight * camera.aspect;

  // Get the camera's position and direction
  const cameraPosition = camera.position.clone();
  const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion
  );

  // Calculate center point where camera is looking
  const lookDistance = distance; // Distance to the viewing plane
  const centerPoint = cameraPosition
    .clone()
    .add(cameraDirection.multiplyScalar(lookDistance));

  return {
    minX: centerPoint.x - visibleWidth / 2,
    maxX: centerPoint.x + visibleWidth / 2,
    minY: centerPoint.y - visibleHeight / 2,
    maxY: centerPoint.y + visibleHeight / 2,
    minZ: -5,
    maxZ: 5,
  };
}

// Screen boundaries that will be updated when the window resizes
let canvasBounds = updateBounds();

// Mouse state
let isMousePressed = false;
let mouseX = 0;
let mouseY = 0;
let mouse3DPosition = new THREE.Vector3(); // Store the mouse position in 3D space
let isMouseOverHeader = false; // Track if mouse is over the header

// Function to update cursor style based on mouse state and header position
function updateCursorStyle() {
  if (!isMouseOverHeader) {
    // Outside of header - show grab/grabbing cursor
    if (isMousePressed) {
      document.body.style.cursor = "grabbing"; // Grabbing cursor when pressed
    } else {
      document.body.style.cursor = "grab"; // Grab cursor when not pressed
    }
  } else {
    // Inside header - use default cursor
    document.body.style.cursor = "default";
  }
}

// Add mouse event listeners
window.addEventListener("mousedown", () => {
  isMousePressed = true;
  updateCursorStyle(); // Update cursor on mouse down
});

window.addEventListener("mouseup", () => {
  isMousePressed = false;
  updateCursorStyle(); // Update cursor on mouse up
});

// Track mouse position
window.addEventListener("mousemove", (event) => {
  // Convert mouse position to normalized device coordinates (-1 to +1)
  mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the 3D position of the mouse in the scene
  updateMouse3DPosition();

  // Check if mouse is over the header
  const header = document.getElementById("header");
  if (header) {
    const rect = header.getBoundingClientRect();
    isMouseOverHeader =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
  }

  // Update cursor style
  updateCursorStyle();
});

// Function to update the mouse's 3D position in the scene
function updateMouse3DPosition() {
  const mouseVector = new THREE.Vector3(mouseX, mouseY, 0.5);
  mouseVector.unproject(camera);
  const raycaster = new THREE.Raycaster(
    camera.position,
    mouseVector.sub(camera.position).normalize()
  );

  // Create a plane at z=0 to intersect with the mouse ray
  const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersectionPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeZ, intersectionPoint);

  // Store the 3D position
  mouse3DPosition.copy(intersectionPoint);
}

// Fix paths to be consistent - adjust these based on your actual folder structure
const modelPaths = [
  "../asset/face/face.glb",
  "../asset/face/hairs.glb",
  "../asset/face/mustache.glb",
  "../asset/face/eye1.glb",
  "../asset/face/eye2.glb",
  "../asset/face/eyebrow1.glb",
  "../asset/face/eyebrow2.glb",
];

console.log("Attempting to load models from paths:", modelPaths);

// Add a helper to visualize the scene
/*
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Add a visual grid helper to see the "floor"
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
*/

// Load all models
let loadedCount = 0;
modelPaths.forEach((path, index) => {
  console.log(`Attempting to load model from: ${path}`);

  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;

      // Log the model's information
      console.log(`Model ${index + 1} loaded:`, model);
      console.log(`Model children:`, model.children.length);

      // Calculate bounding box to determine size
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      console.log(`Model size:`, size);

      // Initial position with some randomness to spread them out across the entire screen
      const bounds = updateBounds();
      // Use a wider range than the visible bounds to make objects more scattered
      const scatterFactor = 2.5; // Increased to scatter more widely across the canvas

      // Ensure models are distributed across the entire canvas area
      const rangeX = (bounds.maxX - bounds.minX) * scatterFactor;
      const rangeY = (bounds.maxY - bounds.minY) * scatterFactor;
      const rangeZ = (bounds.maxZ - bounds.minZ) * 0.5; // Reduced z-axis scatter

      const centerX = (bounds.maxX + bounds.minX) / 2;
      const centerY = (bounds.maxY + bounds.minY) / 2;
      const centerZ = (bounds.maxZ + bounds.minZ) / 2;

      // Use a more uniform distribution method to ensure coverage of the entire canvas
      // Divide the canvas into a grid and place models in different grid cells
      const gridCols = Math.ceil(Math.sqrt(modelPaths.length));
      const gridRows = Math.ceil(modelPaths.length / gridCols);
      const gridX = index % gridCols;
      const gridY = Math.floor(index / gridCols);

      // Calculate grid-based position with randomness
      const cellWidth = rangeX / gridCols;
      const cellHeight = rangeY / gridRows;
      const initialX =
        centerX - rangeX / 2 + gridX * cellWidth + Math.random() * cellWidth;
      const initialY =
        centerY - rangeY / 2 + gridY * cellHeight + Math.random() * cellHeight;
      const initialZ = centerZ + (Math.random() - 0.5) * rangeZ;

      model.position.set(initialX, initialY, initialZ);

      // Scale if needed - adjust based on the model size
      model.scale.set(4, 4, 4);

      // Add to scene and store in array
      scene.add(model);
      models.push(model);

      loadedCount++;
      console.log(
        `Model ${index + 1} loaded successfully. Total: ${loadedCount}/${
          modelPaths.length
        }`
      );

      // If it's the last model, adjust camera to frame all models
      if (loadedCount === modelPaths.length) {
        positionModels();
      }
    },
    (xhr) => {
      console.log(
        `Model ${index + 1} (${path}): ${Math.round(
          (xhr.loaded / xhr.total) * 100
        )}% loaded`
      );
    },
    (error) => {
      console.error(`Error loading model ${index + 1} (${path}):`, error);
    }
  );
});

// Generate random velocities for each model's floating motion
const velocities = Array(modelPaths.length)
  .fill()
  .map(() => ({
    x: (Math.random() - 0.5) * 0.008, // Reduced velocity for slower movement
    y: (Math.random() - 0.5) * 0.008, // Reduced velocity for slower movement
    z: (Math.random() - 0.5) * 0.004, // Reduced velocity for slower movement
  }));

// Function to position models once all are loaded
function positionModels() {
  console.log("Setting up model visualization");

  // Adjust camera to see all models
  camera.position.set(0, 0, 15);
  camera.lookAt(0, 0, 0);

  // Update bounds after changing camera orientation
  canvasBounds = updateBounds();

  console.log("Canvas bounds updated:", canvasBounds);

  // Initialize the post-processing effects after positioning models
  setupPostProcessing();
}

// Enhanced Pixel Shader for pixelated retro look
const EnhancedPixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    pixelSize: { value: 12.0 }, // Increased for more visible pixelation
    brightness: { value: 4.5 }, // Increased brightness for better exposure
    contrast: { value: 1.0 }, // Increased contrast for better definition
    skyBrightness: { value: 1.2 }, // Increased sky brightness
    skyThreshold: { value: 0.65 }, // Threshold to detect sky (blue value)
    skyY: { value: 0.6 }, // Y position threshold for sky detection
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float pixelSize;
  uniform float brightness;
  uniform float contrast;
  uniform float skyBrightness;
  uniform float skyThreshold;
  uniform float skyY;
  varying vec2 vUv;
  
  bool isSkyPixel(vec4 color, vec2 uv) {
    // Detect sky pixels based on color (high blue component) and y position
    bool isBlueish = color.b > skyThreshold && color.b > color.r * 1.5 && color.b > color.g * 1.2;
    bool isTopHalf = uv.y < skyY; // Note: UV coordinates in Y are flipped in some systems
    return isBlueish && isTopHalf;
  }
  
  void main() {
    // Calculate pixel coordinates
    vec2 dxy = pixelSize / resolution;
    vec2 coord = dxy * floor(vUv / dxy);
    
    // Sample neighboring pixels for light estimation
    vec4 centerColor = texture2D(tDiffuse, coord);
    vec4 rightColor = texture2D(tDiffuse, coord + vec2(dxy.x, 0.0));
    vec4 topColor = texture2D(tDiffuse, coord + vec2(0.0, dxy.y));
    
    // Calculate a simplified light gradient based on neighboring pixels
    float lightFactor = length(centerColor.rgb - rightColor.rgb) + 
                        length(centerColor.rgb - topColor.rgb);
    lightFactor = clamp(lightFactor * 3.0, 0.0, 1.0);
    
    // Apply the pixelated light effect
    vec4 color = centerColor;
    
    // Determine if this pixel is part of the sky
    bool isSky = isSkyPixel(color, vUv);
    
    // Apply appropriate brightness based on whether it's sky or scene
    if (isSky) {
      color.rgb *= skyBrightness;
    } else {
      color.rgb *= brightness;
    }
    
    // Apply contrast enhancement
    color.rgb = (color.rgb - 0.5) * contrast + 0.5;
    
    // Add pixelated light edge highlighting
    color.rgb += lightFactor * 0.2;
    
    // Discretize color values for more stylized look
    float colorLevels = 5.0;
    color.rgb = floor(color.rgb * colorLevels) / colorLevels;
    
    gl_FragColor = color;
  }
`,
};

// Set up post-processing with composer and passes
let composer;
let pixelPass;

function setupPostProcessing() {
  // Create composer with renderer
  composer = new EffectComposer(renderer);

  // Add render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Add pixel shader pass
  pixelPass = new ShaderPass(EnhancedPixelShader);
  pixelPass.uniforms["pixelSize"].value = 4.0;
  pixelPass.uniforms["brightness"].value = 4.5; // Match increased brightness
  pixelPass.uniforms["skyBrightness"].value = 1.2; // Match increased sky brightness
  pixelPass.uniforms["contrast"].value = 1.6; // Even more contrast for better definition
  pixelPass.uniforms["skyThreshold"].value = 0.65;
  pixelPass.uniforms["skyY"].value = 1;
  composer.addPass(pixelPass);

  // Add outline pass for highlighting objects (optional)
  const outlinePass = new OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene,
    camera
  );
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 0.5;
  outlinePass.edgeThickness = 1.0;
  outlinePass.pulsePeriod = 0;
  outlinePass.visibleEdgeColor.set("#ffffff");
  outlinePass.hiddenEdgeColor.set("#ffffff");
  composer.addPass(outlinePass);
}

// Handle window resize
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Update screen boundaries when window is resized
  canvasBounds = updateBounds();

  // Update composer and shader uniforms if they exist
  if (composer) {
    composer.setSize(width, height);
  }

  if (pixelPass) {
    pixelPass.uniforms["resolution"].value.set(width, height);
  }
});

// Reset cursor when mouse leaves the window
window.addEventListener("mouseleave", () => {
  document.body.style.cursor = "default";
});

// Reset cursor when mouse enters the window
window.addEventListener("mouseenter", () => {
  updateCursorStyle();
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update mouse 3D position on each frame to ensure accurate interactions
  updateMouse3DPosition();

  // Update model positions for floating effect or return to original positions
  models.forEach((model, index) => {
    if (isMousePressed) {
      // When mouse is pressed, gradually return to right-side position (10,0,0) instead of center
      model.position.x += (10 - model.position.x) * 0.1;
      model.position.y += (0 - model.position.y) * 0.1;
      model.position.z += (0 - model.position.z) * 0.1;

      // Make models face the mouse cursor
      // Convert mouse coordinates to 3D world coordinates using raycasting
      const mouseVector = new THREE.Vector3(mouseX, mouseY, 0.5);
      mouseVector.unproject(camera);
      const raycaster = new THREE.Raycaster(
        camera.position,
        mouseVector.sub(camera.position).normalize()
      );

      // Calculate a point in 3D space that corresponds to the mouse position
      const mouseWorldPos = camera.position.clone().add(
        raycaster.ray.direction.multiplyScalar(15) // Distance from camera
      );

      // Make the model look at the mouse position in 3D space
      const lookAtPos = new THREE.Vector3(
        mouseWorldPos.x,
        mouseWorldPos.y,
        mouseWorldPos.z
      );

      // Create a temporary target and interpolate rotation
      const tempTarget = new THREE.Object3D();
      tempTarget.position.copy(model.position);
      tempTarget.lookAt(lookAtPos);

      // Smoothly interpolate current rotation toward the target rotation
      model.quaternion.slerp(tempTarget.quaternion, 0.1);
    } else {
      // When mouse is not pressed, float freely with boundary checking
      model.position.x += velocities[index].x;
      model.position.y += velocities[index].y;
      model.position.z += velocities[index].z;

      // Apply mouse wind-like pushing effect when not pressed
      const mouseInfluenceRadius = 7; // Size of the area affected by mouse "wind"
      const pushStrength = 0.05; // Strength of the push effect

      // Calculate vector from mouse to model
      const toModelX = model.position.x - mouse3DPosition.x;
      const toModelY = model.position.y - mouse3DPosition.y;
      const distanceSquared = toModelX * toModelX + toModelY * toModelY;

      // If within influence radius, apply wind-like push in direction of mouse movement
      if (distanceSquared < mouseInfluenceRadius * mouseInfluenceRadius) {
        // Calculate normalized direction from mouse to model (direction to push)
        const distance = Math.sqrt(distanceSquared);

        // Direction from mouse to model (normalized)
        const dirX = toModelX / distance;
        const dirY = toModelY / distance;

        // Push strength decreases with distance
        const pushFactor = (1 - distance / mouseInfluenceRadius) * pushStrength;

        // Apply push force (stronger when close to mouse)
        model.position.x += dirX * pushFactor;
        model.position.y += dirY * pushFactor;
      }

      // Bounce off boundaries
      if (
        model.position.x < canvasBounds.minX ||
        model.position.x > canvasBounds.maxX
      ) {
        velocities[index].x *= -1;
      }
      if (
        model.position.y < canvasBounds.minY ||
        model.position.y > canvasBounds.maxY
      ) {
        velocities[index].y *= -1;
      }
      if (
        model.position.z < canvasBounds.minZ ||
        model.position.z > canvasBounds.maxZ
      ) {
        velocities[index].z *= -1;
      }
    }
  });

  // Use composer for rendering if available, otherwise use renderer directly
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

animate();
