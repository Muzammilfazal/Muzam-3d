function RenderModal() {
    const { renderModalOpen, setRenderModalOpen, setFrame, isPlaying, setIsPlaying, activeCameraId, fps } = React.useContext(SceneContext);
    const [quality, setQuality] = React.useState('High');
    const [rendering, setRendering] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [renderFrames, setRenderFrames] = React.useState(fps * 120);

    React.useEffect(() => {
        if (renderModalOpen) {
            setRenderFrames(fps * 120);
        }
    }, [renderModalOpen, fps]);

    if (!renderModalOpen) return null;

    const startRender = async () => {
        if (!window.__MUZAM_RENDER_FRAME__ || !window.VideoEncoder || !window.Mp4Muxer) {
            alert("Your browser does not support true MP4 rendering via WebCodecs.");
            return;
        }

        setRendering(true);
        setProgress(0);
        setIsPlaying(false);

        try {
            const viewportEl = document.querySelector('[data-name="Viewport"]');
            const aspect = viewportEl ? (viewportEl.clientWidth / viewportEl.clientHeight) : 16/9;
            
            let targetHeight = 720;
            if (quality === 'Low') targetHeight = 360;
            else if (quality === 'Medium') targetHeight = 480;
            else if (quality === 'High') targetHeight = fps >= 60 ? 1080 : 720;

            const encHeight = Math.floor(targetHeight / 2) * 2;
            const encWidth = Math.floor((targetHeight * aspect) / 2) * 2;

            // Prepare WebGL context sizing explicitly without toggling it per-frame
            window.__MUZAM_SET_RENDER_MODE__(true, encWidth, encHeight, quality);

            // Use an intermediate canvas to guarantee exact dimensions matching the encoder
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = encWidth;
            tempCanvas.height = encHeight;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

            let bitrate = 8000000; 
            if (quality === 'Low') bitrate = 2000000; // 2 Mbps for 360p
            else if (quality === 'Medium') bitrate = 4000000; // 4 Mbps for 480p
            else if (quality === 'High') bitrate = fps >= 60 ? 12000000 : 8000000; // 12Mbps for 1080p, 8Mbps for 720p

            const muxer = new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc',
                    width: encWidth,
                    height: encHeight
                },
                fastStart: 'in-memory'
            });

            const encoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: e => {
                    console.error("VideoEncoder error:", e);
                    if (window.__MUZAM_SET_RENDER_MODE__) window.__MUZAM_SET_RENDER_MODE__(false);
                    setRendering(false);
                }
            });

            // Use High Profile Level 5.2 to support higher resolutions (up to 4K)
            encoder.configure({
                codec: 'avc1.640034', 
                width: encWidth,
                height: encHeight,
                bitrate: bitrate,
                framerate: fps,
                avc: { format: 'avc' }
            });

            const totalFrames = renderFrames;
            
            // To prevent blocking the UI, we encode asynchronously in chunks
            for (let i = 0; i <= totalFrames; i++) {
                // Yield to main thread every few frames to update UI
                if (i % 5 === 0 || i === totalFrames) {
                    await new Promise(r => setTimeout(r, 0));
                    setProgress(Math.round((i / totalFrames) * 100));
                    setFrame(i);
                }

                // Throttle encoder to prevent frame dropping if queue gets too full
                while (encoder.encodeQueueSize > 10) {
                    await new Promise(r => setTimeout(r, 10));
                }

                // Force render the specific frame synchronously
                const frameCanvas = window.__MUZAM_RENDER_FRAME__(i);
                
                // Draw to our perfectly-sized temporary canvas to avoid dimension mismatch errors
                if (frameCanvas) {
                    tempCtx.drawImage(frameCanvas, 0, 0, encWidth, encHeight);
                }
                
                // Create VideoFrame from temp canvas
                const videoFrame = new VideoFrame(tempCanvas, { 
                    timestamp: Math.round((i * 1000000) / fps) // precise microseconds
                });

                // Encode it (keyframe every second)
                const isKeyFrame = (i % fps === 0);
                encoder.encode(videoFrame, { keyFrame: isKeyFrame });
                videoFrame.close();
            }

            await encoder.flush();
            muxer.finalize();
            window.__MUZAM_SET_RENDER_MODE__(false);

            const buffer = muxer.target.buffer;
            const blob = new Blob([buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Muzam3D_Render_${fps}fps_${quality}.mp4`;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setRendering(false);
                setRenderModalOpen(false);
            }, 100);

        } catch (error) {
            if (window.__MUZAM_SET_RENDER_MODE__) window.__MUZAM_SET_RENDER_MODE__(false);
            console.error("Rendering failed:", error);
            setRendering(false);
            alert("Rendering failed. See console for details.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center" data-name="RenderModal" data-file="components/RenderModal.js">
            <div className="bg-dark-800 border border-dark-600 rounded-lg p-6 w-96 shadow-2xl">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <div className="icon-video text-primary"></div> Render MP4 Video
                </h2>

                {!activeCameraId && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded text-sm mb-4 flex items-start gap-2">
                        <div className="icon-triangle-alert shrink-0 mt-0.5 text-lg"></div>
                        <p>No camera selected. The default editor view will be rendered. Select a camera and use "Look Through Camera" for cinematic renders.</p>
                    </div>
                )}

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Format</label>
                        <select disabled className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-500 cursor-not-allowed outline-none">
                            <option>MP4 (H.264 WebCodecs)</option>
                        </select>
                    </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Project FPS</label>
                        <input type="text" value={`${fps} FPS`} disabled className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-gray-500 cursor-not-allowed outline-none" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Frames to Render</label>
                        <input 
                            type="number" 
                            min="1" 
                            max={fps * 120} 
                            value={renderFrames} 
                            onChange={(e) => setRenderFrames(Math.max(1, Math.min(fps * 120, parseInt(e.target.value) || 1)))}
                            disabled={rendering} 
                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-white focus:border-primary outline-none" 
                        />
                    </div>
                </div>
                <span className="text-[10px] text-gray-500 mt-1 block">Max frames: {fps * 120} ({120} seconds).</span>
                <div>
                    <label className="text-sm text-gray-400 block mb-1 mt-2">Quality</label>
                        <select value={quality} onChange={e => setQuality(e.target.value)} disabled={rendering} className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm text-white focus:border-primary outline-none">
                            <option value="Low">Low (Faster Render)</option>
                            <option value="Medium">Medium (Balanced)</option>
                            <option value="High">High (Best Detail)</option>
                        </select>
                    </div>
                </div>

            {rendering ? (
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
                        <span>Rendering Frame {Math.round((progress / 100) * renderFrames)} / {renderFrames}...</span>
                        <span>{progress}%</span>
                    </div>
                        <div className="w-full bg-dark-900 rounded-full h-2 overflow-hidden border border-dark-700">
                            <div className="bg-primary h-full transition-all duration-75 ease-linear" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-dark-700 pt-4">
                    <button 
                        onClick={() => setRenderModalOpen(false)} 
                        disabled={rendering}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={startRender}
                        disabled={rendering}
                        className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {rendering ? <div className="icon-loader animate-spin"></div> : <div className="icon-play"></div>}
                        {rendering ? 'Rendering...' : 'Start Render'}
                    </button>
                </div>
            </div>
        </div>
    );
}