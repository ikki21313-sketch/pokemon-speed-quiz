import { defineConfig } from "vite";

// GitHub Pages (プロジェクトページ) は /<repo>/ 配下で配信されるため base が必須
export default defineConfig({
  base: "/pokemon-speed-quiz/",
});
