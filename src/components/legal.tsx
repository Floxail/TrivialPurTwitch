import React from 'react';
import { Link } from 'react-router-dom';

// Pages publiques (sans connexion) : Discord exige des CGU et une politique de confidentialité accessibles.
// Le contenu décrit ce que le code du site (src/, api/) et du bot (bot/) collecte réellement :
// à mettre à jour si une nouvelle donnée est collectée.

const CONTACT = 'contact@floxail.fr';
const UPDATED = '13 octobre 2026';

const Page = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="legal-page">
    <h2>{title}</h2>
    <p className="legal-updated">Dernière mise à jour : {UPDATED}</p>
    {children}
    <p className="legal-footer">
      <Link to="/cgu">Conditions d'utilisation</Link> · <Link to="/confidentialite">Politique de confidentialité</Link> · Contact : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
    </p>
  </div>
);

export const Terms = () => (
  <Page title="Conditions d'utilisation">
    <p>
      TrivialPurTwitch (le site trivial.floxail.fr et le bot Discord TrivialPurTwitch) est un service gratuit et non commercial
      édité par Floxail. L'utiliser vaut acceptation des présentes conditions.
    </p>

    <h3>Le service</h3>
    <p>
      Le service permet de jouer à des quiz avec le chat d'un stream Twitch ou dans un salon Discord, de consulter des
      classements et de proposer des questions. Il est fourni tel quel, sans garantie de disponibilité, d'exactitude des
      questions ni de conservation des scores. Il peut être modifié, suspendu ou arrêté à tout moment.
    </p>

    <h3>Comptes</h3>
    <p>
      La connexion au site se fait avec un compte Twitch, Discord ou Google (Twitch est nécessaire pour animer un quiz) ;
      le bot utilise ton compte Discord. Tu peux lier ces comptes entre eux dans les paramètres. Les conditions de Twitch,
      Discord et Google s'appliquent en plus des présentes.
    </p>

    <h3>Propositions de questions</h3>
    <ul>
      <li>Les questions proposées sont relues avant publication et peuvent être refusées, modifiées ou retirées.</li>
      <li>Interdits : contenus illégaux, haineux, discriminatoires, sexuels explicites, harcèlement, données personnelles d'autrui, contenus dont tu n'as pas les droits.</li>
      <li>En proposant une question, tu autorises son utilisation gratuite sur le site et le bot. Ton pseudo (Twitch, Discord ou Google) peut être affiché comme auteur.</li>
    </ul>

    <h3>Bonne conduite</h3>
    <p>
      Interdits : contourner les limites du service, automatiser des envois massifs, fausser les classements ou perturber les
      parties. En cas d'abus, l'accès peut être retiré et les scores ou propositions concernés supprimés.
    </p>

    <h3>Responsabilité</h3>
    <p>
      Dans les limites permises par la loi, l'éditeur n'est pas responsable des dommages liés à l'utilisation du service,
      à son indisponibilité ou au contenu des questions proposées par les utilisateurs.
    </p>

    <h3>Droit applicable</h3>
    <p>
      Ces conditions sont régies par le droit français. Pour toute question : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
    </p>
  </Page>
);

