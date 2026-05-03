function TopBar() {
    const { objects, setObjects, saveHistory, isPlaying, setIsPlaying, addObject, setRenderModalOpen, undo, redo, historyIndex, history, fps, setFps, uiScale, setUiScale } = React.useContext(SceneContext);
    const fileInputRef = React.useRef(null);
    const projectInputRef = React.useRef(null);

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        addObject('Model', { modelUrl: url, name: file.name });
        e.target.value = null; // reset
    };

    const handleSaveProject = () => {
        const projectData = {
            version: "1.0",
            fps,
            objects
        };
        const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'muzam_project.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleOpenProject = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.objects) {
                    setObjects(data.objects);
                    saveHistory(data.objects);
                }
                if (data.fps) {
                    setFps(data.fps);
                }
            } catch (err) {
                alert("Invalid project file.");
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    const handleNewProject = () => {
        if(window.confirm("Are you sure you want to start a new project? Unsaved changes will be lost.")) {
            setObjects([]);
            saveHistory([]);
        }
    };

    return (
        <div className="h-14 border-b panel-bg flex items-center justify-between px-4 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none" data-name="TopBar" data-file="components/TopBar.js">
            <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                <div className="font-bold text-lg lg:text-xl tracking-tight text-white flex items-center gap-2">
                    <div className="icon-box text-primary"></div>
                    <span className="hidden sm:inline">Muzam 3D</span>
                </div>
                <div className="h-6 w-px bg-dark-600 mx-1 lg:mx-2"></div>
                <div className="flex items-center gap-1">
                    <button className="btn-toolbar" title="New Project" onClick={handleNewProject}><div className="icon-file"></div></button>
                    <button className="btn-toolbar" title="Open Project" onClick={() => projectInputRef.current?.click()}><div className="icon-folder"></div></button>
                    <input type="file" ref={projectInputRef} onChange={handleOpenProject} accept=".json" className="hidden" />
                    <button className="btn-toolbar" title="Save Project" onClick={handleSaveProject}><div className="icon-save"></div></button>
                    <button className="btn-toolbar" title="Import Model" onClick={() => fileInputRef.current?.click()}><div className="icon-box"></div></button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".glb,.gltf" className="hidden" />
                </div>
                <div className="h-6 w-px bg-dark-600 mx-2"></div>
                <div className="flex items-center gap-1">
                    <button className={`btn-toolbar ${historyIndex <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`} onClick={undo} disabled={historyIndex <= 0} title="Undo"><div className="icon-arrow-left"></div></button>
                    <button className={`btn-toolbar ${historyIndex >= history.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`} onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><div className="icon-arrow-right"></div></button>
                </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4 shrink-0 pl-2 lg:pl-4">
                <div className="hidden lg:flex items-center gap-1 bg-dark-900 border border-dark-700 rounded px-1 mr-2">
                    <button className="p-1 text-gray-400 hover:text-white" onClick={() => setUiScale(s => Math.max(0.3, s - 0.1))} title="Zoom Out UI"><div className="icon-minus text-[10px]"></div></button>
                    <span className="text-[10px] text-gray-500 font-mono w-8 text-center" title="UI Scale">{Math.round(uiScale * 100)}%</span>
                    <button className="p-1 text-gray-400 hover:text-white" onClick={() => setUiScale(s => Math.min(2, s + 0.1))} title="Zoom In UI"><div className="icon-plus text-[10px]"></div></button>
                </div>
                <div className="flex items-center gap-1 lg:gap-2 mr-1 lg:mr-2">
                    <span className="text-xs text-gray-400 font-medium hidden sm:block">FPS</span>
                    <select 
                        value={fps} 
                        onChange={(e) => setFps(Number(e.target.value))}
                        className="bg-dark-900 border border-dark-700 text-xs text-white rounded px-2 py-1 outline-none focus:border-primary"
                    >
                        <option value={24}>24</option>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                    </select>
                </div>
                <button 
                    className={`btn-toolbar px-2 lg:px-4 ${isPlaying ? 'text-primary' : ''}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    <div className={isPlaying ? "icon-pause" : "icon-play"}></div>
                    <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button 
                    className="bg-primary hover:bg-blue-600 text-white px-3 lg:px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                    onClick={() => setRenderModalOpen(true)}
                >
                    <div className="icon-video"></div>
                    <span className="hidden sm:inline">Render</span>
                </button>
            </div>
        </div>
    );
}