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
import { categoryNames, TrivialCategory, useQuestionsStore } from './store/questions-store';
import { useGlobalStore } from './store/global-store';

const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QCM_MIN_OPTIONS = 2;
const QCM_MAX_OPTIONS = 6;

const AdminDashboard = () => {
  const setSubtitle = useGlobalStore((state) => state.setSubtitle);
  const boxes = useQuestionsStore((state) => state.boxes);

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
  const [editForm, setEditForm] = useState({
    question: '',
    answer: '',
    alternativeAnswers: '',
    category: 0 as TrivialCategory,
    boxName: '',
    questionType: 'free_text' as string,
    qcmOptions: ['', ''] as string[],
    qcmCorrectIndex: 0,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Actions en cours
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

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
      category: q.category as TrivialCategory,
      boxName: q.boxName || '',
      questionType: q.questionType || 'free_text',
      qcmOptions: q.qcmOptions && q.qcmOptions.length >= 2 ? [...q.qcmOptions] : ['', ''],
      qcmCorrectIndex: q.qcmCorrectIndex ?? 0,
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
        category: editForm.category,
        boxName: editForm.boxName || undefined,
        questionType: editForm.questionType,
      };

      if (isQcm) {
        updates.qcmOptions = editForm.qcmOptions.filter(o => o.trim());
        updates.qcmCorrectIndex = editForm.qcmCorrectIndex;
        updates.answer = editForm.qcmOptions[editForm.qcmCorrectIndex] || editForm.answer;
      }

      await apiEditPendingQuestion(editModal.id, updates);

      // Mettre à jour localement
      setPendingQuestions(prev => prev.map(q =>
        q.id === editModal.id ? { ...q, ...updates } : q
      ));

      showSuccess('Question modifiée');
      setEditModal(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification');
    } finally {
      setEditSaving(false);
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
                      {q.qcmOptions.map((opt, i) => (
                        <span key={i} className="me-2" style={{ fontSize: '0.8rem' }}>
                          <span className={`terminal-badge ${i === q.qcmCorrectIndex ? 'terminal-badge-success' : ''}`} style={{ marginRight: '4px' }}>
                            {QCM_LABELS[i]}
                          </span>
                          {opt}
                        </span>
                      ))}
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

      {/* Modal d'édition de question */}
      {editModal && (
        <Modal show onHide={() => setEditModal(null)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Modifier la question</Modal.Title>
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
                        const newIdx = editForm.qcmCorrectIndex >= newOpts.length ? 0 : editForm.qcmCorrectIndex;
                        setEditForm(f => ({ ...f, qcmOptions: newOpts, qcmCorrectIndex: newIdx }));
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
                {editForm.qcmOptions.map((opt, i) => (
                  <div key={i} className="d-flex align-items-center gap-2 mb-2">
                    <Form.Check
                      type="radio"
                      name="editQcmCorrect"
                      checked={editForm.qcmCorrectIndex === i}
                      onChange={() => {
                        setEditForm(f => ({
                          ...f,
                          qcmCorrectIndex: i,
                          answer: f.qcmOptions[i] || f.answer,
                        }));
                      }}
                    />
                    <span style={{
                      fontWeight: 'bold',
                      color: editForm.qcmCorrectIndex === i ? '#4CAF50' : 'inherit',
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
                          answer: f.qcmCorrectIndex === i ? e.target.value : f.answer,
                        }));
                      }}
                      style={{
                        borderColor: editForm.qcmCorrectIndex === i ? '#4CAF50' : undefined,
                        borderWidth: editForm.qcmCorrectIndex === i ? '2px' : undefined,
                      }}
                    />
                    {editForm.qcmCorrectIndex === i && <span className="terminal-badge terminal-badge-success">Correcte</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Catégorie */}
            <Form.Group className="mb-3">
              <Form.Label>Catégorie</Form.Label>
              <Form.Select
                value={editForm.category}
                onChange={(e) => setEditForm(f => ({ ...f, category: parseInt(e.target.value) as TrivialCategory }))}
              >
                {Object.entries(categoryNames).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </Form.Select>
            </Form.Group>

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
            <button className="terminal-btn terminal-btn-sm" onClick={() => setEditModal(null)}>Annuler</button>
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
