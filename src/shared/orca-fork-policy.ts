/** Permanent safety policy for this independent Orca fork. Environment/profile values cannot enable these paths. */
export const ORCA_FORK_POLICY = Object.freeze({
  vendorServices: false,
  executablePlugins: false,
  cloudRecipes: false,
  browserCredentialImport: false
})
