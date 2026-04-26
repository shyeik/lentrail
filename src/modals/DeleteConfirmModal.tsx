export default function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div className="w-full max-w-sm bg-black rounded-sm shadow-xl border border-[#403103]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#000000]">
          <h2 className="text-sm font-bold text-[#ffffff]">
            Delete Confirmation
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-sm text-center text-[#ffffff]">
          Are you sure you want to delete this client?
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-between gap-2 bg-[#000000]">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-2xl bg-[#f5c842] text-[#2b2a2a] hover:bg-[#cca42c]"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="bg-[#e53935] text-white px-4 py-2 text-sm rounded-2xl hover:bg-red-700"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}
