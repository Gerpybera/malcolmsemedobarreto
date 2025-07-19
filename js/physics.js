// Physics system using Ammo.js
import * as THREE from "three";

let physicsWorld;
let tmpTrans;
let rigidBodies = [];
let draggedObject = null;
let dragStartPosition = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let lastMousePosition = new THREE.Vector2();
let mouseDelta = new THREE.Vector2();
let velocity = new THREE.Vector3();
let lastTimestamp = 0;
let screenBounds = {
  minX: -20,
  maxX: 20,
  minY: -10,
  maxY: 10,
  minZ: -10,
  maxZ: 10,
};

// Physics configuration
const GRAVITY = 0; // Zero gravity for floating text
const TEXT_MASS = 0.1; // Light mass for easier movement and floating
const TEXT_RESTITUTION = 0.7; // Higher bounciness for better bounce when hitting screen edges
const DRAG_FORCE_MULTIPLIER = 0.5; // How quickly objects follow the cursor when dragging
const THROW_FORCE_MULTIPLIER = 1.5; // Base multiplier for throws, will be adjusted by speed
export function initPhysics() {
  // Initialize Ammo.js
  return new Promise((resolve) => {
    if (typeof Ammo === "undefined") {
      console.error("Ammo.js is not loaded!");
      resolve(false);
      return;
    }

    // Physics configuration
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();

    // Create physics world with gravity
    physicsWorld = new Ammo.btDiscreteDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration
    );
    physicsWorld.setGravity(new Ammo.btVector3(0, GRAVITY, 0));

    // Temporary transform for object manipulation
    tmpTrans = new Ammo.btTransform();

    console.log("Physics initialized successfully");
    resolve(true);
  });
}

// Create a box-shaped rigid body for a text model
export function createTextRigidBody(model, name) {
  if (!model) return;

  // Instead of using collision shapes, we'll create a "ghost" rigid body
  // that can be moved but doesn't collide with other objects

  // Get current position
  const worldPosition = new THREE.Vector3();
  model.getWorldPosition(worldPosition);

  // Set up transform
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(
    new Ammo.btVector3(worldPosition.x, worldPosition.y, worldPosition.z)
  );

  // Set rotation to match model
  const quaternion = model.quaternion;
  transform.setRotation(
    new Ammo.btQuaternion(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    )
  );

  const motionState = new Ammo.btDefaultMotionState(transform);

  // Create a "ghost" collision shape - just a tiny sphere
  const ghostShape = new Ammo.btSphereShape(0.01);
  const localInertia = new Ammo.btVector3(0, 0, 0);

  // Create rigid body
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    0.1, // Give it a small mass to interact with gravity but still be easy to move
    motionState,
    ghostShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  // Set it as a kinematic object while being dragged, but dynamic when released
  body.setCollisionFlags(body.getCollisionFlags() | 2); // CF_KINEMATIC_OBJECT

  // Configure physics properties for throwing and bouncing
  body.setDamping(0.3, 0.9); // Moderate linear damping (to slow down throws), high angular damping
  body.setRestitution(TEXT_RESTITUTION); // Use the global setting for bounciness
  body.setFriction(0.3); // Moderate friction for better control

  // Allow rotation but not too much - helps with stable throwing
  body.setAngularFactor(new Ammo.btVector3(0.1, 0.1, 0.1)); // Disable sleeping so objects remain active
  body.setActivationState(4); // DISABLE_DEACTIVATION to keep it always active

  // Disable collision responses between objects but allow bouncing off screen boundaries
  physicsWorld.addRigidBody(body, 1, 1); // Group 1, collision with mask 1 (itself)  // Store reference to physics body in the model
  model.userData.physicsBody = body;
  model.userData.name = name;
  model.userData.isDraggable = true; // Mark this object as draggable

  // Add to the list of rigid bodies
  rigidBodies.push(model);

  console.log(`Created non-colliding kinematic body for ${name}`);
}

// Create a ball
export function createBall(scene, position, color = 0xff0000) {
  // Visual representation
  const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
  const ballMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.0, // Minimum roughness
    metalness: 0.0, // No metalness
    emissive: color, // Same color as the diffuse color
    emissiveIntensity: 1.0, // Full intensity emission
  });
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);

  ballMesh.position.copy(position);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);

  // Physics shape
  const ballShape = new Ammo.btSphereShape(BALL_RADIUS);
  ballShape.setMargin(0.05);

  // Set up transform
  const ballTransform = new Ammo.btTransform();
  ballTransform.setIdentity();
  ballTransform.setOrigin(
    new Ammo.btVector3(position.x, position.y, position.z)
  );

  const motionState = new Ammo.btDefaultMotionState(ballTransform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  ballShape.calculateLocalInertia(BALL_MASS, localInertia);

  // Create rigid body
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    BALL_MASS,
    motionState,
    ballShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  // Set restitution (bounciness)
  body.setRestitution(BALL_RESTITUTION);
  body.setFriction(0.5);

  // Add to physics world
  physicsWorld.addRigidBody(body);

  // Store reference to mesh and body
  ballMesh.userData.physicsBody = body;
  rigidBodies.push(ballMesh);

  return ballMesh;
}

