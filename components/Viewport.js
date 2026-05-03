const _tempQ1 = new THREE.Quaternion();
const _tempQ2 = new THREE.Quaternion();
const _tempEuler = new THREE.Euler();

let _defaultFont = null;
if (window.THREE && THREE.FontLoader) {
    new THREE.FontLoader().load('https://unpkg.com/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        _defaultFont = font;
    });
}

const _particleTextures = {};
const getSunGlowTexture = () => {
    if (!window.THREE) return null;
    if (_particleTextures['sunglow']) return _particleTextures['sunglow'];
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new window.THREE.Texture(canvas);
    tex.needsUpdate = true;
    _particleTextures['sunglow'] = tex;
    return tex;
};

const getParticleTexture = (type) => {
    if (!window.THREE) return null;
    if (_particleTextures[type]) return _particleTextures[type];
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (type === 'rain') {
        const grad = ctx.createLinearGradient(0, 0, 0, 64);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(30, 0, 4, 64);
    } else if (type === 'smoke') {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        grad.addColorStop(0.8, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
    } else {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new window.THREE.Texture(canvas);
    tex.needsUpdate = true;
    _particleTextures[type] = tex;
    return tex;
};

function Viewport() {
    const containerRef = React.useRef(null);
    const { objects, selectedId, selectedIds, setSelectedId, setSelectedIds, updateObject, updateMultipleObjects, saveHistory, transformMode, setTransformMode, frame, activeCameraId, isPlaying, fps, addObject, gravity, symmetryMode } = React.useContext(SceneContext);
    const [space, setSpace] = React.useState('local'); // Default to local space

    const selectedIdsRef = React.useRef(selectedIds);
    React.useEffect(() => {
        selectedIdsRef.current = selectedIds;
    }, [selectedIds]);

    const isPlayingRef = React.useRef(isPlaying);
    React.useEffect(() => {
        isPlayingRef.current = isPlaying;
        if (!isPlaying) {
            // Reset simulated transforms when stopped to allow snapping back to keyframes
            simulatedTransformsRef.current = {};
        }
    }, [isPlaying]);

    const fpsRef = React.useRef(fps);
    React.useEffect(() => {
        fpsRef.current = fps;
    }, [fps]);

    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        addObject('Video', { videoUrl: url, name: file.name, transparent: true });
        e.target.value = null; // reset
    };
    
    const sceneRef = React.useRef(null);
    const cameraRef = React.useRef(null);
    const sceneCamerasRef = React.useRef({}); // Store actual THREE.Cameras for scene camera objects
    const cameraHelpersRef = React.useRef({}); // Store THREE.CameraHelper objects
    const lightHelpersRef = React.useRef({}); // Store THREE.DirectionalLightHelper objects
    const sceneLightsRef = React.useRef({});
    const texturesRef = React.useRef({});
    const videosRef = React.useRef({});
    const audiosRef = React.useRef({});
    const rendererRef = React.useRef(null);
    const meshesRef = React.useRef({});
    const controlsRef = React.useRef(null);
    const transformControlRef = React.useRef(null);
    const transformProxyRef = React.useRef(null);
    const dragStartDataRef = React.useRef(null);
    const targetFocusRef = React.useRef(null);
    const physicsWorldRef = React.useRef(null);
    const rigidBodiesRef = React.useRef({});
    const particleSystemsRef = React.useRef({});
    const simulatedTransformsRef = React.useRef({});
    const physicsCacheRef = React.useRef({});

    React.useEffect(() => {
        if (!containerRef.current || !window.THREE) return;
        
        // Init Physics
        let world = null;
        if (window.CANNON) {
            world = new CANNON.World({
                gravity: new CANNON.Vec3(0, gravity || -9.82, 0),
            });
            world.broadphase = new CANNON.SAPBroadphase(world);
            world.solver.iterations = 50; 
            
            const defMat = new CANNON.Material("default");
            world.defaultMaterial = defMat;
            
            world.defaultContactMaterial = new CANNON.ContactMaterial(defMat, defMat, {
                friction: 0.5,
                restitution: 0.1,
                contactEquationStiffness: 1e10,
                contactEquationRelaxation: 3
            });
            
            physicsWorldRef.current = world;
        }

        // Init Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#1a1a1a');
        sceneRef.current = scene;

        // Grid & Axes
        const grid = new THREE.GridHelper(20, 20, '#444444', '#2a2a2a');
        scene.add(grid);
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 5);
        scene.add(dirLight);

        sceneLightsRef.current = { ambient: ambientLight, directional: dirLight };

        // Camera
        const camera = new THREE.PerspectiveCamera(45, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
        camera.position.set(5, 5, 8);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        transformProxyRef.current = new THREE.Object3D();
        scene.add(transformProxyRef.current);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true, // Fixes perspective glitches and Z-fighting
            preserveDrawingBuffer: true // Required for extracting canvas frames to video
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance while maintaining HD
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // OrbitControls
        const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.1; // Increased from 0.05 to make it stop faster
        controlsRef.current = orbitControls;

        // TransformControls
        const transformControl = new THREE.TransformControls(camera, renderer.domElement);
        // drag events are handled inside the dedicated useEffect below
        scene.add(transformControl);
        transformControlRef.current = transformControl;

        // Raycaster for selection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        let pointerDownPos = { x: 0, y: 0 };
        
        const onPointerDown = (event) => {
            pointerDownPos = { x: event.clientX, y: event.clientY };
        };

        const onPointerUp = (event) => {
            if (transformControl.dragging) return;
            
            // Check distance to ensure it's a click, not a drag (OrbitControls drag)
            const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
            if (dist > 5) return;
            
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            
            // Only intersect with object meshes
            const interactables = Object.values(meshesRef.current).filter(m => m.visible);
            const intersects = raycaster.intersectObjects(interactables);

            if (intersects.length > 0) {
                const objectId = Object.keys(meshesRef.current).find(key => meshesRef.current[key] === intersects[0].object);
                if (objectId) {
                    if (event.ctrlKey || event.metaKey) {
                        const prev = selectedIdsRef.current;
                        if (prev.includes(objectId)) {
                            const next = prev.filter(id => id !== objectId);
                            setSelectedIds(next);
                            setSelectedId(next.length > 0 ? next[0] : null);
                        } else {
                            setSelectedIds([...prev, objectId]);
                            setSelectedId(objectId);
                        }
                    } else {
                        setSelectedId(objectId);
                        setSelectedIds([objectId]);
                    }
                }
            } else {
                setSelectedId(null);
                setSelectedIds([]);
            }
        };
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);

        // Keyboard shortcuts
        const onKeyDown = (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': setTransformMode('translate'); break;
                case 'e': setTransformMode('rotate'); break;
                case 'r': setTransformMode('scale'); break;
            }
        };
        window.addEventListener('keydown', onKeyDown);

        // Helper to evaluate and apply frame state synchronously
        const applyFrameState = (frameNum) => {
            objects.forEach(obj => {
                let mesh = meshesRef.current[obj.id];
                if (!mesh) return;

                let currPos = obj.position;
                let currRot = obj.rotation;
                let currScale = obj.scale;
                let currColor = obj.color;
                let currOpacity = obj.opacity !== undefined ? obj.opacity : 1;
                let currRoughness = obj.roughness !== undefined ? obj.roughness : 0.5;
                let currMetalness = obj.metalness !== undefined ? obj.metalness : 0.1;
                let currIntensity = obj.intensity;
                let currDistance = obj.distance;
                let currSunSize = obj.sunSize;
                let currParticleColor = obj.particleColor;
                let currParticleOpacity = obj.particleOpacity;
                let currParticleCount = obj.particleCount;
                let currParticleSpeed = obj.particleSpeed;
                let currParticleSize = obj.particleSize;
                let currParticleSpread = obj.particleSpread;
                let currParticleLength = obj.particleLength;
                let currFontSize = obj.fontSize;
                let currDepth = obj.depth;
                let currVolume = obj.volume;

                if (obj.keyframes && Object.keys(obj.keyframes).length > 0) {
                    const kfKeys = Object.keys(obj.keyframes).map(Number).sort((a,b)=>a-b);
                    let prevKf = kfKeys[0];
                    let nextKf = kfKeys[kfKeys.length - 1];

                    for(let i=0; i<kfKeys.length; i++) {
                        if (frameNum >= kfKeys[i]) prevKf = kfKeys[i];
                        if (frameNum <= kfKeys[i]) {
                            nextKf = kfKeys[i];
                            break;
                        }
                    }

                    const getVal = (k, prop, def) => k[prop] !== undefined ? k[prop] : (obj[prop] !== undefined ? obj[prop] : def);

                    if (prevKf === nextKf) {
                        const pk = obj.keyframes[prevKf];
                        currPos = pk.position || currPos;
                        currRot = pk.rotation || currRot;
                        currScale = pk.scale || currScale;
                        currColor = pk.color || currColor;
                        currOpacity = getVal(pk, 'opacity', 1);
                        currRoughness = getVal(pk, 'roughness', 0.5);
                        currMetalness = getVal(pk, 'metalness', 0.1);
                        currIntensity = getVal(pk, 'intensity', 1);
                        currDistance = getVal(pk, 'distance', 10);
                        currSunSize = getVal(pk, 'sunSize', 1);
                        currParticleColor = pk.particleColor || currParticleColor;
                        currParticleOpacity = getVal(pk, 'particleOpacity', 1);
                        currParticleCount = getVal(pk, 'particleCount', 100);
                        currParticleSpeed = getVal(pk, 'particleSpeed', 1);
                        currParticleSize = getVal(pk, 'particleSize', 1);
                        currParticleSpread = getVal(pk, 'particleSpread', 1);
                        currParticleLength = getVal(pk, 'particleLength', 1);
                        currFontSize = getVal(pk, 'fontSize', 1);
                        currDepth = getVal(pk, 'depth', 0.2);
                        currVolume = getVal(pk, 'volume', 1);
                    } else {
                        let ratio = (frameNum - prevKf) / (nextKf - prevKf);
                        ratio = ratio * ratio * (3 - 2 * ratio);

                        const pK = obj.keyframes[prevKf];
                        const nK = obj.keyframes[nextKf];
                        
                        currPos = pK.position.map((v, i) => v + (nK.position[i] - v) * ratio);
                        currScale = pK.scale.map((v, i) => v + (nK.scale[i] - v) * ratio);
                        
                        _tempEuler.set(pK.rotation[0]*Math.PI/180, pK.rotation[1]*Math.PI/180, pK.rotation[2]*Math.PI/180, 'XYZ');
                        _tempQ1.setFromEuler(_tempEuler);
                        _tempEuler.set(nK.rotation[0]*Math.PI/180, nK.rotation[1]*Math.PI/180, nK.rotation[2]*Math.PI/180, 'XYZ');
                        _tempQ2.setFromEuler(_tempEuler);
                        _tempQ1.slerp(_tempQ2, ratio);
                        _tempEuler.setFromQuaternion(_tempQ1);
                        currRot = [_tempEuler.x*180/Math.PI, _tempEuler.y*180/Math.PI, _tempEuler.z*180/Math.PI];

                        const lerpNum = (prop, def) => getVal(pK, prop, def) + (getVal(nK, prop, def) - getVal(pK, prop, def)) * ratio;

                        currColor = '#' + new THREE.Color(pK.color || obj.color).lerp(new THREE.Color(nK.color || obj.color), ratio).getHexString();
                        if (pK.particleColor || nK.particleColor) {
                            currParticleColor = '#' + new THREE.Color(pK.particleColor || obj.particleColor || '#ffaa00').lerp(new THREE.Color(nK.particleColor || obj.particleColor || '#ffaa00'), ratio).getHexString();
                        }
                        
                        currOpacity = lerpNum('opacity', 1);
                        currRoughness = lerpNum('roughness', 0.5);
                        currMetalness = lerpNum('metalness', 0.1);
                        currIntensity = lerpNum('intensity', 1);
                        currDistance = lerpNum('distance', 10);
                        currSunSize = lerpNum('sunSize', 1);
                        currParticleOpacity = lerpNum('particleOpacity', 1);
                        currParticleCount = Math.round(lerpNum('particleCount', 100));
                        currParticleSpeed = lerpNum('particleSpeed', 1);
                        currParticleSize = lerpNum('particleSize', 1);
                        currParticleSpread = lerpNum('particleSpread', 1);
                        currParticleLength = lerpNum('particleLength', 1);
                        currFontSize = lerpNum('fontSize', 1);
                        currDepth = lerpNum('depth', 0.2);
                        currVolume = lerpNum('volume', 1);
                    }
                }

                // Apply dynamic interpolated values manually for rendering overrides
                if (obj.type === 'Light' && mesh.userData.realLight) {
                    mesh.userData.realLight.color.set(currColor);
                    mesh.userData.realLight.intensity = currIntensity;
                    if ((obj.lightType === 'point' || obj.lightType === 'sun') && mesh.userData.realLight.distance !== undefined) {
                        mesh.userData.realLight.distance = currDistance;
                    }
                    if (obj.lightType === 'sun' && mesh.userData.sunMesh) {
                        if (mesh.userData.sunMesh.isGroup) {
                            mesh.userData.sunMesh.children.forEach(c => {
                                if (c.material) c.material.color.set(currColor);
                            });
                        } else {
                            if (mesh.userData.sunMesh.material) mesh.userData.sunMesh.material.color.set(currColor);
                        }
                        mesh.userData.sunMesh.scale.setScalar(currSunSize !== undefined ? currSunSize : 1);
                    }
                }
                
                if (obj.type === 'Particles' && particleSystemsRef.current[obj.id]) {
                    const sys = particleSystemsRef.current[obj.id];
                    if (sys.baseColor && currParticleColor) {
                        sys.baseColor.set(currParticleColor);
                    }
                    if (sys.mesh && sys.mesh.material) {
                        sys.mesh.material.size = sys.baseSize * currParticleSize;
                        sys.mesh.material.opacity = (mesh.userData.particleType === 'smoke' ? 0.6 : 0.9) * currParticleOpacity;
                    }
                }

                if (obj.type === 'Text' && mesh && mesh.geometry) {
                    // Changing geometry dynamically inside render loop per frame is heavy but works
                    // We'll update mesh scale on Z to simulate depth change quickly, and uniform scale for fontSize
                    const fontRatio = currFontSize / (obj.fontSize || 1);
                    const depthRatio = currDepth / (obj.depth || 0.2);
                    currScale = [currScale[0] * fontRatio, currScale[1] * fontRatio, currScale[2] * fontRatio * depthRatio];
                }

                let finalOpacity = currOpacity;
                let finalTransparent = currOpacity < 1 || obj.transparent;

                if (obj.type === 'Model') {
                    mesh.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.transparent = finalTransparent;
                            child.material.opacity = finalOpacity;
                            child.material.needsUpdate = true;
                        }
                    });
                }

                if (mesh.material && obj.type !== 'Video') {
                    mesh.material.color.set(currColor);
                    mesh.material.opacity = finalOpacity;
                    mesh.material.transparent = finalTransparent;
                    mesh.material.roughness = currRoughness;
                    mesh.material.metalness = currMetalness;
                    mesh.material.needsUpdate = true;
                }

                if (!transformControlRef.current?.dragging || selectedId !== obj.id) {
                    mesh.position.set(...currPos);
                    mesh.rotation.set(
                        currRot[0] * (Math.PI / 180), 
                        currRot[1] * (Math.PI / 180), 
                        currRot[2] * (Math.PI / 180)
                    );
                    mesh.scale.set(...currScale);
                }

                if (obj.type === 'Camera' && sceneCamerasRef.current[obj.id]) {
                    const cam = sceneCamerasRef.current[obj.id];
                    cam.position.copy(mesh.position);
                    cam.rotation.copy(mesh.rotation);
                    cam.updateMatrixWorld();
                    
                    if (cameraHelpersRef.current[obj.id]) {
                        cameraHelpersRef.current[obj.id].update();
                    }
                }
            });
        };

        // Separate render sizing to prevent buffer clearing mid-render loop
        window.__MUZAM_SET_RENDER_MODE__ = (active, targetW, targetH, quality) => {
            const rend = rendererRef.current;
            const cam = cameraRef.current;
            if (!rend || !cam) return;
            
            if (active) {
                window.__oldPixelRatio = rend.getPixelRatio();
                window.__oldW = containerRef.current.clientWidth;
                window.__oldH = containerRef.current.clientHeight;

                rend.setSize(targetW, targetH, false);
                if (quality === 'Low') rend.setPixelRatio(1);
                else if (quality === 'Medium') rend.setPixelRatio(window.devicePixelRatio || 1);
                else if (quality === 'High') rend.setPixelRatio((window.devicePixelRatio || 1) * 1.5);
                
                const activeCamId = window.__ACTIVE_CAMERA_ID__;
                const renderCamera = (activeCamId && sceneCamerasRef.current[activeCamId]) ? sceneCamerasRef.current[activeCamId] : cam;
                
                window.__oldAspect = renderCamera.aspect;
                if (renderCamera.isPerspectiveCamera) {
                    renderCamera.aspect = targetW / targetH;
                    renderCamera.updateProjectionMatrix();
                }
            } else {
                rend.setSize(window.__oldW, window.__oldH, false);
                rend.setPixelRatio(window.__oldPixelRatio);
                const activeCamId = window.__ACTIVE_CAMERA_ID__;
                const renderCamera = (activeCamId && sceneCamerasRef.current[activeCamId]) ? sceneCamerasRef.current[activeCamId] : cam;
                if (renderCamera.isPerspectiveCamera) {
                    renderCamera.aspect = window.__oldAspect;
                    renderCamera.updateProjectionMatrix();
                }
            }
        };

        // Render synchronously
        window.__MUZAM_RENDER_FRAME__ = (frameNum) => {
            const rend = rendererRef.current;
            const scn = sceneRef.current;
            const cam = cameraRef.current;
            if (!rend || !scn || !cam) return null;

            applyFrameState(frameNum);
            
            const activeCamId = window.__ACTIVE_CAMERA_ID__;
            const renderCamera = (activeCamId && sceneCamerasRef.current[activeCamId]) ? sceneCamerasRef.current[activeCamId] : cam;
            
            // Hide helpers during render
            Object.values(cameraHelpersRef.current).forEach(h => h.visible = false);
            const grid = scn.children.find(c => c instanceof THREE.GridHelper);
            const axes = scn.children.find(c => c instanceof THREE.AxesHelper);
            if (grid) grid.visible = false;
            if (axes) axes.visible = false;
            if (transformControlRef.current) transformControlRef.current.visible = false;

            rend.render(scn, renderCamera);

            // Restore helpers
            if (grid) grid.visible = true;
            if (axes) axes.visible = true;
            if (transformControlRef.current) transformControlRef.current.visible = true;
            Object.keys(cameraHelpersRef.current).forEach(id => {
                const obj = latestObjectsRef.current.find(o => o.id === id);
                if (obj && obj.visible && activeCamId !== id && selectedIdsRef.current.includes(id)) {
                    cameraHelpersRef.current[id].visible = true;
                }
            });
            
            return rend.domElement;
        };

        // Animation Loop
        let animationFrameId;
        let lastTime = performance.now();
        const animate = (time) => {
            time = time || performance.now();
            animationFrameId = requestAnimationFrame(animate);
            
            const dt = (time - lastTime) / 1000;
            lastTime = time;

            if (physicsWorldRef.current && isPlayingRef.current) {
                physicsWorldRef.current.gravity.set(0, gravity || -9.82, 0);
                physicsWorldRef.current.step(1/60, dt, 3);
                
                Object.keys(rigidBodiesRef.current).forEach(id => {
                    const body = rigidBodiesRef.current[id];
                    if (body.type === CANNON.Body.DYNAMIC) {
                        simulatedTransformsRef.current[id] = {
                            position: [body.position.x, body.position.y, body.position.z],
                            quaternion: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w]
                        };
                    }
                });
            }

            // Update particles (always preview)
            Object.keys(particleSystemsRef.current).forEach(id => {
                const sys = particleSystemsRef.current[id];
                const obj = latestObjectsRef.current.find(o => o.id === id);
                if (sys && sys.update && obj) sys.update(dt, obj, isPlayingRef.current, frameRef.current, fpsRef.current);
            });
            
            // Only update orbit controls if we are not looking through a scene camera
            if (!window.__ACTIVE_CAMERA_ID__) {
                orbitControls.update();
            }
            
            const activeCamId = window.__ACTIVE_CAMERA_ID__;
            const renderCamera = (activeCamId && sceneCamerasRef.current[activeCamId]) ? sceneCamerasRef.current[activeCamId] : camera;
            
            renderer.render(scene, renderCamera);
        };
        animate();

        // Handle Resize
        const handleResize = () => {
            if (!containerRef.current) return;
            camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            cancelAnimationFrame(animationFrameId);
            renderer.dispose();
            transformControl.dispose();
        };
    }, []);

    const frameRef = React.useRef(frame);
    const latestObjectsRef = React.useRef(objects);
    React.useEffect(() => {
        frameRef.current = frame;
        latestObjectsRef.current = objects;
    }, [frame, objects]);

    const prevSelectedIdRef = React.useRef(selectedId);
    React.useEffect(() => {
        if (selectedId !== prevSelectedIdRef.current) {
            prevSelectedIdRef.current = selectedId;
            
            if (selectedId && controlsRef.current && !activeCameraId) {
                const obj = objects.find(o => o.id === selectedId);
                if (obj && obj.position) {
                    controlsRef.current.target.set(obj.position[0], obj.position[1], obj.position[2]);
                    controlsRef.current.update();
                }
            }
        }
    }, [selectedId, activeCameraId, objects]);

    React.useEffect(() => {
        window.__ACTIVE_CAMERA_ID__ = activeCameraId;
        if (controlsRef.current) {
            controlsRef.current.enabled = !activeCameraId; // Disable orbit when jumped in
        }
    }, [activeCameraId]);

    // Handle TransformControl Change
    React.useEffect(() => {
        if (!transformControlRef.current || selectedIds.length === 0) return;
        
        const handleChange = () => {
            if (!transformControlRef.current.dragging) return;

            if (selectedIds.length > 1) {
                const proxy = transformProxyRef.current;
                if (!proxy || !dragStartDataRef.current) return;
                
                proxy.updateMatrixWorld();
                const proxyCurrentMatrixWorld = proxy.matrixWorld;
                const deltaMatrix = new THREE.Matrix4().multiplyMatrices(proxyCurrentMatrixWorld, dragStartDataRef.current.proxyMatrixWorldInverse);

                const updates = [];
                dragStartDataRef.current.topLevelIds.forEach(id => {
                    const startData = dragStartDataRef.current.objects[id];
                    if (!startData) return;
                    
                    const newMatrix = new THREE.Matrix4().multiplyMatrices(deltaMatrix, startData.matrixWorld);
                    
                    const mesh = meshesRef.current[id];
                    if (mesh && mesh.parent) {
                        const parentInverse = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
                        newMatrix.premultiply(parentInverse);
                    }
                    
                    const position = new THREE.Vector3();
                    const quaternion = new THREE.Quaternion();
                    const scale = new THREE.Vector3();
                    newMatrix.decompose(position, quaternion, scale);
                    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
                    
                    const obj = latestObjectsRef.current.find(o => o.id === id);
                    
                    const newPos = [position.x, position.y, position.z];
                    const newRot = [euler.x * 180/Math.PI, euler.y * 180/Math.PI, euler.z * 180/Math.PI];
                    const newScale = [scale.x, scale.y, scale.z];

                    let kfUpdates = {};
                    if (obj && obj.keyframes && Object.keys(obj.keyframes).length > 0) {
                        kfUpdates = {
                            keyframes: {
                                ...obj.keyframes,
                                [frameRef.current]: {
                                    position: newPos,
                                    rotation: newRot,
                                    scale: newScale
                                }
                            }
                        };
                    }

                    updates.push({
                        id,
                        updates: { position: newPos, rotation: newRot, scale: newScale, ...kfUpdates }
                    });
                });
                updateMultipleObjects(updates, true); // update continuously but skip history
                return;
            }

            // Single select logic
            const selId = selectedIds[0];
            const mesh = meshesRef.current[selId];
            if (!mesh) return;
            
            const obj = latestObjectsRef.current.find(o => o.id === selId);
            if (!obj) return;
            
            const newPos = [mesh.position.x, mesh.position.y, mesh.position.z];
            const newRot = [
                mesh.rotation.x * (180 / Math.PI), 
                mesh.rotation.y * (180 / Math.PI), 
                mesh.rotation.z * (180 / Math.PI)
            ];
            const newScale = [mesh.scale.x, mesh.scale.y, mesh.scale.z];

            const updates = {
                position: newPos,
                rotation: newRot,
                scale: newScale
            };

            if (obj.keyframes && Object.keys(obj.keyframes).length > 0) {
                updates.keyframes = {
                    ...obj.keyframes,
                    [frameRef.current]: {
                        position: newPos,
                        rotation: newRot,
                        scale: newScale
                    }
                };
            }

            let multiUpdates = [{ id: selId, updates }];



            if (multiUpdates.length > 1) {
                updateMultipleObjects(multiUpdates, true);
            } else {
                updateObject(selId, updates, true);
            }
        };

        const handleDraggingChanged = (event) => {
            if (controlsRef.current) controlsRef.current.enabled = !event.value;
            
            if (event.value) { // Drag started
                if (selectedIds.length > 1) {
                    const proxy = transformProxyRef.current;
                    proxy.updateMatrixWorld();
                    const objData = {};
                    
                    const topLevelSelectedIds = selectedIds.filter(id => {
                        let obj = latestObjectsRef.current.find(o => o.id === id);
                        while (obj && obj.parentId) {
                            if (selectedIds.includes(obj.parentId)) return false;
                            obj = latestObjectsRef.current.find(o => o.id === obj.parentId);
                        }
                        return true;
                    });

                    topLevelSelectedIds.forEach(id => {
                        const mesh = meshesRef.current[id];
                        if (mesh) {
                            mesh.updateMatrixWorld();
                            objData[id] = {
                                matrixWorld: mesh.matrixWorld.clone()
                            };
                        }
                    });
                    dragStartDataRef.current = {
                        proxyMatrixWorldInverse: proxy.matrixWorld.clone().invert(),
                        objects: objData,
                        topLevelIds: topLevelSelectedIds
                    };
                }
            } else { // Drag ended
                if (selectedIds.length > 1) {
                    updateMultipleObjects([], false); // trigger history save
                } else {
                    updateObject(selectedIds[0], {}); // trigger history save
                }
            }
        };

        const transformControl = transformControlRef.current;
        transformControl.addEventListener('change', handleChange);
        transformControl.addEventListener('dragging-changed', handleDraggingChanged);
        return () => {
            transformControl.removeEventListener('change', handleChange);
            transformControl.removeEventListener('dragging-changed', handleDraggingChanged);
        }
    }, [selectedIds, updateObject, updateMultipleObjects]);

    // Sync objects with Scene
    React.useEffect(() => {
        if (!sceneRef.current) return;
        const scene = sceneRef.current;
        const currentIds = new Set(objects.map(o => o.id));

        // Remove deleted
        Object.keys(meshesRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                if (rigidBodiesRef.current[id]) {
                    const body = rigidBodiesRef.current[id];
                    if (physicsWorldRef.current) physicsWorldRef.current.removeBody(body);
                    
                    if (body._contactMat && physicsWorldRef.current) {
                        const idx = physicsWorldRef.current.contactmaterials.indexOf(body._contactMat);
                        if (idx !== -1) physicsWorldRef.current.contactmaterials.splice(idx, 1);
                    }
                    
                    delete rigidBodiesRef.current[id];
                }
                if (particleSystemsRef.current[id]) {
                    delete particleSystemsRef.current[id];
                }
                if (videosRef.current[id]) {
                    videosRef.current[id].pause();
                    videosRef.current[id].removeAttribute('src');
                    videosRef.current[id].load();
                    delete videosRef.current[id];
                }
                if (audiosRef.current[id]) {
                    audiosRef.current[id].pause();
                    audiosRef.current[id].removeAttribute('src');
                    audiosRef.current[id].load();
                    delete audiosRef.current[id];
                }
                const meshToRemove = meshesRef.current[id];
                if (transformControlRef.current?.object === meshToRemove) {
                    transformControlRef.current.detach();
                }
                
                // Deep memory disposal
                meshToRemove.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
                
                scene.remove(meshToRemove);
                delete meshesRef.current[id];
                
                if (cameraHelpersRef.current[id]) {
                    scene.remove(cameraHelpersRef.current[id]);
                    cameraHelpersRef.current[id].dispose();
                    delete cameraHelpersRef.current[id];
                }
                if (lightHelpersRef.current[id]) {
                    scene.remove(lightHelpersRef.current[id]);
                    lightHelpersRef.current[id].dispose();
                    delete lightHelpersRef.current[id];
                }
                if (sceneCamerasRef.current[id]) {
                    delete sceneCamerasRef.current[id];
                }
            }
        });

        // Add / Update
        objects.forEach(obj => {
            let mesh = meshesRef.current[obj.id];
            
            if (!mesh) {
                // Create new geometry
                let geometry;
                if (obj.type === 'Model' && obj.modelUrl) {
                    mesh = new THREE.Group(); // Placeholder until loaded
                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;
                    
                    const loader = new THREE.GLTFLoader();
                    loader.load(obj.modelUrl, (gltf) => {
                        const model = gltf.scene;
                        // Center model geometry to group origin so transform gizmo is in the middle
                        const box = new THREE.Box3().setFromObject(model);
                        const center = new THREE.Vector3();
                        box.getCenter(center);
                        model.position.sub(center);
                        mesh.add(model);
                    });
                } else if (obj.type === 'Group') {
                    mesh = new THREE.Group();
                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;
                } else if (obj.type === 'Light') {
                    mesh = new THREE.Group();
                    const helperGeo = new THREE.OctahedronGeometry(0.2);
                    const helperMat = new THREE.MeshBasicMaterial({ color: obj.color, wireframe: true });
                    const helper = new THREE.Mesh(helperGeo, helperMat);
                    mesh.add(helper);
                    
                    let realLight;
                    if (obj.lightType === 'directional') {
                        realLight = new THREE.DirectionalLight(obj.color, obj.intensity || 1);
                        realLight.target.position.set(0, 0, -1);
                        mesh.add(realLight.target);
                    } else if (obj.lightType === 'ambient') {
                        realLight = new THREE.AmbientLight(obj.color, obj.intensity || 1);
                    } else if (obj.lightType === 'sun') {
                        realLight = new THREE.PointLight(obj.color, obj.intensity || 1, obj.distance || 100);
                        const sunGroup = new THREE.Group();
                        const sunGeo = new THREE.SphereGeometry(1, 32, 32);
                        const sunMat = new THREE.MeshBasicMaterial({ color: obj.color });
                        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
                        
                        const glowMat = new THREE.SpriteMaterial({ 
                            map: getSunGlowTexture(), 
                            color: obj.color, 
                            transparent: true, 
                            blending: THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        const glowSprite = new THREE.Sprite(glowMat);
                        glowSprite.scale.set(4, 4, 1);
                        
                        sunGroup.add(sunMesh);
                        sunGroup.add(glowSprite);
                        sunGroup.scale.setScalar(obj.sunSize || 1);
                        
                        mesh.add(sunGroup);
                        mesh.userData.sunMesh = sunGroup;
                    } else {
                        realLight = new THREE.PointLight(obj.color, obj.intensity || 1, obj.distance || 100);
                    }
                    
                    mesh.userData.realLight = realLight;
                    mesh.userData.lightType = obj.lightType;
                    mesh.add(realLight);

                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;
                } else if (obj.type === 'Video' && obj.videoUrl) {
                    mesh = new THREE.Group();
                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;

                    const video = document.createElement('video');
                    video.src = obj.videoUrl;
                    video.loop = true;
                    video.muted = true;
                    video.crossOrigin = "anonymous";
                    video.currentTime = frameRef.current / fps;
                    videosRef.current[obj.id] = video;

                    const texture = new THREE.VideoTexture(video);
                    texture.minFilter = THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    
                    const material = new THREE.MeshStandardMaterial({ 
                        map: texture, 
                        transparent: obj.transparent !== false, 
                        side: THREE.DoubleSide,
                        opacity: obj.opacity !== undefined ? obj.opacity : 1,
                        alphaTest: 0.05,
                        depthWrite: (obj.opacity !== undefined ? obj.opacity : 1) >= 0.99
                    });
                    
                    video.onloadedmetadata = () => {
                        const aspect = video.videoWidth / video.videoHeight;
                        const geometry = new THREE.PlaneGeometry(2 * aspect, 2);
                        const plane = new THREE.Mesh(geometry, material);
                        mesh.add(plane);
                    };
                } else if (obj.type === 'Audio' && obj.audioUrl) {
                    mesh = new THREE.Group(); // invisible helper container
                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;

                    const audio = new Audio(obj.audioUrl);
                    audio.loop = true;
                    audio.volume = obj.volume !== undefined ? obj.volume : 1;
                    audio.currentTime = frameRef.current / fps;
                    audiosRef.current[obj.id] = audio;
                } else if (obj.type === 'Particles') {
                    mesh = new THREE.Group();
                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;
                    mesh.userData.particleType = obj.particleType || 'fire';
                    mesh.userData.particleCount = obj.particleCount || 100;
                    
                    const createParticleSystem = (type, count, color) => {
                        const geo = new THREE.BufferGeometry();
                        const posArray = new Float32Array(count * 3);
                        const colorArray = new Float32Array(count * 3);
                        const velArray = [];
                        const lifeArray = new Float32Array(count);
                        const baseColor = new THREE.Color(color);
                        
                        for(let i=0; i<count; i++){
                            if (type === 'rain') {
                                posArray[i*3] = (Math.random() - 0.5) * 10;
                                posArray[i*3+1] = Math.random() * 10;
                                posArray[i*3+2] = (Math.random() - 0.5) * 10;
                                velArray.push(new THREE.Vector3(0, -Math.random()*8 - 8, 0));
                            } else if (type === 'fire') {
                                posArray[i*3] = (Math.random() - 0.5) * 0.6;
                                posArray[i*3+1] = (Math.random() - 0.5) * 0.2;
                                posArray[i*3+2] = (Math.random() - 0.5) * 0.6;
                                velArray.push(new THREE.Vector3((Math.random()-0.5)*0.8, Math.random()*3 + 1.5, (Math.random()-0.5)*0.8));
                            } else if (type === 'smoke') {
                                posArray[i*3] = (Math.random() - 0.5) * 0.5;
                                posArray[i*3+1] = (Math.random() - 0.5) * 0.5;
                                posArray[i*3+2] = (Math.random() - 0.5) * 0.5;
                                velArray.push(new THREE.Vector3((Math.random()-0.5)*0.8, Math.random()*1.5 + 0.5, (Math.random()-0.5)*0.8));
                            } else { // sparks
                                posArray[i*3] = 0; posArray[i*3+1] = 0; posArray[i*3+2] = 0;
                                velArray.push(new THREE.Vector3((Math.random()-0.5)*8, Math.random()*8 + 2, (Math.random()-0.5)*8));
                            }
                            lifeArray[i] = Math.random();
                            colorArray[i*3] = baseColor.r;
                            colorArray[i*3+1] = baseColor.g;
                            colorArray[i*3+2] = baseColor.b;
                        }
                        
                        geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
                        geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
                        geo.setAttribute('life', new THREE.BufferAttribute(lifeArray, 1));
                        
                        let size = 1.0;
                        if (type === 'rain') size = 0.5;
                        if (type === 'smoke') size = 4.0;
                        if (type === 'sparks') size = 0.3;

                        const mat = new THREE.PointsMaterial({
                            size: size,
                            map: getParticleTexture(type),
                            vertexColors: true,
                            transparent: true,
                            opacity: type === 'smoke' ? 0.6 : 0.9,
                            blending: type === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        
                        return { mesh: new THREE.Points(geo, mat), velocities: velArray, lives: lifeArray, baseColor, baseSize: size };
                    };

                    const system = createParticleSystem(mesh.userData.particleType, mesh.userData.particleCount, obj.particleColor || '#ffaa00');
                    mesh.add(system.mesh);

                    particleSystemsRef.current[obj.id] = {
                        mesh: system.mesh,
                        velocities: system.velocities,
                        lives: system.lives,
                        baseColor: system.baseColor,
                        baseSize: system.baseSize,
                        lastFrame: frameRef.current,
                        lastWorldPos: new THREE.Vector3(),
                        update: (dt, currentObj, isPlaying, currentFrame, currentFps) => {
                            const speed = currentObj._iSpeed !== undefined ? currentObj._iSpeed : (currentObj.particleSpeed !== undefined ? currentObj.particleSpeed : 1);
                            const spread = currentObj._iSpread !== undefined ? currentObj._iSpread : (currentObj.particleSpread !== undefined ? currentObj.particleSpread : 1);
                            const pSize = currentObj._iSize !== undefined ? currentObj._iSize : (currentObj.particleSize !== undefined ? currentObj.particleSize : 1);
                            const pOpacity = currentObj._iOpacity !== undefined ? currentObj._iOpacity : (currentObj.particleOpacity !== undefined ? currentObj.particleOpacity : 1);
                            const pLength = currentObj._iLength !== undefined ? currentObj._iLength : (currentObj.particleLength !== undefined ? currentObj.particleLength : 1);
                            const sync = currentObj.particleSync || false;
                            
                            let actualDt = dt;
                            if (sync) {
                                const sysRef = particleSystemsRef.current[currentObj.id];
                                const frameDiff = currentFrame - (sysRef.lastFrame || 0);
                                actualDt = frameDiff / currentFps;
                                sysRef.lastFrame = currentFrame;
                            }
                            
                            if (system.mesh && system.mesh.material) {
                                system.mesh.material.size = system.baseSize * pSize;
                                const type = mesh.userData.particleType || 'fire';
                                system.mesh.material.opacity = (type === 'smoke' ? 0.6 : 0.9) * pOpacity;
                            }

                            const type = mesh.userData.particleType || 'fire';
                            const positions = system.mesh.geometry.attributes.position.array;
                            const colors = system.mesh.geometry.attributes.color.array;
                            const lives = system.mesh.geometry.attributes.life.array;
                            const count = system.velocities.length;
                            const baseC = system.baseColor;
                            
                            const sysRef = particleSystemsRef.current[currentObj.id];
                            const currentWorldPos = new THREE.Vector3();
                            mesh.getWorldPosition(currentWorldPos);
                            
                            let localDelta = new THREE.Vector3();
                            if (sysRef.lastWorldPos && sysRef.lastWorldPos.lengthSq() > 0) {
                                const deltaWorld = new THREE.Vector3().subVectors(sysRef.lastWorldPos, currentWorldPos);
                                if (deltaWorld.lengthSq() > 0 && deltaWorld.lengthSq() < 100) {
                                    localDelta.copy(deltaWorld).applyQuaternion(mesh.quaternion.clone().invert());
                                }
                            }
                            if (!sysRef.lastWorldPos) sysRef.lastWorldPos = new THREE.Vector3();
                            sysRef.lastWorldPos.copy(currentWorldPos);
                            
                            for(let i=0; i<count; i++){
                                if (localDelta.lengthSq() > 0) {
                                    const inertia = type === 'smoke' ? 0.9 : (type === 'fire' ? 0.85 : 0.6);
                                    positions[i*3] += localDelta.x * inertia;
                                    positions[i*3+1] += localDelta.y * inertia;
                                    positions[i*3+2] += localDelta.z * inertia;
                                }

                                if (actualDt > 0) {
                                    // Make life drain slower if flame is longer
                                    lives[i] -= actualDt * speed * (type === 'smoke' ? 0.3 : 0.8) / Math.max(0.1, pLength);
                                }
                                
                                if (type === 'fire') {
                                    if (actualDt > 0) {
                                        positions[i*3] += system.velocities[i].x * actualDt * speed;
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed * pLength;
                                        positions[i*3+2] += system.velocities[i].z * actualDt * speed;
                                        const pull = Math.max(0.85, 0.98 - (speed * 0.005));
                                        positions[i*3] *= pull;
                                        positions[i*3+2] *= pull;
                                    }
                                    
                                    colors[i*3] = baseC.r * lives[i];
                                    colors[i*3+1] = baseC.g * lives[i] * 0.5; // shift to red as it dies
                                    colors[i*3+2] = baseC.b * lives[i] * 0.1;

                                    if (lives[i] <= 0) {
                                        const tighten = Math.max(0.1, 1 - (speed * 0.05));
                                        positions[i*3] = (Math.random() - 0.5) * 0.6 * spread * tighten;
                                        positions[i*3+1] = (Math.random() - 0.5) * 0.2 * spread;
                                        positions[i*3+2] = (Math.random() - 0.5) * 0.6 * spread * tighten;
                                        lives[i] += 1;
                                    }
                                } else if (type === 'smoke') {
                                    if (actualDt > 0) {
                                        positions[i*3] += system.velocities[i].x * actualDt * speed;
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed * pLength;
                                        positions[i*3+2] += system.velocities[i].z * actualDt * speed;
                                        system.velocities[i].x += (Math.random() - 0.5) * 0.1 * spread;
                                        system.velocities[i].z += (Math.random() - 0.5) * 0.1 * spread;
                                        system.velocities[i].x *= 0.98;
                                        system.velocities[i].z *= 0.98;
                                    }
                                    
                                    const fade = Math.sin(lives[i] * Math.PI);
                                    colors[i*3] = baseC.r * fade;
                                    colors[i*3+1] = baseC.g * fade;
                                    colors[i*3+2] = baseC.b * fade;

                                    if (lives[i] <= 0) {
                                        positions[i*3] = (Math.random() - 0.5) * 0.5 * spread;
                                        positions[i*3+1] = 0;
                                        positions[i*3+2] = (Math.random() - 0.5) * 0.5 * spread;
                                        system.velocities[i].x = (Math.random()-0.5)*0.8 * spread;
                                        system.velocities[i].z = (Math.random()-0.5)*0.8 * spread;
                                        lives[i] += 1;
                                    }
                                } else if (type === 'rain') {
                                    if (actualDt > 0) {
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed;
                                        if (positions[i*3+1] < -5 * spread) {
                                            positions[i*3] = (Math.random() - 0.5) * 10 * spread;
                                            positions[i*3+1] += 10 * spread; 
                                            positions[i*3+2] = (Math.random() - 0.5) * 10 * spread;
                                        }
                                    }
                                    colors[i*3] = baseC.r;
                                    colors[i*3+1] = baseC.g;
                                    colors[i*3+2] = baseC.b;
                                } else if (type === 'sparks') {
                                    if (actualDt > 0) {
                                        system.velocities[i].y -= 15 * actualDt * speed * 0.5; // gravity
                                        positions[i*3] += system.velocities[i].x * actualDt * speed;
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed;
                                        positions[i*3+2] += system.velocities[i].z * actualDt * speed;
                                    }
                                    
                                    colors[i*3] = baseC.r * lives[i];
                                    colors[i*3+1] = baseC.g * lives[i];
                                    colors[i*3+2] = baseC.b * lives[i];

                                    if (lives[i] <= 0 || positions[i*3+1] < -2 * spread) {
                                        positions[i*3] = 0; positions[i*3+1] = 0; positions[i*3+2] = 0;
                                        system.velocities[i].set((Math.random()-0.5)*8*spread, Math.random()*8*spread + 2, (Math.random()-0.5)*8*spread);
                                        lives[i] += 1;
                                    }
                                }
                            }
                            system.mesh.geometry.attributes.position.needsUpdate = true;
                            system.mesh.geometry.attributes.color.needsUpdate = true;
                        }
                    };

                } else {
                    if (obj.type === 'Cube') {
                        geometry = new THREE.BoxGeometry();
                    } else if (obj.type === 'Sphere') {
                        geometry = new THREE.SphereGeometry(0.5, 32, 16);
                    } else if (obj.type === 'Plane') {
                        geometry = new THREE.PlaneGeometry(2, 2);
                        geometry.rotateX(-Math.PI / 2);
                    } else if (obj.type === 'Cylinder') {
                        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                    } else if (obj.type === 'Text') {
                        let currentFont = _defaultFont;
                        if (obj.fontData && window.THREE.Font) {
                            currentFont = new window.THREE.Font(obj.fontData);
                        }
                        
                        if (currentFont && THREE.TextGeometry) {
                            geometry = new THREE.TextGeometry(obj.text || 'Muzam 3D', {
                                font: currentFont,
                                size: obj.fontSize || 1,
                                height: obj.depth || 0.2,
                                curveSegments: 12,
                                bevelEnabled: obj.bevel || false,
                                bevelThickness: 0.03,
                                bevelSize: 0.02,
                                bevelOffset: 0,
                                bevelSegments: 5
                            });
                            geometry.center();
                        } else {
                            geometry = new THREE.BoxGeometry(2, 0.5, 0.2); // Fallback if font not loaded
                        }
                    } else if (obj.type === 'Camera') {
                        // Create a visual representation of the camera
                        geometry = new THREE.BoxGeometry(0.6, 0.4, 0.8);
                        
                        // Also create the actual perspective camera for viewing
                        const cam = new THREE.PerspectiveCamera(45, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
                        sceneCamerasRef.current[obj.id] = cam;
                    }

                    const material = new THREE.MeshStandardMaterial({ 
                        color: obj.color,
                        roughness: obj.roughness !== undefined ? obj.roughness : 0.5,
                        metalness: obj.metalness !== undefined ? obj.metalness : 0.1,
                        transparent: obj.transparent || false,
                        opacity: obj.opacity !== undefined ? obj.opacity : 1,
                        alphaTest: 0.05,
                        depthWrite: (obj.opacity !== undefined ? obj.opacity : 1) >= 0.99
                    });

                    mesh = new THREE.Mesh(geometry, material);
                    
                    if (obj.type === 'Camera') {
                        // Add lens representation
                        const lensGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3);
                        lensGeo.rotateX(Math.PI / 2);
                        const lensMat = new THREE.MeshStandardMaterial({ color: '#222' });
                        const lens = new THREE.Mesh(lensGeo, lensMat);
                        lens.position.z = -0.5;
                        mesh.add(lens);
                    }
                    
                    if (obj.type === 'Text') {
                        mesh.userData.text = obj.text;
                        mesh.userData.fontSize = obj.fontSize;
                        mesh.userData.depth = obj.depth;
                        mesh.userData.bevel = obj.bevel;
                    }

                    scene.add(mesh);
                    meshesRef.current[obj.id] = mesh;
                }
            }

            // Handle hierarchy/parenting
            if (mesh && obj.parentId && meshesRef.current[obj.parentId]) {
                const parentMesh = meshesRef.current[obj.parentId];
                if (mesh.parent !== parentMesh) {
                    parentMesh.add(mesh);
                }
            } else if (mesh && mesh.parent !== scene) {
                scene.add(mesh);
            }

            if (obj.type === 'Particles' && particleSystemsRef.current[obj.id]) {
                const currentCount = obj.particleCount || 100;
                const currentType = obj.particleType || 'fire';
                
                // Recreate if type or count changed
                if (mesh.userData.particleType !== currentType || mesh.userData.particleCount !== currentCount) {
                    mesh.remove(particleSystemsRef.current[obj.id].mesh);
                    
                    const createParticleSystem = (type, count, color) => {
                        const geo = new THREE.BufferGeometry();
                        const posArray = new Float32Array(count * 3);
                        const colorArray = new Float32Array(count * 3);
                        const velArray = [];
                        const lifeArray = new Float32Array(count);
                        const baseColor = new THREE.Color(color);
                        
                        for(let i=0; i<count; i++){
                            if (type === 'rain') {
                                posArray[i*3] = (Math.random() - 0.5) * 10;
                                posArray[i*3+1] = Math.random() * 10;
                                posArray[i*3+2] = (Math.random() - 0.5) * 10;
                                velArray.push(new THREE.Vector3(0, -Math.random()*8 - 8, 0));
                            } else if (type === 'fire') {
                                posArray[i*3] = (Math.random() - 0.5) * 0.6;
                                posArray[i*3+1] = (Math.random() - 0.5) * 0.2;
                                posArray[i*3+2] = (Math.random() - 0.5) * 0.6;
                                velArray.push(new THREE.Vector3((Math.random()-0.5)*0.8, Math.random()*3 + 1.5, (Math.random()-0.5)*0.8));
                            } else if (type === 'smoke') {
                                posArray[i*3] = (Math.random() - 0.5) * 0.5;
                                posArray[i*3+1] = (Math.random() - 0.5) * 0.5;
                                posArray[i*3+2] = (Math.random() - 0.5) * 0.5;
                                velArray.push(new THREE.Vector3((Math.random()-0.5)*0.8, Math.random()*1.5 + 0.5, (Math.random()-0.5)*0.8));
                            } else { // sparks
                                posArray[i*3] = 0; posArray[i*3+1] = 0; posArray[i*3+2] = 0;
                                velArray.push(new THREE.Vector3((Math.random()-0.5)*8, Math.random()*8 + 2, (Math.random()-0.5)*8));
                            }
                            lifeArray[i] = Math.random();
                            colorArray[i*3] = baseColor.r;
                            colorArray[i*3+1] = baseColor.g;
                            colorArray[i*3+2] = baseColor.b;
                        }
                        
                        geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
                        geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
                        geo.setAttribute('life', new THREE.BufferAttribute(lifeArray, 1));
                        
                        let size = 1.0;
                        if (type === 'rain') size = 0.5;
                        if (type === 'smoke') size = 4.0;
                        if (type === 'sparks') size = 0.3;

                        const mat = new THREE.PointsMaterial({
                            size: size,
                            map: getParticleTexture(type),
                            vertexColors: true,
                            transparent: true,
                            opacity: type === 'smoke' ? 0.6 : 0.9,
                            blending: type === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        
                        return { mesh: new THREE.Points(geo, mat), velocities: velArray, lives: lifeArray, baseColor, baseSize: size };
                    };
                    
                    const system = createParticleSystem(currentType, currentCount, obj.particleColor || '#ffaa00');
                    mesh.add(system.mesh);
                    
                    mesh.userData.particleType = currentType;
                    mesh.userData.particleCount = currentCount;
                    
                    particleSystemsRef.current[obj.id] = {
                        mesh: system.mesh,
                        velocities: system.velocities,
                        lives: system.lives,
                        baseColor: system.baseColor,
                        baseSize: system.baseSize,
                        lastFrame: frameRef.current,
                        lastWorldPos: new THREE.Vector3(),
                        update: (dt, currentObj, isPlaying, currentFrame, currentFps) => {
                            const speed = currentObj.particleSpeed !== undefined ? currentObj.particleSpeed : 1;
                            const spread = currentObj.particleSpread !== undefined ? currentObj.particleSpread : 1;
                            const pSize = currentObj.particleSize !== undefined ? currentObj.particleSize : 1;
                            const pOpacity = currentObj.particleOpacity !== undefined ? currentObj.particleOpacity : 1;
                            const pLength = currentObj.particleLength !== undefined ? currentObj.particleLength : 1;
                            const sync = currentObj.particleSync || false;
                            
                            let actualDt = dt;
                            if (sync) {
                                const sysRef = particleSystemsRef.current[currentObj.id];
                                const frameDiff = currentFrame - (sysRef.lastFrame || 0);
                                actualDt = frameDiff / currentFps;
                                sysRef.lastFrame = currentFrame;
                            }

                            if (system.mesh && system.mesh.material) {
                                system.mesh.material.size = system.baseSize * pSize;
                                const type = mesh.userData.particleType || 'fire';
                                system.mesh.material.opacity = (type === 'smoke' ? 0.6 : 0.9) * pOpacity;
                            }

                            const type = mesh.userData.particleType || 'fire';
                            const positions = system.mesh.geometry.attributes.position.array;
                            const colors = system.mesh.geometry.attributes.color.array;
                            const lives = system.mesh.geometry.attributes.life.array;
                            const count = system.velocities.length;
                            const baseC = system.baseColor;
                            
                            const sysRef = particleSystemsRef.current[currentObj.id];
                            const currentWorldPos = new THREE.Vector3();
                            mesh.getWorldPosition(currentWorldPos);
                            
                            let localDelta = new THREE.Vector3();
                            if (sysRef.lastWorldPos && sysRef.lastWorldPos.lengthSq() > 0) {
                                const deltaWorld = new THREE.Vector3().subVectors(sysRef.lastWorldPos, currentWorldPos);
                                if (deltaWorld.lengthSq() > 0 && deltaWorld.lengthSq() < 100) {
                                    localDelta.copy(deltaWorld).applyQuaternion(mesh.quaternion.clone().invert());
                                }
                            }
                            if (!sysRef.lastWorldPos) sysRef.lastWorldPos = new THREE.Vector3();
                            sysRef.lastWorldPos.copy(currentWorldPos);
                            
                            for(let i=0; i<count; i++){
                                if (localDelta.lengthSq() > 0) {
                                    const inertia = type === 'smoke' ? 0.9 : (type === 'fire' ? 0.85 : 0.6);
                                    positions[i*3] += localDelta.x * inertia;
                                    positions[i*3+1] += localDelta.y * inertia;
                                    positions[i*3+2] += localDelta.z * inertia;
                                }

                                if (actualDt > 0) {
                                    // Make life drain slower if flame is longer
                                    lives[i] -= actualDt * speed * (type === 'smoke' ? 0.3 : 0.8) / Math.max(0.1, pLength);
                                }
                                
                                if (type === 'fire') {
                                    if (actualDt > 0) {
                                        positions[i*3] += system.velocities[i].x * actualDt * speed;
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed * pLength;
                                        positions[i*3+2] += system.velocities[i].z * actualDt * speed;
                                        const pull = Math.max(0.85, 0.98 - (speed * 0.005));
                                        positions[i*3] *= pull;
                                        positions[i*3+2] *= pull;
                                    }
                                    
                                    colors[i*3] = baseC.r * lives[i];
                                    colors[i*3+1] = baseC.g * lives[i] * 0.5;
                                    colors[i*3+2] = baseC.b * lives[i] * 0.1;

                                    if (lives[i] <= 0) {
                                        const tighten = Math.max(0.1, 1 - (speed * 0.05));
                                        positions[i*3] = (Math.random() - 0.5) * 0.6 * spread * tighten;
                                        positions[i*3+1] = (Math.random() - 0.5) * 0.2 * spread;
                                        positions[i*3+2] = (Math.random() - 0.5) * 0.6 * spread * tighten;
                                        lives[i] += 1;
                                    }
                                } else if (type === 'smoke') {
                                    if (actualDt > 0) {
                                        positions[i*3] += system.velocities[i].x * actualDt * speed;
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed;
                                        positions[i*3+2] += system.velocities[i].z * actualDt * speed;
                                        system.velocities[i].x += (Math.random() - 0.5) * 0.1 * spread;
                                        system.velocities[i].z += (Math.random() - 0.5) * 0.1 * spread;
                                        system.velocities[i].x *= 0.98;
                                        system.velocities[i].z *= 0.98;
                                    }
                                    
                                    const fade = Math.sin(lives[i] * Math.PI);
                                    colors[i*3] = baseC.r * fade;
                                    colors[i*3+1] = baseC.g * fade;
                                    colors[i*3+2] = baseC.b * fade;

                                    if (lives[i] <= 0) {
                                        positions[i*3] = (Math.random() - 0.5) * 0.5 * spread;
                                        positions[i*3+1] = 0;
                                        positions[i*3+2] = (Math.random() - 0.5) * 0.5 * spread;
                                        system.velocities[i].x = (Math.random()-0.5)*0.8 * spread;
                                        system.velocities[i].z = (Math.random()-0.5)*0.8 * spread;
                                        lives[i] += 1;
                                    }
                                } else if (type === 'rain') {
                                    if (actualDt > 0) {
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed;
                                        if (positions[i*3+1] < -5 * spread) {
                                            positions[i*3] = (Math.random() - 0.5) * 10 * spread;
                                            positions[i*3+1] += 10 * spread; 
                                            positions[i*3+2] = (Math.random() - 0.5) * 10 * spread;
                                        }
                                    }
                                    colors[i*3] = baseC.r;
                                    colors[i*3+1] = baseC.g;
                                    colors[i*3+2] = baseC.b;
                                } else if (type === 'sparks') {
                                    if (actualDt > 0) {
                                        system.velocities[i].y -= 15 * actualDt * speed * 0.5; // gravity
                                        positions[i*3] += system.velocities[i].x * actualDt * speed;
                                        positions[i*3+1] += system.velocities[i].y * actualDt * speed;
                                        positions[i*3+2] += system.velocities[i].z * actualDt * speed;
                                    }
                                    
                                    colors[i*3] = baseC.r * lives[i];
                                    colors[i*3+1] = baseC.g * lives[i];
                                    colors[i*3+2] = baseC.b * lives[i];

                                    if (lives[i] <= 0 || positions[i*3+1] < -2 * spread) {
                                        positions[i*3] = 0; positions[i*3+1] = 0; positions[i*3+2] = 0;
                                        system.velocities[i].set((Math.random()-0.5)*8*spread, Math.random()*8*spread + 2, (Math.random()-0.5)*8*spread);
                                        lives[i] += 1;
                                    }
                                }
                            }
                            system.mesh.geometry.attributes.position.needsUpdate = true;
                            system.mesh.geometry.attributes.color.needsUpdate = true;
                        }
                    };
                } else {
                    const sys = particleSystemsRef.current[obj.id];
                    if (sys && sys.baseColor) {
                        sys.baseColor.set(obj.particleColor || '#ffaa00');
                    }
                }
            }

            if (obj.type === 'Text' && mesh && THREE.TextGeometry) {
                let currentFont = _defaultFont;
                if (obj.fontData && window.THREE.Font) {
                    currentFont = new window.THREE.Font(obj.fontData);
                }

                if (currentFont && (mesh.userData.text !== obj.text || mesh.userData.fontSize !== obj.fontSize || 
                    mesh.userData.depth !== obj.depth || mesh.userData.bevel !== obj.bevel || mesh.userData.fontData !== obj.fontData || mesh.geometry.type === 'BoxGeometry')) {
                    
                    if (mesh.geometry) mesh.geometry.dispose();
                    mesh.geometry = new THREE.TextGeometry(obj.text || 'Muzam 3D', {
                        font: currentFont,
                        size: obj.fontSize || 1,
                        height: obj.depth || 0.2,
                        curveSegments: 12,
                        bevelEnabled: obj.bevel || false,
                        bevelThickness: 0.03,
                        bevelSize: 0.02,
                        bevelOffset: 0,
                        bevelSegments: 5
                    });
                    mesh.geometry.center();
                    
                    mesh.userData.text = obj.text;
                    mesh.userData.fontSize = obj.fontSize;
                    mesh.userData.depth = obj.depth;
                    mesh.userData.bevel = obj.bevel;
                    mesh.userData.fontData = obj.fontData;
                }
            }

            // Simple Keyframe Interpolation logic (if playing or scrubbed)
            let currPos = obj.position;
            let currRot = obj.rotation;
            let currScale = obj.scale;
            let currColor = obj.color;
            let currOpacity = obj.opacity !== undefined ? obj.opacity : 1;
            let currRoughness = obj.roughness !== undefined ? obj.roughness : 0.5;
            let currMetalness = obj.metalness !== undefined ? obj.metalness : 0.1;
            let currIntensity = obj.intensity;
            let currDistance = obj.distance;
            let currSunSize = obj.sunSize;
            let currParticleColor = obj.particleColor;
            let currParticleOpacity = obj.particleOpacity;
            let currParticleCount = obj.particleCount;
            let currParticleSpeed = obj.particleSpeed;
            let currParticleSize = obj.particleSize;
            let currParticleSpread = obj.particleSpread;
            let currParticleLength = obj.particleLength;
            let currFontSize = obj.fontSize;
            let currDepth = obj.depth;
            let currVolume = obj.volume;

            if (obj.keyframes && Object.keys(obj.keyframes).length > 0) {
                const kfKeys = Object.keys(obj.keyframes).map(Number).sort((a,b)=>a-b);
                let prevKf = kfKeys[0];
                let nextKf = kfKeys[kfKeys.length - 1];

                for(let i=0; i<kfKeys.length; i++) {
                    if (frame >= kfKeys[i]) prevKf = kfKeys[i];
                    if (frame <= kfKeys[i]) {
                        nextKf = kfKeys[i];
                        break;
                    }
                }

                const getVal = (k, prop, def) => k[prop] !== undefined ? k[prop] : (obj[prop] !== undefined ? obj[prop] : def);

                if (prevKf === nextKf) {
                    const pk = obj.keyframes[prevKf];
                    currPos = pk.position || currPos;
                    currRot = pk.rotation || currRot;
                    currScale = pk.scale || currScale;
                    currColor = pk.color || currColor;
                    currOpacity = getVal(pk, 'opacity', 1);
                    currRoughness = getVal(pk, 'roughness', 0.5);
                    currMetalness = getVal(pk, 'metalness', 0.1);
                    currIntensity = getVal(pk, 'intensity', 1);
                    currDistance = getVal(pk, 'distance', 10);
                    currSunSize = getVal(pk, 'sunSize', 1);
                    currParticleColor = pk.particleColor || currParticleColor;
                    currParticleOpacity = getVal(pk, 'particleOpacity', 1);
                    currParticleCount = getVal(pk, 'particleCount', 100);
                    currParticleSpeed = getVal(pk, 'particleSpeed', 1);
                    currParticleSize = getVal(pk, 'particleSize', 1);
                    currParticleSpread = getVal(pk, 'particleSpread', 1);
                    currParticleLength = getVal(pk, 'particleLength', 1);
                    currFontSize = getVal(pk, 'fontSize', 1);
                    currDepth = getVal(pk, 'depth', 0.2);
                    currVolume = getVal(pk, 'volume', 1);
                } else {
                    let ratio = (frame - prevKf) / (nextKf - prevKf);
                    ratio = ratio * ratio * (3 - 2 * ratio);

                    const pK = obj.keyframes[prevKf];
                    const nK = obj.keyframes[nextKf];
                    
                    currPos = pK.position.map((v, i) => v + (nK.position[i] - v) * ratio);
                    currScale = pK.scale.map((v, i) => v + (nK.scale[i] - v) * ratio);
                    
                    _tempEuler.set(pK.rotation[0]*Math.PI/180, pK.rotation[1]*Math.PI/180, pK.rotation[2]*Math.PI/180, 'XYZ');
                    _tempQ1.setFromEuler(_tempEuler);
                    _tempEuler.set(nK.rotation[0]*Math.PI/180, nK.rotation[1]*Math.PI/180, nK.rotation[2]*Math.PI/180, 'XYZ');
                    _tempQ2.setFromEuler(_tempEuler);
                    _tempQ1.slerp(_tempQ2, ratio);
                    _tempEuler.setFromQuaternion(_tempQ1);
                    currRot = [_tempEuler.x*180/Math.PI, _tempEuler.y*180/Math.PI, _tempEuler.z*180/Math.PI];

                    const lerpNum = (prop, def) => getVal(pK, prop, def) + (getVal(nK, prop, def) - getVal(pK, prop, def)) * ratio;

                    currColor = '#' + new THREE.Color(pK.color || obj.color).lerp(new THREE.Color(nK.color || obj.color), ratio).getHexString();
                    if (pK.particleColor || nK.particleColor) {
                        currParticleColor = '#' + new THREE.Color(pK.particleColor || obj.particleColor || '#ffaa00').lerp(new THREE.Color(nK.particleColor || obj.particleColor || '#ffaa00'), ratio).getHexString();
                    }
                    
                    currOpacity = lerpNum('opacity', 1);
                    currRoughness = lerpNum('roughness', 0.5);
                    currMetalness = lerpNum('metalness', 0.1);
                    currIntensity = lerpNum('intensity', 1);
                    currDistance = lerpNum('distance', 10);
                    currSunSize = lerpNum('sunSize', 1);
                    currParticleOpacity = lerpNum('particleOpacity', 1);
                    currParticleCount = Math.round(lerpNum('particleCount', 100));
                    currParticleSpeed = lerpNum('particleSpeed', 1);
                    currParticleSize = lerpNum('particleSize', 1);
                    currParticleSpread = lerpNum('particleSpread', 1);
                    currParticleLength = lerpNum('particleLength', 1);
                    currFontSize = lerpNum('fontSize', 1);
                    currDepth = lerpNum('depth', 0.2);
                    currVolume = lerpNum('volume', 1);
                }
            }

            // Temporarily assign interpolated values to obj representation so particle update can read it seamlessly
            if (obj.keyframes && Object.keys(obj.keyframes).length > 0) {
                obj._iSpeed = currParticleSpeed;
                obj._iSpread = currParticleSpread;
                obj._iSize = currParticleSize;
                obj._iOpacity = currParticleOpacity;
                obj._iLength = currParticleLength;
            }

            // Update Global Scene Lighting based on the first Camera found
            if (obj.type === 'Camera' && sceneLightsRef.current) {
                sceneLightsRef.current.ambient.color.set(obj.ambientColor || '#ffffff');
                sceneLightsRef.current.ambient.intensity = obj.ambientIntensity !== undefined ? obj.ambientIntensity : 0.6;
                
                sceneLightsRef.current.directional.color.set(obj.dirColor || '#ffffff');
                sceneLightsRef.current.directional.intensity = obj.dirIntensity !== undefined ? obj.dirIntensity : 0.8;
            }

            // Handle Physics Sync
            if (window.CANNON && physicsWorldRef.current && ['Cube', 'Sphere', 'Plane', 'Cylinder', 'Text', 'Model'].includes(obj.type)) {
                let body = rigidBodiesRef.current[obj.id];
                
                // Recreate body if physics settings changed or it doesn't exist
                const needsBody = obj.physicsType && obj.physicsType !== 'none';
                
                if (needsBody) {
                    if (!body || body.type !== (obj.physicsType === 'static' ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC) || body.mass !== (obj.physicsType === 'static' ? 0 : (obj.physicsMass || 1))) {
                        if (body) physicsWorldRef.current.removeBody(body);
                        
                        let shape;
                        let offset = null;
                        
                        const sX = Math.abs(currScale[0]) || 0.01;
                        const sY = Math.abs(currScale[1]) || 0.01;
                        const sZ = Math.abs(currScale[2]) || 0.01;
                        
                        if (obj.type === 'Sphere') {
                            shape = new CANNON.Sphere(0.5 * Math.max(sX, sY, sZ));
                        } else if (obj.type === 'Plane') {
                            shape = new CANNON.Box(new CANNON.Vec3(1 * sX, 0.05, 1 * sZ));
                        } else {
                            shape = new CANNON.Box(new CANNON.Vec3(0.5 * sX, 0.5 * sY, 0.5 * sZ));
                        }
                        
                        const mat = obj.isMainLand ? physicsWorldRef.current.defaultMaterial : new CANNON.Material();
                        
                        body = new CANNON.Body({
                            mass: obj.physicsType === 'static' ? 0 : (obj.physicsMass || 1),
                            type: obj.physicsType === 'static' ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
                            position: new CANNON.Vec3(currPos[0], currPos[1], currPos[2]),
                            material: mat,
                            linearDamping: 0.01,
                            angularDamping: 0.01
                        });

                        if (!obj.isMainLand && physicsWorldRef.current && physicsWorldRef.current.defaultMaterial) {
                            const mass = obj.physicsMass || 1;
                            const gForce = Math.abs(gravity || 9.82);
                            // Cap maximum restitution to 0.8 to prevent energy gain (extra bouncing) for very light objects
                            const calculatedRestitution = Math.max(0.01, Math.min(0.8, 0.5 / (mass * (gForce / 9.82))));
                            
                            const cm = new CANNON.ContactMaterial(physicsWorldRef.current.defaultMaterial, mat, {
                                friction: obj.roughness !== undefined ? obj.roughness : 0.5,
                                restitution: calculatedRestitution, 
                                contactEquationStiffness: 1e9, 
                                contactEquationRelaxation: 4
                            });
                            physicsWorldRef.current.addContactMaterial(cm);
                            body._contactMat = cm;
                        }

                        if (offset) {
                            body.addShape(shape, offset);
                        } else {
                            body.addShape(shape);
                        }
                        
                        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(currRot[0]*Math.PI/180, currRot[1]*Math.PI/180, currRot[2]*Math.PI/180, 'XYZ'));
                        body.quaternion.set(q.x, q.y, q.z, q.w);
                        
                        physicsWorldRef.current.addBody(body);
                        rigidBodiesRef.current[obj.id] = body;
                    }
                } else if (body) {
                    physicsWorldRef.current.removeBody(body);
                    delete rigidBodiesRef.current[obj.id];
                    body = null;
                }

                if (body) {
                    const startFrame = (obj.physicsStartSec || 0) * fps;
                    const shouldSimulate = isPlaying && obj.physicsType === 'dynamic' && frame >= startFrame;
                    
                    if (!physicsCacheRef.current[obj.id]) {
                        physicsCacheRef.current[obj.id] = {};
                    }
                    const cache = physicsCacheRef.current[obj.id];

                    if (shouldSimulate) {
                        if (body.type !== CANNON.Body.DYNAMIC) {
                            body.type = CANNON.Body.DYNAMIC;
                            body.wakeUp();
                        }
                        
                        // Sync Three.js mesh with Cannon.js body during playback
                        currPos = [body.position.x, body.position.y, body.position.z];
                        const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w), 'XYZ');
                        currRot = [euler.x*180/Math.PI, euler.y*180/Math.PI, euler.z*180/Math.PI];
                        
                        // Save to cache
                        cache[frame] = { pos: [...currPos], rot: [...currRot] };
                    } else {
                        if (body.type !== CANNON.Body.STATIC) {
                            body.type = CANNON.Body.STATIC;
                            body.velocity.set(0,0,0);
                            body.angularVelocity.set(0,0,0);
                        }
                        
                        if (obj.physicsType === 'dynamic') {
                            if (frame < startFrame) {
                                // Clear future cache if we scrub back
                                Object.keys(cache).forEach(f => {
                                    if (parseInt(f) >= frame) delete cache[f];
                                });
                                // Keep original currPos and currRot from keyframes/manual
                            } else {
                                // Find closest previous cached frame
                                let closestFrame = startFrame;
                                const cachedFrames = Object.keys(cache).map(Number).sort((a,b)=>a-b);
                                for (let i = cachedFrames.length - 1; i >= 0; i--) {
                                    if (cachedFrames[i] <= frame) {
                                        closestFrame = cachedFrames[i];
                                        break;
                                    }
                                }
                                
                                if (cache[closestFrame]) {
                                    currPos = cache[closestFrame].pos;
                                    currRot = cache[closestFrame].rot;
                                }
                            }
                        }
                        
                        // Sync Cannon.js body with determined position/rotation
                        body.position.set(currPos[0], currPos[1], currPos[2]);
                        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(currRot[0]*Math.PI/180, currRot[1]*Math.PI/180, currRot[2]*Math.PI/180, 'XYZ'));
                        body.quaternion.set(q.x, q.y, q.z, q.w);
                    }
                }
            }

            // Apply Transforms (avoid applying if we are currently dragging the specific mesh to prevent stutter)
            if (!transformControlRef.current?.dragging || transformControlRef.current.object !== mesh) {
                mesh.position.set(...currPos);
                mesh.rotation.set(
                    currRot[0] * (Math.PI / 180), 
                    currRot[1] * (Math.PI / 180), 
                    currRot[2] * (Math.PI / 180)
                );
                mesh.scale.set(...currScale);
            }
            
            if (obj.type === 'Camera' && sceneCamerasRef.current[obj.id]) {
                const cam = sceneCamerasRef.current[obj.id];
                cam.position.copy(mesh.position);
                cam.rotation.copy(mesh.rotation);
                cam.updateMatrixWorld();
                
                if (!cameraHelpersRef.current[obj.id]) {
                    const helper = new THREE.CameraHelper(cam);
                    scene.add(helper);
                    cameraHelpersRef.current[obj.id] = helper;
                }
                
                const helper = cameraHelpersRef.current[obj.id];
                helper.update();
                
                // Hide the camera mesh and helper if we are looking through it!
                const isVisible = activeCameraId !== obj.id && obj.visible;
                mesh.visible = isVisible;
                helper.visible = isVisible && selectedId === obj.id;
            } else if (obj.type === 'Light') {
                mesh.visible = obj.visible;
                if (mesh.children && mesh.children[0] && mesh.children[0].material) {
                    mesh.children[0].material.color.set(obj.color);
                }
                
                // Recreate light if type changed
                if (mesh.userData.lightType !== obj.lightType) {
                    if (mesh.userData.realLight) {
                        if (mesh.userData.lightType === 'directional') {
                            mesh.remove(mesh.userData.realLight.target);
                        }
                        mesh.remove(mesh.userData.realLight);
                    }
                    if (mesh.userData.sunMesh) {
                        mesh.remove(mesh.userData.sunMesh);
                        if (mesh.userData.sunMesh.isGroup) {
                            mesh.userData.sunMesh.children.forEach(c => {
                                if (c.geometry) c.geometry.dispose();
                                if (c.material) c.material.dispose();
                            });
                        } else {
                            if (mesh.userData.sunMesh.geometry) mesh.userData.sunMesh.geometry.dispose();
                            if (mesh.userData.sunMesh.material) mesh.userData.sunMesh.material.dispose();
                        }
                        mesh.userData.sunMesh = null;
                    }
                    
                    let realLight;
                    if (obj.lightType === 'directional') {
                        realLight = new THREE.DirectionalLight(obj.color, obj.intensity || 1);
                        realLight.target.position.set(0, 0, -1);
                        mesh.add(realLight.target);
                    } else if (obj.lightType === 'ambient') {
                        realLight = new THREE.AmbientLight(obj.color, obj.intensity || 1);
                    } else if (obj.lightType === 'sun') {
                        realLight = new THREE.PointLight(obj.color, obj.intensity || 1, obj.distance || 100);
                        const sunGroup = new THREE.Group();
                        const sunGeo = new THREE.SphereGeometry(1, 32, 32);
                        const sunMat = new THREE.MeshBasicMaterial({ color: obj.color });
                        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
                        
                        const glowMat = new THREE.SpriteMaterial({ 
                            map: getSunGlowTexture(), 
                            color: obj.color, 
                            transparent: true, 
                            blending: THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        const glowSprite = new THREE.Sprite(glowMat);
                        glowSprite.scale.set(4, 4, 1);
                        
                        sunGroup.add(sunMesh);
                        sunGroup.add(glowSprite);
                        sunGroup.scale.setScalar(obj.sunSize || 1);
                        
                        mesh.add(sunGroup);
                        mesh.userData.sunMesh = sunGroup;
                    } else {
                        realLight = new THREE.PointLight(obj.color, obj.intensity || 1, obj.distance || 100);
                    }
                    
                    mesh.userData.realLight = realLight;
                    mesh.userData.lightType = obj.lightType;
                    mesh.add(realLight);
                }
                
                // Update real light properties
                if (mesh.userData.realLight) {
                    mesh.userData.realLight.color.set(currColor);
                    mesh.userData.realLight.intensity = currIntensity !== undefined ? currIntensity : 1;
                    if ((obj.lightType === 'point' || obj.lightType === 'sun') && mesh.userData.realLight.distance !== undefined) {
                        mesh.userData.realLight.distance = currDistance !== undefined ? currDistance : 10;
                    }
                }
                if (obj.lightType === 'sun' && mesh.userData.sunMesh) {
                    if (mesh.userData.sunMesh.isGroup) {
                        mesh.userData.sunMesh.children.forEach(c => {
                            if (c.material) c.material.color.set(currColor);
                        });
                    } else {
                        if (mesh.userData.sunMesh.material) mesh.userData.sunMesh.material.color.set(currColor);
                    }
                    mesh.userData.sunMesh.scale.setScalar(currSunSize !== undefined ? currSunSize : 1);
                }

                // Helper for directional light
                if (obj.lightType === 'directional') {
                    if (!lightHelpersRef.current[obj.id]) {
                        const helper = new THREE.DirectionalLightHelper(mesh.userData.realLight, 1);
                        scene.add(helper);
                        lightHelpersRef.current[obj.id] = helper;
                    }
                    const helper = lightHelpersRef.current[obj.id];
                    helper.update();
                    helper.visible = selectedId === obj.id && obj.visible;
                } else {
                    if (lightHelpersRef.current[obj.id]) {
                        scene.remove(lightHelpersRef.current[obj.id]);
                        lightHelpersRef.current[obj.id].dispose();
                        delete lightHelpersRef.current[obj.id];
                    }
                }
            } else if (obj.type === 'Video') {
                mesh.visible = obj.visible;
                if (mesh.children && mesh.children[0] && mesh.children[0].material) {
                    const mat = mesh.children[0].material;
                    mat.transparent = obj.transparent !== false;
                    mat.opacity = obj.opacity !== undefined ? obj.opacity : 1;
                    mat.alphaTest = 0.05;
                    mat.depthWrite = (obj.opacity !== undefined ? obj.opacity : 1) >= 0.99;
                    mat.needsUpdate = true;
                }
            } else {
                    mesh.visible = obj.visible;

                    let finalOpacity = currOpacity;
                    let finalTransparent = currOpacity < 1 || obj.transparent;
                    let finalDepthWrite = currOpacity >= 0.99;

                if (obj.type === 'Model') {
                    mesh.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.transparent = finalTransparent;
                            child.material.opacity = finalOpacity;
                            child.material.depthWrite = finalDepthWrite;
                            child.material.needsUpdate = true;
                        }
                    });
                }

                    if (mesh.material) {
                        mesh.material.color.set(currColor);
                        mesh.material.roughness = currRoughness;
                        mesh.material.metalness = currMetalness;
                        mesh.material.transparent = finalTransparent;
                        mesh.material.opacity = finalOpacity;
                        mesh.material.alphaTest = 0.05;
                        mesh.material.depthWrite = finalDepthWrite;
                        
                        if (obj.textureUrl) {
                        if (!texturesRef.current[obj.textureUrl]) {
                            const loader = new THREE.TextureLoader();
                            texturesRef.current[obj.textureUrl] = loader.load(obj.textureUrl, () => {
                                mesh.material.needsUpdate = true;
                            });
                            mesh.material.map = texturesRef.current[obj.textureUrl];
                        } else {
                            if (mesh.material.map !== texturesRef.current[obj.textureUrl]) {
                                mesh.material.map = texturesRef.current[obj.textureUrl];
                            }
                        }
                    } else {
                        if (mesh.material.map) {
                            mesh.material.map = null;
                        }
                    }
                    
                    mesh.material.needsUpdate = true;
                }
            }
        });

        // Update TransformControl Attach/Detach and Space
        if (transformControlRef.current) {
            transformControlRef.current.setMode(transformMode);
            transformControlRef.current.setSpace(space);
            
            if (selectedIds.length > 1) {
                if (transformControlRef.current.object !== transformProxyRef.current) {
                    transformControlRef.current.attach(transformProxyRef.current);
                }
                
                // Position proxy at the center of all selected meshes IF NOT DRAGGING
                if (!transformControlRef.current.dragging) {
                    const center = new THREE.Vector3();
                    let count = 0;
                    selectedIds.forEach(id => {
                        const mesh = meshesRef.current[id];
                        if (mesh) {
                            const worldPos = new THREE.Vector3();
                            mesh.getWorldPosition(worldPos);
                            center.add(worldPos);
                            count++;
                        }
                    });
                    if (count > 0) {
                        center.divideScalar(count);
                        transformProxyRef.current.position.copy(center);
                        transformProxyRef.current.rotation.set(0,0,0);
                        transformProxyRef.current.scale.set(1,1,1);
                        transformProxyRef.current.updateMatrixWorld();
                    }
                }
            } else if (selectedIds.length === 1) {
                const selId = selectedIds[0];
                const selectedObj = objects.find(o => o.id === selId);
                // Detach transform gizmo if we are actively looking through this very camera!
                if (selId && meshesRef.current[selId] && selectedObj?.visible && selectedObj?.type !== 'Audio' && activeCameraId !== selId) {
                    if (transformControlRef.current.object !== meshesRef.current[selId]) {
                        transformControlRef.current.attach(meshesRef.current[selId]);
                    }
                } else {
                    transformControlRef.current.detach();
                }
            } else {
                transformControlRef.current.detach();
            }
        }

    }, [objects, selectedId, selectedIds, transformMode, space, frame]);

    // Sync videos & audios with timeline frame
    React.useEffect(() => {
        Object.values(videosRef.current).forEach(video => {
            if (!video) return;
            const duration = video.duration || 1;
            const targetTime = (frame / fps) % duration;
            if (isPlaying) {
                if (video.paused) video.play().catch(e => console.warn('Video autoplay prevented', e));
                // Allow a larger drift threshold during playback to avoid decoding stutters
                if (Math.abs(video.currentTime - targetTime) > 0.5) {
                    video.currentTime = targetTime;
                }
            } else {
                if (!video.paused) video.pause();
                if (Math.abs(video.currentTime - targetTime) > 0.05) {
                    video.currentTime = targetTime;
                }
            }
        });

        Object.entries(audiosRef.current).forEach(([id, audio]) => {
            if (!audio) return;
            const obj = objects.find(o => o.id === id);
            if (!obj) return;
            
            const startFrame = obj.startFrame || 0;
            const durationFrames = obj.durationFrames || (fps * 10);
            const endFrame = startFrame + durationFrames;
            
            if (obj.keyframes && obj.keyframes[frame] && obj.keyframes[frame].volume !== undefined) {
                audio.volume = obj.keyframes[frame].volume;
            } else if (obj.volume !== undefined) {
                // If there's an interpolated value assigned during scene graph sync, use it, else default
                audio.volume = obj.volume;
            }

            const targetTime = Math.max(0, (frame - startFrame) / fps);

            // Play logic based on frame boundaries
            if (frame >= startFrame && frame < endFrame) {
                if (isPlaying) {
                    if (audio.paused) audio.play().catch(e => console.warn('Audio autoplay prevented', e));
                    if (Math.abs(audio.currentTime - targetTime) > 0.5) {
                        audio.currentTime = targetTime;
                    }
                } else {
                    if (!audio.paused) audio.pause();
                    if (Math.abs(audio.currentTime - targetTime) > 0.05) {
                        audio.currentTime = targetTime;
                    }
                }
            } else {
                if (!audio.paused) audio.pause();
            }
        });
    }, [frame, isPlaying, fps, objects]);

    // Custom Active Camera Controls
    React.useEffect(() => {
        if (!activeCameraId || !rendererRef.current) return;
        const canvas = rendererRef.current.domElement;

        let isDragging = false;
        let dragMode = null;
        let prevX = 0, prevY = 0;
        let prevTouchDist = 0;
        let touchMode = null;
        
        const sensitivity = { look: 0.004, pan: 0.015, zoom: 0.02 };

        const getCamData = () => {
            const camObj = latestObjectsRef.current.find(o => o.id === activeCameraId);
            const cam = sceneCamerasRef.current[activeCameraId];
            return { camObj, cam };
        };

        const applyUpdate = (newPos, newRot, camObj, save = false) => {
            if (!save) {
                // Direct mutation for buttery smoothness without React overhead during drag
                const mesh = meshesRef.current[activeCameraId];
                const cam = sceneCamerasRef.current[activeCameraId];
                if (mesh && cam) {
                    mesh.position.set(...newPos);
                    mesh.rotation.set(newRot[0] * Math.PI/180, newRot[1] * Math.PI/180, newRot[2] * Math.PI/180);
                    cam.position.copy(mesh.position);
                    cam.rotation.copy(mesh.rotation);
                    cam.updateMatrixWorld();
                }
                camObj._tempPos = newPos;
                camObj._tempRot = newRot;
                return;
            }

            const finalPos = camObj._tempPos || newPos;
            const finalRot = camObj._tempRot || newRot;
            const updates = { position: finalPos, rotation: finalRot };
            if (camObj.keyframes && Object.keys(camObj.keyframes).length > 0) {
                 updates.keyframes = {
                     ...camObj.keyframes,
                     [frameRef.current]: {
                         position: finalPos,
                         rotation: finalRot,
                         scale: camObj.scale
                     }
                 };
            }
            updateObject(activeCameraId, updates, false); // save=true triggers history save
            camObj._tempPos = null;
            camObj._tempRot = null;
        };

        const handleMovement = (deltaX, deltaY, mode) => {
            const { camObj, cam } = getCamData();
            if (!camObj || !cam) return;
            
            const basePos = camObj._tempPos || camObj.position;
            const baseRot = camObj._tempRot || camObj.rotation;

            const newPos = [...basePos];
            const newRot = [...baseRot];

            if (mode === 'look') {
                const euler = new THREE.Euler(
                    baseRot[0] * Math.PI/180,
                    baseRot[1] * Math.PI/180,
                    baseRot[2] * Math.PI/180,
                    'YXZ'
                );
                euler.y -= deltaX * sensitivity.look;
                euler.x -= deltaY * sensitivity.look;
                euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
                
                newRot[0] = euler.x * 180/Math.PI;
                newRot[1] = euler.y * 180/Math.PI;
                newRot[2] = euler.z * 180/Math.PI;
            } else if (mode === 'pan') {
                cam.rotation.set(baseRot[0]*Math.PI/180, baseRot[1]*Math.PI/180, baseRot[2]*Math.PI/180, 'YXZ');
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
                
                // Standard 3D panning (drag scene): Mouse moves right -> Camera moves left
                const move = new THREE.Vector3()
                    .addScaledVector(right, -deltaX * sensitivity.pan)
                    .addScaledVector(up, deltaY * sensitivity.pan);
                
                newPos[0] += move.x;
                newPos[1] += move.y;
                newPos[2] += move.z;
            }
            applyUpdate(newPos, newRot, camObj);
        };

        const onPointerDown = (e) => {
            if (e.button === 0) dragMode = 'look';
            else if (e.button === 2) dragMode = 'pan';
            else return;
            
            isDragging = true;
            prevX = e.clientX;
            prevY = e.clientY;
            
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch(err) {}

            canvas.addEventListener('pointermove', onPointerMove);
            canvas.addEventListener('pointerup', onPointerUp);
            canvas.addEventListener('pointercancel', onPointerUp);
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - prevX;
            const deltaY = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;
            handleMovement(deltaX, deltaY, dragMode);
        };

        const onPointerUp = (e) => {
            if (isDragging) {
                isDragging = false;
                dragMode = null;
                
                try {
                    canvas.releasePointerCapture(e.pointerId);
                } catch(err) {}

                canvas.removeEventListener('pointermove', onPointerMove);
                canvas.removeEventListener('pointerup', onPointerUp);
                canvas.removeEventListener('pointercancel', onPointerUp);
                
                const { camObj } = getCamData();
                if (camObj && (camObj._tempPos || camObj._tempRot)) {
                    applyUpdate(camObj._tempPos || camObj.position, camObj._tempRot || camObj.rotation, camObj, true);
                }
            }
        };

        const onWheel = (e) => {
            e.preventDefault();
            const { camObj, cam } = getCamData();
            if (!camObj || !cam) return;

            const basePos = camObj._tempPos || camObj.position;
            const baseRot = camObj._tempRot || camObj.rotation;
            
            cam.rotation.set(baseRot[0]*Math.PI/180, baseRot[1]*Math.PI/180, baseRot[2]*Math.PI/180, 'YXZ');
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            const move = new THREE.Vector3().addScaledVector(forward, -e.deltaY * sensitivity.zoom);
            
            const newPos = [
                basePos[0] + move.x,
                basePos[1] + move.y,
                basePos[2] + move.z
            ];
            applyUpdate(newPos, baseRot, camObj);
        };

        const onContextMenu = (e) => { e.preventDefault(); };

        const onTouchStart = (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                touchMode = 'look';
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                touchMode = 'pan_zoom';
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                prevTouchDist = Math.sqrt(dx*dx + dy*dy);
                prevX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                prevY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            }
        };

        const onTouchMove = (e) => {
            e.preventDefault();
            if (!touchMode) return;

            if (touchMode === 'look' && e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - prevX;
                const deltaY = e.touches[0].clientY - prevY;
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
                handleMovement(deltaX, deltaY, 'look');
            } else if (touchMode === 'pan_zoom' && e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const deltaX = cx - prevX;
                const deltaY = cy - prevY;
                const deltaDist = dist - prevTouchDist;

                prevX = cx;
                prevY = cy;
                prevTouchDist = dist;

                handleMovement(deltaX, deltaY, 'pan');
                
                const { camObj, cam } = getCamData();
                if (camObj && cam && Math.abs(deltaDist) > 1) {
                    const basePos = camObj._tempPos || camObj.position;
                    const baseRot = camObj._tempRot || camObj.rotation;
                    cam.rotation.set(baseRot[0]*Math.PI/180, baseRot[1]*Math.PI/180, baseRot[2]*Math.PI/180, 'YXZ');
                    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
                    const move = new THREE.Vector3().addScaledVector(forward, deltaDist * sensitivity.zoom * 0.5);
                    const newPos = [
                        basePos[0] + move.x,
                        basePos[1] + move.y,
                        basePos[2] + move.z
                    ];
                    applyUpdate(newPos, baseRot, camObj);
                }
            }
        };

        const onTouchEnd = (e) => {
            e.preventDefault();
            if (e.touches.length === 0) {
                touchMode = null;
                // trigger history save
                const { camObj } = getCamData();
                if (camObj) applyUpdate(camObj.position, camObj.rotation, camObj, true);
            }
            else if (e.touches.length === 1) {
                touchMode = 'look';
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            }
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', onContextMenu);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('contextmenu', onContextMenu);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
            
            // Clean up document listeners just in case
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
        };
    }, [activeCameraId, updateObject]);

    return (
        <div className="flex-1 relative bg-dark-900" data-name="Viewport" data-file="components/Viewport.js">
            {/* Mobile Add Tools (Vertical Left) */}
            <div className="lg:hidden absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-auto bg-dark-800/90 backdrop-blur border border-dark-700 rounded p-1 shadow-lg max-h-[80vh] overflow-y-auto scrollbar-none">
                <button onClick={() => addObject('Cube')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Cube"><div className="icon-box text-sm"></div></button>
                <button onClick={() => addObject('Sphere')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Sphere"><div className="icon-circle text-sm"></div></button>
                <button onClick={() => addObject('Plane')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Plane"><div className="icon-square text-sm"></div></button>
                <button onClick={() => addObject('Cylinder')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Cylinder"><div className="icon-cylinder text-sm"></div></button>
                <div className="w-full h-px bg-dark-600 my-1"></div>
                <button onClick={() => addObject('Camera')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Camera"><div className="icon-camera text-sm"></div></button>
                <button onClick={() => addObject('Light')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Light"><div className="icon-sun text-sm"></div></button>
                <button onClick={() => document.getElementById('mobile-video-upload').click()} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Video"><div className="icon-video text-sm"></div></button>
                <button onClick={() => addObject('Text')} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Text"><div className="icon-type text-sm"></div></button>
                <button onClick={() => document.getElementById('audio-upload-input').click()} className="p-1.5 hover:bg-dark-700 rounded text-gray-300" title="Audio"><div className="icon-music text-sm"></div></button>
                <input type="file" id="mobile-video-upload" onChange={handleVideoUpload} accept="video/mp4,video/webm" className="hidden" />
            </div>

            {/* Active Camera Indicator */}
            {activeCameraId && (
                <div className="absolute top-2 right-2 lg:top-4 lg:left-4 flex flex-col gap-2 pointer-events-none z-10">
                    <div className="bg-dark-900/90 backdrop-blur-md text-[10px] lg:text-xs px-2 py-1 lg:px-3 lg:py-1.5 rounded-md border border-primary text-primary pointer-events-auto shadow-lg flex items-center gap-1.5 font-medium">
                        <div className="icon-camera text-xs lg:text-sm"></div> 
                        <span className="hidden sm:inline">{`Camera View: ${objects.find(o => o.id === activeCameraId)?.name}`}</span>
                        <span className="sm:hidden">Cam</span>
                    </div>
                </div>
            )}
            
            {/* Transform Space Toggle & Main Land */}
            <div className="absolute bottom-[140px] left-1/2 -translate-x-1/2 lg:bottom-auto lg:top-4 flex gap-2 pointer-events-none z-10 items-center">
                <div className="bg-dark-900/90 backdrop-blur rounded border border-dark-700 pointer-events-auto shadow-lg flex overflow-hidden">
                    <button 
                        onClick={() => setSpace('world')} 
                        className={`px-3 py-1 text-xs hover:bg-dark-700 transition-colors ${space === 'world' ? 'text-primary bg-dark-700' : 'text-gray-400'}`}
                    >
                        World
                    </button>
                    <button 
                        onClick={() => setSpace('local')} 
                        className={`px-3 py-1 text-xs hover:bg-dark-700 transition-colors ${space === 'local' ? 'text-primary bg-dark-700' : 'text-gray-400'}`}
                    >
                        Local
                    </button>
                </div>
                
                {selectedIds.length === 1 && (
                    <button 
                        onClick={() => {
                            const obj = objects.find(o => o.id === selectedIds[0]);
                            if (obj) {
                                const isMainLand = !obj.isMainLand;
                                updateObject(selectedIds[0], { 
                                    isMainLand, 
                                    physicsType: isMainLand ? 'static' : obj.physicsType 
                                });
                            }
                        }}
                        className={`bg-dark-900/90 backdrop-blur rounded border pointer-events-auto shadow-lg px-3 py-1 text-xs transition-colors flex items-center gap-1.5 ${objects.find(o => o.id === selectedIds[0])?.isMainLand ? 'border-green-500/50 text-green-400' : 'border-dark-700 text-gray-400 hover:bg-dark-700 hover:text-white'}`}
                        title="Set as infinite solid floor for physics"
                    >
                        <div className="icon-mountain"></div> Main Land
                    </button>
                )}
            </div>

            <div className="absolute bottom-[140px] right-2 lg:bottom-auto lg:top-4 lg:right-4 flex flex-col gap-2 pointer-events-none z-10">
                <div className="bg-dark-900/90 backdrop-blur rounded border border-dark-700 pointer-events-auto shadow-lg flex flex-col overflow-hidden">
                    <button onClick={() => setTransformMode('translate')} className={`p-2 hover:bg-dark-700 hover:text-white ${transformMode === 'translate' ? 'text-primary' : 'text-gray-400'}`} title="Move (W)"><div className="icon-move"></div></button>
                    <button onClick={() => setTransformMode('rotate')} className={`p-2 hover:bg-dark-700 hover:text-white border-t border-dark-700 ${transformMode === 'rotate' ? 'text-primary' : 'text-gray-400'}`} title="Rotate (E)"><div className="icon-rotate-cw"></div></button>
                    <button onClick={() => setTransformMode('scale')} className={`p-2 hover:bg-dark-700 hover:text-white border-t border-dark-700 ${transformMode === 'scale' ? 'text-primary' : 'text-gray-400'}`} title="Scale (R)"><div className="icon-maximize"></div></button>
                </div>
            </div>

            <div ref={containerRef} className="w-full h-full outline-none"></div>
        </div>
    );
}