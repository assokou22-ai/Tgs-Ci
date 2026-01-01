import React from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons.tsx';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > 3) {
        pageNumbers.push('...');
      }
      if (currentPage > 2) {
        pageNumbers.push(currentPage - 1);
      }
      if (currentPage !== 1 && currentPage !== totalPages) {
        pageNumbers.push(currentPage);
      }
      if (currentPage < totalPages - 1) {
        pageNumbers.push(currentPage + 1);
      }
      if (currentPage < totalPages - 2) {
        pageNumbers.push('...');
      }
      pageNumbers.push(totalPages);
    }
    // Remove duplicate ellipsis
    return pageNumbers.filter((v, i, a) => v !== '...' || a[i - 1] !== '...');
  };

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Précédent
      </button>
      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, index) =>
          typeof page === 'number' ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 rounded-md ${currentPage === page ? 'bg-blue-600 font-bold' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="px-3 py-1 text-gray-400">
              {page}
            </span>
          )
        )}
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Suivant
        <ArrowRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PaginationControls;
