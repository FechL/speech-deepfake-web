import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import MainShell from './components/MainShell';
import LoginScreen from './features/auth/LoginScreen';
import RegisterScreen from './features/auth/RegisterScreen';
import DashboardScreen from './features/dashboard/DashboardScreen';
import HistoryScreen from './features/dashboard/HistoryScreen';
import SelectMethodScreen from './features/detection/SelectMethodScreen';
import SelectModelScreen from './features/detection/SelectModelScreen';
import AnalysisReportScreen from './features/results/AnalysisReportScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import ResultsCollectionScreen from './features/workbench/ResultsCollectionScreen';

const AppContent = () => {
  const { isLoggedIn, addHistory } = useApp();
  const [authScreen, setAuthScreen] = useState('login');
  
  const [activeView, setActiveView] = useState('dashboard');
  
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [reportData, setReportData] = useState(null);

  if (!isLoggedIn) {
    return authScreen === 'login' ? (
      <LoginScreen onRegisterClick={() => setAuthScreen('register')} />
    ) : (
      <RegisterScreen onLoginClick={() => setAuthScreen('login')} />
    );
  }

  let shellIndex = 0;
  if (activeView === 'dashboard' || activeView === 'history' || activeView === 'analysis-report') {
    shellIndex = 0;
  } else if (activeView === 'detection-method' || activeView === 'detection-model') {
    shellIndex = 1;
  } else if (activeView === 'workbench') {
    shellIndex = 2;
  } else if (activeView === 'settings') {
    shellIndex = 3;
  }

  const handleTabChange = (index) => {
    if (index === 0) {
      setActiveView('dashboard');
    } else if (index === 1) {
      setActiveView('detection-method');
      setSelectedAudio(null);
    } else if (index === 2) {
      setActiveView('workbench');
    } else if (index === 3) {
      setActiveView('settings');
    }
  };

  const handleAudioSelected = (fileName, fileFormat, fileSize, fileDuration, fileBytes, fileMimeType) => {
    setSelectedAudio({ fileName, fileFormat, fileSize, fileDuration, fileBytes, fileMimeType });
    setActiveView('detection-model');
  };

  const handleAnalysisFinished = (isAuthentic, score, modelName, result = {}) => {
    const report = {
      fileName: selectedAudio.fileName,
      fileFormat: selectedAudio.fileFormat,
      fileSize: result.fileSize || selectedAudio.fileSize,
      fileDuration: result.duration || selectedAudio.fileDuration,
      aiModel: modelName,
      isAuthentic,
      score,
      probAuthentic: result.prob_authentic,
      probDeepfake: result.prob_deepfake,
      threshold: result.threshold,
    };

    addHistory(report);
    setReportData({
      ...report,
      audioBytes: selectedAudio.fileBytes,
      fileMimeType: selectedAudio.fileMimeType,
    });
    setActiveView('analysis-report');
  };

  const handleHistoryItemClicked = (item) => {
    setReportData(item);
    setActiveView('analysis-report');
  };

  return (
    <MainShell currentIndex={shellIndex} onTabChange={handleTabChange}>
      {activeView === 'dashboard' && (
        <DashboardScreen 
          onStartDetection={() => setActiveView('detection-method')}
          onViewReport={handleHistoryItemClicked}
          onViewAllHistory={() => setActiveView('history')}
          onOpenWorkbench={() => setActiveView('workbench')}
        />
      )}
      
      {activeView === 'history' && (
        <HistoryScreen 
          onBack={() => setActiveView('dashboard')}
          onViewReport={handleHistoryItemClicked}
        />
      )}

      {activeView === 'detection-method' && (
        <SelectMethodScreen 
          onBack={() => setActiveView('dashboard')}
          onAudioSelected={handleAudioSelected}
        />
      )}

      {activeView === 'detection-model' && selectedAudio && (
        <SelectModelScreen
          fileName={selectedAudio.fileName}
          fileFormat={selectedAudio.fileFormat}
          fileSize={selectedAudio.fileSize}
          fileDuration={selectedAudio.fileDuration}
          realFileBytes={selectedAudio.fileBytes}
          fileMimeType={selectedAudio.fileMimeType}
          onBack={() => setActiveView('detection-method')}
          onAnalysisFinished={handleAnalysisFinished}
        />
      )}

      {activeView === 'analysis-report' && reportData && (
        <AnalysisReportScreen
          fileName={reportData.fileName}
          fileFormat={reportData.fileFormat}
          fileSize={reportData.fileSize}
          fileDuration={reportData.fileDuration}
          aiModel={reportData.aiModel}
          isAuthentic={reportData.isAuthentic}
          score={reportData.score}
          probAuthentic={reportData.probAuthentic}
          probDeepfake={reportData.probDeepfake}
          threshold={reportData.threshold}
          audioBytes={reportData.audioBytes}
          fileMimeType={reportData.fileMimeType}
          onBackToDashboard={() => setActiveView('dashboard')}
          onTestAgain={() => setActiveView('detection-model')}
          onOpenWorkbench={() => setActiveView('workbench')}
        />
      )}

      {activeView === 'workbench' && (
        <ResultsCollectionScreen 
          onStartNewDetection={() => {
            setSelectedAudio(null);
            setActiveView('detection-method');
          }}
          onViewReport={handleHistoryItemClicked}
        />
      )}

      {activeView === 'settings' && (
        <SettingsScreen />
      )}
    </MainShell>
  );
};

const App = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
