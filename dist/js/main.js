import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Import post-processing modules
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
// Import physics functions
import {
  initPhysics,
  createTextRigidBody,
  updatePhysics,
  setupDragControls,
  calculateScreenBounds,
} from "./physics.js";

// Function to detect mobile devices
function isMobileDevice() {
  return window.innerWidth < 769;
}

// Get the canvas container
const container = document.getElementById("canvas-container");

// Create the scene
const scene = new THREE.Scene();

// Create the camera with proper aspect ratio based on container dimensions
const camera = new THREE.PerspectiveCamera(
  5,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);

// Create the renderer and set it up to fit the container
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000); // Set background color (black)
container.appendChild(renderer.domElement);

// Define the pixel shader from main-page.js
const EnhancedPixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: {
      value: new THREE.Vector2(container.clientWidth, container.clientHeight),
    },
    pixelSize: { value: isMobileDevice() ? 1.0 : 2.0 }, // Less pixelation on mobile
    brightness: { value: 3.5 }, // Increased brightness for scene elements
    contrast: { value: 1 }, // Added contrast control
    skyBrightness: { value: 1.0 }, // Separate brightness for sky/background areas
    skyThreshold: { value: 0.65 }, // Threshold to detect sky (blue value)
    skyY: { value: 1 }, // Y position threshold for sky detection
    colorLevels: { value: isMobileDevice() ? 8.0 : 5.0 }, // More color levels on mobile for smoother look
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
  uniform float colorLevels;
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
    color.rgb = floor(color.rgb * colorLevels) / colorLevels;
    
    gl_FragColor = color;
  }
