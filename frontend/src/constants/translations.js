/**
 * French Language Translations
 * All UI text in French - Professional Clinical Tone
 */

const translations = {
    // ======================
    // COMMON
    // ======================
    common: {
        loading: 'Chargement en cours...',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        edit: 'Modifier',
        add: 'Ajouter',
        search: 'Rechercher',
        confirm: 'Confirmer',
        back: 'Retour',
        next: 'Suivant',
        previous: 'Précédent',
        submit: 'Valider',
        close: 'Fermer',
        yes: 'Oui',
        no: 'Non',
        actions: 'Actions',
        status: 'Statut',
        date: 'Date',
        required: 'Obligatoire',
        optional: 'Facultatif',
        success: 'Opération réussie',
        error: 'Une erreur est survenue',
        warning: 'Avertissement',
        info: 'Information'
    },

    // ======================
    // AUTHENTICATION
    // ======================
    auth: {
        login: 'Connexion',
        logout: 'Déconnexion',
        register: "S'inscrire",
        email: 'Adresse e-mail',
        password: 'Mot de passe',
        confirmPassword: 'Confirmer le mot de passe',
        forgotPassword: 'Mot de passe oublié ?',
        resetPassword: 'Réinitialiser le mot de passe',
        loginTitle: 'Accès à votre espace professionnel',
        registerTitle: 'Inscription Médecin',
        loginButton: 'Se connecter',
        registerButton: 'Créer mon compte',
        noAccount: "Vous n'avez pas encore de compte ?",
        hasAccount: 'Vous possédez déjà un compte ?',
        invalidCredentials: 'Identifiants incorrects',
        accountCreated: 'Compte créé avec succès'
    },

    // ======================
    // DOCTOR
    // ======================
    doctor: {
        dashboard: 'Tableau de bord',
        profile: 'Mon Profil',
        settings: 'Paramètres',
        catalogue: 'Référentiel des questions',
        assistants: 'Gestion des collaborateurs',
        cases: 'Dossiers Patients',
        caseReview: 'Examen Clinique',

        // Profile fields
        firstName: 'Prénom',
        lastName: 'Nom de famille',
        gender: 'Genre',
        phone: 'Contact téléphonique',
        address: 'Adresse du cabinet',
        specialty: 'Spécialité médicale',

        // Specialties
        specialties: {
            generalMedicine: 'Médecine Générale',
            cardiology: 'Cardiologie',
            dermatology: 'Dermatologie',
            neurology: 'Neurologie',
            pediatrics: 'Pédiatrie',
            psychiatry: 'Psychiatrie',
            surgery: 'Chirurgie',
            gynecology: 'Gynécologie',
            ophthalmology: 'Ophtalmologie',
            orthopedics: 'Orthopédie'
        },

        // Dashboard
        pendingCases: 'Consultations en attente',
        reviewedCases: 'Dossiers finalisés',
        totalAssistants: 'Collaborateurs',
        activeAssistants: 'Personnel actif'
    },

    // ======================
    // ASSISTANT
    // ======================
    assistant: {
        patientsList: 'Registre des Patients',
        newPatient: 'Nouveau Patient',
        startCase: 'Nouvelle Consultation',
        questionnaire: 'Saisie des données',
        review: 'Récapitulatif',
        submit: 'Transmettre au Médecin',
        profile: 'Profil Assistant'
    },

    // ======================
    // PATIENT
    // ======================
    patient: {
        title: 'Patient',
        patients: 'Patients',
        firstName: 'Prénom',
        lastName: 'Nom',
        gender: 'Sexe',
        age: 'Âge',
        phone: 'Téléphone',
        male: 'Masculin',
        female: 'Féminin',
        other: 'Autre',
        addPatient: 'Enregistrer un nouveau patient',
        editPatient: 'Modifier la fiche patient',
        searchPatient: 'Rechercher un patient...',
        noPatients: 'Aucun patient enregistré',
        patientCreated: 'Patient enregistré avec succès',
        selectPatient: 'Sélectionner un patient'
    },

    // ======================
    // CATALOGUE
    // ======================
    catalogue: {
        title: 'Référentiel de Questions',
        addQuestion: 'Ajouter une question',
        editQuestion: 'Modifier la question',
        questionText: 'Énoncé de la question',
        answerType: 'Type de réponse attendue',
        yesNo: 'Oui / Non',
        voice: 'Réponse vocale',
        choices: 'Choix multiples',
        required: 'Champ obligatoire',
        active: 'Question active',
        publish: 'Publier le référentiel',
        noQuestions: 'Le catalogue est actuellement vide',
        reorder: 'Réorganiser',
        published: 'Référentiel publié avec succès'
    },

    // ======================
    // CASE
    // ======================
    case: {
        title: 'Dossier Médical',
        cases: 'Consultations',
        newCase: 'Nouveau Dossier',
        status: {
            inProgress: 'En cours',
            submitted: 'En attente de révision',
            reviewed: 'Finalisé',
            closed: 'Archivé'
        },
        diagnosis: 'Diagnostic',
        prescription: 'Prescription Médicale',
        aiAnalysis: 'Analyse Prédictive IA',
        documents: 'Pièces Jointes',
        answers: 'Données Cliniques',
        startQuestionnaire: 'Démarrer l\'entretien',
        submitCase: 'Valider le dossier',
        saveReview: 'Enregistrer l\'analyse',
        generatePDF: 'Édition de l\'ordonnance',
        closeCase: 'Clôturer le dossier',
        caseSubmitted: 'Dossier transmis avec succès',
        reviewSaved: 'Analyse enregistrée'
    },

    // ======================
    // DOCUMENTS
    // ======================
    documents: {
        title: 'Documents Médicaux',
        upload: 'Importer un document',
        type: 'Type de document',
        types: {
            analysis: 'Analyses Biologiques',
            imagery: 'Imagerie Médicale',
            prescription: 'Ordonnances',
            report: 'Comptes-rendus'
        },
        dragDrop: 'Glissez-déposez vos fichiers ici',
        or: 'ou',
        browse: 'Parcourir les fichiers',
        uploaded: 'Document importé avec succès',
        deleted: 'Document supprimé'
    },

    // ======================
    // QUESTIONNAIRE
    // ======================
    questionnaire: {
        title: 'Entretien Médical',
        question: 'Question',
        answer: 'Réponse',
        recording: 'Enregistrement en cours...',
        startRecording: 'Démarrer la dictée',
        stopRecording: 'Arrêter la dictée',
        reRecord: 'Reprendre l\'enregistrement',
        nextQuestion: 'Suivant',
        previousQuestion: 'Précédent',
        finish: 'Finaliser l\'entretien',
        progress: 'Progression'
    },

    // ======================
    // ERRORS
    // ======================
    errors: {
        required: 'Ce champ est obligatoire',
        invalidEmail: 'Veuillez saisir une adresse e-mail valide',
        passwordMismatch: 'Les mots de passe ne correspondent pas',
        minLength: 'Minimum {min} caractères requis',
        serverError: 'Une erreur serveur est survenue. Veuillez réessayer.',
        network: 'Erreur de connexion au serveur',
        unauthorized: 'Accès non autorisé',
        notFound: 'Ressource introuvable'
    },

    // ======================
    // LANDING PAGE
    // ======================
    landing: {
        title: 'Plateforme de Coordination Médicale',
        subtitle: 'Système intelligent de gestion des consultations et d\'aide au diagnostic',
        features: {
            title: 'Nos Services',
            aiAnalysis: 'Analyse assistée par Intelligence Artificielle',
            voiceRecording: 'Dictée vocale et transcription intelligente',
            pdfGeneration: 'Génération automatisée d\'ordonnances sécurisées',
            secureData: 'Protection rigoureuse des données médicales'
        },
        cta: 'Démarrer l\'expérience',
        learnMore: 'En savoir plus'
    }
};

export default translations;
