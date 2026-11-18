/** Static export: the FastAPI backend serves ./out on the same origin. */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
