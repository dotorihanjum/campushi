import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const apiProxy = {
  target: process.env.API_TARGET || `http://127.0.0.1:${process.env.API_PORT || 8000}`,
  // 인증의 Origin 검사·콜백 주소에는 브라우저에서 보낸 Host가 필요하다.
  changeOrigin: false,
};
export default defineConfig({
  plugins: [tailwindcss()],
  server: { host: "127.0.0.1", proxy: { "/api": apiProxy } },
  preview: { host: "127.0.0.1", proxy: { "/api": apiProxy } },
});
