import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The whole system uses the 12-hour clock with AM/PM. Date and time formatting goes through
  // src/lib/datetime.ts, because toLocale*String and Intl.DateTimeFormat follow the device's 24-hour settings.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/datetime.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]",
          message: "Use formatDateTime / formatDate / formatTime from '@/lib/datetime' (12-hour clock, never 24-hour).",
        },
        {
          selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
          message: "Use the helpers in '@/lib/datetime' (12-hour clock, never 24-hour).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
