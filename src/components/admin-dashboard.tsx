import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Form, Modal, Spinner, Table } from 'react-bootstrap';
import {
  apiApproveQuestion,
  apiGetPendingQuestions,
  apiRejectQuestion,
  PendingQuestion,
} from 'services/api-admin-service';
import { useQuestionsStore } from './store/questions-store';
import { useGlobalStore } from './store/global-store';

const QCM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

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

  // Actions en cours (pour désactiver les boutons)
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

  // Approuver directement (avec boîte par défaut)
  const handleQuickApprove = async (q: PendingQuestion) => {
    if (q.boxName) {
      await doApprove(q.id, q.boxName);
    } else {
      // Ouvrir la modal pour choisir la boîte
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

  const handleApproveAll = async () => {
    if (!window.confirm(`Approuver les ${pendingQuestions.length} questions en attente ?`)) return;
    const defaultBox = boxes.length > 0 ? boxes[0].name : 'Propositions';

    for (const q of pendingQuestions) {
      await doApprove(q.id, q.boxName || defaultBox);
    }
  };

  const pendingCount = useMemo(() =>
    pendingQuestions.length,
  [pendingQuestions]);

  return (
    <div className="p-3">
      <h2>
        <FontAwesomeIcon icon={['fas', 'list']} className="me-2" />
        Modération des questions
        {pendingCount > 0 && (
          <Badge bg="warning" className="ms-2">{pendingCount}</Badge>
        )}
      </h2>

      {successMessage && <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>{successMessage}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {/* Filtres */}
      <div className="d-flex gap-2 mb-3 align-items-center">
        <ButtonGroup size="sm">
          <Button
            variant={filterStatus === 'pending' ? 'warning' : 'outline-secondary'}
            onClick={() => setFilterStatus('pending')}
          >
            En attente
          </Button>
          <Button
            variant={filterStatus === 'approved' ? 'success' : 'outline-secondary'}
            onClick={() => setFilterStatus('approved')}
          >
            Approuvées
          </Button>
          <Button
            variant={filterStatus === 'rejected' ? 'danger' : 'outline-secondary'}
            onClick={() => setFilterStatus('rejected')}
          >
            Rejetées
          </Button>
        </ButtonGroup>

        <Button size="sm" variant="outline-primary" onClick={loadQuestions} disabled={loading}>
          <FontAwesomeIcon icon={['fas', 'shuffle']} className="me-1" />
          Rafraîchir
        </Button>

        {filterStatus === 'pending' && pendingCount > 0 && (
          <Button size="sm" variant="success" onClick={handleApproveAll}>
            <FontAwesomeIcon icon={['fas', 'check']} className="me-1" />
            Tout approuver
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" className="me-2" />
          Chargement...
        </div>
      )}

      {/* Liste vide */}
      {!loading && pendingQuestions.length === 0 && (
        <div className="text-center text-muted py-4">
          Aucune question {filterStatus === 'pending' ? 'en attente' : filterStatus === 'approved' ? 'approuvée' : 'rejetée'}
        </div>
      )}

      {/* Tableau des questions */}
      {!loading && pendingQuestions.length > 0 && (
        <Table striped hover responsive size="sm">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Type</th>
              <th style={{ width: '30%' }}>Question</th>
              <th style={{ width: '20%' }}>Réponse</th>
              <th style={{ width: '10%' }}>Boîte</th>
              <th style={{ width: '12%' }}>Proposé par</th>
              <th style={{ width: '10%' }}>Date</th>
              {filterStatus === 'pending' && <th style={{ width: '13%' }}>Actions</th>}
              {filterStatus !== 'pending' && <th style={{ width: '13%' }}>Modéré par</th>}
            </tr>
          </thead>
          <tbody>
            {pendingQuestions.map(q => (
              <tr key={q.id}>
                <td>
                  {q.questionType === 'qcm' ? (
                    <Badge bg="info">QCM</Badge>
                  ) : (
                    <Badge bg="secondary">Texte</Badge>
                  )}
                </td>
                <td>
                  <strong>{q.question}</strong>
                  {q.questionType === 'qcm' && q.qcmOptions && (
                    <div className="mt-1">
                      {q.qcmOptions.map((opt, i) => (
                        <span key={i} className="me-2">
                          <Badge bg={i === q.qcmCorrectIndex ? 'success' : 'outline-secondary'} className="me-1">
                            {QCM_LABELS[i]}
                          </Badge>
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span style={{ color: 'var(--bs-success)' }}>{q.answer}</span>
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
                {filterStatus === 'pending' && (
                  <td>
                    <div className="d-flex gap-1">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={processingIds.has(q.id)}
                        onClick={() => handleQuickApprove(q)}
                        title="Approuver"
                      >
                        <FontAwesomeIcon icon={['fas', 'check']} />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={processingIds.has(q.id)}
                        onClick={() => handleReject(q.id)}
                        title="Rejeter"
                      >
                        <FontAwesomeIcon icon={['fas', 'times']} />
                      </Button>
                    </div>
                  </td>
                )}
                {filterStatus !== 'pending' && (
                  <td className="text-muted small">{q.reviewedBy || '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
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
            <Button variant="secondary" onClick={() => setApproveModal(null)}>Annuler</Button>
            <Button
              variant="success"
              disabled={!approveBox}
              onClick={() => doApprove(approveModal.id, approveBox)}
            >
              <FontAwesomeIcon icon={['fas', 'check']} className="me-1" />
              Approuver
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default AdminDashboard;
