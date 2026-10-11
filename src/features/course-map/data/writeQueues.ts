import { isPreconditionRequired, isVersionConflict } from "./client.ts";
import { WriteQueue, type ConflictEvent } from "./writeQueue.ts";

export interface MapConflictEvent extends ConflictEvent {
    mapId: string;
}

type ConflictListener = (event: MapConflictEvent) => void;
type IdleListener = (mapId: string, wrote: boolean) => void;

const conflictListeners = new Set<ConflictListener>();
const idleListeners = new Set<IdleListener>();

// The conflict UI (WriteSyncHost) subscribes here; the queue itself stays free
// of React.
export const subscribeConflicts = (listener: ConflictListener) => {
    conflictListeners.add(listener);
    return () => void conflictListeners.delete(listener);
};

export const subscribeIdle = (listener: IdleListener) => {
    idleListeners.add(listener);
    return () => void idleListeners.delete(listener);
};

const queues = new Map<string, WriteQueue>();

// One FIFO queue per map, shared by every draft-content write of that map.
export const getWriteQueue = (mapId: string): WriteQueue => {
    let queue = queues.get(mapId);
    if (!queue) {
        queue = new WriteQueue({
            isConflict: isVersionConflict,
            onConflict: (event) => {
                if (conflictListeners.size === 0) return false;
                conflictListeners.forEach((listener) => listener({ ...event, mapId }));
                return true;
            },
            onIdle: (wrote) => idleListeners.forEach((listener) => listener(mapId, wrote)),
            onFailure: (error) => {
                // A 428 means our own client forgot If-Match: a bug, never user error.
                if (isPreconditionRequired(error)) {
                    console.error("[rumbos] A guarded write was sent without If-Match (428). This is a client bug.", error);
                }
            },
        });
        queues.set(mapId, queue);
    }
    return queue;
};
