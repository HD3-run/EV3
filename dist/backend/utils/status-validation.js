"use strict";
/**
 * Status validation utilities for order management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPLOYEE_STATUS_TRANSITIONS = void 0;
exports.isValidEmployeeStatusTransition = isValidEmployeeStatusTransition;
exports.getAllowedStatusTransitions = getAllowedStatusTransitions;
exports.requiresPaymentValidation = requiresPaymentValidation;
const constants_1 = require("./constants");
/**
 * Define valid status transitions for employees
 * This prevents employees from making invalid status changes
 */
exports.EMPLOYEE_STATUS_TRANSITIONS = [
    {
        from: constants_1.ORDER_STATUS.PENDING,
        to: [constants_1.ORDER_STATUS.CONFIRMED, constants_1.ORDER_STATUS.CANCELLED]
    },
    {
        from: constants_1.ORDER_STATUS.CONFIRMED,
        to: [constants_1.ORDER_STATUS.PROCESSING, constants_1.ORDER_STATUS.SHIPPED, constants_1.ORDER_STATUS.CANCELLED]
    },
    {
        from: constants_1.ORDER_STATUS.PROCESSING,
        to: [constants_1.ORDER_STATUS.SHIPPED, constants_1.ORDER_STATUS.CANCELLED]
    },
    {
        from: constants_1.ORDER_STATUS.SHIPPED,
        to: [constants_1.ORDER_STATUS.DELIVERED, constants_1.ORDER_STATUS.CANCELLED]
    },
    // Final states - no transitions allowed
    {
        from: constants_1.ORDER_STATUS.DELIVERED,
        to: [] // Cannot change from delivered
    },
    {
        from: constants_1.ORDER_STATUS.CANCELLED,
        to: [] // Cannot change from cancelled
    },
    {
        from: constants_1.ORDER_STATUS.RETURNED,
        to: [] // Cannot change from returned
    }
];
/**
 * Validate if a status transition is allowed for employees
 */
function isValidEmployeeStatusTransition(currentStatus, newStatus) {
    // Employees cannot change returned orders
    if (currentStatus === constants_1.ORDER_STATUS.RETURNED) {
        return false;
    }
    const rule = exports.EMPLOYEE_STATUS_TRANSITIONS.find(r => r.from === currentStatus);
    if (!rule) {
        return false;
    }
    return rule.to.includes(newStatus);
}
/**
 * Get allowed status transitions for a given current status
 */
function getAllowedStatusTransitions(currentStatus) {
    const rule = exports.EMPLOYEE_STATUS_TRANSITIONS.find(r => r.from === currentStatus);
    return rule ? rule.to : [];
}
/**
 * Check if a status requires payment validation
 */
function requiresPaymentValidation(status) {
    return status === constants_1.ORDER_STATUS.CONFIRMED || status === constants_1.ORDER_STATUS.DELIVERED || status === constants_1.ORDER_STATUS.CANCELLED;
}
//# sourceMappingURL=status-validation.js.map