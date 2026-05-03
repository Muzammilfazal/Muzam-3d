const SliderInput = ({ label, min, max, step, value, onChange, accentClass = "accent-primary" }) => {
    const [localStr, setLocalStr] = React.useState(value === undefined ? '' : String(value));
    
    React.useEffect(() => {
        if (parseFloat(localStr) !== value && !isNaN(value)) {
            setLocalStr(String(value));
        }
    }, [value]);

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400 uppercase">{label}</span>
                <input 
                    type="number" 
                    value={localStr} 
                    onChange={e => {
                        setLocalStr(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) onChange(val);
                    }} 
                    onBlur={() => {
                        setLocalStr(value === undefined ? '' : String(value));
                    }}
                    className="text-[10px] text-gray-300 bg-dark-900 border border-dark-600 rounded px-1.5 py-0.5 text-right w-16 outline-none focus:border-primary transition-colors"
                    step="any"
                />
            </div>
            <input 
                type="range" min={min} max={max} step={step} 
                value={value !== undefined ? value : min} 
                onChange={e => {
                    const val = parseFloat(e.target.value);
                    setLocalStr(String(val));
                    onChange(val);
                }} 
                className={`w-full ${accentClass}`} 
            />
        </div>
    );
};

const Vector3Input = ({ label, prop, values, onChange, onBlur }) => (
    <div className="mb-5">
        <span className="label-sm">{label}</span>
        <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center bg-dark-900 rounded-md border border-dark-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden transition-shadow">
                <div className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-1.5 h-full flex items-center border-r border-dark-700 select-none">X</div>
                <input type="number" value={values[0]} onChange={e => onChange(prop, 0, e.target.value)} onBlur={onBlur} className="w-full bg-transparent text-sm px-2 py-1.5 outline-none font-mono" step="0.001" />
            </div>
            <div className="flex items-center bg-dark-900 rounded-md border border-dark-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden transition-shadow">
                <div className="bg-green-500/10 text-green-400 text-xs font-bold px-2 py-1.5 h-full flex items-center border-r border-dark-700 select-none">Y</div>
                <input type="number" value={values[1]} onChange={e => onChange(prop, 1, e.target.value)} onBlur={onBlur} className="w-full bg-transparent text-sm px-2 py-1.5 outline-none font-mono" step="0.001" />
            </div>
            <div className="flex items-center bg-dark-900 rounded-md border border-dark-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden transition-shadow">
                <div className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-1.5 h-full flex items-center border-r border-dark-700 select-none">Z</div>
                <input type="number" value={values[2]} onChange={e => onChange(prop, 2, e.target.value)} onBlur={onBlur} className="w-full bg-transparent text-sm px-2 py-1.5 outline-none font-mono" step="0.001" />
            </div>
        </div>
    </div>
);

