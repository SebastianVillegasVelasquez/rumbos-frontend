import type { Activity } from "../types/course-props.types.ts";

interface ActivityModalProps {
    activity: Activity | null;
    onClose: () => void;
}

export const ActivityModal = ({ activity, onClose }: ActivityModalProps) => {
    if (!activity) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={activity.name}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <h2 className="font-semibold text-gray-800">{activity.name}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        &#10005;
                    </button>
                </div>
                <iframe
                    // TODO: replace with real Moodle activity URL via backend
                    src="https://example.com"
                    title={activity.name}
                    className="w-full flex-1"
                />
            </div>
        </div>
    );
};
