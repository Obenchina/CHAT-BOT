/**
 * Role-based Access Control Middleware
 * Restricts access based on user roles (doctor, assistant)
 */

/**
 * Create middleware to restrict access to specific roles
 * @param {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware function
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        // Check if user role is in allowed roles
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
}

/**
 * Middleware to allow only doctors
 */
const doctorOnly = authorize('doctor');

/**
 * Middleware to allow only assistants
 */
const assistantOnly = authorize('assistant');

/**
 * Middleware to allow both doctors and assistants
 */
const doctorOrAssistant = authorize('doctor', 'assistant');

module.exports = {
    authorize,
    doctorOnly,
    assistantOnly,
    doctorOrAssistant
};
