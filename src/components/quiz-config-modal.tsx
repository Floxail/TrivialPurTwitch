import React from 'react';
import { Modal, Form, Row, Col } from 'react-bootstrap';

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
	altAnswerPoints: boolean;
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

/** Nombre de boîtes nommées dans l'en-tête avant de passer à « +N ». */
const MAX_BOXES_IN_HEADER = 2;

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

function describeBoxes(selectedBoxNames: null | string[], totalVisibleBoxes: number): string {
	if (selectedBoxNames === null) return `Toutes les boîtes (${totalVisibleBoxes})`;
	const shown = selectedBoxNames.slice(0, MAX_BOXES_IN_HEADER).join(', ');
	const rest = selectedBoxNames.length - MAX_BOXES_IN_HEADER;
	return rest > 0 ? `${shown} +${rest}` : shown;
}

type BooleanOverride = { [K in keyof QuizOverrides]: QuizOverrides[K] extends boolean ? K : never }[keyof QuizOverrides];

type ToggleProps = {
	id: BooleanOverride;
	label: string;
	/** Explication complète, affichée au survol. */
	hint: string;
	overrides: QuizOverrides;
	onOverrideChange: Props['onOverrideChange'];
};

const Toggle = ({ id, label, hint, overrides, onOverrideChange }: ToggleProps) => (
	<Form.Check
		type="switch"
		id={id}
		className="quiz-config-toggle"
		checked={overrides[id]}
		onChange={(e) => onOverrideChange(id, e.target.checked)}
		label={label}
		title={hint}
	/>
);

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
}: Props) => {
	const toggle = { overrides, onOverrideChange };

	return (
		<Modal show={show} onHide={onCancel} centered size="lg">
			<Modal.Header closeButton>
				<Modal.Title>Configurer le quiz</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<p className="quiz-config-summary" title={selectedBoxNames?.join(', ')}>
					<strong>{requester}</strong> demande un quiz · <span>{describeBoxes(selectedBoxNames, totalVisibleBoxes)}</span>
				</p>

				<Row className="g-3">
					<Col md={6}>
						<section className="quiz-config-panel">
							<h6 className="quiz-config-panel-title">Partie</h6>

							{isOrderedBox ? (
								<p className="quiz-config-note">
									↓ Mode ordonné — toutes les questions seront jouées dans l'ordre de la boîte.
								</p>
							) : (
								<Form.Group className="mb-3" controlId="quizQuestionCount">
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

							<Form.Group controlId="quizQuestionTime">
								<Form.Label className="quiz-config-range-label">
									Temps par question
									<span>{overrides.unlimitedTimer ? '∞' : `${overrides.questionTimeLimit} s`}</span>
								</Form.Label>
								<Form.Range
									value={overrides.questionTimeLimit}
									onChange={(e) => onOverrideChange('questionTimeLimit', e.target.valueAsNumber)}
									min={10}
									max={60}
									disabled={overrides.unlimitedTimer}
								/>
							</Form.Group>
							<Toggle id="unlimitedTimer" label="Timer illimité" hint="Pas de compte à rebours : vous révélez la réponse manuellement" {...toggle} />
						</section>
					</Col>

					<Col md={6}>
						<section className="quiz-config-panel">
							<h6 className="quiz-config-panel-title">Règles</h6>

							<div className="quiz-config-group-label">Réponses</div>
							<Toggle id="onlyOneAnswer" label="1 essai par personne" hint="Une seule réponse par personne et par question (comme en QCM)" {...toggle} />
							<Toggle id="strictSpelling" label="Orthographe stricte" hint="Pas de tolérance orthographique : seule la réponse exacte est acceptée" {...toggle} />

							<div className="quiz-config-group-label">Points</div>
							<Toggle id="penalizeWrong" label="−1 si mauvaise réponse" hint="Retire 1 point pour chaque mauvaise réponse (une fois par question)" {...toggle} />
							<Toggle id="altAnswerPoints" label="3 pts principale / 1 pt ALT" hint="3 points de base pour la réponse principale, 1 pour une réponse alternative. Les bonus FIRST, Seul et Combo s'ajoutent." {...toggle} />
						</section>
					</Col>
				</Row>

				<details className="quiz-config-advanced">
					<summary>
						Avancé <span>· délai {overrides.acceptanceDelay} s · clémence {formatSeconds(overrides.gracePeriodMs)}</span>
					</summary>
					<Row className="g-3 mt-1">
						<Col md={6}>
							<Form.Group controlId="quizAcceptanceDelay">
								<Form.Label className="quiz-config-range-label">
									Délai d'acceptation
									<span>{overrides.acceptanceDelay} s</span>
								</Form.Label>
								<Form.Range value={overrides.acceptanceDelay} onChange={(e) => onOverrideChange('acceptanceDelay', e.target.valueAsNumber)} min={0} max={20} />
							</Form.Group>
						</Col>
						<Col md={6}>
							<Form.Group controlId="quizGracePeriod">
								<Form.Label className="quiz-config-range-label" title="Temps supplémentaire accordé pour partager la place de 1er">
									Clémence FIRST
									<span>{formatSeconds(overrides.gracePeriodMs)}</span>
								</Form.Label>
								<Form.Range value={overrides.gracePeriodMs} onChange={(e) => onOverrideChange('gracePeriodMs', e.target.valueAsNumber)} min={100} max={2000} step={100} />
							</Form.Group>
						</Col>
					</Row>
				</details>

				<small className="quiz-config-footnote">Réglages valables pour cette partie uniquement (n'affectent pas les Settings globaux)</small>

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
					▶ Lancer le quiz
				</button>
			</Modal.Footer>
		</Modal>
	);
};

export default QuizConfigModal;
