// Import three.js and necessary modules
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// Add these imports at the top of your file
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { Raycaster } from "three";

// Import physics functions
import {
  initPhysics,
  createBall,
  shootBallFromMouse,
  createGroundPlane,
  updatePhysics,
  processModelForPhysics,
} from "./physics.js";

// Make BufferGeometryUtils available globally for physics.js
window.THREE = THREE;
window.BufferGeometryUtils = BufferGeometryUtils;

// Initialize physics when document is loaded
let physicsInitialized = false;

// Initialize physics as soon as possible
document.addEventListener("DOMContentLoaded", async () => {
  physicsInitialized = await initPhysics();
  console.log("Physics initialization result:", physicsInitialized);

  // Create invisible physics ground
  if (physicsInitialized) {
    createGroundPlane(scene, 100, { x: 0, y: 0, z: 0 });
  }
});

const scene = new THREE.Scene();
const loader = new GLTFLoader();

// Get the container for Three.js
const container = document.getElementById("canvas-container");
const width = container.clientWidth;
const height = container.clientHeight;

const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

// Add camera controls
/*
const controls = new OrbitControls(camera, container);
controls.enableDamping = true; // Add smooth damping effect
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1; // Minimum zoom distance
controls.maxDistance = 50; // Maximum zoom distance
controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation
*/

// Position the camera to better view the scene
camera.position.set(12, 9, 0); // Position camera on the right side
camera.lookAt(-5, 2, 0); // Look toward the left
//controls.update();

// Add ambient light to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Increased intensity
scene.add(ambientLight);

// Add directional light for better depth perception
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Create an animation mixer
let mixer;
const clock = new THREE.Clock();

// Create a simple pixel sky background with clouds
function createSimplePixelSky() {
  // First set a nice blue gradient as the clear color
  renderer.setClearColor(0x66aaff, 1); // Light blue base color

  // Create a large plane for the clouds that sits far behind everything
  const planeGeometry = new THREE.PlaneGeometry(300, 150);

  // Create a canvas for the clouds
  const canvas = document.createElement("canvas");
  canvas.width = 256; // Increased canvas size for more clouds
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Make the canvas transparent (we'll only draw the clouds)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw several white pixel clouds at different positions
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // Semi-transparent white

  // Draw multiple clouds (original clouds)

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter; // Ensure pixelated look

  // Create material with the texture
  const planeMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false, // Don't write to depth buffer
  });

  // Create the cloud plane
  const cloudPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  cloudPlane.position.z = -250; // Far behind everything
  cloudPlane.position.y = 45; // Adjusted position for better visibility

  // Add animation data to make clouds slowly drift
  cloudPlane.userData = {
    speed: 0.02, // Speed of cloud movement
    direction: 1, // Direction of movement
  };

  scene.add(cloudPlane);

  return cloudPlane;
}

// Helper function to draw a simple pixel cloud
function drawPixelCloud(ctx, x, y, width, height) {
  // Draw the main body of the cloud
  ctx.fillRect(x, y, width, height);

  // Add some randomized "bumps" to the top of the cloud
  for (let i = 0; i < width; i += 2) {
    if (Math.random() > 0.4) {
      const bumpHeight = Math.floor(Math.random() * 3) + 1;
      ctx.fillRect(x + i, y - bumpHeight, 2, bumpHeight);
    }
  }

  // Add some bumps to the sides as well for a fluffier look
  for (let i = 1; i < height; i += 2) {
    // Left side bumps
    if (Math.random() > 0.6) {
      const bumpWidth = Math.floor(Math.random() * 2) + 1;
      ctx.fillRect(x - bumpWidth, y + i, bumpWidth, 2);
    }

    // Right side bumps
    if (Math.random() > 0.6) {
      const bumpWidth = Math.floor(Math.random() * 2) + 1;
      ctx.fillRect(x + width, y + i, bumpWidth, 2);
    }
  }

  // Add some flat bottom extensions
  const extensions = Math.floor(width / 4);
  for (let i = 0; i < extensions; i++) {
    const extX = x + Math.floor(Math.random() * width);
    const extWidth = Math.floor(Math.random() * 4) + 2;
    const extHeight = Math.floor(Math.random() * 2) + 1;
    ctx.fillRect(extX, y + height, extWidth, extHeight);
  }

  // Occasionally add a second layer on top for more complex clouds
  if (Math.random() > 0.6) {
    const topX =
      x + Math.floor(width / 4) + Math.floor(Math.random() * (width / 2));
    const topY = y - Math.floor(Math.random() * 3) - 2;
    const topWidth =
      Math.floor(width / 3) + Math.floor(Math.random() * (width / 3));
    const topHeight = Math.floor(height / 3) + Math.floor(Math.random() * 2);

    ctx.fillRect(topX, topY, topWidth, topHeight);
  }
}
/*
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
*/
//Loading the ground asset
loader.load(
  "./asset/ground.glb",
  function (gltf) {
    scene.add(gltf.scene);
    console.log("Ground model loaded successfully", gltf);

    // Center the model
    const groundBox = new THREE.Box3().setFromObject(gltf.scene);
    const groundCenter = groundBox.getCenter(new THREE.Vector3());

    // Save the ground center for placing the hands
    const groundPosition = new THREE.Vector3(
      -groundCenter.x,
      -groundCenter.y,
      -groundCenter.z
    );

    // Store ground size
    const groundSize = groundBox.getSize(new THREE.Vector3());
    console.log("Ground size:", groundSize);

    // Position ground
    gltf.scene.position.copy(groundPosition);

    // Scale if needed
    const scale = 1;
    gltf.scene.scale.set(scale, scale, scale);

    // Add physics to ground model for collision
    if (physicsInitialized) {
      processModelForPhysics(gltf.scene, 0); // 0 mass = static object
    }

    // Now load all hand models
    handManager.loadAll(groundPosition, groundSize);
  },
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  function (error) {
    console.error("Error loading the ground model:", error);
  }
);

