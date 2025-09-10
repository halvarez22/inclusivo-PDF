import React from 'react';

interface LoaderProps {
  message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary"></div>
      <p className="mt-6 text-xl font-semibold text-gray-200">{message}</p>
      <p className="mt-2 text-sm text-gray-400">Esto puede tardar un momento...</p>
    </div>
  );
};

export default Loader;