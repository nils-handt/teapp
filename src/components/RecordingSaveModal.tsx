import { useEffect, useState } from 'react';
import { zenInputClass } from '../styles/zen';
import AppButton from './ui/AppButton';
import ModalFrame from './ui/ModalFrame';

type RecordingSaveModalProps = {
  isOpen: boolean;
  initialSessionName: string;
  onCancel: () => void;
  onSave: (sessionName: string, notes: string) => void;
};

const RecordingSaveModal = ({
  isOpen,
  initialSessionName,
  onCancel,
  onSave,
}: RecordingSaveModalProps) => {
  const [sessionName, setSessionName] = useState(initialSessionName);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSessionName(initialSessionName);
      setNotes('');
    }
  }, [initialSessionName, isOpen]);

  return (
    <ModalFrame
      isOpen={isOpen}
      title="Save Recording"
      actions={(
        <>
          <AppButton variant="soft" onClick={onCancel}>Cancel</AppButton>
          <AppButton onClick={() => onSave(sessionName, notes)}>Save</AppButton>
        </>
      )}
    >
      <div className="grid gap-3 pb-4">
        <label className="grid gap-1">
          <span className="text-[0.76rem] uppercase text-zen-muted">Session Name</span>
          <input
            autoFocus
            aria-label="Session Name"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            className={zenInputClass}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[0.76rem] uppercase text-zen-muted">Notes (optional)</span>
          <textarea
            aria-label="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={zenInputClass}
          />
        </label>
      </div>
    </ModalFrame>
  );
};

export default RecordingSaveModal;