// Update physics simulation

// Keep objects within screen bounds
function enforceScreenBounds(object) {
  const physicsBody = object.userData.physicsBody;
  if (!physicsBody) return;

  let needsCorrection = false;
  const position = object.position.clone();
  const velocity = new Ammo.btVector3();

  physicsBody.getLinearVelocity(velocity);

  // Get current velocity for bounce calculations
  const currentVel = {
    x: velocity.x(),
    y: velocity.y(),
    z: velocity.z(),
  };

  // Bounce factor - higher means more energetic bounces off the walls
  const bounceFactor = 0.9;

  // Create a boundary margin to prevent objects from getting stuck at edges
  const margin = 0.2;

  // Check X bounds - apply stricter enforcement
  if (position.x < screenBounds.minX + margin) {
    position.x = screenBounds.minX + margin;
    // Apply bounce with conservation of energy but opposite direction
    velocity.setX(Math.abs(currentVel.x) * bounceFactor);
    needsCorrection = true;
  } else if (position.x > screenBounds.maxX - margin) {
    position.x = screenBounds.maxX - margin;
    velocity.setX(-Math.abs(currentVel.x) * bounceFactor);
    needsCorrection = true;
  }

  // Check Y bounds
  if (position.y < screenBounds.minY + margin) {
    position.y = screenBounds.minY + margin;
    velocity.setY(Math.abs(currentVel.y) * bounceFactor);
    needsCorrection = true;
  } else if (position.y > screenBounds.maxY - margin) {
    position.y = screenBounds.maxY - margin;
    velocity.setY(-Math.abs(currentVel.y) * bounceFactor);
    needsCorrection = true;
  }

  // Check Z bounds - allow more space in Z direction
  if (position.z < screenBounds.minZ + margin) {
    position.z = screenBounds.minZ + margin;
    velocity.setZ(Math.abs(currentVel.z) * bounceFactor);
    needsCorrection = true;
  } else if (position.z > screenBounds.maxZ - margin) {
    position.z = screenBounds.maxZ - margin;
    velocity.setZ(-Math.abs(currentVel.z) * bounceFactor);
    needsCorrection = true;
  }

  // Apply corrections if needed
  if (needsCorrection) {
    // Update position immediately to prevent escaping boundaries
    object.position.copy(position);

    // Add a small random rotation when bouncing for more lively behavior
    const angularVelocity = new Ammo.btVector3(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    );
    physicsBody.setAngularVelocity(angularVelocity);

    // Update physics body position
    const transform = new Ammo.btTransform();
    physicsBody.getMotionState().getWorldTransform(transform);
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
    physicsBody.setWorldTransform(transform);

    // Update velocity with bounce effect
    physicsBody.setLinearVelocity(velocity);

    // Ensure the object stays active
    physicsBody.activate(true);
  }
}

