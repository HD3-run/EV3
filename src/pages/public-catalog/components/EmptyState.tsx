import React from 'react';

export const EmptyState: React.FC = () => {
  return (
    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
      <p className="text-gray-600 dark:text-gray-400">No products found.</p>
    </div>
  );
};

