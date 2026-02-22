/**
 * Input Component
 * Reusable form input with label and error
 */

/**
 * Input component
 * @param {Object} props - Component props
 * @param {string} props.label - Input label
 * @param {string} props.type - Input type
 * @param {string} props.name - Input name
 * @param {string} props.value - Input value
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.error - Error message
 * @param {boolean} props.required - Required field
 * @param {Function} props.onChange - Change handler
 */
function Input({
    label,
    type = 'text',
    name,
    value,
    placeholder,
    error,
    required = false,
    onChange,
    className = '',
    ...props
}) {
    return (
        <div className="form-group">
            {/* Label */}
            {label && (
                <label htmlFor={name} className="form-label">
                    {label}
                    {required && <span style={{ color: 'var(--error)' }}> *</span>}
                </label>
            )}

            {/* Input */}
            <input
                id={name}
                type={type}
                name={name}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                className={`form-input ${error ? 'error' : ''} ${className}`}
                required={required}
                {...props}
            />

            {/* Error message */}
            {error && (
                <span className="form-error">{error}</span>
            )}
        </div>
    );
}

export default Input;