// Set up event listeners for dragging
export function setupDragControls(camera, container) {
  // Track if button is being hovered (to be set from main.js)
  let isButtonHovered = false;

  // Function to update button hover state (called from main.js)
  function updateButtonHoverState(isHovered) {
    isButtonHovered = isHovered;
  }

  // Calculate screen bounds based on camera and container
  calculateScreenBounds(camera, container);

  // Mouse down event
  container.addEventListener("mousedown", onMouseDown);

  // Mouse move event
  container.addEventListener("mousemove", onMouseMove);

  // Mouse up event
  window.addEventListener("mouseup", onMouseUp);

  // Listen for window resize to update bounds
  window.addEventListener("resize", () =>
    calculateScreenBounds(camera, container)
  );

  function onMouseDown(event) {
    // Get mouse coordinates in normalized device coordinates (-1 to +1)
    updateMousePosition(event);

    // Reset velocity when starting a new drag
    velocity = new THREE.Vector3(0, 0, 0);

    // Store current mouse position for velocity calculation
    lastMousePosition.copy(mouse);
    lastTimestamp = performance.now();

    // Check if we hit any objects
    raycaster.setFromCamera(mouse, camera);

    // Create an array of objects to test for intersection
    const objectsToTest = [];
    rigidBodies.forEach((body) => {
      // Only test objects that are marked as draggable
      if (body.userData.isDraggable) {
        body.traverse((child) => {
          if (child.isMesh) {
            // Store the parent rigid body in the mesh's userData for reference
            child.userData.parentBody = body;
            objectsToTest.push(child);
          }
        });
      }
    });

    console.log(`Testing ${objectsToTest.length} objects for intersection`);
    const intersects = raycaster.intersectObjects(objectsToTest, true); // true for recursive check

    if (intersects.length > 0) {
      // Get the first intersected mesh
      const intersectedMesh = intersects[0].object;

      // Find the parent rigid body (could be the mesh itself or a parent)
      const parentBody =
        intersectedMesh.userData.parentBody ||
        findDraggableParent(intersectedMesh);

      if (!parentBody) {
        console.log("No draggable parent found for", intersectedMesh);
        return;
      }

      // Skip the button (we don't want it to be grabbable)
      if (parentBody.userData.name === "button") return;

      // Set the dragged object to be the parent rigid body
      draggedObject = parentBody;

      // Set the isDragging flag for the rotation animation
      draggedObject.userData.isDragging = true;

      // Set cursor to grabbing when we start dragging
      container.style.cursor = "grabbing";

      console.log(
        `Grabbed: ${
          draggedObject.userData.name
        } at position: ${draggedObject.position.x.toFixed(
          2
        )}, ${draggedObject.position.y.toFixed(
          2
        )}, ${draggedObject.position.z.toFixed(2)}`
      );

      // Store the start position
      dragStartPosition.copy(parentBody.position);

      // Make sure it's active
      const physicsBody = draggedObject.userData.physicsBody;
      physicsBody.activate(true);
    } else {
      console.log("No intersection found");
    }
    if (draggedObject) {
      draggedObject.userData.isDragging = true;
    }
  }

  // Helper function to find a draggable parent
  function findDraggableParent(object) {
    let current = object;
    while (current && !current.userData.isDraggable) {
      current = current.parent;
    }
    return current; // Will be null if no draggable parent is found
  }

  function onMouseMove(event) {
    // Track mouse movement
    const prevMouse = mouse.clone();
    updateMousePosition(event);

    // Calculate mouse delta
    mouseDelta.x = mouse.x - prevMouse.x;
    mouseDelta.y = mouse.y - prevMouse.y;

    // If we're already dragging, use the "grabbing" cursor
    if (draggedObject) {
      container.style.cursor = "grabbing";
    } else {
      // Check if we're hovering over a draggable object
      raycaster.setFromCamera(mouse, camera);

      // Create an array of objects to test for intersection
      const objectsToTest = [];
      rigidBodies.forEach((body) => {
        // Only test objects that are marked as draggable
        if (body.userData.isDraggable && body.userData.name !== "button") {
          body.traverse((child) => {
            if (child.isMesh) {
              child.userData.parentBody = body;
              objectsToTest.push(child);
            }
          });
        }
      });

      const intersects = raycaster.intersectObjects(objectsToTest, true);

      // Change cursor to "grab" if hovering over a draggable object
      if (intersects.length > 0) {
        // Only change to grab if we're not hovering over the button
        if (!isButtonHovered) {
          container.style.cursor = "grab";
        }
      } else {
        // Only change to default if we're not hovering over the button
        if (!isButtonHovered) {
          container.style.cursor = "default";
        }
      }
    }

    // Move the dragged object if we have one
    if (draggedObject) {
      // Get camera direction vectors
      const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
        camera.quaternion
      );
      const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
        camera.quaternion
      );

      // Project mouse position to 3D space at the distance of the object
      const distance = camera.position.distanceTo(draggedObject.position);

      // Create a ray from the camera through the mouse position
      raycaster.setFromCamera(mouse, camera);

      // Calculate new position based on the ray and distance
      const newPosition = new THREE.Vector3();
      newPosition
        .copy(camera.position)
        .add(raycaster.ray.direction.clone().multiplyScalar(distance));

      // Enforce screen bounds during dragging to prevent objects from going off-screen
      // Apply constraints directly to the new position
      newPosition.x = Math.max(
        screenBounds.minX,
        Math.min(newPosition.x, screenBounds.maxX)
      );
      newPosition.y = Math.max(
        screenBounds.minY,
        Math.min(newPosition.y, screenBounds.maxY)
      );
      newPosition.z = Math.max(
        screenBounds.minZ,
        Math.min(newPosition.z, screenBounds.maxZ)
      );

      // Log for debugging
      console.log(
        `Mouse: ${mouse.x.toFixed(2)}, ${mouse.y.toFixed(
          2
        )} | New pos: ${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(
          2
        )}, ${newPosition.z.toFixed(2)} | Bounds: X(${screenBounds.minX.toFixed(
          2
        )}-${screenBounds.maxX.toFixed(2)})`
      );

      // Update both the visual model and physics body
      draggedObject.position.copy(newPosition);

      // Update physics body position
      const physicsBody = draggedObject.userData.physicsBody;

      // Ensure object is kinematic while being dragged
      physicsBody.setCollisionFlags(physicsBody.getCollisionFlags() | 2); // CF_KINEMATIC_OBJECT

      const transform = new Ammo.btTransform();
      physicsBody.getMotionState().getWorldTransform(transform);
      transform.setOrigin(
        new Ammo.btVector3(newPosition.x, newPosition.y, newPosition.z)
      );
      physicsBody.setWorldTransform(transform);
      physicsBody.activate(true); // Make sure the physics body is active

      // Calculate velocity for throwing
      const now = performance.now();
      const dt = (now - lastTimestamp) / 1000; // Convert to seconds

      if (dt > 0.001) {
        // Ensure we have a reasonable time delta
        // Calculate velocity based on screen coordinates for more natural feel
        // We scale by the distance to make throws consistent at different depths
        const screenVelocityX = (mouse.x - lastMousePosition.x) / dt;
        const screenVelocityY = (mouse.y - lastMousePosition.y) / dt;

        // Apply smoothing to avoid jumpy behavior but be responsive enough for throws
        const smoothFactor = 0.3; // Higher value = more responsive for throwing
        velocity.x =
          velocity.x * (1 - smoothFactor) + screenVelocityX * smoothFactor;
        velocity.y =
          velocity.y * (1 - smoothFactor) + screenVelocityY * smoothFactor;

        // Store recent velocities for averaging when calculating throw force
        if (!draggedObject.userData.recentVelocities) {
          draggedObject.userData.recentVelocities = [];
        }

        // Keep the last 10 velocity measurements for a better throw calculation
        draggedObject.userData.recentVelocities.push(
          new THREE.Vector2(screenVelocityX, screenVelocityY)
        );
        if (draggedObject.userData.recentVelocities.length > 10) {
          draggedObject.userData.recentVelocities.shift();
        }

        // Limit maximum velocity during dragging (throw can exceed this)
        const maxVel = 15;
        if (Math.abs(velocity.x) > maxVel)
          velocity.x = Math.sign(velocity.x) * maxVel;
        if (Math.abs(velocity.y) > maxVel)
          velocity.y = Math.sign(velocity.y) * maxVel;

        // Z velocity is small to prevent objects flying away from camera
        velocity.z = 0.1;
      }

      // Update for next frame
      lastMousePosition.copy(mouse);
      lastTimestamp = now;
    }
  }

  function onMouseUp() {
    if (draggedObject) {
      // Save the current position to maintain it after release
      const currentPosition = draggedObject.position.clone();

      // Get the physics body
      const physicsBody = draggedObject.userData.physicsBody;

      // First update the position before changing the collision flags
      // This prevents position jumps when transitioning from kinematic to dynamic
      const transform = new Ammo.btTransform();
      physicsBody.getMotionState().getWorldTransform(transform);
      transform.setOrigin(
        new Ammo.btVector3(
          currentPosition.x,
          currentPosition.y,
          currentPosition.z
        )
      );
      physicsBody.setWorldTransform(transform);

      // Convert from kinematic to dynamic (remove kinematic flag)
      physicsBody.setCollisionFlags(physicsBody.getCollisionFlags() & ~2); // Remove CF_KINEMATIC_OBJECT flag

      // Apply the throw velocity based on mouse movement
      const throwVelocity = calculateThrowVelocity();

      // Apply the throw velocity
      physicsBody.setLinearVelocity(
        new Ammo.btVector3(throwVelocity.x, throwVelocity.y, throwVelocity.z)
      );

      console.log(
        `Released: ${
          draggedObject.userData.name
        } at position: ${currentPosition.x.toFixed(
          2
        )}, ${currentPosition.y.toFixed(2)}, ${currentPosition.z.toFixed(2)}`
      );

      console.log(
        `Throw velocity: ${throwVelocity.x.toFixed(
          2
        )}, ${throwVelocity.y.toFixed(2)}, ${throwVelocity.z.toFixed(2)}`
      );

      // Save the last position for smooth transition
      draggedObject.userData.lastPosition = currentPosition;

      // Set isDragging flag to false for rotation animation
      draggedObject.userData.isDragging = false;

      // Reset dragged object
      draggedObject = null;

      // Check if we're still hovering over a draggable object
      raycaster.setFromCamera(mouse, camera);

      // Create an array of objects to test for intersection
      const objectsToTest = [];
      rigidBodies.forEach((body) => {
        // Only test objects that are marked as draggable
        if (body.userData.isDraggable && body.userData.name !== "button") {
          body.traverse((child) => {
            if (child.isMesh) {
              child.userData.parentBody = body;
              objectsToTest.push(child);
            }
          });
        }
      });

      const intersects = raycaster.intersectObjects(objectsToTest, true);

      // Set appropriate cursor based on what we're hovering over
      if (intersects.length > 0) {
        // Only change to grab if we're not hovering over the button
        if (!isButtonHovered) {
          container.style.cursor = "grab";
        }
      } else {
        // Only change to default if we're not hovering over the button
        if (!isButtonHovered) {
          container.style.cursor = "default";
        }
      }
    }
  }

  // Calculate throw velocity based on mouse movement
  function calculateThrowVelocity() {
    // Create a throw velocity based on the recent mouse movement
    const throwVelocity = new THREE.Vector3();

    // Use the velocity calculated during drag for the throw
    throwVelocity.copy(velocity);

    // Calculate the average of recent velocities for a more representative throw
    if (
      draggedObject.userData.recentVelocities &&
      draggedObject.userData.recentVelocities.length > 0
    ) {
      // Calculate the average velocity from recent measurements
      const avgVelocity = new THREE.Vector2(0, 0);
      const recentVelocities = draggedObject.userData.recentVelocities;

      // Calculate the magnitude of the latest velocity for speed-based scaling
      const latestVelocityMagnitude =
        recentVelocities[recentVelocities.length - 1].length();

      // Put more weight on the most recent velocities
      let totalWeight = 0;

      for (let i = 0; i < recentVelocities.length; i++) {
        // Use exponential weighting - more recent velocities have higher weight
        const weight = Math.pow(1.5, i);
        totalWeight += weight;

        // Apply weight to velocity components
        avgVelocity.x += recentVelocities[i].x * weight;
        avgVelocity.y += recentVelocities[i].y * weight;
      }

      // Normalize by total weight
      avgVelocity.x /= totalWeight;
      avgVelocity.y /= totalWeight;

      // Use weighted average for throw direction but scale by latest magnitude for responsiveness
      throwVelocity.x = avgVelocity.x;
      throwVelocity.y = avgVelocity.y;

      // Speed scaling - faster mouse movements result in stronger throws
      // Map the velocity magnitude to a throw force multiplier (1.0 to 3.0)
      const speedMultiplier = Math.min(
        5.0,
        Math.max(1.0, latestVelocityMagnitude / 4.0)
      );
      console.log(`Throw speed multiplier: ${speedMultiplier.toFixed(2)}`);

      // Apply the speed multiplier to the throw velocity
      throwVelocity.multiplyScalar(speedMultiplier);
    }

    // Scale velocity based on distance from camera (further objects should move more)
    const distanceScale = Math.min(
      camera.position.distanceTo(draggedObject.position) * 0.05,
      0.5
    );

    // Apply scaling based on the THROW_FORCE_MULTIPLIER
    throwVelocity.x *= THROW_FORCE_MULTIPLIER * distanceScale;
    throwVelocity.y *= THROW_FORCE_MULTIPLIER * distanceScale;

    // Z-velocity is determined based on mouse movement direction
    // Moving outward (away from screen center) = positive Z (away from camera)
    // Moving inward (toward screen center) = negative Z (toward camera)
    const mouseFromCenter = new THREE.Vector2(mouse.x, mouse.y).length();
    const prevMouseFromCenter = new THREE.Vector2(
      lastMousePosition.x,
      lastMousePosition.y
    ).length();
    const zDirection = mouseFromCenter - prevMouseFromCenter;

    // Set Z velocity based on radial movement and current velocity magnitude but limit it
    throwVelocity.z = zDirection * 2 * THROW_FORCE_MULTIPLIER;

    // Cap maximum velocity in any direction, but scale the cap based on mouse speed
    const maxVelocity = draggedObject.userData.recentVelocities
      ? Math.min(
          10,
          5 +
            draggedObject.userData.recentVelocities[
              draggedObject.userData.recentVelocities.length - 1
            ].length() /
              2
        )
      : 5;

    console.log(`Maximum throw velocity: ${maxVelocity.toFixed(2)}`);

    if (throwVelocity.length() > maxVelocity) {
      throwVelocity.normalize().multiplyScalar(maxVelocity);
    }

    // Add a small random component to make throws more interesting
    throwVelocity.x += (Math.random() - 0.5) * 0.1;
    throwVelocity.y += (Math.random() - 0.5) * 0.1;
    throwVelocity.z += (Math.random() - 0.5) * 0.1;

    return throwVelocity;
  }

  function updateMousePosition(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Return functions that can be called from main.js
  return {
    updateButtonHoverState,
  };
}

