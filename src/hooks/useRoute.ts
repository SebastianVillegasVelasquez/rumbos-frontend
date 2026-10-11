import { useCallback, useEffect, useState } from "react";

// None of the query params below → home. ?map=<uuid> → open that map.
// ?course=<moodleCourseId> → the course's levels: opens the single level
// directly, or the carousel with several (or &entry=1 to force the carousel
// even with one level). This is also the future entry point when launched
// from Moodle.
export type Route =
    | { name: "home" }
    | { name: "map"; mapId: string }
    | { name: "course"; moodleCourseId: number; forceEntry: boolean };

const parseRoute = (): Route => {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get("map");
    if (mapId) return { name: "map", mapId };
    const courseId = params.get("course");
    const moodleCourseId = courseId ? Number(courseId) : NaN;
    if (Number.isInteger(moodleCourseId) && moodleCourseId > 0) {
        return { name: "course", moodleCourseId, forceEntry: params.get("entry") === "1" };
    }
    return { name: "home" };
};

// A tiny history.pushState/popstate wrapper — no router dependency. Browser
// back/forward works because navigation always goes through pushState here.
export const useRoute = () => {
    const [route, setRoute] = useState<Route>(parseRoute);

    useEffect(() => {
        const onPopState = () => setRoute(parseRoute());
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    const navigate = useCallback((next: Route) => {
        const url = new URL(window.location.href);
        const view = url.searchParams.get("view");
        url.search = "";
        if (view) url.searchParams.set("view", view);
        if (next.name === "map") url.searchParams.set("map", next.mapId);
        else if (next.name === "course") {
            url.searchParams.set("course", String(next.moodleCourseId));
            if (next.forceEntry) url.searchParams.set("entry", "1");
        }
        window.history.pushState(null, "", url);
        setRoute(next);
    }, []);

    return [route, navigate] as const;
};
