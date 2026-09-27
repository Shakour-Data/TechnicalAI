import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  languageOptions: {
    parserOptions: {
      projectService: true
    }
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_" 
      }
    ],
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "error",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/strict-boolean-expressions": "warn",
    
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/purity": "warn",
    "react/no-unescaped-entities": "error",
    "react/display-name": "warn",
    
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "warn",
    
    "prefer-const": "error",
    "no-unused-vars": "error",
    "no-console": [
      "warn",
      { 
        "allow": ["warn", "error", "info"] 
      }
    ],
    "no-debugger": "warn",
    "no-empty": "error",
    "no-irregular-whitespace": "error",
    "no-case-declarations": "error",
    "no-fallthrough": "error",
    "no-mixed-spaces-and-tabs": "error",
    "no-redeclare": "error",
    "no-undef": "error",
    "no-unreachable": "error",
    "no-useless-escape": "error",
    "no-unsafe-negation": "error",
    "no-implicit-globals": "error",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "src/lib/ta-engine.ts", "src/lib/ml-engine.ts", ".kilo/**", ".kilo/worktrees/**", "commitlint.config.js", "eslint.config.mjs", "postcss.config.mjs", "scripts/prewarm-indices.mjs", "scripts/prefetch-all-indices.ts"]
}];

export default eslintConfig;