export const Privacy = () => (
  <Page title="Politique de confidentialité">
    <p>
      Responsable du traitement : Floxail, joignable à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      Cette page décrit les données traitées par le site trivial.floxail.fr et par le bot Discord TrivialPurTwitch.
    </p>

    <h3>Ce que nous ne faisons pas</h3>
    <ul>
      <li>Aucune vente ni location de données, aucune publicité, aucun profilage.</li>
      <li>Le bot Discord ne lit pas les messages des salons : il n'utilise que les commandes, boutons et fenêtres de réponse.</li>
      <li>Le site ne stocke pas ton token Twitch ni tes jetons Discord ou Google sur ses serveurs.</li>
    </ul>

    <h3>Données traitées</h3>
    <ul>
      <li>
        <strong>Connexion au site avec Twitch</strong> : pseudo, identifiant et avatar Twitch. Le token de connexion reste dans ton
        navigateur (stockage local) jusqu'à son expiration fixée par Twitch ; nos serveurs ne font que le vérifier auprès de Twitch.
      </li>
      <li>
        <strong>Connexion au site avec Discord ou Google</strong> : identifiant, pseudo (ou nom) et avatar du compte. Aucune
        adresse e-mail n'est demandée. Un cookie de session strictement nécessaire (30 jours, inaccessible aux scripts) garde
        la connexion ouverte ; il est effacé à la déconnexion.
      </li>
      <li>
        <strong>Comptes liés</strong> : si tu lies tes comptes, leur correspondance est enregistrée pour regrouper tes propositions
        et statistiques sous une seule identité. Tu peux les délier à tout moment dans les paramètres.
      </li>
      <li>
        <strong>Parties sur Twitch</strong> : pendant un quiz, le navigateur du streamer lit le chat de sa chaîne. Les pseudos et
        identifiants Twitch des joueurs qui répondent, leurs scores, ainsi que le nom de la chaîne, sont enregistrés pour les
        classements et statistiques.
      </li>
      <li>
        <strong>Propositions et signalements</strong> : contenu proposé ou signalé, avec le pseudo et l'identifiant du compte
        de son auteur. Pour les streamers, la liste des questions déjà jouées (500 au plus) est conservée pour éviter les répétitions.
      </li>
      <li>
        <strong>Bot Discord</strong> : identifiant et pseudo Discord des joueurs, identifiants du serveur et du salon, scores
        des parties. Les réponses tapées servent seulement à vérifier si elles sont justes ; elles ne sont pas enregistrées.
      </li>
      <li>
        <strong>Mesure d'audience</strong> : Vercel Web Analytics, sans cookie, compte les pages vues de façon agrégée.
      </li>
      <li>
        <strong>Dans ton navigateur uniquement</strong> : réglages, questions personnelles et sauvegarde des scores en cours
        (stockage local, jamais envoyés à nos serveurs sauf les scores en fin de partie).
      </li>
    </ul>

    <h3>Pourquoi</h3>
    <p>
      Pour faire fonctionner les quiz, afficher les classements et statistiques, modérer les propositions et assurer la
      sécurité du service. Base légale : l'exécution du service que tu utilises et notre intérêt légitime à le faire fonctionner
      (pour les joueurs du chat ou d'un serveur Discord qui répondent à un quiz).
    </p>

    <h3>Combien de temps</h3>
    <ul>
      <li>Scores et statistiques du site : tant que le service existe, ou jusqu'à ta demande de suppression.</li>
      <li>Scores du bot Discord : supprimés automatiquement quand le bot est retiré du serveur, ou sur demande.</li>
      <li>Propositions : conservées après modération ; les questions acceptées restent publiées avec leur auteur.</li>
      <li>Données du navigateur : jusqu'à ce que tu les effaces ou te déconnectes.</li>
    </ul>

    <h3>Où et avec qui</h3>
    <p>
      Hébergement du site et de son API : Vercel Inc. (États-Unis). Base de données : Turso (ChiselStrike Inc.). Le bot Discord
      tourne sur un serveur géré par l'éditeur. Les transferts hors de l'Union européenne s'appuient sur les garanties prévues
      par ces prestataires (clauses contractuelles types ou Data Privacy Framework). Twitch, Discord et Google traitent aussi tes
      données selon leurs propres politiques.
    </p>

    <h3>Tes droits</h3>
    <p>
      Tu peux demander l'accès à tes données, leur correction, leur suppression ou t'opposer à leur traitement en écrivant à{' '}
      <a href={`mailto:${CONTACT}`}>{CONTACT}</a> (indique ton pseudo Twitch ou Discord). Tu peux aussi saisir la CNIL
      (www.cnil.fr).
    </p>
  </Page>
);
