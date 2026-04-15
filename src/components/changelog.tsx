import { Button, Modal } from 'react-bootstrap';

const Changelog = ({ show, onClose }: any) => {

  return (
    <Modal scrollable={true} show={show} centered size="lg" dialogClassName="changelog-modal">
      <Modal.Body>
        <h3><u>07/04/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Couleurs dynamiques par boîte</h5>
        <br />
        <ul>
          <li>Les sous-boîtes héritent automatiquement de la couleur de leur boîte parente (teinte atténuée)</li>
          <li>Hover, sélection, crop marks et animations adaptés à la couleur de chaque boîte</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Création de boîte vide</h5>
        <br />
        <ul>
          <li>Nouveau bouton <b>"Créer une Boîte"</b> dans la barre d'outils du gestionnaire de questions (admin)</li>
          <li>Permet de créer une boîte vide pour y rattacher des sous-boîtes ou des questions plus tard</li>
          <li>Détection de doublon (case-insensitive)</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Lisibilité améliorée des boîtes</h5>
        <br />
        <ul>
          <li>Les boîtes non sélectionnées et éloignées du survol sont désormais <b>plus lisibles</b></li>
          <li>Opacités minimales relevées pour garder les noms de boîtes toujours visibles</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Suppression du système de catégories</h5>
        <br />
        <ul>
          <li>Les anciennes catégories (Géographie, Science, etc.) ont été supprimées</li>
          <li>Les <b>Boîtes</b> sont désormais le seul organisateur de questions</li>
          <li>Le badge en-tête de question affiche le nom de la boîte (blanc) au lieu de la catégorie</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Accordion inline pour les sous-boîtes</h5>
        <br />
        <ul>
          <li>Les sous-boîtes s'affichent en <b>accordion inline</b> sous leur boîte parente</li>
          <li>Plusieurs masters peuvent être dépliés simultanément (icônes ▶ / ▼)</li>
          <li>Sous-boîtes indentées avec bordure gauche et icône └</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Grace period configurable</h5>
        <br />
        <ul>
          <li>Nouveau slider dans les paramètres : <b>clémence FIRST</b> (100ms à 2000ms)</li>
          <li>Les joueurs qui répondent dans cette fenêtre après le premier sont aussi considérés "premier"</li>
          <li>Timer minimum de réponse abaissé de 15s à 10s</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>27/03/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Bonus Seul (+1 point)</h5>
        <br />
        <ul>
          <li>Nouveau bonus : <b>+1 point</b> si vous êtes le seul joueur à avoir trouvé la bonne réponse</li>
          <li>Cumulable avec First (+2) et Combo (max +3) — score max par question : <b>7 points</b></li>
        </ul>
        <br />
        <h5 className="h5-with-line">Combo max dans le podium</h5>
        <br />
        <ul>
          <li>Le podium affiche désormais le <b>combo max</b> de chaque joueur au lieu du total de combos</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>21/03/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Page Statistiques</h5>
        <br />
        <ul>
          <li>Nouvelle page <b>/stats</b> avec statistiques globales et par joueur</li>
          <li>Stats joueur : score total, meilleur score, combos, performances par boîte, contributions</li>
          <li>Lien partageable <b>/stats/pseudo</b> pour chaque joueur</li>
          <li>Bouton "Mes stats" pré-rempli avec le pseudo Twitch connecté</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Attribution des créateurs</h5>
        <br />
        <ul>
          <li>Le pseudo du créateur est affiché à côté de chaque boîte et question</li>
          <li>Visible dans les statistiques joueur (questions ajoutées, boîtes créées)</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Pagination & optimisations</h5>
        <br />
        <ul>
          <li>Pagination 50 questions/page dans le gestionnaire</li>
          <li>Fix du temps de réponse (calcul réel basé sur le timestamp de réponse)</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>10/03/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Mode boîte ordonnée</h5>
        <br />
        <ul>
          <li>Toggle <b>↓ Ordonné</b> pour jouer les questions dans l'ordre d'insertion</li>
          <li>Activable à la création ou via le bouton dans l'en-tête de la boîte (admin)</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Nettoyage auth & code</h5>
        <br />
        <ul>
          <li>Suppression complète du système API Key (tout passe par token Twitch Bearer)</li>
          <li>Nettoyage de code mort : fichiers legacy, fonctions inutilisées</li>
        </ul>
        <br />
        <hr />
        <br />
        <h3><u>21/02/2026</u></h3>
        <br />
        <h5 className="h5-with-line">Sélection de boîte au clic (page Quiz)</h5>
        <br />
        <ul>
          <li>Les boîtes sont maintenant <b>cliquables</b> directement sur la page d'accueil du quiz</li>
          <li>Card <b>★ TOUTES</b> en premier : sélectionne toutes les boîtes d'un clic</li>
          <li>Clic sur une boîte quand "Toutes" est actif → isole cette boîte</li>
          <li>Multi-sélection : clic sur d'autres boîtes pour en ajouter à la sélection</li>
          <li>Les boîtes sélectionnées restent <b>allumées</b> (glow cyan) entre les quiz</li>
          <li>Le popup de lancement n'affiche plus le dropdown de boîte — juste le nombre de questions</li>
        </ul>
        <br />
        <h5 className="h5-with-line">Renommer une boîte (Admin)</h5>
        <br />
        <ul>
          <li>Bouton <b>crayon</b> dans l'en-tête de chaque boîte sur la page /questions</li>
          <li>Le nouveau nom est propagé en base de données (boîte + toutes ses questions)</li>
          <li>Modale de confirmation avec le nom actuel pré-rempli</li>
        </ul>
        <br />
        <hr />
        <br />
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
