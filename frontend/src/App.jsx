import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import ErrorReportModal from './components/ErrorReportModal';
import ScaleToFit from './components/ScaleToFit';
import AdminPanel from './components/AdminPanel';
import { LanguageProvider } from './i18n/LanguageProvider';
import Screen1Upload from './components/screens/Screen1Upload';
import Screen2Preview from './components/screens/Screen2Preview';
import Screen3Settings from './components/screens/Screen3Settings';
import Screen4Payment from './components/screens/Screen4Payment';
import Screen5Kaspi from './components/screens/Screen5Kaspi';
import Screen5Card from './components/screens/Screen5Card';
import Screen6Success from './components/screens/Screen6Success';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-red-500">Произошла ошибка в этом разделе.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Простой роутинг по hash: #/admin → админка, иначе → киоск
  const [route, setRoute] = useState(() => (window.location.hash === '#/admin' ? 'admin' : 'kiosk'));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash === '#/admin' ? 'admin' : 'kiosk');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [currentScreen, setCurrentScreen] = useState(1);
  const [session, setSession] = useState(null);
  const uploadedFile = session
    ? {
        name: session.fileName,
        pageCount: session.pageCount || null,
        size: session.size,
        mimeType: session.mimeType,
        downloadUrl: session.downloadUrl,
      }
    : { name: '—', pageCount: null, size: 0, mimeType: '', downloadUrl: '' };
  const [orientation, setOrientation] = useState('portrait');
  const [printSettings, setPrintSettings] = useState({
    pages: 'all',
    pageRange: '',
    copies: 1,
    pagesPerSide: 1,
    duplex: false,
  });
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const goTo = useCallback((screen) => {
    console.log(`[App] Navigating to screen ${screen}`);
    setCurrentScreen(screen);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentScreen(1);
    setSession(null);
    setOrientation('portrait');
    setPrintSettings({
      pages: 'all',
      pageRange: '',
      copies: 1,
      pagesPerSide: 1,
      duplex: false,
    });
    setPaymentMethod(null);
    console.log('[App] Session restarted');
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 1:
        return (
          <Screen1Upload
            onNext={() => goTo(2)}
            onSessionLoaded={setSession}
          />
        );
      case 2:
        return (
          <Screen2Preview
            file={uploadedFile}
            orientation={orientation}
            setOrientation={setOrientation}
            onNext={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        );
      case 3:
        return (
          <Screen3Settings
            printSettings={printSettings}
            setPrintSettings={setPrintSettings}
            filePageCount={uploadedFile.pageCount || 1}
            file={uploadedFile}
            orientation={orientation}
            onNext={() => goTo(4)}
            onBack={() => goTo(2)}
          />
        );
      case 4:
        return (
          <Screen4Payment
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            printSettings={printSettings}
            filePageCount={uploadedFile.pageCount || 1}
            file={uploadedFile}
            onNext={() => goTo(5)}
            onBack={() => goTo(3)}
          />
        );
      case 5:
        return paymentMethod === 'kaspi'
          ? <Screen5Kaspi printSettings={printSettings} filePageCount={uploadedFile.pageCount || 1} onSuccess={() => goTo(6)} />
          : <Screen5Card printSettings={printSettings} filePageCount={uploadedFile.pageCount || 1} onSuccess={() => goTo(6)} />;
      case 6:
        return <Screen6Success printSettings={printSettings} sessionCode={session?.code} file={uploadedFile} orientation={orientation} onRestart={handleRestart} />;
      default:
        return <Screen1Upload onNext={() => goTo(2)} />;
    }
  };

  if (route === 'admin') {
    return (
      <LanguageProvider>
        <AdminPanel onExit={() => { window.location.hash = ''; }} />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <ScaleToFit>
        <div className="w-full bg-white" style={{ width: 1920, height: 1080 }}>
          <Header currentScreen={currentScreen} onErrorReport={() => setShowErrorModal(true)} />

          <main
            className="mt-[148px] overflow-hidden"
            style={{ height: 932 }}
          >
            <div className="screen-enter h-full" key={currentScreen}>
              <ErrorBoundary>
                {renderScreen()}
              </ErrorBoundary>
            </div>
          </main>

          {showErrorModal && <ErrorReportModal onClose={() => setShowErrorModal(false)} currentScreen={currentScreen} />}
        </div>
      </ScaleToFit>
    </LanguageProvider>
  );
}

export default App;