// Shoot a ball from mouse position
export function shootBallFromMouse(
  scene,
  camera,
  mouse,
  renderer,
  color = null
) {
  // Random color if none provided
  if (!color) {
    color = Math.random() * 0xffffff;
  }

  // Create ball from mouse position by raycasting into the scene
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Create a fixed distance from the camera for the ball's initial position
  const distanceFromCamera = 2;
  const ballPosition = new THREE.Vector3();
  ballPosition.copy(camera.position);

  // Direction is based purely on the X,Y of the mouse cursor
  // Project a ray from the mouse position into the scene
  const direction = raycaster.ray.direction.clone();

  // Place the ball in front of the camera
  ballPosition.add(direction.clone().multiplyScalar(distanceFromCamera));

  // Create the ball
  const ball = createBall(scene, ballPosition, color);

  // Apply shooting force in the ray direction
  const physicsBody = ball.userData.physicsBody;

  // Use ray direction for velocity
  direction.normalize();
  direction.multiplyScalar(SHOOT_FORCE);

  physicsBody.setLinearVelocity(
    new Ammo.btVector3(direction.x, direction.y, direction.z)
  );

  return ball;
}

// Create a static ground plane
export function createGroundPlane(
  scene,
  size = 50,
  position = { x: 0, y: 0, z: 0 }
) {
  // Visual representation (invisible)
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      visible: false,
    })
  );

  groundMesh.position.set(position.x, position.y, position.z);
  groundMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Physics shape
  const groundShape = new Ammo.btBoxShape(
    new Ammo.btVector3(size / 2, 0.5, size / 2)
  );
  groundShape.setMargin(0.05);

  // Set up transform
  const groundTransform = new Ammo.btTransform();
  groundTransform.setIdentity();
  groundTransform.setOrigin(
    new Ammo.btVector3(position.x, position.y - 0.5, position.z)
  );

  const motionState = new Ammo.btDefaultMotionState(groundTransform);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    0,
    motionState,
    groundShape,
    new Ammo.btVector3(0, 0, 0)
  );
  const body = new Ammo.btRigidBody(rbInfo);

  // Add to physics world
  physicsWorld.addRigidBody(body);

  return groundMesh;
}