function RightPanel() {
    const { objects, selectedId, selectedIds, setSelectedId, updateObject, updateMultipleObjects, deleteObject, frame, activeCameraId, setActiveCameraId, activeMobilePanel, symmetryMode, setSymmetryMode } = React.useContext(SceneContext);
    
    const [size, setSize] = React.useState({ w: 288 });
    const fileInputRef = React.useRef(null);
    const videoInputRef = React.useRef(null);
    const fontInputRef = React.useRef(null);

    const moveStateRef = React.useRef({ action: null, amount: 0 });
    const moveRafRef = React.useRef(null);
    const camTransformRef = React.useRef({ position: [0,0,0], rotation: [0,0,0] });

    React.useEffect(() => {
        return () => {
            if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
        };
    }, []);

    const handlePropUpdate = (updates) => {
        const applyAutoKeyframe = (obj, currentUpdates) => {
            if (obj.keyframes && Object.keys(obj.keyframes).length > 0) {
                return {
                    ...currentUpdates,
                    keyframes: {
                        ...obj.keyframes,
                        [frame]: {
                            position: [...obj.position],
                            rotation: [...obj.rotation],
                            scale: [...obj.scale],
                            color: obj.color,
                            opacity: obj.opacity !== undefined ? obj.opacity : 1,
                            roughness: obj.roughness !== undefined ? obj.roughness : 0.5,
                            metalness: obj.metalness !== undefined ? obj.metalness : 0.1,
                            intensity: obj.intensity,
                            distance: obj.distance,
                            sunSize: obj.sunSize,
                            particleColor: obj.particleColor,
                            particleOpacity: obj.particleOpacity,
                            particleCount: obj.particleCount,
                            particleSpeed: obj.particleSpeed,
                            particleSize: obj.particleSize,
                            particleSpread: obj.particleSpread,
                            particleLength: obj.particleLength,
                            fontSize: obj.fontSize,
                            depth: obj.depth,
                            volume: obj.volume,
                            ...currentUpdates
                        }
                    }
                };
            }
            return currentUpdates;
        };

        if (selectedIds && selectedIds.length > 1) {
            const validTypes = ['Cube', 'Sphere', 'Plane', 'Cylinder', 'Text', 'Model'];
            const updatesArray = selectedIds
                .filter(id => {
                    const obj = objects.find(o => o.id === id);
                    return obj && validTypes.includes(obj.type);
                })
                .map(id => {
                    const obj = objects.find(o => o.id === id);
                    return { id, updates: applyAutoKeyframe(obj, updates) };
                });
            if (updatesArray.length > 0) {
                updateMultipleObjects(updatesArray);
            }
        } else {
            const obj = objects.find(o => o.id === selectedId);
            updateObject(selectedId, applyAutoKeyframe(obj, updates));
        }
    };

    const handleResizeStart = (e) => {
        e.stopPropagation();
        const startClientX = e.clientX;
        const startW = size.w;

        const onMove = (ev) => {
            const deltaX = ev.clientX - startClientX;
            // Negative deltaX because we're resizing from the left edge of the right panel
            setSize({ w: Math.max(250, Math.min(800, startW - deltaX)) });
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    };

    const handleFontUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !selectedId) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target.result);
                updateObject(selectedId, { fontData: json });
            } catch(err) {
                alert("Invalid font file. Please upload a valid Three.js typeface JSON file.");
            }
        };
        reader.readAsText(file);
        e.target.value = null; // reset
    };

    const selectedObj = objects.find(o => o.id === selectedId);

    React.useEffect(() => {
        // Prevent overwriting transform reference while user is holding down camera control buttons
        if (selectedObj && !moveStateRef.current?.action) {
            camTransformRef.current.position = [...selectedObj.position];
            camTransformRef.current.rotation = [...selectedObj.rotation];
        }
    }, [selectedId, selectedObj?.position, selectedObj?.rotation]);

    if (!selectedObj) {
        const { gravity, setGravity } = React.useContext(SceneContext);
        return (
            <div 
                className={`panel-bg flex-col shrink-0 relative z-30 border-l border-dark-600 ${activeMobilePanel === 'right' ? 'flex absolute inset-0' : 'hidden lg:flex'}`}
                style={{ width: activeMobilePanel === 'right' ? '100%' : `${size.w}px`, height: '100%' }}
            >
                <div className="p-5 border-b border-dark-700 flex items-center justify-between bg-dark-800/80 sticky top-0 z-10 backdrop-blur shrink-0">
                    <span className="font-semibold text-lg text-white">Scene Settings</span>
                </div>
                <div className="p-4 overflow-y-auto flex-1 scrollbar-thin">
                    <div className="mb-6 bg-dark-900 border border-dark-700 rounded-md p-3">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="icon-settings"></div> Global Physics
                        </h4>
                        <SliderInput 
                            label="Gravity (m/s²)" 
                            min={-30} max={30} step={0.1} 
                            value={gravity} 
                            onChange={setGravity} 
                        />
                    </div>
                    <div className="text-center text-gray-500 text-sm mt-8">Select an object to view its properties</div>
                </div>
                {/* Resize Handle */}
                <div className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize z-40 hover:bg-primary/20 transition-colors" onPointerDown={handleResizeStart}></div>
            </div>
        );
    }

    const handleChange = (prop, index, value) => {
        const numVal = parseFloat(value) || 0;
        const newArr = [...selectedObj[prop]];
        newArr[index] = numVal;
        
        const updates = { [prop]: newArr };
        
        // Auto Keyframe system: triggers if object already has at least one keyframe
        if (selectedObj.keyframes && Object.keys(selectedObj.keyframes).length > 0) {
            updates.keyframes = {
                ...selectedObj.keyframes,
                [frame]: {
                    position: prop === 'position' ? newArr : [...selectedObj.position],
                    rotation: prop === 'rotation' ? newArr : [...selectedObj.rotation],
                    scale: prop === 'scale' ? newArr : [...selectedObj.scale]
                }
            };
        }
        
        updateObject(selectedId, updates, true); // skip history during rapid input typing
    };

    const handleBlur = () => {
        // Save to history once user finishes typing
        updateObject(selectedId, {});
    };

    const handleLocalCameraMove = (action, amount, saveHistory = false) => {
        if (!window.THREE) return;
        const cam = new THREE.PerspectiveCamera();
        const startPos = camTransformRef.current.position;
        const startRot = camTransformRef.current.rotation;
        
        cam.position.set(...startPos);
        cam.rotation.set(
            startRot[0] * Math.PI/180,
            startRot[1] * Math.PI/180,
            startRot[2] * Math.PI/180,
            'YXZ'
        );

        if (action === 'zoom') cam.translateZ(-amount);
        if (action === 'panX') cam.translateX(amount);
        if (action === 'panY') cam.translateY(amount);
        if (action === 'lookX') cam.rotateX(amount * Math.PI/180);
        if (action === 'lookY') cam.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), amount * Math.PI/180);
        if (action === 'rollZ') cam.rotateZ(amount * Math.PI/180);

        // Clamp Pitch to avoid flipping upside down
        const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));

        const newPos = [cam.position.x, cam.position.y, cam.position.z];
        const newRot = [
            euler.x * 180/Math.PI,
            euler.y * 180/Math.PI,
            euler.z * 180/Math.PI
        ];

        camTransformRef.current.position = newPos;
        camTransformRef.current.rotation = newRot;

        const updates = { position: newPos, rotation: newRot };

        if (selectedObj.keyframes && Object.keys(selectedObj.keyframes).length > 0) {
            updates.keyframes = {
                ...selectedObj.keyframes,
                [frame]: {
                    position: newPos,
                    rotation: newRot,
                    scale: selectedObj.scale
                }
            };
        }

        updateObject(selectedId, updates, !saveHistory);
    };

    const startMove = (action, amount) => {
        stopMove(); // clear any previous movement safely
        moveStateRef.current = { action, amount };
        
        let lastTime = performance.now();
        const loop = (time) => {
            if (!moveStateRef.current.action) return;
            const dt = time - lastTime;
            lastTime = time;
            const timeScale = Math.min(dt / 16.66, 3); // Normalize to 60fps
            handleLocalCameraMove(moveStateRef.current.action, moveStateRef.current.amount * timeScale);
            moveRafRef.current = requestAnimationFrame(loop);
        };
        moveRafRef.current = requestAnimationFrame(loop);
    };

    const stopMove = () => {
        if (moveStateRef.current.action) {
            const action = moveStateRef.current.action;
            moveStateRef.current.action = null;
            if (moveRafRef.current) {
                cancelAnimationFrame(moveRafRef.current);
                moveRafRef.current = null;
            }
            handleLocalCameraMove(action, 0, true); // save history
        }
    };

    const btnProps = (action, amount) => ({
        onPointerDown: (e) => { 
            e.preventDefault(); 
            try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
            startMove(action, amount); 
        },
        onPointerUp: (e) => { 
            try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
            stopMove(); 
        },
        onPointerCancel: stopMove,
        onLostPointerCapture: stopMove,
        onContextMenu: (e) => e.preventDefault(),
        className: "bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded flex items-center justify-center p-1 active:bg-dark-600 active:text-white transition-colors touch-none"
    });

    const CameraControls = () => (
        <div className="mb-6 bg-dark-900 border border-dark-700 rounded-md p-3 select-none touch-none">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="icon-camera"></div> Camera Controls
            </h4>
            
            {/* Zoom & Roll Control */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                    <span className="text-[10px] text-gray-500 uppercase block mb-1 text-center">Zoom</span>
                    <div className="flex gap-1">
                        <button {...btnProps('zoom', -0.15)} className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded py-1.5 flex justify-center text-gray-400 hover:text-white active:bg-dark-600">
                            <div className="icon-minus text-sm pointer-events-none"></div>
                        </button>
                        <button {...btnProps('zoom', 0.15)} className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded py-1.5 flex justify-center text-gray-400 hover:text-white active:bg-dark-600">
                            <div className="icon-plus text-sm pointer-events-none"></div>
                        </button>
                    </div>
                </div>
                <div>
                    <span className="text-[10px] text-gray-500 uppercase block mb-1 text-center">Roll (Z)</span>
                    <div className="flex gap-1">
                        <button {...btnProps('rollZ', 1.5)} className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded py-1.5 flex justify-center text-gray-400 hover:text-white active:bg-dark-600">
                            <div className="icon-rotate-ccw text-sm pointer-events-none"></div>
                        </button>
                        <button {...btnProps('rollZ', -1.5)} className="flex-1 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded py-1.5 flex justify-center text-gray-400 hover:text-white active:bg-dark-600">
                            <div className="icon-rotate-cw text-sm pointer-events-none"></div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Pan Controls */}
                <div>
                    <span className="text-[10px] text-gray-500 uppercase block mb-1 text-center">Pan</span>
                    <div className="grid grid-cols-3 grid-rows-3 gap-1 max-w-[90px] mx-auto">
                        <div></div>
                        <button {...btnProps('panY', 0.1)}><div className="icon-chevron-up text-xs pointer-events-none text-gray-400"></div></button>
                        <div></div>
                        <button {...btnProps('panX', -0.1)}><div className="icon-chevron-left text-xs pointer-events-none text-gray-400"></div></button>
                        <div className="flex items-center justify-center text-[10px] text-gray-600 icon-move"></div>
                        <button {...btnProps('panX', 0.1)}><div className="icon-chevron-right text-xs pointer-events-none text-gray-400"></div></button>
                        <div></div>
                        <button {...btnProps('panY', -0.1)}><div className="icon-chevron-down text-xs pointer-events-none text-gray-400"></div></button>
                        <div></div>
                    </div>
                </div>

                {/* Look Controls */}
                <div>
                    <span className="text-[10px] text-gray-500 uppercase block mb-1 text-center">Look</span>
                    <div className="grid grid-cols-3 grid-rows-3 gap-1 max-w-[90px] mx-auto">
                        <div></div>
                        <button {...btnProps('lookX', 1.5)} className="bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded flex items-center justify-center p-1 active:bg-dark-600">
                            <div className="icon-chevron-up text-xs pointer-events-none text-primary"></div>
                        </button>
                        <div></div>
                        <button {...btnProps('lookY', 1.5)} className="bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded flex items-center justify-center p-1 active:bg-dark-600">
                            <div className="icon-chevron-left text-xs pointer-events-none text-primary"></div>
                        </button>
                        <div className="flex items-center justify-center text-[10px] text-primary/50 icon-eye"></div>
                        <button {...btnProps('lookY', -1.5)} className="bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded flex items-center justify-center p-1 active:bg-dark-600">
                            <div className="icon-chevron-right text-xs pointer-events-none text-primary"></div>
                        </button>
                        <div></div>
                        <button {...btnProps('lookX', -1.5)} className="bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded flex items-center justify-center p-1 active:bg-dark-600">
                            <div className="icon-chevron-down text-xs pointer-events-none text-primary"></div>
                        </button>
                        <div></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-3 text-[9px] text-gray-500 text-center uppercase tracking-wide">
                Press & Hold to move
            </div>
        </div>
    );

    return (
        <div 
            className={`panel-bg flex-col shrink-0 relative z-30 border-l border-dark-600 ${activeMobilePanel === 'right' ? 'flex absolute inset-0' : 'hidden lg:flex'}`} 
            style={{ width: activeMobilePanel === 'right' ? '100%' : `${size.w}px`, height: '100%' }}
            data-name="RightPanel" data-file="components/RightPanel.js"
        >
            <div className="p-5 border-b border-dark-700 flex items-center justify-between bg-dark-800/80 sticky top-0 z-10 backdrop-blur shrink-0">
                <input 
                    type="text" 
                    value={selectedObj.name} 
                    onChange={e => updateObject(selectedId, { name: e.target.value })}
                    className="bg-transparent font-semibold text-lg focus:outline-none focus:text-primary transition-colors w-3/4"
                />
                <button onClick={() => updateObject(selectedId, { visible: !selectedObj.visible })} className="p-1.5 rounded-md hover:bg-dark-700 text-gray-400 hover:text-white transition-colors">
                    <div className={selectedObj.visible ? "icon-eye" : "icon-eye-off"}></div>
                </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 scrollbar-thin">
                {selectedObj.type === 'Camera' && (
                    <div className="mb-6">
                        <button 
                            onClick={() => setActiveCameraId(activeCameraId === selectedId ? null : selectedId)}
                            className={`w-full py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm ${activeCameraId === selectedId ? 'bg-primary text-white shadow-primary/20' : 'bg-dark-700 hover:bg-dark-600 text-gray-200 hover:text-white'}`}
                        >
                            <div className="icon-camera"></div> 
                            {activeCameraId === selectedId ? 'Exit Camera View' : 'Look Through Camera'}
                        </button>
                    </div>
                )}

                {selectedObj.type === 'Light' && (
                    <div className="mb-6 bg-dark-900 border border-dark-700 rounded-md p-3">
                        <h4 className="text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="icon-sun"></div> Light Settings
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-gray-400 uppercase block mb-1">Type</span>
                                <select 
                                    value={selectedObj.lightType || 'point'} 
                                    onChange={e => updateObject(selectedId, { lightType: e.target.value })}
                                    className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white outline-none"
                                >
                                    <option value="point">Point Light</option>
                                    <option value="directional">Directional</option>
                                    <option value="sun">Sun (Glowing Sphere)</option>
                                    <option value="ambient">Ambient</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 uppercase">Color</span>
                                <input type="color" value={selectedObj.color || '#ffffff'} onChange={e => handlePropUpdate({ color: e.target.value })} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                            </div>
                            <SliderInput 
                                label="Intensity" 
                                min={0} max={5} step={0.1} 
                                value={selectedObj.intensity !== undefined ? selectedObj.intensity : 1} 
                                onChange={val => handlePropUpdate({ intensity: val })} 
                                accentClass="accent-yellow-500"
                            />
                            {(selectedObj.lightType === 'point' || selectedObj.lightType === 'sun') && (
                                <SliderInput 
                                    label={selectedObj.lightType === 'sun' ? "Light Field (Distance)" : "Distance"} 
                                    min={1} max={selectedObj.lightType === 'sun' ? 500 : 100} step={1} 
                                    value={selectedObj.distance !== undefined ? selectedObj.distance : (selectedObj.lightType === 'sun' ? 100 : 10)} 
                                    onChange={val => handlePropUpdate({ distance: val })} 
                                    accentClass="accent-yellow-500"
                                />
                            )}
                            {selectedObj.lightType === 'sun' && (
                                <SliderInput 
                                    label="Sun Glow Size" 
                                    min={0.1} max={2.5} step={0.1} 
                                    value={selectedObj.sunSize !== undefined ? selectedObj.sunSize : 1} 
                                    onChange={val => handlePropUpdate({ sunSize: val })} 
                                    accentClass="accent-yellow-500"
                                />
                            )}
                            
                            {(selectedObj.lightType === 'ambient' || selectedObj.lightType === 'directional') && (
                                <div className="pt-3 border-t border-dark-700 mt-3">
                                    <div className="text-[10px] text-gray-500 uppercase mb-2">Global Lighting overrides</div>
                                    <p className="text-[9px] text-gray-400">Settings here now control scene defaults.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {selectedObj.type === 'Particles' && (
                    <div className="mb-6 bg-dark-900 border border-dark-700 rounded-md p-3">
                        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="icon-sparkles"></div> Particles
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-gray-400 uppercase block mb-1">Type</span>
                                <select 
                                    value={selectedObj.particleType || 'fire'} 
                                    onChange={e => updateObject(selectedId, { particleType: e.target.value })}
                                    className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white outline-none"
                                >
                                    <option value="fire">Fire</option>
                                    <option value="smoke">Smoke</option>
                                    <option value="rain">Rain</option>
                                    <option value="sparks">Sparks</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 uppercase">Color</span>
                                <input type="color" value={selectedObj.particleColor || '#ffaa00'} onChange={e => handlePropUpdate({ particleColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                            </div>
                            <SliderInput 
                                label="Opacity" 
                                min={0} max={1} step={0.05} 
                                value={selectedObj.particleOpacity !== undefined ? selectedObj.particleOpacity : 1} 
                                onChange={val => handlePropUpdate({ particleOpacity: val })} 
                            />
                            {(() => {
                                const pType = selectedObj.particleType || 'fire';
                                let maxSpeed = 10, maxCount = 5000, maxSize = 5, maxSpread = 5;
                                if (pType === 'smoke') { maxSpeed = 1.5; maxCount = 500; maxSpread = 10; }
                                else if (pType === 'fire') { maxSpeed = 5; maxCount = 500; maxSize = 2; }
                                else if (pType === 'rain') { maxSpeed = 1.5; maxCount = 2200; maxSize = 3; maxSpread = 5; }
                                
                                return (
                                    <>
                                        <SliderInput 
                                            label="Count" 
                                            min={10} max={maxCount} step={10} 
                                            value={selectedObj.particleCount || 100} 
                                            onChange={val => handlePropUpdate({ particleCount: parseInt(val) })} 
                                        />
                                        <SliderInput 
                                            label="Speed" 
                                            min={0.01} max={maxSpeed} step={0.01} 
                                            value={selectedObj.particleSpeed || 1} 
                                            onChange={val => handlePropUpdate({ particleSpeed: val })} 
                                        />
                                        <SliderInput 
                                            label="Size" 
                                            min={0.01} max={maxSize} step={0.01} 
                                            value={selectedObj.particleSize || 1} 
                                            onChange={val => handlePropUpdate({ particleSize: val })} 
                                        />
                                        <SliderInput 
                                            label="Spread / Area" 
                                            min={0.01} max={maxSpread} step={0.01} 
                                            value={selectedObj.particleSpread || 1} 
                                            onChange={val => handlePropUpdate({ particleSpread: val })} 
                                        />
                                    </>
                                );
                            })()}
                            {(selectedObj.particleType === 'fire' || selectedObj.particleType === 'smoke') && (
                                <SliderInput 
                                    label="Particle Length" 
                                    min={0.01} max={1} step={0.01} 
                                    value={selectedObj.particleLength || 1} 
                                    onChange={val => handlePropUpdate({ particleLength: val })} 
                                />
                            )}
                            <div className="flex items-center gap-2 pt-2 border-t border-dark-700">
                                <input type="checkbox" id={`psync-toggle-${selectedId}`} checked={selectedObj.particleSync || false} onChange={e => updateObject(selectedId, { particleSync: e.target.checked })} className="accent-primary" />
                                <label htmlFor={`psync-toggle-${selectedId}`} className="text-[10px] text-gray-300 select-none cursor-pointer uppercase">Sync with Timeline</label>
                            </div>
                        </div>
                    </div>
                )}

                {selectedObj.type === 'Audio' && (
                    <div className="mb-6 bg-dark-900 border border-dark-700 rounded-md p-3">
                        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="icon-music"></div> Audio Settings
                        </h4>
                        <div className="space-y-3">
                            <SliderInput 
                                label="Volume" 
                                min={0} max={1} step={0.05} 
                                value={selectedObj.volume !== undefined ? selectedObj.volume : 1} 
                                onChange={val => handlePropUpdate({ volume: val })} 
                            />
                        </div>
                    </div>
                )}

                {selectedObj.type === 'Camera' && (
                    <>
                        <CameraControls />
                    </>
                )}
                
                {selectedObj.type !== 'Audio' && (
                    <>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-dark-700 pb-2">Transform</h3>
                        <Vector3Input label="Position" prop="position" values={selectedObj.position} onChange={handleChange} onBlur={handleBlur} />
                        <Vector3Input label="Rotation" prop="rotation" values={selectedObj.rotation} onChange={handleChange} onBlur={handleBlur} />
                        <Vector3Input label="Scale" prop="scale" values={selectedObj.scale} onChange={handleChange} onBlur={handleBlur} />
                    </>
                )}

                {selectedObj.type === 'Text' && (
                    <div className="mb-6 bg-dark-900 border border-dark-700 rounded-md p-3 mt-4">
                        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <div className="icon-type"></div> Text Settings
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-gray-400 uppercase block mb-1">Content</span>
                                <input 
                                    type="text" 
                                    value={selectedObj.text || ''} 
                                    onChange={e => updateObject(selectedId, { text: e.target.value })}
                                    className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-primary"
                                />
                            </div>
                            <SliderInput 
                                label="Font Size" 
                                min={0.1} max={5} step={0.1} 
                                value={selectedObj.fontSize !== undefined ? selectedObj.fontSize : 1} 
                                onChange={val => handlePropUpdate({ fontSize: val })} 
                            />
                            <SliderInput 
                                label="Extrusion Depth" 
                                min={0.01} max={2} step={0.01} 
                                value={selectedObj.depth !== undefined ? selectedObj.depth : 0.2} 
                                onChange={val => handlePropUpdate({ depth: val })} 
                            />
                            <div className="flex items-center gap-2 pt-1">
                                <input type="checkbox" id="bevel-toggle" checked={selectedObj.bevel || false} onChange={e => updateObject(selectedId, { bevel: e.target.checked })} className="accent-primary" />
                                <label htmlFor="bevel-toggle" className="text-xs text-gray-300 select-none cursor-pointer">Enable Bevel</label>
                            </div>
                            <div className="pt-2 border-t border-dark-700 mt-2">
                                <button 
                                    onClick={() => fontInputRef.current.click()}
                                    className="w-full bg-dark-700 hover:bg-dark-600 text-xs py-1.5 rounded flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <div className="icon-upload text-[10px]"></div> Load Custom Font (.json)
                                </button>
                                <input type="file" ref={fontInputRef} onChange={handleFontUpload} accept=".json" className="hidden" />
                            </div>
                        </div>
                    </div>
                )}



                {['Cube', 'Sphere', 'Plane', 'Cylinder', 'Text', 'Model'].includes(selectedObj.type) && (
                    <>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 mt-6 border-b border-dark-700 pb-2">Physics (Auto-Simulation)</h3>
                        <div className="space-y-3 mb-6 bg-dark-900 border border-dark-700 rounded-md p-3">
                            <div>
                                <span className="text-[10px] text-gray-400 uppercase block mb-1">Body Type</span>
                                <select 
                                    value={selectedObj.physicsType || 'none'} 
                                    onChange={e => updateObject(selectedId, { physicsType: e.target.value })}
                                    className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs text-white outline-none"
                                >
                                    <option value="none">None (Keyframe only)</option>
                                    <option value="dynamic">Dynamic (Falls & Bounces)</option>
                                    <option value="static">Static (Immovable wall/floor)</option>
                                </select>
                            </div>
                            {selectedObj.physicsType === 'dynamic' && (
                                <>
                                    <SliderInput 
                                        label="Mass (kg)" 
                                        min={0.1} max={100} step={0.1} 
                                        value={selectedObj.physicsMass || 1} 
                                        onChange={val => updateObject(selectedId, { physicsMass: val })} 
                                        accentClass="accent-green-500"
                                    />
                                    <div className="pt-2 border-t border-dark-700 mt-2">
                                        <SliderInput 
                                            label="Start Falling At (Sec)" 
                                            min={0} max={120} step={0.1} 
                                            value={selectedObj.physicsStartSec || 0} 
                                            onChange={val => updateObject(selectedId, { physicsStartSec: val })} 
                                            accentClass="accent-green-500"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 mt-6 border-b border-dark-700 pb-2">Material</h3>
                        
                        <div className="space-y-4 mb-4">
                    <div>
                        <span className="label-sm">Presets</span>
                        <div className="flex gap-2">
                            <button onClick={() => handlePropUpdate({ roughness: 1, metalness: 0 })} className="flex-1 bg-dark-700 hover:bg-dark-600 text-xs py-1 rounded text-gray-300">Matte</button>
                            <button onClick={() => handlePropUpdate({ roughness: 0.1, metalness: 0 })} className="flex-1 bg-dark-700 hover:bg-dark-600 text-xs py-1 rounded text-gray-300">Glossy</button>
                            <button onClick={() => handlePropUpdate({ roughness: 0.2, metalness: 1 })} className="flex-1 bg-dark-700 hover:bg-dark-600 text-xs py-1 rounded text-gray-300">Metallic</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="label-sm w-16 mb-0">Color</span>
                        <input 
                            type="color" 
                            value={selectedObj.color} 
                            onChange={e => handlePropUpdate({ color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-xs text-gray-400 uppercase">{selectedObj.color}</span>
                    </div>

                    <SliderInput 
                        label="Opacity" 
                        min={0} max={1} step={0.05} 
                        value={selectedObj.opacity !== undefined ? selectedObj.opacity : 1} 
                        onChange={val => handlePropUpdate({ opacity: val, transparent: val < 1 })} 
                    />
                    <SliderInput 
                        label="Roughness" 
                        min={0} max={1} step={0.05} 
                        value={selectedObj.roughness !== undefined ? selectedObj.roughness : 0.5} 
                        onChange={val => handlePropUpdate({ roughness: val })} 
                    />
                    <SliderInput 
                        label="Metalness" 
                        min={0} max={1} step={0.05} 
                        value={selectedObj.metalness !== undefined ? selectedObj.metalness : 0.1} 
                        onChange={val => handlePropUpdate({ metalness: val })} 
                    />
                </div>
                    </>
                )}

                <div className="mt-8 border-t border-dark-700 pt-4">
                    <button 
                        onClick={() => deleteObject(selectedId)}
                        className="w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <div className="icon-trash"></div> Delete Object
                    </button>
                </div>
            </div>
            
            {/* Resize Handle */}
            <div className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize z-40 hover:bg-primary/20 transition-colors" onPointerDown={handleResizeStart}></div>
        </div>
    );
}
