import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { apiCreateReport, type ReportReason } from 'services/api-reports-service';
import { Question } from './store/questions-store';

/** Labels des options QCM. Partagé avec quiz.tsx, qui les reprend dans les
 *  messages envoyés au chat Twitch. */
export const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Regex pour détecter les emojis Unicode (Extended_Pictographic couvre la plupart des emojis modernes)
const EMOJI_SPLIT_REGEX = /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\uFE0F?)/gu;
const EMOJI_TEST_REGEX = /^\p{Extended_Pictographic}/u;

// Encapsule chaque emoji dans un span avec une taille augmentée
const renderWithEmojiBoost = (text: string): React.ReactNode => {
	if (!text) return text;
	const parts = text.split(EMOJI_SPLIT_REGEX);
	return parts.map((part, i) =>
		EMOJI_TEST_REGEX.test(part)
			? <span key={i} className="emoji-boost">{part}</span>
			: part
	);
};

type Props = {
	question: Question;
	/** Sert de clé de remontage pour relancer l'animation typewriter. */
	questionIndex: number;
	questionRevealed: boolean;
	isQcmQuestion: boolean;
	/** Répondants figés au moment de la révélation. */
	answerers: { nick: string; isFirst: boolean }[];
	showReportMenu: boolean;
	setShowReportMenu: (show: boolean) => void;
	reportSent: boolean;
	setReportSent: (sent: boolean) => void;
	reportError: string;
	setReportError: (err: string) => void;
};

const REPORT_REASONS: { reason: ReportReason; label: string }[] = [
	{ reason: 'question_incorrecte', label: 'Question incorrecte' },
	{ reason: 'reponse_non_accepter', label: 'Réponses non accepté' },
	{ reason: 'categorie_incorrecte', label: 'Mauvaise catégorie' },
	{ reason: 'question_obsolete', label: 'Question obsolète' },
];

/** Largeur de colonne Bootstrap selon le nombre d'options QCM. */
const qcmColClass = (optionCount: number, index: number): string => {
	if (optionCount <= 2) return 'col-6';
	if (optionCount === 3) return 'col-4';
	if (optionCount === 4) return 'col-6';
	if (optionCount === 5) return index < 3 ? 'col-4' : 'col-6';
	return 'col-4';
};

/**
 * Affichage de la question en cours : énoncé, illustration, options QCM,
 * réponse révélée, signalement et liste des répondants.
 *
 * Purement présentationnel — aucune logique de jeu, aucun timer.
 */
