import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5174,
    // Disable caching headers during development
    middlewareMode: false,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Ensure hash-based filenames for cache busting in production
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
        manualChunks: {
          // Core React runtime — changes rarely
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI framework — changes rarely
          'vendor-ui': ['framer-motion', 'lucide-react', 'sonner', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          // Data layer
          'vendor-data': ['@tanstack/react-query', '@supabase/supabase-js'],
          // Rich-text editor (large)
          'vendor-tiptap': [
            '@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm',
            '@tiptap/extension-placeholder', '@tiptap/extension-highlight',
            '@tiptap/extension-typography',
          ],
          // Markdown rendering
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex', 'rehype-highlight'],
          // Charts / visualisation
          'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
}));
