export const isFpsDebugEnabled = () =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "fps";
