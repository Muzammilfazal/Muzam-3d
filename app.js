class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-[100dvw] flex flex-col items-center justify-center bg-dark-900 text-white">
          <div className="icon-circle-alert text-red-500 text-4xl mb-4"></div>
          <h1 className="text-xl font-bold mb-2">Editor Error</h1>
          <p className="text-gray-400 mb-6 max-w-md text-center text-sm">{this.state.error?.message || 'Something went wrong.'}</p>
          <button onClick={() => window.location.reload()} className="bg-primary hover:bg-blue-600 px-4 py-2 rounded">Reload Editor</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { uiScale, activeMobilePanel, setActiveMobilePanel } = React.useContext(SceneContext);
  return (
    <div className="h-[100dvh] w-[100dvw] flex flex-col overflow-hidden" data-name="App" data-file="app.js" style={{ zoom: uiScale }}>
      <TopBar />
      <div className="flex-1 relative overflow-hidden flex flex-row w-full h-full">
        <LeftPanel />
        <Viewport />
        <RightPanel />
      </div>
      <Timeline />
      
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden h-14 bg-dark-800 border-t border-dark-700 flex items-center justify-around shrink-0 z-30 relative">
        <button onClick={() => setActiveMobilePanel(activeMobilePanel === 'left' ? 'viewport' : 'left')} className={`flex flex-col items-center justify-center w-full h-full ${activeMobilePanel === 'left' ? 'text-primary' : 'text-gray-400'}`}>
            <div className="icon-list-tree text-lg"></div>
            <span className="text-[9px] mt-0.5 font-medium">Add/Scene</span>
        </button>
        <button onClick={() => setActiveMobilePanel('viewport')} className={`flex flex-col items-center justify-center w-full h-full ${activeMobilePanel === 'viewport' ? 'text-primary' : 'text-gray-400'}`}>
            <div className="icon-box text-lg"></div>
            <span className="text-[9px] mt-0.5 font-medium">3D View</span>
        </button>
        <button onClick={() => setActiveMobilePanel(activeMobilePanel === 'right' ? 'viewport' : 'right')} className={`flex flex-col items-center justify-center w-full h-full ${activeMobilePanel === 'right' ? 'text-primary' : 'text-gray-400'}`}>
            <div className="icon-sliders-horizontal text-lg"></div>
            <span className="text-[9px] mt-0.5 font-medium">Inspector</span>
        </button>
      </div>

      <RenderModal />
    </div>
  );
}

function App() {
  const [splashComplete, setSplashComplete] = React.useState(false);
  try {
    return (
      <SceneProvider>
        {!splashComplete && <SplashScreen onComplete={() => setSplashComplete(true)} />}
        <AppContent />
      </SceneProvider>
    );
  } catch (error) {
    console.error('App component error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);