// Create precise trimesh collision shape from mesh geometry
export function createTrimeshFromMesh(mesh) {
  if (!mesh.geometry) {
    console.error("Mesh has no geometry:", mesh);
    return null;
  }

  // Ensure we have an indexed BufferGeometry
  let geometry = mesh.geometry;
  if (!geometry.index) {
    // If not indexed, we need to create our own indices
    console.log("Converting to indexed geometry");
    try {
      // Try to use BufferGeometryUtils if available
      if (window.BufferGeometryUtils) {
        geometry = window.BufferGeometryUtils.mergeVertices(geometry.clone());
      } else {
        console.warn("BufferGeometryUtils not available, using geometry as-is");
      }
    } catch (e) {
      console.error("Error converting geometry:", e);
    }
  }

  // Get positions and indices
  const vertices = geometry.attributes.position.array;
  const indices = geometry.index ? geometry.index.array : null;

  if (!vertices || vertices.length === 0) {
    console.error("Geometry has no vertices");
    return null;
  }

  // Create a simplified collision shape if there are too many vertices
  if (vertices.length > 3000) {
    console.log(
      `Mesh has ${vertices.length / 3} vertices, creating simplified collision`
    );
    // Use a simpler shape for complex meshes
    return createSimplifiedShape(mesh);
  }

  // Apply mesh's world transform to vertices
  const tempVec = new THREE.Vector3();
  const vertexCount = vertices.length / 3;
  const transformedVertices = new Float32Array(vertices.length);

  for (let i = 0; i < vertexCount; i++) {
    tempVec.set(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);

    tempVec.applyMatrix4(mesh.matrixWorld);

    transformedVertices[i * 3] = tempVec.x;
    transformedVertices[i * 3 + 1] = tempVec.y;
    transformedVertices[i * 3 + 2] = tempVec.z;
  }

  // Create triangle mesh
  const triangleMesh = new Ammo.btTriangleMesh();

  // Add triangles to mesh
  if (indices && indices.length > 0) {
    // Indexed geometry
    const triCount = indices.length / 3;
    for (let i = 0; i < triCount; i++) {
      const i0 = indices[i * 3];
      const i1 = indices[i * 3 + 1];
      const i2 = indices[i * 3 + 2];

      triangleMesh.addTriangle(
        new Ammo.btVector3(
          transformedVertices[i0 * 3],
          transformedVertices[i0 * 3 + 1],
          transformedVertices[i0 * 3 + 2]
        ),
        new Ammo.btVector3(
          transformedVertices[i1 * 3],
          transformedVertices[i1 * 3 + 1],
          transformedVertices[i1 * 3 + 2]
        ),
        new Ammo.btVector3(
          transformedVertices[i2 * 3],
          transformedVertices[i2 * 3 + 1],
          transformedVertices[i2 * 3 + 2]
        ),
        false
      );
    }
  } else {
    // Non-indexed geometry (process as triangles)
    const triCount = vertexCount / 3;
    for (let i = 0; i < triCount; i++) {
      const i0 = i * 9;
      triangleMesh.addTriangle(
        new Ammo.btVector3(
          transformedVertices[i0],
          transformedVertices[i0 + 1],
          transformedVertices[i0 + 2]
        ),
        new Ammo.btVector3(
          transformedVertices[i0 + 3],
          transformedVertices[i0 + 4],
          transformedVertices[i0 + 5]
        ),
        new Ammo.btVector3(
          transformedVertices[i0 + 6],
          transformedVertices[i0 + 7],
          transformedVertices[i0 + 8]
        ),
        false
      );
    }
  }

  // Create triangle mesh shape
  const shape = new Ammo.btBvhTriangleMeshShape(triangleMesh, true, true);

  // Store the triangleMesh to prevent garbage collection
  mesh.userData.triangleMesh = triangleMesh;

  return shape;
}

