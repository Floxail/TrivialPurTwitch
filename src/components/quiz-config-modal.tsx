import React from 'react';
import { Modal, Form } from 'react-bootstrap';

/**
 * Réglages valables pour une seule partie. Ils n'écrivent jamais dans le
 * settings-store global — d'où le nom « overrides ».
 */
export type QuizOverrides = {
	questionTimeLimit: number;
	acceptanceDelay: number;
	gracePeriodMs: number;
	onlyOneAnswer: boolean;
	penalizeWrong: boolean;
	unlimitedTimer: boolean;
	strictSpelling: boolean;
};

type Props = {
	show: boolean;
	/** Pseudo du viewer ayant tapé !quiz. */
	requester: string;
	/** null = toutes les boîtes, string[] = sélection explicite. */
	selectedBoxNames: null | string[];
	totalVisibleBoxes: number;
	/** Boîte ordonnée : le nombre de questions n'est pas configurable. */
	isOrderedBox: boolean;
	questionCount: number;
	onQuestionCountChange: (count: number) => void;
	overrides: QuizOverrides;
	onOverrideChange: <K extends keyof QuizOverrides>(key: K, value: QuizOverrides[K]) => void;
	modeError: string;
	onCancel: () => void;
	onStart: () => void;
};

/**
 * Popup de configuration lancée par la commande !quiz.
 *
 * Purement présentationnel : l'état vit dans quiz.tsx (les réglages sont lus
 * pendant la partie via des refs), ce composant ne fait que l'afficher et
 * remonter les changements.
 */
