import { mockCourseMapApi } from "./mockCourseMapApi.ts";
import { realCourseMapApi, type CourseMapApi } from "./courseMapApi.ts";

export const courseMapApi: CourseMapApi =
    import.meta.env.VITE_USE_MOCK_API === "true" ? mockCourseMapApi : realCourseMapApi;
