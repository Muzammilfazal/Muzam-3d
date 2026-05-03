const SceneContext = React.createContext();

function SceneProvider({ children }) {
    const [objects, setObjects] = React.useState([]);
    const [history, setHistory] = React.useState([[]]); // Start with empty scene
    const [historyIndex, setHistoryIndex] = React.useState(0);
    
    const [selectedId, setSelectedId] = React.useState(null);
    const [selectedIds, setSelectedIds] = React.useState([]);
    const [frame, setFrame] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [transformMode, setTransformMode] = React.useState('translate');
    const [activeCameraId, setActiveCameraId] = React.useState(null);
    const [isRendering, setIsRendering] = React.useState(false);
    const [renderModalOpen, setRenderModalOpen] = React.useState(false);
    const [fps, setFps] = React.useState(30);
    const [uiScale, setUiScale] = React.useState(1);
    const [activeMobilePanel, setActiveMobilePanel] = React.useState('viewport');
    const [gravity, setGravity] = React.useState(-9.82);
    const [symmetryMode, setSymmetryMode] = React.useState(true);

    const saveHistory = (newObjects) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(window.structuredClone ? structuredClone(newObjects) : JSON.parse(JSON.stringify(newObjects)));
        if (newHistory.length > 6) newHistory.shift(); // Keep last 5 actions + initial
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setObjects(history[historyIndex - 1]);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setObjects(history[historyIndex + 1]);
        }
    };

    const addObject = (type, extraData = {}) => {
        let defaultExtras = {};
        if (type === 'Camera') {
            defaultExtras = {
                ambientColor: '#ffffff',
                ambientIntensity: 0.6,
                dirColor: '#ffffff',
                dirIntensity: 0.8
            };
        } else if (type === 'Light') {
            defaultExtras = {
                lightType: 'point', // point, directional, ambient
                intensity: 1,
                distance: 10,
            };
        } else if (type === 'Text') {
            defaultExtras = {
                text: 'Muzam 3D',
                fontSize: 1,
                depth: 0.2,
                bevel: false
            };
        } else if (type === 'Audio') {
            defaultExtras = {
                volume: 1.0,
                name: extraData.name || 'Audio Track'
            };
        } else if (type === 'Group') {
            defaultExtras = {
                name: extraData.name || 'Group',
                childrenIds: extraData.childrenIds || []
            };
        } else if (type === 'Particles') {
            defaultExtras = {
                particleType: 'fire', // fire, smoke, rain, sparks
                particleCount: 100,
                particleSize: 1,
                particleSpeed: 1,
                particleSpread: 1,
                particleSync: false,
                particleColor: '#ffaa00',
                particleOpacity: 1,
                particleLength: 1
            };
        }

        const newObj = {
            id: 'obj_' + Date.now(),
            type,
            name: extraData.name || `${type} ${objects.length + 1}`,
            position: [0, 2, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            color: type === 'Camera' ? '#ff4444' : type === 'Light' ? '#ffd700' : '#aaaaaa',
            visible: true,
            keyframes: {}, // frameNumber: { position, rotation, scale }
            ...defaultExtras,
            ...extraData
        };
        const newObjects = [...objects, newObj];
        setObjects(newObjects);
        saveHistory(newObjects);
        setSelectedId(newObj.id);
        setSelectedIds([newObj.id]);
        return newObj; // return so caller can use its ID
    };

    const updateObject = (id, updates, skipHistory = false) => {
        const newObjects = objects.map(obj => obj.id === id ? { ...obj, ...updates } : obj);
        setObjects(newObjects);
        if (!skipHistory) {
            saveHistory(newObjects);
        }
    };

    const updateMultipleObjects = (updatesArray, skipHistory = false) => {
        if (updatesArray.length === 0) {
            if (!skipHistory) saveHistory(objects);
            return;
        }
        
        const updatesMap = {};
        updatesArray.forEach(u => updatesMap[u.id] = u.updates);
        
        const newObjects = objects.map(obj => {
            if (updatesMap[obj.id]) {
                return { ...obj, ...updatesMap[obj.id] };
            }
            return obj;
        });
        setObjects(newObjects);
        if (!skipHistory) {
            saveHistory(newObjects);
        }
    };

    const deleteObject = (id) => {
        const idsToDelete = new Set([id]);
        let added;
        do {
            added = false;
            objects.forEach(obj => {
                if (obj.parentId && idsToDelete.has(obj.parentId) && !idsToDelete.has(obj.id)) {
                    idsToDelete.add(obj.id);
                    added = true;
                }
            });
        } while (added);

        const newObjects = objects.filter(obj => !idsToDelete.has(obj.id));
        setObjects(newObjects);
        saveHistory(newObjects);
        
        if (selectedId && idsToDelete.has(selectedId)) {
            setSelectedId(null);
            setSelectedIds([]);
        } else if (selectedIds.some(sid => idsToDelete.has(sid))) {
            const newSelectedIds = selectedIds.filter(sid => !idsToDelete.has(sid));
            setSelectedIds(newSelectedIds);
            if (!newSelectedIds.includes(selectedId)) {
                setSelectedId(newSelectedIds.length > 0 ? newSelectedIds[0] : null);
            }
        }
    };

    return (
        <SceneContext.Provider value={{
            objects, setObjects, saveHistory,
            history, historyIndex, undo, redo,
            selectedId, setSelectedId,
            selectedIds, setSelectedIds,
            frame, setFrame,
            isPlaying, setIsPlaying,
            transformMode, setTransformMode,
            activeCameraId, setActiveCameraId,
            isRendering, setIsRendering,
            renderModalOpen, setRenderModalOpen,
            fps, setFps,
            uiScale, setUiScale,
            activeMobilePanel, setActiveMobilePanel,
            gravity, setGravity,
            symmetryMode, setSymmetryMode,
            addObject, updateObject, updateMultipleObjects, deleteObject
        }}>
            {children}
        </SceneContext.Provider>
    );
}