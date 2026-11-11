module.exports = {
  appId: "org.dcsmcraft.desktop",
  productName: "DCSMCRAFT",
  electronVersion: "45.3.0",
  artifactName: "DCSMCRAFT-${version}-Portable.${ext}",
  directories: { output: "dist/desktop-app" },
  win: {
    target: [{ target: "portable", arch: ["x64"] }],
    signAndEditExecutable: false,
  },
  portable: { requestExecutionLevel: "user" },
  npmRebuild: false,
  asar: true,
};
