export const isHostedPreview = () => !["localhost", "127.0.0.1", "[::1]"].includes(globalThis.location?.hostname);
export const releaseLinks = {
  repository: "https://github.com/JY2046/showflow",
  guide: "/reviewer-guide.html",
  sample: "/samples/ShowFlow_English_Sample.pptx",
};
