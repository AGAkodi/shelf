# DOCX/PDF chapter import report

7 November 2026. Follow-up to Phase 12, requested by the user. Scope: let administrators upload chapters as DOCX or PDF without changing protected reading.

1. **Implemented.**
   - **Conversion.** The admin chapter upload now accepts DOCX and PDF as well as chapter-text-v1 JSON. A DOCX or PDF is converted in the administrator's browser into a plain-text chapter-text-v1 chapter, which then follows the existing upload, private storage, digest, delivery and reader path. Server authorization, storage policies and the reader are unchanged.
   - **Preview.** The admin enters a chapter number and title. The next chapter number and a title from the file name are filled in. Before upload, the admin sees the paragraph count, the opening text and any adjustments.
   - **What the conversion keeps.** Only text survives, so no markup, links, images or embedded content reach storage or readers:
     - DOCX keeps paragraph text and turns tabs and line breaks into spaces. It drops deleted tracked changes and field codes.
     - PDF uses pdf.js text extraction. Paragraphs come from line spacing and page breaks, and hyphenated line ends are rejoined.
     - Angle brackets become ‹ ›, as the delivery handler rejects `<` and `>`.
     - Paragraphs over 20,000 characters are split at sentence boundaries.
     - A chapter is limited to 1,000 paragraphs and 1 MiB.
   - **Clear refusals.** The import refuses, with a clear message:
     - scanned PDFs with no text, damaged or password-protected PDFs, and PDFs over 500 pages;
     - files that are not DOCX, or are damaged;
     - files over 20 MiB;
     - DOCX entries that expand past their declared size, to guard against zip bombs.
2. **Files created.**
   - src/features/admin/chapterImport.ts and ChapterUpload.tsx.
   - tests/fixtures/documents.mjs, a test-only DOCX/PDF builder.
   - tests/unit/chapter-import.test.ts and tests/database/chapter-import-ui.test.mjs.
   - This report.
3. **Files changed.** src/features/admin/CatalogueEditor.tsx, package.json and package-lock.json.
4. **Dependencies and database.**
   - Added pdfjs-dist 6.4.299, pinned exactly. It is Mozilla's Apache-2.0 library, released 3 October 2026, with no dependencies. The newer 6.5.438 was skipped because it was only 6 days old. npm audit reports 0 vulnerabilities.
   - The PDF library (430 kB) and its worker (1.26 MB) load only when an admin imports a PDF. The main reader bundle does not include them. DOCX uses the browser's built-in DecompressionStream and DOMParser, so it needs no library.
   - No database or storage changes.
5. **Tests performed.**
   - **Unit tests (12).** DOCX: deflated and stored archives, tabs, tracked deletions, field codes, table cells, markup in text, invalid archives, malformed XML, and the inflate-size guard. Also: PDF line and paragraph grouping (including short pages), hyphen rejoining, whitespace and control characters, oversize paragraph splitting, paragraph and size limits, title and number validation, and file-kind detection.
   - **Browser test (Chrome, 390 px, real local Supabase):**
     - Uploaded a real DOCX as chapter 1 and a real two-page PDF as chapter 2.
     - Read both back from private storage. The exact text, SHA-256 and size matched, and the chapters meet the delivery handler's rules.
     - Readers could not download the objects.
     - A blank PDF and a non-DOCX file were refused, with the upload disabled.
     - No console errors and no horizontal overflow.
   - The existing JSON upload path is still exercised by the admin journey test.
   - **Full regression, all passing:**
     - Import browser test.
     - Admin/applicant journey.
     - Unit: 57.
     - pgTAP: 91. Auth/RLS/Storage API: 13.
     - Payment database/API: 12.
     - Verifier: 25.
     - Catalogue browser: 10. Route/provider browser: 30.
     - Deno function checks.
6. **Build/type checks.** ESLint, TypeScript and the production build passed.
7. **Problems discovered.**
   - jsdom lacks `Blob.stream()`.
   - TypeScript 6 stream typing needed a plain ArrayBuffer.
   - pdf.js 6 removed `PDFDocumentProxy.destroy` and `isEvalSupported`.
   - A median line gap merged paragraphs on short PDF pages.
8. **Problems fixed.** All four: a ReadableStream source, an explicit buffer copy, loading-task cleanup with no unsupported options, and a lower-quartile line gap.
9. **Limitations.**
   - **Lossy PDF conversion.** Columns, footnotes, headers and footers can mix into the text.
   - **Text only.** Images, tables and formatting are not kept, and scanned PDFs need OCR, which is not included.
   - **One chapter per upload.** Multi-chapter documents need one upload per chapter.
   - **Phone uploads untested.** Phone uploads still depend on the host file picker and were not re-tested on the user's Android device.
   - **Original file not kept.** The administrator should keep their source file.
10. **Acceptance.** The automated checks above passed. User confirmation with a real DOCX/PDF of their own is still outstanding.
