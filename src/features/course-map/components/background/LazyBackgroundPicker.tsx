import { Suspense, lazy, type ComponentProps } from "react";

// The picker (library grid, uploader, preview) is only needed once someone
// opens it, so it stays out of the main bundle.
const BackgroundPicker = lazy(() => import("./BackgroundPicker.tsx").then((m) => ({ default: m.BackgroundPicker })));

export const LazyBackgroundPicker = (props: ComponentProps<typeof BackgroundPicker>) =>
    props.open ? (
        <Suspense fallback={null}>
            <BackgroundPicker {...props} />
        </Suspense>
    ) : null;
