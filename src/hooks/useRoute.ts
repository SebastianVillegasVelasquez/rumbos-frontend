import { useCallback, useEffect, useState } from "react";

// None of the query params below → home. ?map=<uuid> → open that map.
// ?course=<moodleCourseId> → look up (or offer to create) the map for that
// Moodle course; this is the future entry point when launched from Moodle.
export type Route = { name: "home" } | { name: "map"; mapId: string } | { name: "course"; moodleCourseId: number };

const parseRoute = (): Route => {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get("map");
    if (mapId) return { name: "map", mapId };
    const courseId = params.get("course");
    const moodleCourseId = courseId ? Number(courseId) : NaN;
    if (Number.isInteger(moodleCourseId) && moodleCourseId > 0) return { name: "course", moodleCourseId };
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
        url.search = "";
        if (next.name === "map") url.searchParams.set("map", next.mapId);
        else if (next.name === "course") url.searchParams.set("course", String(next.moodleCourseId));
        window.history.pushState(null, "", url);
        setRoute(next);
    }, []);

    return [route, navigate] as const;
};