// Modify the handManager to add physics to hands
const handManager = {
  hands: [],
  mixers: [],
  assets: [
    {
      name: "hand1",
      file: "./asset/hands/hand1.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    // Add more hand assets as needed
    {
      name: "hand2",
      file: "./asset/hands/hand2.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand3",
      file: "./asset/hands/hand3.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand4",
      file: "./asset/hands/hand4.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand5",
      file: "./asset/hands/hand5.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand6",
      file: "./asset/hands/hand6.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand7",
      file: "./asset/hands/hand7.glb",
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand8",
      file: "./asset/hands/hand8.glb",
      position: { x: -3, y: 0, z: -1 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand9",
      file: "./asset/hands/hand9.glb",
      position: { x: -3, y: 0, z: -1 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand10",
      file: "./asset/hands/hand10.glb",
      position: { x: -5, y: 0, z: -2 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand11",
      file: "./asset/hands/hand11.glb",
      position: { x: -5, y: 0, z: -2 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand12",
      file: "./asset/hands/hand12.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand13",
      file: "./asset/hands/hand13.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand14",
      file: "./asset/hands/hand14.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand15",
      file: "./asset/hands/hand15.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand16",
      file: "./asset/hands/hand16.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand17",
      file: "./asset/hands/hand17.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand18",
      file: "./asset/hands/hand18.glb",
      position: { x: -5, y: 0, z: 0 },
      scale: 1,
      defaultAnimation: 0,
    },
    {
      name: "hand19",
      file: "./asset/hands/hand19.glb",
      position: { x: -25, y: 0, z: -18 }, // Updated position coordinates
      scale: 1,
      defaultAnimation: 0,
    },
  ],

  // Load all hands
  loadAll: function (groundPosition, groundSize) {
    console.log("Loading all hand assets...");
    this.assets.forEach((asset, index) => {
      this.loadHand(asset, index, groundPosition, groundSize);
    });
  },

  // Load a single hand
  loadHand: function (asset, index, groundPosition, groundSize) {
    console.log(`Loading hand asset: ${asset.name}`);

    loader.load(
      asset.file,
      (gltf) => {
        // Store the hand model
        this.hands[index] = gltf;

        // Add to scene
        scene.add(gltf.scene);
        console.log(`Hand model ${asset.name} loaded successfully`);

        // Position relative to ground + custom position offset
        const newPosition = new THREE.Vector3(
          groundPosition.x + asset.position.x,
          groundPosition.y + asset.position.y,
          groundPosition.z + asset.position.z
        );
        gltf.scene.position.copy(newPosition);

        // Scale
        gltf.scene.scale.set(asset.scale, asset.scale, asset.scale);

        // Set up animation
        if (gltf.animations && gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(gltf.scene);
          this.mixers[index] = mixer;

          console.log(
            `Hand ${asset.name} has ${gltf.animations.length} animations`
          );

          // Play default animation
          if (gltf.animations[asset.defaultAnimation]) {
            const action = mixer.clipAction(
              gltf.animations[asset.defaultAnimation]
            );
            action.play();
          }
        }

        // Store a reference to hand19 for interaction
        if (asset.name === "hand19") {
          hand19Object = gltf.scene;
        }
      },
      (xhr) => {
        console.log(`${asset.name}: ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error(`Error loading ${asset.name}:`, error);
      }
    );
  },

  // Update animations
  update: function (deltaTime) {
    this.mixers.forEach((mixer) => {
      if (mixer) mixer.update(deltaTime);
    });
  },

  // Control specific hand animations
  playAnimation: function (handIndex, animationIndex) {
    if (this.hands[handIndex] && this.mixers[handIndex]) {
      const animations = this.hands[handIndex].animations;
      if (animations && animations[animationIndex]) {
        // Stop current animations
        this.mixers[handIndex].stopAllAction();

        // Play requested animation
        const action = this.mixers[handIndex].clipAction(
          animations[animationIndex]
        );
        action.play();

        return true;
      }
    }
    return false;
  },
};
// Create renderer and add to the container
const EnhancedPixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(width, height) },
    pixelSize: { value: 12.0 }, // Increased for more visible pixelation
    brightness: { value: 3.5 }, // Increased brightness
    contrast: { value: 1.2 }, // Added contrast control
    skyBrightness: { value: 1.0 }, // Separate brightness for sky
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

// Replace your current PixelShader with EnhancedPixelShader
// const PixelShader = EnhancedPixelShader;

// Create renderer and add to the container
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setClearColor(0x222222, 1); // Slightly lighter background
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const cloudPlane = createSimplePixelSky();
// Set up post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Add pixel shader pass - IMPORTANT: Use the same value as defined in the shader
const pixelPass = new ShaderPass(EnhancedPixelShader); // Use the enhanced shader
pixelPass.uniforms["pixelSize"].value = 4.0; // Match the value in the shader
pixelPass.uniforms["brightness"].value = 3.5; // Brightness for scene elements
pixelPass.uniforms["skyBrightness"].value = 1.0; // Separate brightness for sky
pixelPass.uniforms["contrast"].value = 1.5;
pixelPass.uniforms["skyThreshold"].value = 0.65; // Tune this value to accurately detect sky
pixelPass.uniforms["skyY"].value = 1; // Adjust based on where sky appears in your scene
composer.addPass(pixelPass);

const outlinePass = new OutlinePass(
  new THREE.Vector2(width, height),
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

// Add raycaster for interactive elements
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredObject = null;
let hand19Object = null;

// Video URL to open when hand19 is clicked
const videoUrl = "https://www.youtube.com/watch?v=PIMeE1M_stQ"; // Replace with your actual video URL

// Event listeners for mouse interaction
container.addEventListener("mousemove", onMouseMove, false);
container.addEventListener("click", onClick, false);

function onMouseMove(event) {
  // Calculate mouse position in normalized device coordinates (-1 to +1)
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;
}

function onClick(event) {
  // Check if we clicked on hand19
  if (hoveredObject === hand19Object && hand19Object !== null) {
    // Open the video URL in a new tab
    window.open(videoUrl, "_blank");
  } else if (physicsInitialized) {
    // Shoot a ball from the mouse cursor
    shootBallFromMouse(scene, camera, mouse, renderer);
  }
}

// Modify handManager.loadHand to store a reference to hand19
const originalLoadHand = handManager.loadHand;
handManager.loadHand = function (asset, index, groundPosition, groundSize) {
  originalLoadHand.call(this, asset, index, groundPosition, groundSize);

  // Store a reference to hand19 for interaction
  if (asset.name === "hand19") {
    // We'll set this in the callback when it's loaded
    const checkForhand19 = setInterval(() => {
      if (this.hands[index]) {
        hand19Object = this.hands[index].scene;
        clearInterval(checkForhand19);
      }
    }, 100);
  }
};

const targetFPS = 30; // Set to your desired FPS (15 or 12 for a retro feel)
const frameTime = 1000 / targetFPS;
let lastFrameTime = 0;
// Modified animation loop with physics update
function animate(currentTime) {
  requestAnimationFrame(animate);

  // Skip frames to limit FPS
  if (currentTime - lastFrameTime < frameTime) {
    return; // Skip this frame
  }

  // Calculate actual delta time
  const delta = clock.getDelta();

  // Update physics if initialized
  if (physicsInitialized) {
    updatePhysics(delta);
  }

  // Update controls
  //controls.update();

  // Update hand animations
  handManager.update(delta);

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Find intersections with hand19
  if (hand19Object) {
    const intersects = raycaster.intersectObject(hand19Object, true);

    if (intersects.length > 0) {
      if (hoveredObject !== hand19Object) {
        hoveredObject = hand19Object;
        // Set the outline to highlight only hand19
        outlinePass.selectedObjects = [hand19Object];
        // Change cursor to indicate clickable
        container.style.cursor = "pointer";
      }
    } else if (hoveredObject === hand19Object) {
      hoveredObject = null;
      outlinePass.selectedObjects = [];
      container.style.cursor = "default";
    }
  }

  // Animate clouds
  if (cloudPlane && cloudPlane.userData) {
    // Move the clouds slowly
    cloudPlane.position.x +=
      cloudPlane.userData.speed * cloudPlane.userData.direction;

    // Change direction if clouds move too far
    if (Math.abs(cloudPlane.position.x) > 50) {
      cloudPlane.userData.direction *= -1;
    }
  }

  // Render with post-processing
  composer.render();

  // Remember when we rendered last
  lastFrameTime = currentTime;
}

// Start animation with timestamp
requestAnimationFrame(animate);

// Handle window resize
window.addEventListener("resize", () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);

  // Update shader resolution uniform
  pixelPass.uniforms["resolution"].value.set(width, height);
});
