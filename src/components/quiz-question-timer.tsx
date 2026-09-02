import React, { useMemo } from 'react';

/** Rayon du cercle de progression. Partagé avec la boucle rAF de quiz.tsx,
 *  qui calcule la circonférence pour piloter le stroke-dashoffset. */
export const TIMER_RADIUS = 54;
export const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

type Props = {
	/** Nom de la boîte de la question en cours, affiché au-dessus de la jauge. */
	boxName: string;
	timeLeft: number;
	questionTimeLimit: number;
	/** Timer illimité : la jauge affiche ∞ et ne décompte pas. */
	unlimitedTimer: boolean;
	/** La boucle rAF écrit directement stroke-dashoffset sur ce cercle (bypass React). */
	circleRef: React.MutableRefObject<SVGCircleElement | null>;
};

/**
 * Jauge circulaire du temps restant sur la question en cours.
 *
 * Purement présentationnel : le décompte est piloté par la boucle
 * requestAnimationFrame de quiz.tsx, qui écrit sur `circleRef` sans repasser
 * par React. Ce composant ne fait que dessiner.
 */
const QuestionTimer = ({ boxName, timeLeft, questionTimeLimit, unlimitedTimer, circleRef }: Props) => {
	const pct = (timeLeft / questionTimeLimit) * 100;

	const timerColor = useMemo(() => {
		if (pct > 50) return 'var(--lumon-success, #00FF66)';
		if (pct > 25) return 'var(--lumon-amber, #FFB000)';
		return 'var(--lumon-danger, #FF0033)';
	}, [pct]);

	const timerUrgencyClass = pct <= 25 ? 'timer-critical' : '';

	return (
		<div className="mb-4">
			<div
				className="terminal-badge"
				style={{
					backgroundColor: 'rgba(255, 255, 255, 0.1)',
					borderColor: 'rgba(255, 255, 255, 0.5)',
					color: 'white',
					padding: '8px 20px',
					display: 'inline-block',
					fontFamily: "'Orbitron', sans-serif",
					fontSize: '0.75rem',
					letterSpacing: '0.15em',
					textTransform: 'uppercase' as const,
					marginBottom: '15px'
				}}
			>
				{boxName}
			</div>

			<div className={timerUrgencyClass} style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				margin: '0 auto',
				position: 'relative',
				width: '180px',
				height: '180px',
			}}>
				<svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
					{/* Gauge tick marks */}
					{Array.from({ length: 24 }).map((_, i) => {
						const angle = (i * 15) * (Math.PI / 180);
						const isMajor = i % 6 === 0;
						const outerR = 86;
						const innerR = isMajor ? 78 : 81;
						return (
							<line
								key={i}
								x1={90 + outerR * Math.cos(angle)}
								y1={90 + outerR * Math.sin(angle)}
								x2={90 + innerR * Math.cos(angle)}
								y2={90 + innerR * Math.sin(angle)}
								stroke="rgba(0, 112, 128, 0.3)"
								strokeWidth={isMajor ? 2 : 1}
							/>
						);
					})}
					{/* Background track */}
					<circle
						cx="90" cy="90" r={TIMER_RADIUS}
						fill="none"
						stroke="rgba(0, 112, 128, 0.15)"
						strokeWidth="6"
					/>
					{/* Progress ring (rAF-driven) */}
					<circle
						ref={circleRef}
						cx="90" cy="90" r={TIMER_RADIUS}
						fill="none"
						stroke={timerColor}
						strokeWidth="6"
						strokeLinecap="round"
						strokeDasharray={TIMER_CIRCUMFERENCE}
						strokeDashoffset={TIMER_CIRCUMFERENCE * (1 - timeLeft / questionTimeLimit)}
						style={{
							transition: 'stroke 0.5s ease',
							filter: `drop-shadow(0 0 6px ${timerColor})`,
						}}
					/>
				</svg>
				{/* Center number */}
				<div style={{ textAlign: 'center', zIndex: 1 }}>
					<div style={{
						fontFamily: "'Orbitron', sans-serif",
						fontSize: '3.2rem',
						fontWeight: 900,
						letterSpacing: '0.05em',
						lineHeight: 1,
						color: timerColor,
						transition: 'color 0.5s ease',
						textShadow: `0 0 12px ${timerColor}, 0 0 24px ${timerColor}40`,
					}}>
						{unlimitedTimer ? '∞' : timeLeft}
					</div>
					<div style={{
						fontFamily: "'Share Tech Mono', monospace",
						fontSize: '0.55rem',
						color: 'var(--lumon-text-muted)',
						textTransform: 'uppercase' as const,
						letterSpacing: '0.25em',
						marginTop: '4px',
					}}>
						{unlimitedTimer ? 'manuel' : 'sec'}
					</div>
				</div>
			</div>
		</div>
	);
};

export default QuestionTimer;