// Create a simplified collision shape for complex meshes
function createSimplifiedShape(mesh) {
  // Create a convex hull shape which better follows the mesh contours
  // than a simple box shape
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  // Get the mesh's vertices
  const geometry = mesh.geometry;
  const vertices = geometry.attributes.position.array;
  const vertexCount = vertices.length / 3;

  // Create a convex hull shape
  const convexShape = new Ammo.btConvexHullShape();

  // Add vertices to the convex hull, using a sampling approach for complex meshes
  const stride = Math.max(1, Math.floor(vertexCount / 100)); // Sample up to 100 points
  for (let i = 0; i < vertexCount; i += stride) {
    const tempVec = new THREE.Vector3(
      vertices[i * 3],
      vertices[i * 3 + 1],
      vertices[i * 3 + 2]
    );

    // Apply mesh's world transform to the vertex
    tempVec.applyMatrix4(mesh.matrixWorld);

    // Add to convex hull
    convexShape.addPoint(new Ammo.btVector3(tempVec.x, tempVec.y, tempVec.z));
  }

  // Set margin for better collision detection
  convexShape.setMargin(0.05);

  // Store the original center for positioning
  mesh.userData.collisionCenter = center;

  return convexShape;
}

// Add accurate collision to a mesh
export function addMeshPhysics(mesh, mass = 0) {
  if (!mesh.isMesh) {
    console.log("Not a mesh, skipping physics:", mesh.name || "unnamed");
    return null;
  }

  console.log("Adding physics to mesh:", mesh.name || "unnamed");

  // Create collision shape based on mesh geometry
  const shape = createTrimeshFromMesh(mesh);
  if (!shape) {
    console.error(
      "Failed to create collision shape for mesh:",
      mesh.name || "unnamed"
    );
    return null;
  }

  // Create transform
  const transform = new Ammo.btTransform();
  transform.setIdentity();

  // If we have a stored collision center (for simplified shapes), use it
  if (mesh.userData.collisionCenter) {
    const center = mesh.userData.collisionCenter;
    transform.setOrigin(new Ammo.btVector3(center.x, center.y, center.z));
  } else {
    // For trimesh shapes, vertices are already transformed
    transform.setOrigin(new Ammo.btVector3(0, 0, 0));
  }

  transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);

  if (mass > 0) {
    shape.calculateLocalInertia(mass, localInertia);
  }

  // Create rigid body
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  // Set physics properties
  body.setRestitution(0.7); // Bounciness
  body.setFriction(0.5);

  // If mass is 0, it's a static object
  if (mass === 0) {
    body.setCollisionFlags(body.getCollisionFlags() | 1); // CF_STATIC_OBJECT
  }

  // Add to physics world
  physicsWorld.addRigidBody(body);

  // Store reference to physics body
  mesh.userData.physicsBody = body;

  // Only add to rigid bodies array if it has mass (dynamic)
  if (mass > 0) {
    rigidBodies.push(mesh);
  }

  return body;
}

