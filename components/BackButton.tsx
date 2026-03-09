import React from 'react';

const BackButton: React.FC = () => {
  const handleBackToPAI = () => {
    window.location.href = 'https://www.pai-b.com/#agents';
  };

  return (
    <button
      onClick={handleBackToPAI}
      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-slate-900 bg-cyan-500 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-all duration-300 hover:scale-105"
      style={{
        boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
      }}
    >
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        className="mr-2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Regresar a PAI-B
    </button>
  );
};

export default BackButton;
