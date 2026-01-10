import { Button, Modal } from 'react-bootstrap';

const Changelog = ({ show, onClose }: any) => {

  return (
    <Modal scrollable={true} show={show} centered size="lg" dialogClassName="changelog-modal">
      <Modal.Body>
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
