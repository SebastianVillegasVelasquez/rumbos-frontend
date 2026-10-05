import { useState, type FormEvent } from "react";
import { ApiError, isUnreachable } from "../data/client.ts";
import { useCreateCourseMap } from "../data/queries.ts";

export const DEFAULT_MAP_IMAGE_URL = "/fondo.webp";

interface CreateMapPanelProps {
    onCreated: (courseMapId: string) => void;
}

const describeError = (error: unknown) => {
    if (isUnreachable(error)) return "Cannot reach the server. Check that the backend is running.";
    if (error instanceof ApiError && error.status === 409) return "A map already exists for this course.";
    return "Could not create the map. Try again.";
};

export const CreateMapPanel = ({ onCreated }: CreateMapPanelProps) => {
    const [courseId, setCourseId] = useState("");
    const createMap = useCreateCourseMap();

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const moodleCourseId = Number(courseId);
        if (!Number.isInteger(moodleCourseId) || moodleCourseId <= 0) return;
        createMap.mutate(
            { moodleCourseId, imageUrl: DEFAULT_MAP_IMAGE_URL },
            { onSuccess: (map) => onCreated(map.id) }
        );
    };

    return (
        <div className="flex h-full items-center justify-center">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
                <div>
                    <h2 className="font-semibold text-gray-800">Create a course map</h2>
                    <p className="mt-1 text-xs text-gray-400">Uses the default background image.</p>
                </div>
                <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Moodle course id</span>
                    <input
                        type="number"
                        min={1}
                        step={1}
                        required
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </label>
                {createMap.isError && <p className="text-sm text-red-600">{describeError(createMap.error)}</p>}
                <button
                    type="submit"
                    disabled={createMap.isPending}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                    {createMap.isPending ? "Creating..." : "Create map"}
                </button>
            </form>
        </div>
    );
};
