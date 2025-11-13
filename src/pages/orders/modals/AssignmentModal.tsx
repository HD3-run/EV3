// Assignment Modal Component

import { createPortal } from 'react-dom';
import type { Order, AssignmentData } from '../types/order.types';

interface AssignmentModalProps {
  show: boolean;
  order: Order | null;
  employees: Array<{ user_id: number; username: string; role: string }>;
  assignmentData: AssignmentData;
  onAssignmentDataChange: (data: AssignmentData) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export default function AssignmentModal({
  show,
  order,
  employees,
  assignmentData,
  onAssignmentDataChange,
  onSubmit,
  onClose,
  isSubmitting = false
}: AssignmentModalProps) {
  if (!show || !order) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Assign Order #{order.orderId}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assign to Employee:
            </label>
            <select
              value={assignmentData.userId}
              onChange={(e) => onAssignmentDataChange({...assignmentData, userId: e.target.value})}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Employee</option>
              {employees.map((employee) => (
                <option key={`employee-${employee.user_id}`} value={employee.user_id}>
                  {employee.username} ({employee.role})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Delivery Notes:
            </label>
            <textarea
              value={assignmentData.deliveryNotes}
              onChange={(e) => onAssignmentDataChange({...assignmentData, deliveryNotes: e.target.value})}
              placeholder="Special instructions for delivery..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!assignmentData.userId || isSubmitting}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Assigning...' : 'Assign Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

