import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import stylistic from "@stylistic/eslint-plugin";

export default [
  js.configs.recommended,
  {
    plugins: {
      "@stylistic": stylistic
    },
    rules: {
      // Enforces exactly 2 spaces of indentation for every nested block
      "@stylistic/indent": ["error", 2], 
      
      // Ensures the space after the 'if' keyword is maintained
      "@stylistic/keyword-spacing": ["error", { "before": true, "after": true }],
      
      "@stylistic/space-before-blocks": ["error", "always"]
    }
  },
  eslintConfigPrettier
];
