import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrivialBox } from './store/questions-store';

type Props = {
	/** Boîtes visibles (non cachées), masters et sous-boîtes mélangées. */
	boxes: TrivialBox[];
	/** null = toutes les boîtes sélectionnées, string[] = sélection explicite. */
	selectedBoxNames: null | string[];
	setSelectedBoxNames: React.Dispatch<React.SetStateAction<null | string[]>>;
};

// Palette Master : violets / roses / magenta uniquement (pas de bleu, pour éviter
// la confusion avec les boîtes indépendantes en cyan).
const MASTER_THEME_PALETTE = [
	{ color: '#b366ff', rgb: '179,102,255' },    // Violet Lumon
	{ color: '#ff3366', rgb: '255,51,102' },     // Rose Néon
	{ color: '#9d4edd', rgb: '157,78,221' },     // Deep Purple
	{ color: '#ff66b2', rgb: '255,102,178' },    // Pink
	{ color: '#7209b7', rgb: '114,9,183' },      // Indigo profond
	{ color: '#e040fb', rgb: '224,64,251' },     // Magenta vif
	{ color: '#c71585', rgb: '199,21,133' },     // Rose framboise
];

// Couleur standard pour les boîtes indépendantes (le vrai Cyan Lumon du site)
const DEFAULT_LUMON_THEME = { color: '#00e5ff', rgb: '0,229,255' };

/**
 * Grille de sélection des boîtes, avec accordéon des masters et effet fisheye
 * radial au survol (style Severance MDR).
 *
 * Autonome : ne dépend que de la liste des boîtes et de la sélection courante.
 * Toute la mécanique de survol, de thème et de dépliage vit ici.
 */
