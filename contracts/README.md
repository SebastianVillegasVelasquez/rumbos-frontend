# contracts

`openapi.json` is a copy of the backend's OpenAPI export (`rumbos-backend/openapi.json`). The
trainer contract test (`src/features/trainer/catalogOpenapi.test.ts`) validates the real catalog
fixture against it, and fails when the file is missing.

To update it, copy the new export over this one and run `pnpm test`:

    cp ../rumbos-backend/openapi.json contracts/openapi.json

A test that fails after the copy is a contract change to deal with, not noise.