// Process a model to add accurate physics to all its meshes
export function processModelForPhysics(model, mass = 0) {
  if (!model) {
    console.error("No model provided");
    return null;
  }

  console.log("Processing model for physics:", model.name || "unnamed");

  // Instead of processing each mesh individually, create a compound shape
  // This will better preserve the relative positions and improve collision
  const compoundShape = new Ammo.btCompoundShape();

  // For each mesh in the model, add to compound shape
  let meshCount = 0;
  model.traverse((child) => {
    if (child.isMesh) {
      // Simplified collision for each mesh
      // Create box shape based on mesh's bounding box
      const bbox = new THREE.Box3().setFromObject(child);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      // Create box shape
      const shape = new Ammo.btBoxShape(
        new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5)
      );

      // Get world position and rotation
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      child.getWorldPosition(position);
      child.getWorldQuaternion(quaternion);

      // Create transform for this shape within the compound
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(
        new Ammo.btVector3(position.x, position.y, position.z)
      );
      transform.setRotation(
        new Ammo.btQuaternion(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        )
      );

      // Add to compound shape
      compoundShape.addChildShape(transform, shape);
      meshCount++;
    }
  });

  console.log(`Added ${meshCount} meshes to compound shape`);

  // Create the rigid body using the compound shape
  const transform = new Ammo.btTransform();
  transform.setIdentity();

  // Position at model origin
  transform.setOrigin(new Ammo.btVector3(0, 0, 0));
  transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);

  if (mass > 0) {
    compoundShape.calculateLocalInertia(mass, localInertia);
  }

  // Create rigid body
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    compoundShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  // Set physics properties
  body.setRestitution(0.7);
  body.setFriction(0.5);

  // If mass is 0, it's a static object
  if (mass === 0) {
    body.setCollisionFlags(body.getCollisionFlags() | 1); // CF_STATIC_OBJECT
  }

  // Add to physics world
  physicsWorld.addRigidBody(body);

  // Store reference to the physics body
  model.userData.physicsBody = body;
  model.userData.compoundShape = compoundShape;

  return model;
}

