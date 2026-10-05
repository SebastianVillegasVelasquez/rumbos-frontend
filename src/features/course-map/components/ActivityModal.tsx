import type { Activity } from "../data/types.ts";
import { isSafeActivityUrl } from "../activityOpener.ts";

interface ActivityModalProps {
    activity: Activity | null;
    onClose: () => void;
}

export const ActivityModal = ({ activity, onClose }: ActivityModalProps) => {
    if (!activity || !isSafeActivityUrl(activity.url)) return null;

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
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                    <h2 className="truncate font-semibold text-gray-800">{activity.name}</h2>
                    <div className="flex shrink-0 items-center gap-3">
                        <a
                            href={activity.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline"
                        >
                            Open in new tab
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                            &#10005;
                        </button>
                    </div>
                </div>
                <iframe src={activity.url} title={activity.name} className="w-full flex-1" />
            </div>
        </div>
    );
};
