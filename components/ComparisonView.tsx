import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { InclusiveChange } from '../types';

interface HighlightProps {
  children: React.ReactNode;
  id: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isActive: boolean;
}

const Highlight: React.FC<HighlightProps> = ({ children, id, onMouseEnter, onMouseLeave, isActive }) => {
  const baseClasses = "rounded px-1 py-0.5 cursor-pointer transition-all duration-300";
  const activeClasses = "bg-yellow-300 text-black ring-2 ring-yellow-200";
  const inactiveClasses = "bg-yellow-500 bg-opacity-40 text-yellow-200 hover:bg-opacity-60";

  return (
    <span
      id={id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      {children}
    </span>
  );
};

interface ComparisonViewProps {
  originalText: string;
  modifiedText: string;
  changes: InclusiveChange[];
  onModifiedTextChange: (newText: string) => void;
}

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const ComparisonView: React.FC<ComparisonViewProps> = ({ originalText, modifiedText, changes, onModifiedTextChange }) => {
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localModifiedText, setLocalModifiedText] = useState(modifiedText);
  const editableRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState<number>(0);

  // Sincronizar el texto local con el prop cuando cambie externamente
  useEffect(() => {
    if (!isEditing) {
      setLocalModifiedText(modifiedText);
    }
  }, [modifiedText, isEditing]);

  useEffect(() => {
    if (activeChangeId) {
      const originalEl = document.getElementById(`original-${activeChangeId}`);
      const modifiedEl = document.getElementById(`modified-${activeChangeId}`);

      originalEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      modifiedEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeChangeId]);

  // Función para restaurar la posición del cursor
  const restoreCursorPosition = useCallback(() => {
    if (editableRef.current && cursorPosition > 0) {
      const range = document.createRange();
      const sel = window.getSelection();
      
      if (sel) {
        try {
          // Buscar el nodo de texto y la posición
          const textNode = editableRef.current.childNodes[0];
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const maxPos = textNode.textContent?.length || 0;
            const pos = Math.min(cursorPosition, maxPos);
            range.setStart(textNode, pos);
            range.setEnd(textNode, pos);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (e) {
          console.warn('Error al restaurar cursor:', e);
        }
      }
    }
  }, [cursorPosition]);

  const renderWithHighlights = (text: string, type: 'original' | 'inclusive') => {
    if (!changes || changes.length === 0) {
      return <span>{text}</span>;
    }

    const phrasesToHighlight = changes.map(c => escapeRegExp(type === 'original' ? c.original : c.inclusive)).filter(p => p.length > 0);
    
    if (phrasesToHighlight.length === 0) {
        return <span>{text}</span>
    }

    const regex = new RegExp(`(${phrasesToHighlight.join('|')})`, 'g');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const matchingChange = changes.find(c => (type === 'original' ? c.original : c.inclusive) === part);
      if (matchingChange) {
        return (
          <Highlight
            key={`${matchingChange.id}-${index}`}
            id={`${type}-${matchingChange.id}`}
            onMouseEnter={() => setActiveChangeId(matchingChange.id)}
            onMouseLeave={() => setActiveChangeId(null)}
            isActive={activeChangeId === matchingChange.id}
          >
            {part}
          </Highlight>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleTextEdit = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerText;
    setLocalModifiedText(newText);
    onModifiedTextChange(newText);
  }, [onModifiedTextChange]);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Guardar la posición del cursor
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode.nodeType === Node.TEXT_NODE) {
        setCursorPosition(range.startOffset);
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevenir que Enter cree nuevos párrafos
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    // Guardar posición del cursor cuando se hace clic
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode.nodeType === Node.TEXT_NODE) {
        setCursorPosition(range.startOffset);
      }
    }
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full p-4 md:p-6">
      <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold p-4 border-b border-gray-700 text-gray-200">Documento Original</h2>
        <div className="p-6 overflow-y-auto h-full text-gray-300 leading-relaxed whitespace-pre-wrap">
          {renderWithHighlights(originalText, 'original')}
        </div>
      </div>
      <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold p-4 border-b border-gray-700 text-gray-200">Versión Inclusiva (Editable)</h2>
        <div className="relative p-6 overflow-y-auto h-full">
          {isEditing ? (
            <textarea
              ref={editableRef as any}
              value={localModifiedText}
              onChange={(e) => {
                setLocalModifiedText(e.target.value);
                onModifiedTextChange(e.target.value);
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyUp={handleKeyUp}
              onMouseUp={handleMouseUp}
              className="w-full h-full text-gray-100 leading-relaxed bg-transparent border-none outline-none resize-none"
              style={{ 
                minHeight: '200px',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit'
              }}
            />
          ) : (
            <div 
              onClick={() => setIsEditing(true)}
              className="cursor-text"
            >
              {renderWithHighlights(localModifiedText, 'inclusive')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;