// Update physics world
export function updatePhysics(deltaTime) {
  // Step physics simulation
  physicsWorld.stepSimulation(deltaTime, 10);

  // Update object positions based on physics
  for (let i = 0; i < rigidBodies.length; i++) {
    const objThree = rigidBodies[i];
    const objPhysics = objThree.userData.physicsBody;

    // Skip objects that are currently being dragged - they're already updated in onMouseMove
    if (objThree === draggedObject) continue;

    // Check and enforce screen bounds BEFORE updating position
    enforceScreenBounds(objThree);

    // Get updated position
    const ms = objPhysics.getMotionState();
    if (ms) {
      ms.getWorldTransform(tmpTrans);
      const p = tmpTrans.getOrigin();
      const q = tmpTrans.getRotation();

      // Update Three.js object position
      objThree.position.set(p.x(), p.y(), p.z());

      // Only update rotation from physics if there's no custom rotation
      if (!objThree.userData.hasCustomRotation) {
        objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
      } else {
        // If the object has custom rotation, we need to update the physics body's rotation
        // to match the custom rotation (not the other way around)
        const transform = new Ammo.btTransform();
        transform.setOrigin(new Ammo.btVector3(p.x(), p.y(), p.z()));

        // Get the custom rotation
        const customRotation = objThree.userData.customRotation;
        transform.setRotation(
          new Ammo.btQuaternion(
            customRotation.x,
            customRotation.y,
            customRotation.z,
            customRotation.w
          )
        );

        // Update the physics body
        objPhysics.setWorldTransform(transform);
      }

      // Check if object is moving too fast (could be a physics glitch)
      const velocity = new Ammo.btVector3();
      objPhysics.getLinearVelocity(velocity);
      const speed = Math.sqrt(
        velocity.x() * velocity.x() +
          velocity.y() * velocity.y() +
          velocity.z() * velocity.z()
      );

      // If speed is too high, dampen it
      if (speed > 20) {
        console.log(
          `Object moving too fast (${speed.toFixed(2)}), dampening velocity`
        );
        velocity.op_mul(0.5); // Cut velocity in half
        objPhysics.setLinearVelocity(velocity);
      }

      // Apply gentle random motion to floating objects to make them more lively
      if (!draggedObject && Math.random() < 0.01) {
        // Reduced probability
        // Occasionally apply tiny forces
        const gentleForce = 0.03; // Reduced force
        const randomForce = new Ammo.btVector3(
          (Math.random() - 0.5) * gentleForce,
          (Math.random() - 0.5) * gentleForce,
          (Math.random() - 0.5) * gentleForce
        );
        objPhysics.applyCentralForce(randomForce);
      }

      // Check and enforce screen bounds AGAIN to ensure proper containment
      enforceScreenBounds(objThree);
    }
  }

  // Remove balls that fell too far
  cleanupBalls();
}

// Remove balls that have fallen below a certain point
function cleanupBalls() {
  const removeThreshold = -20;
  for (let i = rigidBodies.length - 1; i >= 0; i--) {
    const body = rigidBodies[i];
    if (body.position.y < removeThreshold) {
      // Remove from physics world
      physicsWorld.removeRigidBody(body.userData.physicsBody);

      // Remove from scene
      body.parent.remove(body);

      // Remove from tracking array
      rigidBodies.splice(i, 1);
    }
  }
}

// Calculate screen bounds based on camera frustum
export function calculateScreenBounds(camera, container) {
  // Get the container dimensions
  const rect = container
    ? container.getBoundingClientRect()
    : { width: window.innerWidth, height: window.innerHeight };
  const aspect = rect.width / rect.height;

  // Calculate the visible area at the Z=0 plane (where most objects are)
  const distanceToTarget = Math.abs(camera.position.z);
  const vFOV = (camera.fov * Math.PI) / 180; // vertical FOV in radians
  const visibleHeight = 2 * Math.tan(vFOV / 2) * distanceToTarget;
  const visibleWidth = visibleHeight * aspect;

  // Set screen bounds based on visible area with a small margin (5%)
  const margin = 0.05;
  const boundsWidth = visibleWidth * (1 - margin);
  const boundsHeight = visibleHeight * (1 - margin);

  // Update screen bounds
  screenBounds = {
    minX: -boundsWidth / 2,
    maxX: boundsWidth / 2,
    minY: -boundsHeight / 2,
    maxY: boundsHeight / 2,
    minZ: -10, // Keep Z bounds the same
    maxZ: 10,
  };

  console.log(
    `Screen bounds calculated: X(${screenBounds.minX.toFixed(
      2
    )} to ${screenBounds.maxX.toFixed(2)}), Y(${screenBounds.minY.toFixed(
      2
    )} to ${screenBounds.maxY.toFixed(2)})`
  );

  return screenBounds;
}

// Export screen bounds setter for customizing from outside
export function setScreenBounds(bounds) {
  // Store the provided bounds
  if (bounds.minX !== undefined) screenBounds.minX = bounds.minX;
  if (bounds.maxX !== undefined) screenBounds.maxX = bounds.maxX;
  if (bounds.minY !== undefined) screenBounds.minY = bounds.minY;
  if (bounds.maxY !== undefined) screenBounds.maxY = bounds.maxY;
  if (bounds.minZ !== undefined) screenBounds.minZ = bounds.minZ;
  if (bounds.maxZ !== undefined) screenBounds.maxZ = bounds.maxZ;

  console.log(
    `Screen bounds set to: X(${screenBounds.minX.toFixed(
      2
    )} to ${screenBounds.maxX.toFixed(2)}), Y(${screenBounds.minY.toFixed(
      2
    )} to ${screenBounds.maxY.toFixed(2)}), Z(${screenBounds.minZ.toFixed(
      2
    )} to ${screenBounds.maxZ.toFixed(2)})`
  );
}
