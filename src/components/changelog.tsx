import { Button, Modal } from 'react-bootstrap';

const Changelog = ({ show, onClose }: any) => {

  return (
    <Modal scrollable={true} show={show} centered size="lg" dialogClassName="changelog-modal">
      <Modal.Body>
        <h3><u>17/02/2026</u></h3>
        <br />
        <h5 className="h5-with-line">QCM Réponses multiples</h5>
        <br />
        <ul>
          <li>Les QCM peuvent désormais avoir <b>plusieurs bonnes réponses</b></li>
          <li>Les viewers répondent avec les lettres correctes dans le chat (ex: <code>A,C</code> ou <code>AC</code>)</li>
          <li>Indication visuelle quand un QCM a plusieurs réponses attendues</li>
          <li>Checkboxes dans les formulaires de création/édition au lieu de boutons radio</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Signalement de questions</h5>
        <br />
        <ul>
          <li>Bouton de signalement (drapeau) après la révélation de la réponse</li>
          <li>4 raisons : question incorrecte, réponses manquantes, mauvaise catégorie, question obsolète</li>
          <li>Les signalements sont visibles et gérables dans le dashboard admin</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Effet MDR (Macro Data Refinement) sur les boîtes</h5>
        <br />
        <ul>
          <li>Effet <b>fisheye / loupe</b> sur les noms de boîtes en page d'accueil</li>
          <li>Zoom élastique sur la boîte survolée, zoom léger sur les voisines</li>
          <li>Micro-tremblement et bordure pulsante style Severance</li>
          <li>Crop marks aux 4 coins, curseur viseur (crosshair)</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>16/02/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Page de contribution communautaire</h5>
        <br />
        <ul>
          <li>Nouvelle page <b>/contribute</b> pour proposer des questions</li>
          <li>Support texte libre et QCM directement depuis l'interface</li>
          <li>Ajout en masse avec le format Q:/R:/ALT:</li>
          <li>Les questions proposées sont soumises à modération avant publication</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Dashboard Admin & Modération</h5>
        <br />
        <ul>
          <li>Interface de modération pour les questions proposées par la communauté</li>
          <li>Approbation, rejet ou modification des questions en attente</li>
          <li>Choix de la boîte de destination lors de l'approbation</li>
          <li>Filtres par statut (en attente, approuvées, rejetées)</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Scores persistants & Leaderboard All-time</h5>
        <br />
        <ul>
          <li>Les scores sont désormais sauvegardés côté serveur entre les sessions</li>
          <li>Nouveau mode <b>All-time</b> dans le leaderboard : classement global tous quiz confondus</li>
          <li>Statistiques détaillées par joueur (nombre de sessions, historique)</li>
          <li>Synchronisation automatique des scores en fin de quiz</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>09/02/2026</u></h3>
        <br />
        <h5 className="h5-with-line">QCM Flexible (2-6 options)</h5>
        <br />
        <ul>
          <li>Le QCM supporte maintenant entre 2 et 6 options (A à F)</li>
          <li>Boutons "+ Option" / "- Option" dans le formulaire de création</li>
          <li>Grille d'affichage dynamique qui s'adapte au nombre d'options</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Ajout en masse amélioré</h5>
        <br />
        <ul>
          <li>Les réponses alternatives acceptent les virgules : <code>ALT: réponse1, réponse2</code></li>
          <li>Support QCM dans l'ajout en masse (format A: B: C: D: + R: lettre)</li>
          <li>Détection automatique du type (texte libre ou QCM)</li>
          <li>Prévisualisation avant ajout avec badge QCM</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>07/02/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Ajout en masse de questions</h5>
        <br />
        <ul>
          <li>Nouvelle modale d'ajout en masse avec format Q:/R:/ALT:</li>
          <li>Support des deux formats : texte libre et QCM dans le même bloc</li>
          <li>Catégories aléatoires activables</li>
          <li>Sélection de la boîte de destination</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>31/01/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Mode QCM (Questions à Choix Multiples)</h5>
        <br />
        <ul>
          <li>Nouveau type de question : QCM avec 4 options (A, B, C, D)</li>
          <li>Les viewers répondent avec la lettre ou le chiffre dans le chat</li>
          <li>Interface de création/édition QCM dans le gestionnaire</li>
          <li>Suppression de l'ancien mode "Carte" (6 questions par catégorie)</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>10/01/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Architecture & Performance</h5>
        <br />
        <ul>
          <li>Refactoring complet : séparation du store monolithique en <code>questions-store</code> et <code>game-store</code></li>
          <li>Amélioration de la maintenabilité et réduction des risques de bugs</li>
          <li>Code mieux organisé avec séparation claire des responsabilités</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Sauvegarde & Sécurité des données</h5>
        <br />
        <ul>
          <li>Système de backup complet dans les Settings</li>
          <li>Export/Import JSON de toutes les données (questions, scores, paramètres)</li>
          <li>Protection contre la perte de données lors du changement de navigateur</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Synchronisation GitHub</h5>
        <br />
        <ul>
          <li>Indicateur visuel de statut de synchronisation</li>
          <li>Affichage du temps écoulé depuis la dernière sync ("il y a X minutes")</li>
          <li>Statut en temps réel : succès, erreur, chargement</li>
          <li>Nombre de questions chargées affiché</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Paramètres & Personnalisation</h5>
        <br />
        <ul>
          <li>Temps de réponse configurable par question (slider 15-60 secondes)</li>
          <li>Déplacement du backup dans les Settings pour une meilleure organisation</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Corrections de bugs</h5>
        <br />
        <ul>
          <li>Correction du bug d'affichage vide après déplacement de questions</li>
          <li>Retour automatique à "Toutes les boîtes" si la boîte devient vide</li>
          <li>Correction de la synchronisation GitHub pour supprimer les questions retirées</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>01/01/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Podium & Trophées</h5>
        <br />
        <ul>
          <li>Affichage du podium de fin de partie avec statistiques des joueurs</li>
          <li>Système de trophées et récompenses</li>
          <li>Couronne pour le vainqueur</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Système de points</h5>
        <br />
        <ul>
          <li>Convertisseur de thèmes pour gérer différentes catégories</li>
          <li>Système de combo pour récompenser les bonnes réponses consécutives</li>
          <li>Points de chaîne pour encourager la participation</li>
          <li>Commande !score optimisée pour éviter le spam</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Base de données & Synchronisation</h5>
        <br />
        <ul>
          <li>Ajout de questions personnalisées</li>
          <li>Synchronisation avec GitHub pour la base de données</li>
          <li>Sauvegarde automatique des scores et statistiques</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Leaderboard & Affichage</h5>
        <br />
        <ul>
          <li>Classement des joueurs avec avatars Twitch</li>
          <li>Optimisations du rendu pour de meilleures performances</li>
          <li>Statistiques détaillées des joueurs</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Corrections & Optimisations</h5>
        <br />
        <ul>
          <li>Correction des conditions de course entre stats et scores</li>
          <li>Sauvegarde des scores pour annulation de questions</li>
          <li>Migration vers Yarn et mise à jour des dépendances</li>
          <li>Nettoyage et optimisations diverses du code</li>
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" style={{ color: 'white', width: '60px' }} onClick={() => onClose()}>
          <b>Ok</b>
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default Changelog;
