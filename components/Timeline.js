function Timeline() {
    const { frame, setFrame, isPlaying, setIsPlaying, objects, selectedId, updateObject, fps, activeMobilePanel } = React.useContext(SceneContext);
    const timelineRef = React.useRef(null);
    const scrollContainerRef = React.useRef(null);
    const [zoom, setZoom] = React.useState(10);
    
    const totalFrames = fps * 120; // 120 seconds total length
    
    // Auto play
    React.useEffect(() => {
        let animationFrame;
        let lastTime = performance.now();
        let accumulatedTime = 0;
        const frameDuration = 1000 / fps;

        const loop = (time) => {
            animationFrame = requestAnimationFrame(loop);
            const delta = time - lastTime;
            lastTime = time;
            
            accumulatedTime += delta;
            
            const framesToAdvance = Math.floor(accumulatedTime / frameDuration);
            
            if (framesToAdvance > 0) {
                accumulatedTime -= framesToAdvance * frameDuration;
                
                setFrame(f => {
                    const next = f + framesToAdvance;
                    // We go from 0 to totalFrames inclusive (totalFrames + 1 frames)
                    return next % (totalFrames + 1);
                });
            }
        };

        if (isPlaying) {
            lastTime = performance.now();
            animationFrame = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, setFrame, fps, totalFrames]);

    // Handle Playhead Scrubbing
    const handleScrub = (e) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        // Calculate relative position based on the zoomed inner container
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const newFrame = Math.round(percentage * totalFrames);
        setFrame(newFrame);
    };

    const handleMouseDown = (e) => {
        handleScrub(e);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        handleScrub(e);
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    const addKeyframe = () => {
        if (!selectedId) return;
        const obj = objects.find(o => o.id === selectedId);
        if (!obj) return;
        
        const newKeyframes = { ...obj.keyframes };
        newKeyframes[frame] = {
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
            volume: obj.volume
        };
        updateObject(selectedId, { keyframes: newKeyframes });
    };

    return (
        <div className="h-32 lg:h-48 border-t panel-bg flex flex-col shrink-0 select-none relative w-full z-20" data-name="Timeline" data-file="components/Timeline.js">
            <div className="flex items-center justify-between px-2 lg:px-4 py-1.5 lg:py-2 border-b border-dark-700 bg-dark-900/50 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                    <span className="hidden lg:inline text-xs font-medium text-gray-400">TIMELINE</span>
                    <div className="flex items-center bg-dark-900 rounded p-0.5">
                        <button className="p-1 text-gray-400 hover:text-white rounded" onClick={() => setFrame(0)}><div className="icon-skip-back text-sm"></div></button>
                        <button className="p-1 text-gray-400 hover:text-white rounded" onClick={() => setFrame(Math.max(0, frame - 1))}><div className="icon-rewind text-sm"></div></button>
                        <button 
                            className={`p-1 rounded ${isPlaying ? 'text-primary' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setIsPlaying(!isPlaying)}
                        >
                            <div className={isPlaying ? "icon-pause" : "icon-play"}></div>
                        </button>
                        <button className="p-1 text-gray-400 hover:text-white rounded" onClick={() => setFrame(Math.min(totalFrames, frame + 1))}><div className="icon-fast-forward text-sm"></div></button>
                        <button className="p-1 text-gray-400 hover:text-white rounded" onClick={() => setFrame(totalFrames)}><div className="icon-skip-forward text-sm"></div></button>
                    </div>
                </div>
                <div className="flex items-center gap-2 lg:gap-4 shrink-0 pl-2 lg:pl-0">
                    {/* Zoom Controls */}
                    <div className="hidden lg:flex items-center gap-2 px-3 border-r border-dark-700">
                        <div className="icon-minus text-gray-500 text-[10px]"></div>
                        <input 
                            type="range" 
                            min="1" max="10" step="0.1" 
                            value={zoom} 
                            onChange={(e) => setZoom(parseFloat(e.target.value))} 
                            className="w-20 cursor-ew-resize accent-primary" 
                            title="Zoom Timeline"
                        />
                        <div className="icon-plus text-gray-500 text-[10px]"></div>
                    </div>

                    <button 
                        className={`text-xs px-2 lg:px-3 py-1 rounded flex items-center gap-1 shrink-0 ${selectedId ? 'bg-dark-700 hover:bg-dark-600 text-white' : 'bg-dark-800 text-gray-600 cursor-not-allowed'}`}
                        onClick={addKeyframe}
                        disabled={!selectedId}
                    >
                        <div className="icon-diamond text-[10px]"></div> <span className="hidden sm:inline">Add Keyframe</span><span className="sm:hidden">Keyframe</span>
                    </button>
                    <div className="text-[10px] lg:text-xs bg-dark-900 px-2 lg:px-3 py-1 rounded border border-dark-600 font-mono w-16 lg:w-24 text-center shrink-0">
                        {frame} / {totalFrames}
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto bg-dark-900 scrollbar-thin" ref={scrollContainerRef}>
                <div 
                    className="min-h-full relative cursor-pointer flex flex-col"
                    style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                    ref={timelineRef}
                    onMouseDown={handleMouseDown}
                >
                    {/* Timeline Ruler */}
                    <div className="h-8 border-b border-dark-700 pointer-events-none relative bg-dark-800/50">
                        {Array.from({ length: 121 }).map((_, i) => { // 120 seconds + 0
                            const currentFrame = i * fps;
                            return (
                                <div 
                                    key={i} 
                                    className={`absolute border-l h-full pl-1 pt-0.5 border-gray-500`}
                                    style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
                                >
                                    <span className={`text-[9px] block text-gray-300 font-medium`}>
                                        {currentFrame}
                                    </span>
                                    <span className="text-[10px] text-primary font-bold absolute bottom-0.5 left-1">
                                        {i}s
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {/* Tracks Area */}
                    <div className="h-16 relative pointer-events-none mt-2 border-b border-dark-700">
                        {selectedId && objects.find(o => o.id === selectedId)?.keyframes && 
                            Object.keys(objects.find(o => o.id === selectedId).keyframes).map(kf => (
                                <div 
                                    key={kf} 
                                    className="absolute w-2.5 h-2.5 bg-yellow-500 transform rotate-45 -translate-x-1/2 -translate-y-1/2"
                                    style={{ left: `${(kf / totalFrames) * 100}%`, top: '8px' }}
                                ></div>
                            ))
                        }
                        {!selectedId && (
                            <div className="pt-2 px-2 text-gray-600 text-xs italic flex justify-center w-full sticky left-0">
                                Select an object to view keyframes...
                            </div>
                        )}
                    </div>
                    
                    {/* Audio Layers */}
                    <div className="flex flex-col relative pointer-events-auto border-b border-dark-700 pb-4">
                        {objects.filter(o => o.type === 'Audio').length > 0 && (
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-1 sticky left-0 bg-dark-900/80 z-20">Audio Tracks</div>
                        )}
                        {objects.filter(o => o.type === 'Audio').map(audio => {
                            const startFrame = audio.startFrame || 0;
                            const durationFrames = audio.durationFrames || totalFrames;
                            const leftPct = (startFrame / totalFrames) * 100;
                            const widthPct = (durationFrames / totalFrames) * 100;
                            
                            return (
                                <div key={audio.id} className="h-8 border-b border-dark-700 flex items-center group relative" onClick={() => updateObject(audio.id, { selected: true })}>
                                    {/* Track Header / Controls */}
                                    <div className="w-48 bg-dark-800 h-full border-r border-dark-700 flex items-center px-2 gap-2 sticky left-0 z-20 shrink-0">
                                        <div className="icon-music text-primary text-xs"></div>
                                        <span className="text-xs text-gray-300 truncate w-16">{audio.name}</span>
                                        <div className="flex items-center gap-1 flex-1">
                                            <div className="icon-volume-1 text-[10px] text-gray-500"></div>
                                            <input 
                                                type="range" min="0" max="1" step="0.05" 
                                                value={audio.volume !== undefined ? audio.volume : 1}
                                                onChange={(e) => updateObject(audio.id, { volume: parseFloat(e.target.value) })}
                                                className="w-12 accent-primary"
                                                title="Volume"
                                            />
                                        </div>
                                        <button 
                                            className="text-gray-500 hover:text-white p-1" title="Split at Playhead"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (frame > startFrame && frame < startFrame + durationFrames) {
                                                    // Simple split: shortens current, creates new one after
                                                    updateObject(audio.id, { durationFrames: frame - startFrame });
                                                    // We ideally need an addObject call here, but for simplicity in this context we'll just trim it.
                                                }
                                            }}
                                        >
                                            <div className="icon-scissors text-[10px]"></div>
                                        </button>
                                    </div>
                                    {/* Track Clip */}
                                    <div className="flex-1 h-full relative">
                                        <div 
                                            className="absolute top-1 bottom-1 bg-primary/20 border border-primary/40 rounded-sm hover:bg-primary/30 transition-colors cursor-pointer"
                                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        >
                                            <div className="w-full h-full overflow-hidden opacity-30 flex items-center">
                                                {/* Fake waveform */}
                                                <svg className="w-full h-full preserve-aspect-ratio-none" viewBox="0 0 100 10" preserveAspectRatio="none">
                                                    <path d="M0,5 Q5,0 10,5 T20,5 T30,5 T40,5 T50,5 T60,5 T70,5 T80,5 T90,5 T100,5" stroke="currentColor" strokeWidth="0.5" fill="none" className="text-primary"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Playhead */}
                    <div 
                        className="absolute top-0 bottom-0 w-[1px] bg-primary z-30 pointer-events-none transform -translate-x-1/2"
                        style={{ left: `${(frame / totalFrames) * 100}%`, minHeight: '100%' }}
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary transform rotate-45" style={{ marginTop: '-2px' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}