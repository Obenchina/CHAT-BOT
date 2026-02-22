/**
 * 404 Not Found Page
 */

import { Link } from 'react-router-dom';
import Button from '../../components/common/Button';
import '../../styles/pages.css';

function NotFoundPage() {
    return (
        <div className="error-page">
            <div className="error-content">
                <div className="error-code">404</div>
                <h1 className="error-title">Page non trouvée</h1>
                <p className="error-message">
                    La page que vous recherchez n'existe pas ou a été déplacée.
                </p>
                <Link to="/">
                    <Button variant="primary">Retour à l'accueil</Button>
                </Link>
            </div>
        </div>
    );
}

export default NotFoundPage;