const QuizQuestionView = ({
	question,
	questionIndex,
	questionRevealed,
	isQcmQuestion,
	answerers,
	showReportMenu,
	setShowReportMenu,
	reportSent,
	setReportSent,
	reportError,
	setReportError,
}: Props) => {
	const correctIndexes = question.qcmCorrectIndexes
		?? (question.qcmCorrectIndex !== undefined ? [question.qcmCorrectIndex] : []);

	const displayedImage = questionRevealed
		? (question.answerImageUrl || question.imageUrl)
		: question.imageUrl;

	return (
		<>
			{/* Question */}
			<div className="question-box terminal-panel border-glow-cyan" style={{
				padding: '30px',
				marginBottom: '20px',
				minHeight: '150px',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center'
			}}>
				<h2 className="phosphor-text typewriter-wrap" key={questionIndex} style={{
					textAlign: 'center',
					margin: 0,
					fontFamily: "'Orbitron', sans-serif",
					fontSize: '1.4rem',
					letterSpacing: '0.05em'
				}}>
					{renderWithEmojiBoost(question.question)}
				</h2>

				{/* Image associée à la question / réponse */}
				{displayedImage && (
					<div style={{ textAlign: 'center', marginTop: '1rem' }}>
						<img
							src={displayedImage}
							alt={questionRevealed ? "Illustration de la réponse" : "Illustration de la question"}
							style={{
								maxHeight: '300px',
								maxWidth: '100%',
								objectFit: 'contain',
								borderRadius: '8px',
								border: '1px solid var(--lumon-cyan)',
							}}
							onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
						/>
					</div>
				)}

				{/* Options QCM */}
				{isQcmQuestion && question.qcmOptions && !questionRevealed && (
					<div className="qcm-options mt-4" style={{ width: '100%', maxWidth: '700px' }}>
						<div className="row g-3">
							{question.qcmOptions.map((option, index) => (
								<div key={index} className={qcmColClass(question.qcmOptions!.length, index)}>
									<div className="qcm-option-terminal">
										<span className="qcm-label">{QCM_LABELS[index]}</span>
										<span style={{ color: 'var(--lumon-text-dim)' }}>—</span>
										<span style={{ color: 'var(--lumon-text)' }}>{renderWithEmojiBoost(option)}</span>
									</div>
								</div>
							))}
						</div>
						<p className="text-center mt-3 system-artifact" style={{ fontSize: '12px', opacity: 0.7 }}>
							{correctIndexes.length > 1 ? (
								<>Répondez avec les <strong>{correctIndexes.length} lettres</strong> correctes (ex: A,C) dans le chat</>
							) : (
								<>Répondez avec{' '}
									{question.qcmOptions!.map((_, i) => (
										<span key={i}>
											{i > 0 && (i === question.qcmOptions!.length - 1 ? ' ou ' : ', ')}
											<strong>{QCM_LABELS[i]}</strong>
										</span>
									))}{' '}
									dans le chat</>
							)}
						</p>
					</div>
				)}
			</div>

			{/* Réponse révélée */}
			{questionRevealed && (
				<div className="answer-box-terminal" style={{ marginBottom: '20px' }}>
					<h3 style={{ margin: 0 }}>
						<span className="emoji-boost">✅</span> {isQcmQuestion && (question.qcmCorrectIndexes || question.qcmCorrectIndex !== undefined)
							? renderWithEmojiBoost(correctIndexes.map(i => `${QCM_LABELS[i]} - ${question.qcmOptions?.[i] || ''}`).join(', '))
							: renderWithEmojiBoost(question.answer)}
					</h3>
				</div>
			)}

			{/* Bouton de signalement — après révélation */}
			{questionRevealed && (
				<div className="report-section">
					{reportSent ? (
						<div className="report-feedback report-feedback-success">
							<FontAwesomeIcon icon={['fas', 'check']} /> Signalement envoyé
						</div>
					) : reportError ? (
						<div className="report-feedback report-feedback-error">{reportError}</div>
					) : !showReportMenu ? (
						<div className="report-flag-row">
							<button className="report-flag-btn" onClick={() => setShowReportMenu(true)}>
								<FontAwesomeIcon icon={['fas', 'flag']} />
								<span className="report-flag-label">Signaler</span>
							</button>
						</div>
					) : (
						<div className="report-options">
							<div className="report-options-header">
								<span>Signaler cette question</span>
								<button className="report-close-btn" onClick={() => setShowReportMenu(false)}>✕</button>
							</div>
							<div className="report-options-list">
								{REPORT_REASONS.map(({ reason, label }) => (
									<button
										key={reason}
										className="report-option-btn"
										onClick={async () => {
											try {
												await apiCreateReport({
													questionId: question.id,
													questionText: question.question,
													reason,
												});
												setShowReportMenu(false);
												setReportSent(true);
											} catch (err: any) {
												setReportError(err.message || 'Erreur lors du signalement');
												setShowReportMenu(false);
											}
										}}
									>
										{label}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Liste des joueurs ayant répondu - seulement après révélation */}
			{questionRevealed && answerers.length > 0 && (
				<div className="answerers-list" style={{ marginTop: '20px' }}>
					<h5 className="text-display-tech" style={{ fontSize: '0.8rem', color: 'var(--lumon-cyan)' }}>
						Ont répondu correctement :
					</h5>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
						{answerers.map((answerer) => (
							<span
								key={answerer.nick}
								className={answerer.isFirst ? 'answerer-chip answerer-chip-first' : 'answerer-chip'}
							>
								{answerer.isFirst && '★ '}{answerer.nick}
							</span>
						))}
					</div>
				</div>
			)}
		</>
	);
};

export default QuizQuestionView;
