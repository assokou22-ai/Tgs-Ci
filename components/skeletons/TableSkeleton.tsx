import React from 'react';

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
    return (
        <div className="w-full animate-pulse">
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-12 gap-4 items-center">
                        {Array.from({ length: columns }).map((_, colIndex) => {
                             // Make columns have varying widths for a more realistic look
                            const colSpan = colIndex === 0 ? 'col-span-4' : colIndex === columns - 1 ? 'col-span-2' : 'col-span-3';
                            return (
                                <div key={colIndex} className={colSpan}>
                                    <div className="h-4 bg-gray-700 rounded"></div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TableSkeleton;
