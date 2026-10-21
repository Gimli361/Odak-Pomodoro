import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Tek dosyalık build: dist/index.html sunucusuz (çift tıklayarak) açılabilir.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
