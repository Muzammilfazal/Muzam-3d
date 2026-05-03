function SplashScreen({ onComplete }) {
    const [progress, setProgress] = React.useState(0);
    const [isReady, setIsReady] = React.useState(false);
    const [isExiting, setIsExiting] = React.useState(false);

    React.useEffect(() => {
        const duration = 5000; // Exactly 5 seconds
        const interval = 50;
        const steps = duration / interval;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            setProgress(Math.min(100, (currentStep / steps) * 100));
            if (currentStep >= steps) {
                clearInterval(timer);
                setIsReady(true);
            }
        }, interval);

        return () => clearInterval(timer);
    }, []);

    const handleEnter = () => {
        setIsExiting(true);
        // Wait for fade out transition before unmounting
        setTimeout(() => {
            onComplete();
        }, 700); 
    };

    return (
        <div 
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-dark-900 overflow-hidden transition-all duration-700 ease-in-out ${isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`} 
            data-name="SplashScreen" 
            data-file="components/SplashScreen.js"
        >
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" style={{ perspective: '1000px' }}>
                <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] bg-primary/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse-glow"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[40rem] h-[40rem] bg-indigo-600/10 rounded-full mix-blend-screen filter blur-[150px] animate-pulse-glow" style={{ animationDelay: '2.5s' }}></div>
                
                {/* Floating 3D-like perspective shapes */}
                <div className="absolute top-[20%] right-[20%] w-24 h-24 border-2 border-primary/30 rounded-lg animate-float-medium backdrop-blur-sm bg-gradient-to-br from-white/10 to-transparent" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(45deg) rotateY(45deg)' }}></div>
                <div className="absolute bottom-[20%] left-[15%] w-32 h-32 border border-indigo-500/30 rounded-full animate-float-slow backdrop-blur-md bg-white/5" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-30deg) rotateY(20deg)' }}></div>
                <div className="absolute top-[50%] left-[25%] w-16 h-16 bg-gradient-to-br from-primary/20 to-transparent border border-white/10 rounded-xl animate-float-fast backdrop-blur-sm" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(45deg)' }}></div>
                <div className="absolute top-[30%] left-[65%] w-12 h-12 bg-indigo-500/20 border border-white/10 rounded-full animate-float-medium backdrop-blur-sm" style={{ animationDelay: '1s', transformStyle: 'preserve-3d', transform: 'rotateY(60deg)' }}></div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-6 w-full max-w-2xl">
                
                {/* Logo Area */}
                <div className="mb-10 flex flex-col items-center gap-6 animate-float-slow">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary to-indigo-600 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.5)] relative">
                        <div className="absolute inset-0 rounded-3xl border border-white/20"></div>
                        <div className="icon-box text-5xl text-white"></div>
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
                        Muzam 3D
                    </h1>
                </div>

                {/* Credits & Info */}
                <div className="space-y-3 mb-12 w-full">
                    <div className="bg-dark-800/50 backdrop-blur-md border border-dark-700/50 rounded-2xl p-6 shadow-xl max-w-md mx-auto">
                        <p className="text-xl font-semibold text-gray-200 tracking-wide mb-1">Developed By Muzammil Fazal</p>
                        <div className="text-sm flex items-center justify-center gap-2 text-gray-400">
                            <div className="icon-mail text-primary"></div>
                            muzammilfazal85@gmail.com
                        </div>
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-dark-600 to-transparent my-4"></div>
                        <p className="text-sm text-gray-400 mb-4">
                            A lightweight, powerful 3D animation & rendering engine directly in your browser.
                        </p>
                        <div className="flex justify-center items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                                <div className="icon-zap"></div> Super Smooth HD
                            </span>
                            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                                <div className="icon-cpu"></div> Optimized
                            </span>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2.5 flex items-start gap-2 text-left">
                            <div className="icon-monitor text-yellow-500 shrink-0 mt-0.5"></div>
                            <p className="text-xs text-yellow-400/90 leading-tight">
                                <strong>Desktop & Tablet Recommended:</strong> For the best experience and performance, please use a larger screen. Mobile devices may have limited functionality.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Loading / Action Area */}
                <div className="h-20 flex flex-col items-center justify-center w-full">
                    {!isReady ? (
                        <div className="w-64 sm:w-80 flex flex-col items-center gap-4 transition-opacity duration-500">
                            <div className="w-full h-1.5 bg-dark-800 rounded-full overflow-hidden border border-dark-700 shadow-inner">
                                <div 
                                    className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-[50ms] ease-linear shadow-[0_0_15px_rgba(99,102,241,0.8)] relative" 
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute top-0 right-0 bottom-0 w-10 bg-white/30 blur-[2px]"></div>
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                                Initializing Engine... {Math.round(progress)}%
                            </span>
                        </div>
                    ) : (
                        <button 
                            onClick={handleEnter}
                            className="group relative px-8 py-3.5 bg-white text-dark-900 font-bold rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-in fade-in slide-in-from-bottom-4"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <span className="relative flex items-center gap-2 group-hover:text-white transition-colors duration-300">
                                Enter Studio <div className="icon-arrow-right group-hover:translate-x-1 transition-transform"></div>
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}