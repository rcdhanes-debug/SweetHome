import BottomSheet from './BottomSheet';

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger, loading }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title || 'Are you sure?'}
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" /> Please wait…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      }
    >
      <p className="confirm-text">{message}</p>
    </BottomSheet>
  );
}
