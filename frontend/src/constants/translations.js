/**
 * French Language Translations
 * All UI text in French
 */

const translations = {
    // ======================
    // COMMON
    // ======================
    common: {
        loading: 'Chargement...',
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
        submit: 'Soumettre',
        close: 'Fermer',
        yes: 'Oui',
        no: 'Non',
        actions: 'Actions',
        status: 'Statut',
        date: 'Date',
        required: 'Obligatoire',
        optional: 'Optionnel',
        success: 'Succès',
        error: 'Erreur',
        warning: 'Attention',
        info: 'Information'
    },

    // ======================
    // AUTHENTICATION
    // ======================
    auth: {
        login: 'Connexion',
        logout: 'Déconnexion',
        register: 'S\'inscrire',
        email: 'Adresse e-mail',
        password: 'Mot de passe',
        confirmPassword: 'Confirmer le mot de passe',
        forgotPassword: 'Mot de passe oublié ?',
        resetPassword: 'Réinitialiser le mot de passe',
        loginTitle: 'Connexion à votre compte',
        registerTitle: 'Créer un compte médecin',
        loginButton: 'Se connecter',
        registerButton: 'Créer le compte',
        noAccount: 'Vous n\'avez pas de compte ?',
        hasAccount: 'Vous avez déjà un compte ?',
        invalidCredentials: 'Email ou mot de passe incorrect',
        accountCreated: 'Compte créé avec succès'
    },

    // ======================
    // DOCTOR
    // ======================
    doctor: {
        dashboard: 'Tableau de bord',
        profile: 'Profil',
        settings: 'Paramètres',
        catalogue: 'Catalogue des questions',
        assistants: 'Gestion des assistants',
        cases: 'Boîte de réception des cas',
        caseReview: 'Révision du cas',

        // Profile fields
        firstName: 'Prénom',
        lastName: 'Nom',
        gender: 'Genre',
        phone: 'Téléphone',
        address: 'Adresse professionnelle',
        specialty: 'Spécialité',

        // Specialties
        specialties: {
            generalMedicine: 'Médecine générale',
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
        pendingCases: 'Cas en attente',
        reviewedCases: 'Cas traités',
        totalAssistants: 'Assistants',
        activeAssistants: 'Assistants actifs'
    },

    // ======================
    // ASSISTANT
    // ======================
    assistant: {
        patientsList: 'Liste des patients',
        newPatient: 'Nouveau patient',
        startCase: 'Démarrer un cas',
        questionnaire: 'Questionnaire',
        review: 'Révision',
        submit: 'Soumettre le cas',
        profile: 'Profil'
    },

    // ======================
    // PATIENT
    // ======================
    patient: {
        title: 'Patient',
        patients: 'Patients',
        firstName: 'Prénom',
        lastName: 'Nom',
        gender: 'Genre',
        age: 'Âge',
        phone: 'Téléphone',
        male: 'Homme',
        female: 'Femme',
        other: 'Autre',
        addPatient: 'Ajouter un patient',
        editPatient: 'Modifier le patient',
        searchPatient: 'Rechercher un patient...',
        noPatients: 'Aucun patient trouvé',
        patientCreated: 'Patient créé avec succès',
        selectPatient: 'Sélectionner un patient'
    },

    // ======================
    // CATALOGUE
    // ======================
    catalogue: {
        title: 'Catalogue des questions',
        addQuestion: 'Ajouter une question',
        editQuestion: 'Modifier la question',
        questionText: 'Texte de la question',
        answerType: 'Type de réponse',
        yesNo: 'Oui/Non',
        voice: 'Réponse vocale',
        choices: 'Choix multiples',
        required: 'Question obligatoire',
        active: 'Question active',
        publish: 'Publier le catalogue',
        version: 'Version',
        noQuestions: 'Aucune question dans le catalogue',
        reorder: 'Réorganiser les questions',
        published: 'Catalogue publié avec succès'
    },

    // ======================
    // CASE
    // ======================
    case: {
        title: 'Cas médical',
        cases: 'Cas',
        newCase: 'Nouveau cas',
        status: {
            inProgress: 'En cours',
            submitted: 'Soumis',
            reviewed: 'Traité',
            closed: 'Clôturé'
        },
        diagnosis: 'Diagnostic',
        prescription: 'Ordonnance',
        aiAnalysis: 'Analyse IA',
        documents: 'Documents',
        answers: 'Réponses',
        startQuestionnaire: 'Démarrer le questionnaire',
        submitCase: 'Soumettre le cas',
        saveReview: 'Enregistrer la révision',
        generatePDF: 'Générer l\'ordonnance',
        closeCase: 'Clôturer le cas',
        caseSubmitted: 'Cas soumis avec succès',
        reviewSaved: 'Révision enregistrée'
    },

    // ======================
    // DOCUMENTS
    // ======================
    documents: {
        title: 'Documents médicaux',
        upload: 'Télécharger un document',
        type: 'Type de document',
        types: {
            analysis: 'Analyses',
            imagery: 'Imagerie',
            prescription: 'Ordonnances',
            report: 'Rapports médicaux'
        },
        dragDrop: 'Glissez et déposez les fichiers ici',
        or: 'ou',
        browse: 'Parcourir',
        uploaded: 'Document téléchargé avec succès',
        deleted: 'Document supprimé'
    },

    // ======================
    // QUESTIONNAIRE
    // ======================
    questionnaire: {
        title: 'Questionnaire médical',
        question: 'Question',
        answer: 'Réponse',
        recording: 'Enregistrement...',
        startRecording: 'Commencer l\'enregistrement',
        stopRecording: 'Arrêter l\'enregistrement',
        reRecord: 'Ré-enregistrer',
        nextQuestion: 'Question suivante',
        previousQuestion: 'Question précédente',
        finish: 'Terminer',
        progress: 'Progression'
    },

    // ======================
    // ERRORS
    // ======================
    errors: {
        required: 'Ce champ est obligatoire',
        invalidEmail: 'Adresse e-mail invalide',
        passwordMismatch: 'Les mots de passe ne correspondent pas',
        minLength: 'Minimum {min} caractères requis',
        serverError: 'Erreur serveur. Veuillez réessayer.',
        network: 'Erreur de connexion au serveur',
        unauthorized: 'Accès non autorisé',
        notFound: 'Ressource non trouvée'
    },

    // ======================
    // LANDING PAGE
    // ======================
    landing: {
        title: 'Plateforme de Consultation Médicale',
        subtitle: 'Solution intelligente pour la gestion des consultations médicales',
        features: {
            title: 'Fonctionnalités',
            aiAnalysis: 'Analyse IA des symptômes',
            voiceRecording: 'Enregistrement vocal des réponses',
            pdfGeneration: 'Génération automatique d\'ordonnances',
            secureData: 'Données médicales sécurisées'
        },
        cta: 'Commencer maintenant',
        learnMore: 'En savoir plus'
    }
};

export default translations;