`,
};

// Set up post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Add pixel shader pass
const pixelPass = new ShaderPass(EnhancedPixelShader);
composer.addPass(pixelPass);

// Add outline pass for potential interaction highlights
const outlinePass = new OutlinePass(
  new THREE.Vector2(container.clientWidth, container.clientHeight),
  scene,
  camera
);
outlinePass.edgeStrength = 3.0;
outlinePass.edgeGlow = 0.5;
outlinePass.edgeThickness = 1.0;
outlinePass.pulsePeriod = 0;
outlinePass.visibleEdgeColor.set("#ffffff"); // White highlight color
outlinePass.hiddenEdgeColor.set("#ffffff");
composer.addPass(outlinePass);

// Add lights to better see the models
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 20);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Position camera
if (isMobileDevice()) {
  camera.position.z = 150; // Increase camera distance on mobile for better view
  camera.position.y = 0;
} else {
  camera.position.z = 75; // Standard distance for desktop
  camera.position.y = 0;
}

// Setup loader
const loader = new GLTFLoader();
const textModels = [];

// Define the text models to load
const textModelPaths = [
  {
    name: "text1",
    path: "./asset/text/text1.glb",
    position: { x: -1.5, y: 2, z: 0 },
    mobilePosition: { x: 0, y: 5, z: 0 },
    mobileScale: 0.8,
  },
  {
    name: "text2",
    path: "./asset/text/text2.glb",
    position: { x: 3.5, y: 2, z: 0 },
    mobilePosition: { x: 0, y: 3.2, z: 0 },
    mobileScale: 1.8,
  },
  {
    name: "text3",
    path: "./asset/text/text3.glb",
    position: { x: 0, y: 1, z: 0 },
    mobilePosition: { x: 0, y: 1.5, z: 0 },
    mobileScale: 0.6,
  },
  {
    name: "text4",
    path: "./asset/text/text4.glb",
    position: { x: -3, y: 0, z: 0 },
    mobilePosition: { x: -1.5, y: 0, z: 0 },
    mobileScale: 0.8,
  },
  {
    name: "text5",
    path: "./asset/text/text5.glb",
    position: { x: 0, y: 0, z: 0 },
    mobilePosition: { x: 0, y: 0, z: 0 },
    mobileScale: 0.8,
  },
  {
    name: "text6",
    path: "./asset/text/text6.glb",
    position: { x: 3, y: 0, z: 0 },
    mobilePosition: { x: 1.5, y: 0, z: 0 },
    mobileScale: 0.8,
  },
  {
    name: "text7",
    path: "./asset/text/text7.glb",
    position: { x: -1, y: -1.5, z: 0 },
    mobilePosition: { x: -0.3, y: -2, z: 0 },
    mobileScale: 0.8,
  },
  {
    name: "text8",
    path: "./asset/text/text8.glb",
    position: { x: 0, y: -2, z: 0 },
    mobilePosition: { x: 0, y: -4, z: 0 },
    mobileScale: 1.2,
  },
  {
    name: "button",
    path: "./asset/text/button.glb",
    position: { x: 0, y: 0, z: 0 },
    mobilePosition: { x: -1.5, y: -4, z: 0 },
    mobileScale: 0.8,
  },
];

// Track loading progress
let modelsToLoad = textModelPaths.length;
let modelsLoaded = 0;

// Variables for animation
let rotationSpeed = 0.005;
let time = 0;
let lastTime = 0;
let physicsInitialized = false;

// Set a target FPS for consistent retro feel
const targetFPS = 30; // Set to desired FPS (30 for smoother, 15 or 12 for more retro)
const frameTime = 1000 / targetFPS;
let lastFrameTime = 0;

// Function to load a model
function loadModel(modelData) {
  return new Promise((resolve, reject) => {
    loader.load(
      modelData.path,
      function (gltf) {
        // Store the loaded model
        const model = gltf.scene;

        // Apply position based on device type
        const isMobile = isMobileDevice();
        const position =
          isMobile && modelData.mobilePosition
            ? modelData.mobilePosition
            : modelData.position;

        model.position.set(position.x, position.y, position.z);

        model.rotation.y = -Math.PI / 2; // Rotate the model to face the camera

        // Apply scale based on device type
        const scale =
          isMobile && modelData.mobileScale ? modelData.mobileScale : 1.1;

        model.scale.set(scale, scale, scale);

        // Add to scene
        scene.add(model);

        // Store for later reference
        textModels.push({
          name: modelData.name,
          model: model,
        });

        // Add physics to text models but not to the button
        if (physicsInitialized && modelData.name !== "button") {
          // Add physics to the model
          createTextRigidBody(model, modelData.name);
          console.log(`Added physics to ${modelData.name}`);
        }

        modelsLoaded++;
        console.log(
          `Loaded ${modelData.name} (${modelsLoaded}/${modelsToLoad})`
        );

        resolve(model);
      },
      function (xhr) {
        console.log(
          `${modelData.name}: ${Math.round(
            (xhr.loaded / xhr.total) * 100
          )}% loaded`
        );
      },
      function (error) {
        console.error(`Error loading ${modelData.name}:`, error);
        reject(error);
      }
    );
  });
}

// Load all models
async function loadAllModels() {
  console.log("Starting to load all models...");

  // First initialize physics
  physicsInitialized = await initPhysics();

  if (!physicsInitialized) {
    console.error("Failed to initialize physics. Continuing without physics.");
  }

  // Calculate accurate screen bounds based on camera and container
  calculateScreenBounds(camera, container);

  const loadingPromises = textModelPaths.map((modelData) =>
    loadModel(modelData)
  );

  try {
    await Promise.all(loadingPromises);
    console.log("All models loaded successfully!");

    // Set up drag controls after models are loaded
    if (physicsInitialized) {
      const physicsControls = setupDragControls(camera, container);

      // Store the updateButtonHoverState function for later use
      window.updateButtonHoverState = physicsControls.updateButtonHoverState;

      // Start tracking time for physics
      lastTime = performance.now();

      // Adjust model positions for the current device type
      adjustModelsForDeviceType();
    }

    // Initialize button interactivity after all models are loaded
    findButtonModel();
  } catch (error) {
    console.error("Error loading models:", error);
  }
}
const rotatingModels = [
  //{ name: "text1", speed: 0.05, axis: "y" }, // Slow y-axis rotation
  { name: "text2", speed: 0.5, axis: "y" }, // Faster y-axis rotation
  //{ name: "text3", speed: 0.04, axis: "z" }, // Subtle z-axis rotation
  { name: "text4", speed: 1, axis: "y" }, // Moderate y-axis rotation
  //{ name: "text5", speed: -0.03, axis: "y" }, // Slow counter-clockwise rotation
  { name: "text6", speed: -0.5, axis: "y" }, // Faster counter-clockwise rotation
  //{ name: "text7", speed: 0.04, axis: "y" }, // Slow y-axis rotation
  { name: "text8", speed: 1, axis: "y" }, // Faster y-axis rotation
];

// Model rotation state tracking
const modelRotationStates = {};

// Start the animation loop
animate();

// Initialize loading
loadAllModels();

function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  // Skip frames to limit FPS for retro feel
  if (currentTime - lastFrameTime < frameTime) {
    return; // Skip this frame
  }

  const now = performance.now();
  // Calculate delta time in seconds
  const deltaTime = (now - lastTime) / 1000;
  lastTime = now;

  // Animate rotating models
  textModels.forEach((textModel) => {
    const rotationConfig = rotatingModels.find(
      (config) => config.name === textModel.name
    );

    if (rotationConfig) {
      // Only animate models that aren't currently being dragged
      if (!textModel.model.userData.isDragging) {
        // Apply rotation based on the configured axis
        const rotationAmount = rotationConfig.speed * deltaTime;

        // Apply rotation directly to the model
        switch (rotationConfig.axis) {
          case "x":
            textModel.model.rotation.x += rotationAmount;
            break;
          case "y":
            textModel.model.rotation.y += rotationAmount;
            break;
          case "z":
            textModel.model.rotation.z += rotationAmount;
            break;
        }

        // Store rotation in userData to prevent physics from overriding it
        textModel.model.userData.hasCustomRotation = true;
        textModel.model.userData.customRotation =
          textModel.model.quaternion.clone();
      }
    }
  });

  // Only run physics once it's initialized
  if (physicsInitialized) {
    updatePhysics(deltaTime);
  }

  // Render with post-processing instead of direct rendering
  composer.render();

  // Remember when we rendered last
  lastFrameTime = currentTime;
}
// Handle window resize to maintain aspect ratio and keep the canvas centered
window.addEventListener("resize", () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);

  // Update shader resolution uniform
  pixelPass.uniforms["resolution"].value.set(width, height);

  // Update shader settings based on device type
  const isMobile = isMobileDevice();
  pixelPass.uniforms["pixelSize"].value = isMobile ? 1.0 : 2.0;
  pixelPass.uniforms["colorLevels"].value = isMobile ? 8.0 : 5.0;

  // Update screen bounds for physics
  calculateScreenBounds(camera, container);

  // Adjust camera position for mobile/desktop
  if (isMobileDevice()) {
    camera.position.z = 100; // Increase camera distance on mobile
  } else {
    camera.position.z = 75; // Standard distance for desktop
  }

  // Adjust model positions and scales based on device type
  adjustModelsForDeviceType();
});

// Function to adjust models for current device type
function adjustModelsForDeviceType() {
  const isMobile = isMobileDevice();

  textModels.forEach((textModel) => {
    const modelData = textModelPaths.find(
      (data) => data.name === textModel.name
    );
    if (modelData && textModel.model) {
      // Apply position based on device type
      if (isMobile && modelData.mobilePosition) {
        textModel.model.position.set(
          modelData.mobilePosition.x,
          modelData.mobilePosition.y,
          modelData.mobilePosition.z
        );

        // Apply scale based on device type
        const scale = modelData.mobileScale || 0.8;
        textModel.model.scale.set(scale, scale, scale);
      } else {
        textModel.model.position.set(
          modelData.position.x,
          modelData.position.y,
          modelData.position.z
        );

        textModel.model.scale.set(1.1, 1.1, 1.1);
      }
    }
  });
}

// Add button interactivity
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let buttonModel = null;
const videoURL = "https://www.youtube.com/watch?v=PIMeE1M_stQ"; // Replace with your actual video URL
let hoveredButton = false;

// Find the button model after loading
function findButtonModel() {
  const buttonModelObj = textModels.find((model) => model.name === "button");
  if (buttonModelObj) {
    buttonModel = buttonModelObj.model;

    // Save original materials for reference
    buttonModel.userData.originalMaterials = [];
    buttonModel.traverse((child) => {
      if (child.isMesh && child.material) {
        // Store the original material
        const originalMaterial = child.material.clone();
        child.userData.originalMaterial = originalMaterial;

        // Check if it's a material array or single material
        if (Array.isArray(child.material)) {
          child.userData.originalMaterials = child.material.map((mat) =>
            mat.clone()
          );
        } else {
          child.userData.originalMaterials = [child.material.clone()];
        }
      }
    });

    console.log("Button model found and initialized for interactivity");
  }
}

// Handle mouse movement for hover effects
container.addEventListener("mousemove", (event) => {
  handlePointerMove(event.clientX, event.clientY);
});

// Helper function to handle pointer move events (mouse or touch)
function handlePointerMove(clientX, clientY) {
  // Calculate mouse position in normalized device coordinates
  const rect = container.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  // Check for button hover if button model is loaded
  if (buttonModel) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(buttonModel, true);

    if (intersects.length > 0) {
      // Hover state - increase emission
      if (!hoveredButton) {
        hoveredButton = true;
        buttonModel.traverse((child) => {
          if (child.isMesh && child.material) {
            // Apply to array of materials or single material
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];

            materials.forEach((material) => {
              if (material.emissive) {
                material.emissiveIntensity = 2.0; // Increase emission on hover
                material.emissive.set(0xffffff); // Set emission color to white
                material.needsUpdate = true;
              }
            });
          }
        });

        // Change cursor to indicate it's clickable
        container.style.cursor = "pointer";

        // Update the physics system about button hover state
        if (window.updateButtonHoverState) {
          window.updateButtonHoverState(true);
        }
      }
    } else if (hoveredButton) {
      // Reset to original state
      hoveredButton = false;
      buttonModel.traverse((child) => {
        if (child.isMesh && child.userData.originalMaterials) {
          // Restore original material properties
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          const originals = child.userData.originalMaterials;

          materials.forEach((material, index) => {
            if (material.emissive && index < originals.length) {
              material.emissiveIntensity =
                originals[index].emissiveIntensity || 1.0;
              material.emissive.copy(
                originals[index].emissive || new THREE.Color(0x000000)
              );
              material.needsUpdate = true;
            }
          });
        }
      });

      // Reset cursor
      container.style.cursor = "default";

      // Update the physics system about button hover state
      if (window.updateButtonHoverState) {
        window.updateButtonHoverState(false);
      }
    }
  }
}

// Handle click to open video
container.addEventListener("click", () => {
  if (hoveredButton) {
    console.log("Button clicked! Opening video:", videoURL);
    window.open(videoURL, "_blank");
  }
});

// We already initialized loading at line 335

// Remove the duplicate animate call as we already have one above
// animate();

// Add touch event handlers for mobile interaction
container.addEventListener("touchstart", handleTouchStart, { passive: false });
container.addEventListener("touchmove", handleTouchMove, { passive: false });
container.addEventListener("touchend", handleTouchEnd);

// Variables to track touch interaction
let touchStartX, touchStartY;
let isDragging = false;

function handleTouchStart(event) {
  event.preventDefault(); // Prevent default to avoid scrolling

  // Get touch coordinates
  const touch = event.touches[0];
  const rect = container.getBoundingClientRect();

  // Convert to normalized device coordinates
  touchStartX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  touchStartY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

  // Update mouse position for raycaster
  mouse.x = touchStartX;
  mouse.y = touchStartY;

  // Check for intersections with objects
  raycaster.setFromCamera(mouse, camera);

  // Create a list of objects to test
  const objectsToTest = [];
  textModels.forEach((model) => {
    if (model.model) {
      objectsToTest.push(model.model);
    }
  });

  const intersects = raycaster.intersectObjects(objectsToTest, true);

  if (intersects.length > 0) {
    // Found an object to interact with
    isDragging = true;

    // Handle button click
    if (buttonModel && intersects[0].object.parent === buttonModel) {
      console.log("Button touched on mobile!");
      window.open(videoURL, "_blank");
    }
  }
}

function handleTouchMove(event) {
  if (!isDragging) return;
  event.preventDefault();

  // Get touch coordinates
  const touch = event.touches[0];

  // Use the shared pointer move handler
  handlePointerMove(touch.clientX, touch.clientY);
}

function handleTouchEnd() {
  isDragging = false;
}
