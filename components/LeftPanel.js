function LeftPanel() {
    const { objects, setObjects, saveHistory, selectedId, setSelectedId, selectedIds, setSelectedIds, addObject, updateObject, activeMobilePanel } = React.useContext(SceneContext);
    const fileInputRef = React.useRef(null);
    const [uploadTargetId, setUploadTargetId] = React.useState(null);
    const [editingId, setEditingId] = React.useState(null);
    const [size, setSize] = React.useState({ w: 224 });
    const hierarchyRef = React.useRef(null);
    const [dragSelect, setDragSelect] = React.useState(false);
    const dragBoxRef = React.useRef(null);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const [collapsedGroups, setCollapsedGroups] = React.useState(new Set());
    const [showAddMenu, setShowAddMenu] = React.useState(false);

    const toggleGroup = (e, id) => {
        e.stopPropagation();
        const newSet = new Set(collapsedGroups);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setCollapsedGroups(newSet);
    };

    const videoInputRef = React.useRef(null);

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (selectedIds.length > 1) {
                    // Calculate center of selected objects
                    let cx = 0, cy = 0, cz = 0;
                    let count = 0;
                    objects.forEach(o => {
                        if (selectedIds.includes(o.id) && !o.parentId) {
                            cx += o.position[0]; cy += o.position[1]; cz += o.position[2];
                            count++;
                        }
                    });
                    if (count > 0) { cx /= count; cy /= count; cz /= count; }

                    const groupId = 'obj_' + Date.now();
                    const group = {
                        id: groupId,
                        type: 'Group',
                        name: `Group ${objects.length + 1}`,
                        position: [cx, cy, cz],
                        rotation: [0, 0, 0],
                        scale: [1, 1, 1],
                        color: '#aaaaaa',
                        visible: true,
                        keyframes: {}
                    };

                    const newObjs = objects.map(o => {
                        if (selectedIds.includes(o.id) && !o.parentId) {
                            return { 
                                ...o, 
                                parentId: groupId,
                                // Offset local position relative to new group center
                                position: [o.position[0] - cx, o.position[1] - cy, o.position[2] - cz]
                            };
                        }
                        return o;
                    }).concat(group);

                    setObjects(newObjs);
                    saveHistory(newObjs);
                    setSelectedId(groupId);
                    setSelectedIds([groupId]);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, objects, setObjects, saveHistory, addObject, setSelectedId, setSelectedIds]);

    const handleSelect = (e, id) => {
        if (e.ctrlKey || e.metaKey) {
            if (selectedIds.includes(id)) {
                const newIds = selectedIds.filter(sid => sid !== id);
                setSelectedIds(newIds);
                if (selectedId === id) setSelectedId(newIds.length > 0 ? newIds[0] : null);
            } else {
                setSelectedIds([...selectedIds, id]);
                setSelectedId(id);
            }
        } else {
            setSelectedId(id);
            setSelectedIds([id]);
        }
    };

    // Right-click drag selection
    const handleHierarchyPointerDown = (e) => {
        if (e.button === 2) { // Right click
            setDragSelect(true);
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            if (dragBoxRef.current) {
                dragBoxRef.current.style.display = 'block';
                dragBoxRef.current.style.left = `${e.clientX}px`;
                dragBoxRef.current.style.top = `${e.clientY}px`;
                dragBoxRef.current.style.width = '0px';
                dragBoxRef.current.style.height = '0px';
            }

            const onMove = (ev) => {
                if (dragBoxRef.current) {
                    const minX = Math.min(dragStartRef.current.x, ev.clientX);
                    const minY = Math.min(dragStartRef.current.y, ev.clientY);
                    const w = Math.abs(ev.clientX - dragStartRef.current.x);
                    const h = Math.abs(ev.clientY - dragStartRef.current.y);
                    dragBoxRef.current.style.left = `${minX}px`;
                    dragBoxRef.current.style.top = `${minY}px`;
                    dragBoxRef.current.style.width = `${w}px`;
                    dragBoxRef.current.style.height = `${h}px`;

                    // Check intersections with items
                    const newSelected = [];
                    const items = document.querySelectorAll('.hierarchy-item');
                    items.forEach(item => {
                        const rect = item.getBoundingClientRect();
                        if (!(rect.left > minX + w || rect.right < minX || rect.top > minY + h || rect.bottom < minY)) {
                            newSelected.push(item.dataset.id);
                        }
                    });
                    if (newSelected.length > 0) {
                        setSelectedIds(newSelected);
                        if (!newSelected.includes(selectedId)) setSelectedId(newSelected[0]);
                    }
                }
            };
            const onUp = () => {
                setDragSelect(false);
                if (dragBoxRef.current) dragBoxRef.current.style.display = 'none';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        }
    };

    const handleTextureUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !uploadTargetId) return;
        const url = URL.createObjectURL(file);
        updateObject(uploadTargetId, { textureUrl: url, transparent: true });
        e.target.value = null; // reset
    };

    const handleResizeStart = (e) => {
        e.stopPropagation();
        const startClientX = e.clientX;
        const startW = size.w;

        const onMove = (ev) => {
            const deltaX = ev.clientX - startClientX;
            setSize({ w: Math.max(200, Math.min(800, startW + deltaX)) });
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    };

    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        addObject('Video', { videoUrl: url, name: file.name, transparent: true });
        e.target.value = null; // reset
    };

    return (
        <div 
            className={`panel-bg flex-col shrink-0 relative z-30 border-r border-dark-600 ${activeMobilePanel === 'left' ? 'flex absolute inset-0' : 'hidden lg:flex'}`} 
            style={{ width: activeMobilePanel === 'left' ? '100%' : `${size.w}px`, height: '100%' }}
            data-name="LeftPanel" data-file="components/LeftPanel.js"
        >
            <div className="block border-b border-dark-700 shrink-0">
                <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-dark-800 transition-colors"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                >
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0 flex items-center gap-2">
                        <div className="icon-plus-circle text-primary"></div> Add Object
                    </h3>
                    <div className={`icon-chevron-${showAddMenu ? 'up' : 'down'} text-gray-500 text-xs`}></div>
                </div>
                
                {showAddMenu && (
                    <div className="px-4 pb-4">
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                            <button onClick={() => addObject('Cube')} className="bg-dark-700 hover:bg-dark-600 text-xs py-1.5 px-3 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap">
                                <div className="icon-box"></div> Cube
                            </button>
                            <button onClick={() => addObject('Sphere')} className="bg-dark-700 hover:bg-dark-600 text-xs py-1.5 px-3 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap">
                                <div className="icon-circle"></div> Sphere
                            </button>
                            <button onClick={() => addObject('Plane')} className="bg-dark-700 hover:bg-dark-600 text-xs py-1.5 px-3 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap">
                                <div className="icon-square"></div> Plane
                            </button>
                            <button onClick={() => addObject('Cylinder')} className="bg-dark-700 hover:bg-dark-600 text-xs py-1.5 px-3 rounded flex items-center gap-1.5 transition-colors whitespace-nowrap">
                                <div className="icon-cylinder"></div> Cylinder
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <button onClick={() => addObject('Particles')} className="col-span-2 bg-dark-700 hover:bg-dark-600 text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors border border-dark-600">
                                <div className="icon-sparkles text-lg"></div> Particle Emitter
                            </button>
                            <button onClick={() => addObject('Camera')} className="bg-dark-700 hover:bg-dark-600 text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors border border-dark-600">
                                <div className="icon-camera text-lg"></div> Camera
                            </button>
                            <button onClick={() => addObject('Light')} className="bg-dark-700 hover:bg-dark-600 text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors border border-dark-600">
                                <div className="icon-sun text-lg"></div> Light
                            </button>
                            <button onClick={() => videoInputRef.current.click()} className="col-span-2 bg-dark-700 hover:bg-dark-600 text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors border border-dark-600">
                                <div className="icon-video text-lg"></div> Add Video
                            </button>
                            <button onClick={() => addObject('Text')} className="col-span-2 bg-dark-700 hover:bg-dark-600 text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors border border-dark-600">
                                <div className="icon-type text-lg"></div> Add Text
                            </button>
                            <button onClick={() => document.getElementById('audio-upload-input').click()} className="col-span-2 bg-dark-700 hover:bg-dark-600 text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors border border-dark-600">
                                <div className="icon-music text-lg"></div> Add Audio
                            </button>
                            <input type="file" ref={videoInputRef} onChange={handleVideoUpload} accept="video/mp4,video/webm" className="hidden" />
                            <input type="file" id="audio-upload-input" onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) addObject('Audio', { audioUrl: URL.createObjectURL(file), name: file.name });
                                e.target.value = null;
                            }} accept="audio/*,video/*" className="hidden" />
                        </div>
                    </div>
                )}
            </div>

            <div className="px-4 py-3 border-b border-dark-700 shrink-0 flex items-center justify-between bg-dark-800">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0">Hierarchy</h3>
                <span className="bg-dark-600 px-2 py-0.5 rounded text-[10px]">{objects.length}</span>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto relative scrollbar-thin" onPointerDown={handleHierarchyPointerDown} onContextMenu={e => e.preventDefault()}>
                <input type="file" ref={fileInputRef} onChange={handleTextureUpload} accept="image/*" className="hidden" />
                <div className="flex flex-col gap-1" ref={hierarchyRef}>
                    {(() => {
                        const renderHierarchy = (parentId, level = 0) => {
                            return objects.filter(o => (parentId === null ? !o.parentId : o.parentId === parentId)).map(obj => {
                                const hasChildren = objects.some(o => o.parentId === obj.id);
                                return (
                                    <div key={obj.id}>
                                        <div 
                                            data-id={obj.id}
                                            onClick={(e) => handleSelect(e, obj.id)}
                                            className={`hierarchy-item pr-3 py-1.5 text-sm rounded cursor-pointer flex items-center gap-2 transition-colors ${selectedIds?.includes(obj.id) ? 'bg-primary text-white' : 'hover:bg-dark-700 text-gray-300'}`}
                                            style={{ paddingLeft: `${level * 16 + 12}px` }}
                                        >
                                            {level > 0 && <div className="icon-corner-down-right text-[10px] text-gray-500 opacity-50 shrink-0"></div>}
                                            <div className={`icon-${obj.type === 'Group' ? 'folder' : obj.type === 'Cube' ? 'box' : obj.type === 'Sphere' ? 'circle' : obj.type === 'Plane' ? 'square' : obj.type === 'Camera' ? 'camera' : obj.type === 'Model' ? 'box' : obj.type === 'Text' ? 'type' : obj.type === 'Audio' ? 'music' : 'cylinder'} text-xs opacity-70 shrink-0`} onDoubleClick={() => setEditingId(obj.id)}></div>
                                            {editingId === obj.id ? (
                                                <input 
                                                    autoFocus
                                                    className="flex-1 bg-dark-900 border border-primary px-1 text-sm text-white outline-none rounded min-w-[50px]"
                                                    defaultValue={obj.name}
                                                    onBlur={(e) => { updateObject(obj.id, { name: e.target.value }); setEditingId(null); }}
                                                    onKeyDown={(e) => { if(e.key === 'Enter') { updateObject(obj.id, { name: e.target.value }); setEditingId(null); } }}
                                                />
                                            ) : (
                                                <span className="truncate flex-1" onDoubleClick={() => setEditingId(obj.id)}>{obj.name}</span>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setEditingId(obj.id); }} className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Rename"><div className="icon-pencil text-[10px]"></div></button>
                                            {['Cube', 'Sphere', 'Plane', 'Cylinder', 'Model', 'Text'].includes(obj.type) && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setUploadTargetId(obj.id); fileInputRef.current.click(); }}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 shrink-0"
                                                    title="Add Texture"
                                                >
                                                    <div className="icon-image text-[10px]"></div> Add
                                                </button>
                                            )}
                                            {!obj.visible && <div className="icon-eye-off text-xs opacity-50 ml-1 shrink-0"></div>}
                                            {hasChildren && (
                                                <button 
                                                    onClick={(e) => toggleGroup(e, obj.id)} 
                                                    className="ml-auto p-1 text-gray-400 hover:text-white hover:bg-dark-600 rounded transition-colors shrink-0"
                                                >
                                                    <div className={`icon-chevron-${collapsedGroups.has(obj.id) ? 'up' : 'down'} text-[10px]`}></div>
                                                </button>
                                            )}
                                        </div>
                                        {hasChildren && !collapsedGroups.has(obj.id) && renderHierarchy(obj.id, level + 1)}
                                    </div>
                                );
                            });
                        };
                        return renderHierarchy(null, 0);
                    })()}
                    {objects.length === 0 && (
                        <div className="text-center text-sm text-gray-500 py-4">Scene is empty</div>
                    )}
                </div>
            </div>
            
            {/* Drag Selection Box */}
            <div ref={dragBoxRef} className="fixed border border-primary bg-primary/20 pointer-events-none z-50 hidden"></div>

            {/* Resize Handle */}
            <div className="absolute top-0 bottom-0 right-0 w-1.5 cursor-ew-resize z-40 hover:bg-primary/20 transition-colors" onPointerDown={handleResizeStart}></div>
        </div>
    );
}
