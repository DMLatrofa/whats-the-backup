import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

import { resetAttachmentResourceCache } from "@/lib/attachment-cache";

afterEach(() => {
  resetAttachmentResourceCache();
});