const QuizBoxGrid = ({ boxes, selectedBoxNames, setSelectedBoxNames }: Props) => {
	// Set de masters actuellement dépliés (accordion inline)
	const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set());

	// Map : nom du master → ses sous-boîtes
	const masterSubBoxMap = useMemo(() => {
		const map = new Map<string, TrivialBox[]>();
		boxes.forEach(b => {
			if (b.parentBox) {
				if (!map.has(b.parentBox)) map.set(b.parentBox, []);
				map.get(b.parentBox)!.push(b);
			}
		});
		return map;
	}, [boxes]);

	// Boîtes de niveau racine (sans parent)
	const topLevelBoxes = useMemo(() => boxes.filter(b => !b.parentBox), [boxes]);

	// Map : nom de boîte → couleur du thème
	const boxThemeMap = useMemo(() => {
		const map = new Map<string, { color: string; rgb: string }>();
		let masterIndex = 0; // compteur spécifique aux Master Boxes

		topLevelBoxes.forEach((b) => {
			const isMaster = masterSubBoxMap.has(b.name);

			if (isMaster) {
				// Master Box : couleur de la palette, puis incrément
				const theme = MASTER_THEME_PALETTE[masterIndex % MASTER_THEME_PALETTE.length];
				map.set(b.name, theme);

				// Ses sous-boîtes héritent de la même couleur
				const subs = masterSubBoxMap.get(b.name);
				if (subs) {
					subs.forEach(sub => map.set(sub.name, theme));
				}
				masterIndex++;
			} else {
				// Boîte classique sans sous-boîtes : Cyan Lumon par défaut
				map.set(b.name, DEFAULT_LUMON_THEME);
			}
		});
		return map;
	}, [topLevelBoxes, masterSubBoxMap]);

	// Boîtes affichées : top-level, avec les sous-boîtes insérées après chaque master déplié
	const displayedBoxes = useMemo(() => {
		const result: { box: TrivialBox; isSubBox: boolean; masterName?: string }[] = [];
		for (const b of topLevelBoxes) {
			const isMaster = masterSubBoxMap.has(b.name);
			result.push({ box: b, isSubBox: false });
			if (isMaster && expandedMasters.has(b.name)) {
				const subs = masterSubBoxMap.get(b.name) ?? [];
				for (const sub of subs) {
					result.push({ box: sub, isSubBox: true, masterName: b.name });
				}
			}
		}
		return result;
	}, [topLevelBoxes, masterSubBoxMap, expandedMasters]);

	// MDR fisheye effect — Severance-style radial magnification
	const [mdrHoveredIndex, setMdrHoveredIndex] = useState<number | null>(null);
	const mdrContainerRef = useRef<HTMLDivElement>(null);
	const mdrItemRefs = useRef<(HTMLDivElement | null)[]>([]);

	// Compute distance rings from hovered element (fisheye gradient)
	const mdrRingMap = useMemo(() => {
		const map = new Map<number, 'near' | 'mid' | 'far'>();
		if (mdrHoveredIndex === null || !mdrContainerRef.current) return map;
		const hoveredEl = mdrItemRefs.current[mdrHoveredIndex];
		if (!hoveredEl) return map;

		const hr = hoveredEl.getBoundingClientRect();
		const hx = hr.left + hr.width / 2;
		const hy = hr.top + hr.height / 2;
		const unitW = hr.width;
		const unitH = hr.height;

		for (let i = 0; i < mdrItemRefs.current.length; i++) {
			if (i === mdrHoveredIndex) continue;
			const el = mdrItemRefs.current[i];
			if (!el) continue;
			const r = el.getBoundingClientRect();
			const dx = Math.abs((r.left + r.width / 2) - hx);
			const dy = Math.abs((r.top + r.height / 2) - hy);
			// Normalized distance in "box units"
			const dist = Math.sqrt((dx / unitW) ** 2 + (dy / unitH) ** 2);

			if (dist < 1.6) map.set(i, 'near');
			else if (dist < 3.0) map.set(i, 'mid');
			else map.set(i, 'far');
		}
		return map;
	}, [mdrHoveredIndex]);

	const getMdrClass = useCallback((mdrIndex: number) => {
		const isSelected = mdrIndex === 0
			? selectedBoxNames === null
			: (selectedBoxNames === null || selectedBoxNames.includes(displayedBoxes[mdrIndex - 1]?.box.name ?? ''));
		let hoverClass = '';
		if (mdrHoveredIndex !== null) {
			if (mdrIndex === mdrHoveredIndex) hoverClass = 'mdr-focused';
			else {
				const ring = mdrRingMap.get(mdrIndex) || 'far';
				hoverClass = `mdr-ring-${ring}`;
			}
		}
		const selectionClass = isSelected ? 'mdr-selected' : 'mdr-unselected';
		return `${hoverClass} ${selectionClass}`.trim();
	}, [mdrHoveredIndex, mdrRingMap, selectedBoxNames, displayedBoxes]);

	const handleBoxClick = useCallback((boxName: string) => {
		setSelectedBoxNames(prev => {
			if (prev === null) return [boxName];
			const isSelected = prev.includes(boxName);
			if (isSelected && prev.length === 1) return null;
			if (isSelected) return prev.filter(n => n !== boxName);
			return [...prev, boxName];
		});
	}, [setSelectedBoxNames]);

	// Clic sur un Master : toggle la sélection du master + toutes ses sous-boîtes en bloc
	const handleMasterSelectToggle = useCallback((masterName: string) => {
		const subs = masterSubBoxMap.get(masterName) ?? [];
		const allNames = [masterName, ...subs.map(s => s.name)];
		setSelectedBoxNames(prev => {
			if (prev === null) return allNames;
			const allSelected = allNames.every(n => prev.includes(n));
			if (allSelected) {
				const filtered = prev.filter(n => !allNames.includes(n));
				return filtered.length === 0 ? null : filtered;
			}
			return Array.from(new Set([...prev, ...allNames]));
		});
	}, [masterSubBoxMap, setSelectedBoxNames]);

	// Une boîte dépliée peut disparaître après une sync DB : on purge les noms
	// qui n'existent plus, sinon le Set garde des références mortes.
	useEffect(() => {
		setExpandedMasters(prev => {
			const boxNames = new Set(boxes.map(b => b.name));
			const valid = new Set(Array.from(prev).filter(n => boxNames.has(n)));
			return valid.size !== prev.size ? valid : prev;
		});
	}, [boxes]);

	// Chevron ▶/▼ : expand/collapse de la Master (ne change pas la sélection)
	const handleMasterExpandToggle = useCallback((masterName: string) => {
		setExpandedMasters(prev => {
			const next = new Set(prev);
			if (next.has(masterName)) next.delete(masterName);
			else next.add(masterName);
			return next;
		});
	}, []);

	if (boxes.length === 0) return null;

	return (
		<div className="mt-4 p-3 terminal-panel" style={{ display: 'block', maxWidth: '920px', margin: '16px auto 0' }}>
			<p className="mb-2" style={{ color: 'var(--lumon-text-dim)' }}>
				<strong style={{ color: 'var(--lumon-cyan)' }}>
					Boîtes disponibles
				</strong>
				<span style={{ color: 'var(--lumon-text-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>
					— cliquez pour sélectionner
				</span>
			</p>
			<div
				className="mdr-data-point-container"
				ref={mdrContainerRef}
				onMouseLeave={() => setMdrHoveredIndex(null)}
			>
				{/* Card 0 : ★ TOUTES */}
				<div
					ref={el => { mdrItemRefs.current[0] = el; }}
					className={`mdr-data-point mdr-all-boxes ${getMdrClass(0)}`}
					onMouseEnter={() => setMdrHoveredIndex(0)}
					onClick={() => setSelectedBoxNames(prev => prev === null ? [] : null)}
				>
					★ TOUTES
				</div>
				{/* Boîtes avec sous-boîtes inline */}
				{displayedBoxes.map((entry, i) => {
					const { box: b, isSubBox } = entry;
					const isMaster = !isSubBox && masterSubBoxMap.has(b.name);
					const isExpanded = isMaster && expandedMasters.has(b.name);
					const subCount = isMaster ? (masterSubBoxMap.get(b.name)?.length ?? 0) : 0;
					const theme = boxThemeMap.get(b.name);
					const boxStyle: any = {
						'--box-theme': theme?.color || 'var(--lumon-cyan)',
						'--box-theme-rgb': theme?.rgb || 'var(--lumon-cyan-rgb)',
					};
					return (
						<div
							key={b.name}
							ref={el => { mdrItemRefs.current[i + 1] = el; }}
							className={`mdr-data-point mdr-themed ${isMaster ? 'mdr-master-box' : ''} ${isSubBox ? 'mdr-sub-box' : ''} ${getMdrClass(i + 1)}`}
							onMouseEnter={() => setMdrHoveredIndex(i + 1)}
							onClick={() => { if (isMaster) handleMasterSelectToggle(b.name); else handleBoxClick(b.name); }}
							title={isMaster ? `Sélectionner "${b.name}" et ses ${subCount} sous-boîte(s)` : (b.description || undefined)}
							style={boxStyle}
						>
							{isMaster && (
								<span
									className="mdr-chevron"
									onClick={(e) => { e.stopPropagation(); handleMasterExpandToggle(b.name); }}
									title={isExpanded ? 'Réduire' : `Déplier (${subCount})`}
								>
									{isExpanded ? '▼' : '▶'}
								</span>
							)}
							{isSubBox && <span className="mdr-sub-connector">└</span>}
							{b.ordered && <span style={{ fontSize: '0.55rem', marginRight: '4px', opacity: 0.7 }}>↓</span>}
							<span className="mdr-box-name">{b.name}</span>
							{isMaster && <span className="mdr-sub-count">({subCount})</span>}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default QuizBoxGrid;
