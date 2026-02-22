/**
 * Loading Skeleton Component
 * Displays placeholder shimmer animations while content loads
 * Variants: text, circle, card, table-row
 */

function LoadingSkeleton({ variant = 'text', count = 1, width, height }) {
    const skeletons = Array.from({ length: count }, (_, i) => i);

    const getClassName = () => {
        switch (variant) {
            case 'circle':
                return 'skeleton skeleton-circle';
            case 'card':
                return 'skeleton skeleton-card';
            case 'table-row':
                return 'skeleton skeleton-table-row';
            default:
                return 'skeleton skeleton-text';
        }
    };

    const getStyle = () => {
        const style = {};
        if (width) style.width = width;
        if (height) style.height = height;
        return style;
    };

    if (variant === 'card') {
        return (
            <div className="skeleton-card-wrapper">
                {skeletons.map((i) => (
                    <div key={i} className="skeleton-card-container" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="skeleton skeleton-card-header" />
                        <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'table-row') {
        return (
            <>
                {skeletons.map((i) => (
                    <tr key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.05}s` }}>
                        <td><div className="skeleton skeleton-text" style={{ width: '70%' }} /></td>
                        <td><div className="skeleton skeleton-text" style={{ width: '50%' }} /></td>
                        <td><div className="skeleton skeleton-text" style={{ width: '60%' }} /></td>
                        <td><div className="skeleton skeleton-text" style={{ width: '40%' }} /></td>
                    </tr>
                ))}
            </>
        );
    }

    return (
        <>
            {skeletons.map((i) => (
                <div
                    key={i}
                    className={getClassName()}
                    style={{ ...getStyle(), animationDelay: `${i * 0.1}s` }}
                />
            ))}
        </>
    );
}

export default LoadingSkeleton;
