import React from 'react';

const ListItemSkeleton: React.FC = () => {
    return (
        <div className="p-4 border-b border-gray-700 animate-pulse">
            <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-600 rounded w-1/3"></div>
                <div className="h-4 bg-gray-600 rounded w-1/4"></div>
            </div>
            <div className="flex justify-between items-center mt-2">
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/6"></div>
            </div>
        </div>
    );
};

export default ListItemSkeleton;
