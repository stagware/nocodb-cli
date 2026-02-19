import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ["**/dist/**", "**/node_modules/**", "**/*.js", "**/*.mjs"],
    },
    {
        files: ["packages/*/src/**/*.ts"],
        rules: {
            // Warn on unused variables (allow underscore-prefixed to be ignored)
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            // Allow explicit any sparingly — warn instead of error
            "@typescript-eslint/no-explicit-any": "warn",
            // Enforce consistent type imports
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                { prefer: "type-imports", fixStyle: "inline-type-imports" },
            ],
        },
    },
);
