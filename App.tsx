import React, { useState, useCallback } from 'react';
import { AppState } from './types';
import type { InclusiveChange } from './types';
import { extractTextFromPdf } from './services/pdfService';
import { getInclusiveSuggestions } from './services/geminiService';
import { downloadDocxWithHighlights, downloadDocxComparisonTwoColumns } from './services/docxService';
import { downloadOriginalPdfWithHighlights } from './services/pdfExportService';
import Loader from './components/Loader';
import ComparisonView from './components/ComparisonView';
import BackButton from './components/BackButton';

const UploadIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
  </svg>
);

const DownloadIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Initial);
  const [originalText, setOriginalText] = useState<string>('');
  const [modifiedText, setModifiedText] = useState<string>('');
  const [changes, setChanges] = useState<InclusiveChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    if (!isPdf && !isTxt) {
      setError('Por favor, sube un archivo PDF o TXT válido.');
      setAppState(AppState.Error);
      return;
    }

    setAppState(AppState.Loading);
    setError(null);
    setFileName(file.name);

    try {
      let text = '';
      if (isPdf) {
        text = await extractTextFromPdf(file);
      } else {
        const reader = new FileReader();
        text = await new Promise<string>((resolve, reject) => {
          reader.onload = e => {
            const t = typeof e.target?.result === 'string' ? e.target?.result : '';
            resolve(t);
          };
          reader.onerror = () => reject(new Error('Error al leer el archivo TXT.'));
          reader.readAsText(file, 'utf-8');
        });
      }
      setOriginalText(text);

      const suggestions = await getInclusiveSuggestions(text);
      
      const changesWithIds: InclusiveChange[] = suggestions.map((s, i) => ({ ...s, id: `change-${i}` }));
      setChanges(changesWithIds);

      let newText = text;
      changesWithIds.forEach(change => {
        newText = newText.split(change.original).join(change.inclusive);
      });
      setModifiedText(newText);

      setAppState(AppState.Comparing);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error desconocido.');
      }
      setAppState(AppState.Error);
    }
  };
  
  const handleModifiedTextChange = useCallback((newText: string) => {
    setModifiedText(newText);
  }, []);

  const handleDownload = () => {
    const blob = new Blob([modifiedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inclusivo_${fileName.replace('.pdf', '.txt')}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadWord = async () => {
    await downloadDocxWithHighlights(modifiedText, changes, fileName);
  };

  const handleDownloadComparisonWord = async () => {
    await downloadDocxComparisonTwoColumns(originalText, modifiedText, changes, fileName);
  };

  const handleDownloadOriginalPdf = async () => {
    await downloadOriginalPdfWithHighlights(originalText, changes, fileName);
  };

  const handleDownloadChangesJson = () => {
    if (!changes.length) return;
    // Solo enviamos original/inclusive para que la otra IA compare
    const payload = changes.map(({ original, inclusive }) => ({
      original,
      inclusive,
    }));
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = fileName || 'documento';
    a.href = url;
    a.download = `cambios_inclusivo_${base.replace(/\.[^.]+$/, '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setAppState(AppState.Initial);
    setOriginalText('');
    setModifiedText('');
    setChanges([]);
    setError(null);
    setFileName('');
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.Loading:
        return <Loader message="Analizando tu documento..." />;
      case AppState.Comparing:
        return (
            <ComparisonView 
                originalText={originalText} 
                modifiedText={modifiedText} 
                changes={changes}
                onModifiedTextChange={handleModifiedTextChange}
            />
        );
      case AppState.Error:
      case AppState.Initial:
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="mb-8">
              <img 
                src="/images/logo_pai.png" 
                alt="Logo PAI" 
                className="h-24 w-auto mx-auto mb-4"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary mb-10 leading-normal">
              Agente IA Inclusivo PDF
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mb-8 mt-4">
              Sube tu documento PDF y nuestra IA lo analizará para sugerir un lenguaje más inclusivo. Compara los cambios lado a lado, haz tus propias ediciones y descarga el resultado.
            </p>
            <label htmlFor="pdf-upload" className="relative cursor-pointer group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-8 py-4 bg-gray-900 rounded-lg leading-none flex items-center space-x-4">
                <UploadIcon className="w-8 h-8 text-brand-light" />
                <span className="text-xl font-semibold text-gray-100">Subir PDF o TXT</span>
              </div>
            </label>
            <input id="pdf-upload" type="file" accept=".pdf,.txt" onChange={handleFileChange} className="hidden" />
            {appState === AppState.Error && (
              <div className="mt-6 p-4 bg-red-900 bg-opacity-40 border border-red-700 text-red-300 rounded-lg">
                <p className="font-bold">Ocurrió un error:</p>
                <p>{error}</p>
              </div>
            )}
            <div className="mt-12 text-center">
              <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                <span>©</span>
                <span>Powered by pai-b 2025 todos los derechos reservados</span>
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col font-sans">
      {/* Botón flotante para estados Initial y Loading */}
      {(appState === AppState.Initial || appState === AppState.Loading) && (
        <div className="fixed top-4 right-4 z-50">
          <BackButton />
        </div>
      )}
      {(appState === AppState.Comparing || appState === AppState.Error) && (
        <header className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 shadow-lg z-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
                Agente IA Inclusivo PDF
              </h1>
              <div className="flex items-center space-x-4">
                <BackButton />
                {/* 
                  Botones avanzados para depuración / uso interno.
                  Ocultos en producción; pueden reactivarse para análisis de cambios.
                  
                  <button
                    onClick={handleDownloadChangesJson}
                    disabled={!changes.length}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-100 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-colors"
                  >
                    <DownloadIcon className="w-5 h-5 mr-2" />
                    Exportar cambios (JSON)
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-light transition-colors"
                  >
                    <DownloadIcon className="w-5 h-5 mr-2" />
                    Descargar
                  </button>
                */}
                <button 
                  onClick={handleDownloadOriginalPdf}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-light transition-colors text-center"
                >
                  <DownloadIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal text-left">
                    Descargar Original PDF<br className="hidden sm:block" />
                    con ajustes detectados
                  </span>
                </button>
                <button 
                  onClick={handleDownloadWord}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-brand-secondary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-light transition-colors text-center"
                >
                  <DownloadIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal text-left">
                    Descargar Word<br className="hidden sm:block" />
                    con ajustes propuestos
                  </span>
                </button>
                <button
                  onClick={handleDownloadComparisonWord}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary/80 hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-brand-light transition-colors text-center"
                >
                  <DownloadIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="whitespace-normal text-left">
                    Comparativa<br className="hidden sm:block" />
                    en 2 columnas
                  </span>
                </button>
                <button 
                  onClick={handleReset}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-colors"
                >
                  Empezar de Nuevo
                </button>
              </div>
            </div>
          </div>
        </header>
      )}
      <div className="flex-grow min-h-0">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;
