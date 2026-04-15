import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Modal, Spinner } from 'react-bootstrap';
import {
  apiApproveQuestion,
  apiEditPendingQuestion,
  apiGetPendingQuestions,
  apiRejectQuestion,
  PendingQuestion,
} from 'services/api-admin-service';
import { Question, useQuestionsStore } from './store/questions-store';
import { useGlobalStore } from './store/global-store';
import {
  apiGetReports,
  apiResolveReport,
  apiDeleteReport,
  type QuestionReport,
} from 'services/api-reports-service';

const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QCM_MIN_OPTIONS = 2;
const QCM_MAX_OPTIONS = 6;

const AdminDashboard = () => {
  const setSubtitle = useGlobalStore((state) => state.setSubtitle);
  const boxes = useQuestionsStore((state) => state.boxes);
  const allQuestions = useQuestionsStore((state) => state.questions);

  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Modal d'approbation
  const [approveModal, setApproveModal] = useState<PendingQuestion | null>(null);
  const [approveBox, setApproveBox] = useState('');

  // Modal d'édition
  const [editModal, setEditModal] = useState<PendingQuestion | null>(null);
  // Quand non-null, on édite une question principale (signalement) et non une question en attente
  const [editingMainQuestionId, setEditingMainQuestionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    question: '',
    answer: '',
    alternativeAnswers: '',
    boxName: '',
    questionType: 'free_text' as string,
    qcmOptions: ['', ''] as string[],
    qcmCorrectIndex: 0,
    qcmCorrectIndexes: [0] as number[],
  });
  const [editSaving, setEditSaving] = useState(false);

  // Actions en cours
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Signalements
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsFilter, setReportsFilter] = useState<'pending' | 'resolved'>('pending');

  useEffect(() => {
    setSubtitle('Admin - Modération');
  }, [setSubtitle]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGetPendingQuestions(filterStatus, 100);
      setPendingQuestions(result.questions);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // ==================== Approuver ====================
  const handleQuickApprove = async (q: PendingQuestion) => {
    if (q.boxName) {
      await doApprove(q.id, q.boxName);
    } else {
      setApproveModal(q);
      setApproveBox(boxes.length > 0 ? boxes[0].name : '');
    }
  };

  const doApprove = async (id: string, boxName: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiApproveQuestion(id, boxName);
      setPendingQuestions(prev => prev.filter(q => q.id !== id));
      useQuestionsStore.getState().syncFromDB(true).catch(() => {});
      showSuccess(`Question approuvée → ${boxName}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'approbation');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setApproveModal(null);
    }
  };

  // ==================== Rejeter ====================
  const handleReject = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiRejectQuestion(id);
      setPendingQuestions(prev => prev.filter(q => q.id !== id));
      showSuccess('Question rejetée');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du rejet');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ==================== Changer le statut ====================
  const handleChangeStatus = async (id: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiEditPendingQuestion(id, { status: newStatus });
      setPendingQuestions(prev => prev.filter(q => q.id !== id));
      const labels = { pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée' };
      showSuccess(`Statut changé → ${labels[newStatus]}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de statut');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ==================== Tout approuver ====================
  const handleApproveAll = async () => {
    if (!window.confirm(`Approuver les ${pendingQuestions.length} questions en attente ?`)) return;
    const defaultBox = boxes.length > 0 ? boxes[0].name : 'Propositions';

    for (const q of pendingQuestions) {
      await doApprove(q.id, q.boxName || defaultBox);
    }
  };

  // ==================== Édition ====================
  const openEditModal = (q: PendingQuestion) => {
    setEditModal(q);
    setEditForm({
      question: q.question,
      answer: q.answer,
      alternativeAnswers: q.alternativeAnswers?.join(', ') || '',
      boxName: q.boxName || '',
      questionType: q.questionType || 'free_text',
      qcmOptions: q.qcmOptions && q.qcmOptions.length >= 2 ? [...q.qcmOptions] : ['', ''],
      qcmCorrectIndex: q.qcmCorrectIndex ?? 0,
      qcmCorrectIndexes: q.qcmCorrectIndexes ?? (q.qcmCorrectIndex !== undefined ? [q.qcmCorrectIndex] : [0]),
    });
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      const isQcm = editForm.questionType === 'qcm';
      const altArr = editForm.alternativeAnswers.split(',').map(s => s.trim()).filter(Boolean);

      const updates: Partial<PendingQuestion> = {
        question: editForm.question,
        answer: editForm.answer,
        alternativeAnswers: altArr.length > 0 ? altArr : undefined,
        boxName: editForm.boxName || undefined,
        questionType: editForm.questionType,
      };

      if (isQcm) {
        updates.qcmOptions = editForm.qcmOptions.filter(o => o.trim());
        updates.qcmCorrectIndex = editForm.qcmCorrectIndexes[0];
        updates.qcmCorrectIndexes = editForm.qcmCorrectIndexes;
        updates.answer = editForm.qcmCorrectIndexes.map(i => editForm.qcmOptions[i]).filter(Boolean).join(', ');
      }

      if (editingMainQuestionId) {
        // Édition d'une question principale (depuis un signalement)
        await useQuestionsStore.getState().updateQuestion(editingMainQuestionId, updates as Partial<Question>);
        showSuccess('Question principale modifiée');
        setEditingMainQuestionId(null);
      } else {
        // Édition d'une question en attente de modération
        await apiEditPendingQuestion(editModal.id, updates);
        setPendingQuestions(prev => prev.map(q =>
          q.id === editModal.id ? { ...q, ...updates } : q
        ));
        showSuccess('Question modifiée');
      }

      setEditModal(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification');
    } finally {
      setEditSaving(false);
    }
  };

  // Ouvrir le modal d'édition pour une question principale (depuis un signalement)
  const openReportEditModal = (report: { questionId: string; questionText: string }) => {
    const question = allQuestions.find(q => q.id === report.questionId);
    if (!question) {
      setError(`Question introuvable dans la base locale (ID: ${report.questionId}). Elle provient peut-être de GitHub — rechargez la page pour la synchroniser.`);
      return;
    }
    setEditingMainQuestionId(question.id);
    setEditForm({
      question: question.question,
      answer: question.answer,
      alternativeAnswers: question.alternativeAnswers?.join(', ') || '',
      boxName: question.boxName || '',
      questionType: question.questionType || 'free_text',
      qcmOptions: question.qcmOptions && question.qcmOptions.length >= 2 ? [...question.qcmOptions] : ['', ''],
      qcmCorrectIndex: question.qcmCorrectIndex ?? 0,
      qcmCorrectIndexes: question.qcmCorrectIndexes ?? (question.qcmCorrectIndex !== undefined ? [question.qcmCorrectIndex] : [0]),
    });
    // Créer un PendingQuestion factice pour ouvrir le modal existant
    const fakePending: PendingQuestion = {
      id: question.id,
      question: question.question,
      answer: question.answer,
      alternativeAnswers: question.alternativeAnswers,
      boxName: question.boxName,
      questionType: question.questionType || 'free_text',
      qcmOptions: question.qcmOptions,
      qcmCorrectIndex: question.qcmCorrectIndex,
      qcmCorrectIndexes: question.qcmCorrectIndexes,
      status: 'approved',
      createdAt: new Date().toISOString(),
    };
    setEditModal(fakePending);
  };

  // ==================== Signalements ====================
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const data = await apiGetReports(reportsFilter);
      setReports(data);
    } catch {
      // silently fail — reports are secondary
    } finally {
      setReportsLoading(false);
    }
  }, [reportsFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const REASON_LABELS: Record<string, string> = {
    question_incorrecte: 'Question incorrecte',
    reponse_non_accepter: 'Réponses non accepté',
    categorie_incorrecte: 'Catégorie incorrecte',
    question_obsolete: 'Question obsolète',
  };

  const handleResolveReport = async (reportId: string) => {
    setProcessingIds(prev => new Set(prev).add(reportId));
    try {
      await apiResolveReport(reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
      showSuccess('Signalement marqué comme traité');
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(reportId); return n; });
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    setProcessingIds(prev => new Set(prev).add(reportId));
    try {
      await apiDeleteReport(reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
      showSuccess('Signalement supprimé');
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(reportId); return n; });
    }
  };

  const pendingCount = useMemo(() => pendingQuestions.length, [pendingQuestions]);

  return (
    <div className="lumon-page">
      <h2 className="text-glow-cyan mb-3">
        <FontAwesomeIcon icon={['fas', 'list']} className="me-2" />
        Moderation des questions
        {pendingCount > 0 && (
          <span className="terminal-badge terminal-badge-amber ms-2">{pendingCount}</span>
        )}
      </h2>

      {successMessage && <div className="terminal-alert terminal-alert-success mb-3">{successMessage}</div>}
      {error && <div className="terminal-alert terminal-alert-danger mb-3">{error}</div>}

      {/* Filtres */}
      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div className="terminal-tabs" style={{ borderBottom: 'none' }}>
          <div
            className={`terminal-tab ${filterStatus === 'pending' ? 'terminal-tab-active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            En attente
          </div>
          <div
            className={`terminal-tab ${filterStatus === 'approved' ? 'terminal-tab-active' : ''}`}
            onClick={() => setFilterStatus('approved')}
            style={filterStatus === 'approved' ? { color: 'var(--lumon-success)', borderBottomColor: 'var(--lumon-success)' } : {}}
          >
            Approuvées
          </div>
          <div
            className={`terminal-tab ${filterStatus === 'rejected' ? 'terminal-tab-active' : ''}`}
            onClick={() => setFilterStatus('rejected')}
            style={filterStatus === 'rejected' ? { color: 'var(--lumon-danger)', borderBottomColor: 'var(--lumon-danger)' } : {}}
          >
            Rejetées
          </div>
        </div>

        <button className="terminal-btn terminal-btn-sm" onClick={loadQuestions} disabled={loading}>
          <FontAwesomeIcon icon={['fas', 'shuffle']} className="me-1" />
          Rafraîchir
        </button>

        {filterStatus === 'pending' && pendingCount > 0 && (
          <button className="terminal-btn terminal-btn-success terminal-btn-sm" onClick={handleApproveAll}>
            <FontAwesomeIcon icon={['fas', 'check']} className="me-1" />
            Tout approuver
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-4" style={{ color: 'var(--lumon-cyan)' }}>
          <Spinner animation="border" size="sm" className="me-2" />
          <span className="system-artifact" style={{ opacity: 1 }}>Chargement des données...</span>
        </div>
      )}

      {/* Liste vide */}
      {!loading && pendingQuestions.length === 0 && (
        <div className="text-center py-4 system-artifact" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Aucune question {filterStatus === 'pending' ? 'en attente' : filterStatus === 'approved' ? 'approuvée' : 'rejetée'}
        </div>
      )}

      {/* Tableau des questions */}
      {!loading && pendingQuestions.length > 0 && (
        <table className="terminal-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Type</th>
              <th style={{ width: '28%' }}>Question</th>
              <th style={{ width: '18%' }}>Réponse</th>
              <th style={{ width: '10%' }}>Boîte</th>
              <th style={{ width: '10%' }}>Proposé par</th>
              <th style={{ width: '9%' }}>Date</th>
              <th style={{ width: '20%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingQuestions.map(q => (
              <tr key={q.id}>
                <td>
                  {q.questionType === 'qcm' ? (
                    <span className="terminal-badge terminal-badge-cyan">QCM</span>
                  ) : (
                    <span className="terminal-badge" style={{ borderColor: 'var(--lumon-text-muted)', color: 'var(--lumon-text-dim)' }}>Texte</span>
                  )}
                </td>
                <td>
                  <strong>{q.question}</strong>
                  {q.questionType === 'qcm' && q.qcmOptions && (
                    <div className="mt-1">
                      {q.qcmOptions.map((opt, i) => {
                        const isCorrectDisplay = (q.qcmCorrectIndexes || (q.qcmCorrectIndex !== undefined ? [q.qcmCorrectIndex] : [])).includes(i);
                        return (
                          <span key={i} className="me-2" style={{ fontSize: '0.8rem' }}>
                            <span className={`terminal-badge ${isCorrectDisplay ? 'terminal-badge-success' : ''}`} style={{ marginRight: '4px' }}>
                              {QCM_LABELS[i]}
                            </span>
                            {opt}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td>
                  <span style={{ color: 'var(--lumon-success)' }}>{q.answer}</span>
                  {q.alternativeAnswers && q.alternativeAnswers.length > 0 && (
                    <div className="text-muted small">
                      ALT: {q.alternativeAnswers.join(', ')}
                    </div>
                  )}
                </td>
                <td>{q.boxName || <span className="text-muted">—</span>}</td>
                <td>{q.submittedBy || <span className="text-muted">Anonyme</span>}</td>
                <td className="text-muted small">
                  {q.createdAt ? new Date(q.createdAt).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td>
                  <div className="d-flex gap-1 flex-wrap">
                    {/* Bouton éditer (tous les onglets) */}
                    <button
                      className="terminal-btn terminal-btn-sm"
                      disabled={processingIds.has(q.id)}
                      onClick={() => openEditModal(q)}
                      title="Modifier"
                    >
                      <FontAwesomeIcon icon={['fas', 'pen']} />
                    </button>

                    {/* Actions selon le statut actuel */}
                    {filterStatus === 'pending' && (
                      <>
                        <button
                          className="terminal-btn terminal-btn-success terminal-btn-sm"
                          disabled={processingIds.has(q.id)}
                          onClick={() => handleQuickApprove(q)}
                          title="Approuver"
                        >
                          <FontAwesomeIcon icon={['fas', 'check']} />
                        </button>
                        <button
                          className="terminal-btn terminal-btn-danger terminal-btn-sm"
                          disabled={processingIds.has(q.id)}
                          onClick={() => handleReject(q.id)}
                          title="Rejeter"
                        >
                          <FontAwesomeIcon icon={['fas', 'times']} />
                        </button>
                      </>
                    )}

                    {filterStatus === 'approved' && (
                      <>
                        <button
                          className="terminal-btn terminal-btn-amber terminal-btn-sm"
                          disabled={processingIds.has(q.id)}
                          onClick={() => handleChangeStatus(q.id, 'pending')}
                          title="Remettre en attente"
                        >
                          <FontAwesomeIcon icon={['fas', 'clock']} />
                        </button>
                        <button
                          className="terminal-btn terminal-btn-danger terminal-btn-sm"
                          disabled={processingIds.has(q.id)}
                          onClick={() => handleChangeStatus(q.id, 'rejected')}
                          title="Rejeter"
                        >
                          <FontAwesomeIcon icon={['fas', 'times']} />
                        </button>
                      </>
                    )}

                    {filterStatus === 'rejected' && (
                      <>
                        <button
                          className="terminal-btn terminal-btn-amber terminal-btn-sm"
                          disabled={processingIds.has(q.id)}
                          onClick={() => handleChangeStatus(q.id, 'pending')}
                          title="Remettre en attente"
                        >
                          <FontAwesomeIcon icon={['fas', 'clock']} />
                        </button>
                        <button
                          className="terminal-btn terminal-btn-success terminal-btn-sm"
                          disabled={processingIds.has(q.id)}
                          onClick={() => handleQuickApprove(q)}
                          title="Approuver"
                        >
                          <FontAwesomeIcon icon={['fas', 'check']} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de sélection de boîte pour approbation */}
      {approveModal && (
        <Modal show onHide={() => setApproveModal(null)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Choisir la boîte de destination</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p><strong>Question :</strong> {approveModal.question}</p>
            <p><strong>Réponse :</strong> {approveModal.answer}</p>
            <Form.Group>
              <Form.Label>Boîte de destination</Form.Label>
              <Form.Select value={approveBox} onChange={(e) => setApproveBox(e.target.value)}>
                {boxes.map(box => (
                  <option key={box.name} value={box.name}>{box.name}</option>
                ))}
                <option value="Propositions">Propositions (nouvelle)</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <button className="terminal-btn terminal-btn-sm" onClick={() => setApproveModal(null)}>Annuler</button>
            <button
              className="terminal-btn terminal-btn-success terminal-btn-sm"
              disabled={!approveBox}
              onClick={() => doApprove(approveModal.id, approveBox)}
            >
              <FontAwesomeIcon icon={['fas', 'check']} className="me-1" />
              Approuver
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         SECTION SIGNALEMENTS
         ═══════════════════════════════════════════════════════════════ */}
      <hr style={{ borderColor: 'var(--lumon-border)', margin: '40px 0 30px' }} />

      <h2 className="text-glow-cyan mb-3">
        <FontAwesomeIcon icon={['fas', 'flag']} className="me-2" />
        Signalements
        {reportsFilter === 'pending' && reports.length > 0 && (
          <span className="terminal-badge terminal-badge-amber ms-2">{reports.length}</span>
        )}
      </h2>

      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div className="terminal-tabs" style={{ borderBottom: 'none' }}>
          <div
            className={`terminal-tab ${reportsFilter === 'pending' ? 'terminal-tab-active' : ''}`}
            onClick={() => setReportsFilter('pending')}
          >
            En attente
          </div>
          <div
            className={`terminal-tab ${reportsFilter === 'resolved' ? 'terminal-tab-active' : ''}`}
            onClick={() => setReportsFilter('resolved')}
            style={reportsFilter === 'resolved' ? { color: 'var(--lumon-success)', borderBottomColor: 'var(--lumon-success)' } : {}}
          >
            Traités
          </div>
        </div>
        <button className="terminal-btn terminal-btn-sm" onClick={loadReports} disabled={reportsLoading}>
          <FontAwesomeIcon icon={['fas', 'shuffle']} className="me-1" />
          Rafraîchir
        </button>
      </div>

      {reportsLoading && (
        <div className="text-center py-4" style={{ color: 'var(--lumon-cyan)' }}>
          <Spinner animation="border" size="sm" className="me-2" />
          <span className="system-artifact" style={{ opacity: 1 }}>Chargement...</span>
        </div>
      )}

      {!reportsLoading && reports.length === 0 && (
        <div className="text-center py-4 system-artifact" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Aucun signalement {reportsFilter === 'pending' ? 'en attente' : 'traité'}
        </div>
      )}

      {!reportsLoading && reports.length > 0 && (
        <table className="terminal-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Question</th>
              <th style={{ width: '20%' }}>Raison</th>
              <th style={{ width: '12%' }}>Signalé par</th>
              <th style={{ width: '13%' }}>Date</th>
              <th style={{ width: '25%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => (
              <tr key={report.id}>
                <td style={{ fontSize: '0.8rem' }}>{report.questionText}</td>
                <td>
                  <span className="terminal-badge terminal-badge-amber" style={{ fontSize: '0.7rem' }}>
                    {REASON_LABELS[report.reason] || report.reason}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>{report.reportedBy}</td>
                <td style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  {report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td>
                  <div className="d-flex gap-1">
                    <button
                      className="terminal-btn terminal-btn-sm"
                      disabled={processingIds.has(report.id)}
                      onClick={() => openReportEditModal({ questionId: report.questionId, questionText: report.questionText })}
                      title="Modifier la question signalée"
                    >
                      <FontAwesomeIcon icon={['fas', 'pen']} />
                    </button>
                    {reportsFilter === 'pending' && (
                      <button
                        className="terminal-btn terminal-btn-success terminal-btn-sm"
                        disabled={processingIds.has(report.id)}
                        onClick={() => handleResolveReport(report.id)}
                        title="Marquer comme traité"
                      >
                        <FontAwesomeIcon icon={['fas', 'check']} className="me-1" />
                        Traité
                      </button>
                    )}
                    <button
                      className="terminal-btn terminal-btn-danger terminal-btn-sm"
                      disabled={processingIds.has(report.id)}
                      onClick={() => handleDeleteReport(report.id)}
                      title="Supprimer le signalement"
                    >
                      <FontAwesomeIcon icon={['fas', 'trash']} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal d'édition de question */}
      {editModal && (
        <Modal show onHide={() => { setEditModal(null); setEditingMainQuestionId(null); }} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingMainQuestionId ? 'Modifier la question (depuis signalement)' : 'Modifier la question'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {/* Type de question */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Type</strong></Form.Label>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`terminal-btn terminal-btn-sm flex-fill ${editForm.questionType === 'free_text' ? '' : 'terminal-btn-amber'}`}
                  onClick={() => setEditForm(f => ({ ...f, questionType: 'free_text' }))}
                  style={editForm.questionType === 'free_text' ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
                >
                  Réponse libre
                </button>
                <button
                  type="button"
                  className={`terminal-btn terminal-btn-sm flex-fill ${editForm.questionType === 'qcm' ? '' : 'terminal-btn-amber'}`}
                  onClick={() => setEditForm(f => ({ ...f, questionType: 'qcm' }))}
                  style={editForm.questionType === 'qcm' ? { backgroundColor: 'var(--lumon-cyan)', color: 'var(--lumon-void)' } : {}}
                >
                  QCM
                </button>
              </div>
            </Form.Group>

            {/* Question */}
            <Form.Group className="mb-3">
              <Form.Label>Question *</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={editForm.question}
                onChange={(e) => setEditForm(f => ({ ...f, question: e.target.value }))}
              />
            </Form.Group>

            {/* Réponse */}
            <Form.Group className="mb-3">
              <Form.Label>Réponse *</Form.Label>
              <Form.Control
                type="text"
                value={editForm.answer}
                onChange={(e) => setEditForm(f => ({ ...f, answer: e.target.value }))}
              />
            </Form.Group>

            {/* Alternatives (texte libre) */}
            {editForm.questionType === 'free_text' && (
              <Form.Group className="mb-3">
                <Form.Label>Réponses alternatives</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Séparées par des virgules"
                  value={editForm.alternativeAnswers}
                  onChange={(e) => setEditForm(f => ({ ...f, alternativeAnswers: e.target.value }))}
                />
              </Form.Group>
            )}

            {/* Options QCM */}
            {editForm.questionType === 'qcm' && (
              <div className="terminal-panel border-glow-cyan p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-display-tech" style={{ fontSize: '0.75rem', color: 'var(--lumon-cyan)' }}>Options QCM ({editForm.qcmOptions.length})</span>
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="terminal-btn terminal-btn-danger terminal-btn-sm"
                      disabled={editForm.qcmOptions.length <= QCM_MIN_OPTIONS}
                      onClick={() => {
                        const newOpts = editForm.qcmOptions.slice(0, -1);
                        const newIdxs = editForm.qcmCorrectIndexes.filter(i => i < newOpts.length);
                        if (newIdxs.length === 0) newIdxs.push(0);
                        setEditForm(f => ({
                          ...f,
                          qcmOptions: newOpts,
                          qcmCorrectIndex: newIdxs[0],
                          qcmCorrectIndexes: newIdxs,
                          answer: newIdxs.map(i => newOpts[i]).filter(Boolean).join(', '),
                        }));
                      }}
                    >
                      − Option
                    </button>
                    <button
                      type="button"
                      className="terminal-btn terminal-btn-success terminal-btn-sm"
                      disabled={editForm.qcmOptions.length >= QCM_MAX_OPTIONS}
                      onClick={() => setEditForm(f => ({ ...f, qcmOptions: [...f.qcmOptions, ''] }))}
                    >
                      + Option
                    </button>
                  </div>
                </div>
                {editForm.qcmOptions.map((opt, i) => {
                  const isCorrectEdit = editForm.qcmCorrectIndexes.includes(i);
                  return (
                    <div key={i} className="d-flex align-items-center gap-2 mb-2">
                      <Form.Check
                        type="checkbox"
                        checked={isCorrectEdit}
                        onChange={() => {
                          let newIdxs: number[];
                          if (isCorrectEdit) {
                            newIdxs = editForm.qcmCorrectIndexes.filter(idx => idx !== i);
                            if (newIdxs.length === 0) return;
                          } else {
                            newIdxs = [...editForm.qcmCorrectIndexes, i].sort();
                          }
                          setEditForm(f => ({
                            ...f,
                            qcmCorrectIndex: newIdxs[0],
                            qcmCorrectIndexes: newIdxs,
                            answer: newIdxs.map(idx => f.qcmOptions[idx]).filter(Boolean).join(', '),
                          }));
                        }}
                      />
                      <span style={{
                        fontWeight: 'bold',
                        color: isCorrectEdit ? '#4CAF50' : 'inherit',
                        minWidth: '25px',
                      }}>
                        {QCM_LABELS[i]})
                      </span>
                      <Form.Control
                        type="text"
                        size="sm"
                        placeholder={`Option ${QCM_LABELS[i]}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...editForm.qcmOptions];
                          newOpts[i] = e.target.value;
                          setEditForm(f => ({
                            ...f,
                            qcmOptions: newOpts,
                            answer: f.qcmCorrectIndexes.map(idx => idx === i ? e.target.value : newOpts[idx]).filter(Boolean).join(', '),
                          }));
                        }}
                        style={{
                          borderColor: isCorrectEdit ? '#4CAF50' : undefined,
                          borderWidth: isCorrectEdit ? '2px' : undefined,
                        }}
                      />
                      {isCorrectEdit && <span className="terminal-badge terminal-badge-success">Correcte</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Boîte */}
            <Form.Group className="mb-3">
              <Form.Label>Boîte</Form.Label>
              <Form.Select
                value={editForm.boxName}
                onChange={(e) => setEditForm(f => ({ ...f, boxName: e.target.value }))}
              >
                <option value="">Aucune (l'admin choisira)</option>
                {boxes.map(box => (
                  <option key={box.name} value={box.name}>{box.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <button className="terminal-btn terminal-btn-sm" onClick={() => { setEditModal(null); setEditingMainQuestionId(null); }}>Annuler</button>
            <button
              className="terminal-btn terminal-btn-success terminal-btn-sm"
              disabled={editSaving || !editForm.question.trim() || !editForm.answer.trim()}
              onClick={handleEditSave}
            >
              {editSaving && <Spinner animation="border" size="sm" className="me-2" />}
              <FontAwesomeIcon icon={['fas', 'save']} className="me-1" />
              Enregistrer
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default AdminDashboard;