const QuizConfigModal = ({
	show,
	requester,
	selectedBoxNames,
	totalVisibleBoxes,
	isOrderedBox,
	questionCount,
	onQuestionCountChange,
	overrides,
	onOverrideChange,
	modeError,
	onCancel,
	onStart,
}: Props) => (
	<Modal show={show} onHide={onCancel} centered size="lg">
		<Modal.Header closeButton>
			<Modal.Title>Configurer le quiz</Modal.Title>
		</Modal.Header>
		<Modal.Body>
			<p className="mb-3" style={{ color: 'var(--lumon-text-dim)' }}>
				<strong style={{ color: 'var(--lumon-cyan)' }}>{requester}</strong> demande un quiz. Configurez les paramètres :
			</p>

			{/* Résumé des boîtes sélectionnées */}
			<div className="mb-3 p-2" style={{ background: 'rgba(var(--lumon-cyan-rgb), 0.05)', border: '1px solid rgba(var(--lumon-cyan-rgb), 0.2)', borderRadius: '4px' }}>
				<small style={{ color: 'var(--lumon-text-dim)' }}>Boîtes sélectionnées :</small>
				<div style={{ color: 'var(--lumon-cyan)', fontSize: '0.85rem', marginTop: '2px' }}>
					{selectedBoxNames === null
						? `Toutes les boîtes (${totalVisibleBoxes})`
						: selectedBoxNames.length === 1
							? selectedBoxNames[0]
							: `${selectedBoxNames.length} boîtes : ${selectedBoxNames.join(', ')}`
					}
				</div>
			</div>

			{/* Mode ordonné : afficher un message, cacher les options inutiles */}
			{isOrderedBox ? (
				<div className="mb-3 p-2" style={{ background: 'rgba(var(--lumon-cyan-rgb), 0.08)', border: '1px solid rgba(var(--lumon-cyan-rgb), 0.3)', borderRadius: '4px' }}>
					<small style={{ color: 'var(--lumon-cyan)' }}>
						↓ Mode ordonné — toutes les questions seront jouées dans l'ordre de la boîte.
					</small>
				</div>
			) : (
				<Form.Group className="mb-3">
					<Form.Label>Nombre de questions</Form.Label>
					<Form.Control
						type="number"
						min="1"
						max="550"
						value={questionCount}
						onChange={(e) => onQuestionCountChange(parseInt(e.target.value) || 10)}
					/>
				</Form.Group>
			)}

			{/* Overrides locaux (valables uniquement pour ce quiz) */}
			<div className="mb-3 p-3" style={{ background: 'rgba(var(--lumon-cyan-rgb), 0.03)', border: '1px solid rgba(var(--lumon-cyan-rgb), 0.15)', borderRadius: '4px' }}>
				<small style={{ color: 'var(--lumon-text-dim)', display: 'block', marginBottom: '10px' }}>
					Réglages pour cette partie uniquement (n'affecte pas les Settings globaux)
				</small>

				<Form.Group className="mb-2">
					<Form.Label style={{ fontSize: '0.85rem' }}>Temps de réponse par question</Form.Label>
					<Form.Range value={overrides.questionTimeLimit} onChange={(e) => onOverrideChange('questionTimeLimit', e.target.valueAsNumber)} min={10} max={60} />
					<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--lumon-cyan)', marginTop: '-6px' }}>
						<i>{overrides.questionTimeLimit} seconde{overrides.questionTimeLimit > 1 ? 's' : ''}</i>
					</div>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Label style={{ fontSize: '0.85rem' }}>Délai d'acceptation de la réponse</Form.Label>
					<Form.Range value={overrides.acceptanceDelay} onChange={(e) => onOverrideChange('acceptanceDelay', e.target.valueAsNumber)} min={0} max={20} />
					<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--lumon-cyan)', marginTop: '-6px' }}>
						<i>{overrides.acceptanceDelay} seconde{overrides.acceptanceDelay > 1 ? 's' : ''}</i>
					</div>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Label style={{ fontSize: '0.85rem' }}>
						Délai de clémence (FIRST)
						<span style={{ fontSize: '0.7rem', color: 'var(--lumon-text-dim)', display: 'block', fontWeight: 'normal' }}>
							Temps supplémentaire accordé pour partager la place de 1er
						</span>
					</Form.Label>
					<Form.Range value={overrides.gracePeriodMs} onChange={(e) => onOverrideChange('gracePeriodMs', e.target.valueAsNumber)} min={100} max={2000} step={100} />
					<div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--lumon-cyan)', marginTop: '-6px' }}>
						<i>{(overrides.gracePeriodMs / 1000).toFixed(1).replace('.', ',')} seconde{overrides.gracePeriodMs >= 2000 ? 's' : ''}</i>
					</div>
				</Form.Group>

				<hr style={{ borderColor: 'rgba(var(--lumon-cyan-rgb), 0.15)', margin: '10px 0' }} />

				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="onlyOneAnswer"
						checked={overrides.onlyOneAnswer}
						onChange={(e) => onOverrideChange('onlyOneAnswer', e.target.checked)}
						label="Une seule réponse par personne (comme en QCM)"
					/>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="penalizeWrong"
						checked={overrides.penalizeWrong}
						onChange={(e) => onOverrideChange('penalizeWrong', e.target.checked)}
						label="Retirer 1 point pour chaque mauvaise réponse"
					/>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="unlimitedTimer"
						checked={overrides.unlimitedTimer}
						onChange={(e) => onOverrideChange('unlimitedTimer', e.target.checked)}
						label="Timer illimité (révélation manuelle)"
					/>
				</Form.Group>

				<Form.Group>
					<Form.Check
						type="checkbox"
						id="strictSpelling"
						checked={overrides.strictSpelling}
						onChange={(e) => onOverrideChange('strictSpelling', e.target.checked)}
						label="Pas de tolérance orthographique"
					/>
				</Form.Group>
			</div>

			{/* Message d'erreur */}
			{modeError && (
				<div className="terminal-alert terminal-alert-danger mt-2">
					{modeError}
				</div>
			)}
		</Modal.Body>
		<Modal.Footer>
			<button className="terminal-btn" onClick={onCancel}>
				Annuler
			</button>
			<button
				className="terminal-btn terminal-btn-success"
				onClick={onStart}
				disabled={totalVisibleBoxes === 0 || (selectedBoxNames !== null && selectedBoxNames.length === 0)}
			>
				Lancer le quiz
			</button>
		</Modal.Footer>
	</Modal>
);

export default QuizConfigModal;
