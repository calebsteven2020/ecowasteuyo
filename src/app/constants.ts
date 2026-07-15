// No Play Store listing yet — this links straight to the signed release APK.
// Same Supabase project as the image assets used around the site, just a
// separate public bucket ("downloads") so the storage dashboard stays tidy.
// Upload the signed app-release.apk there (Supabase dashboard → Storage →
// New bucket → toggle "Public bucket" on → upload the file) and this URL
// just works. See Home.tsx's "GET THE APP" section for the full how-to.
export const APK_DOWNLOAD_URL = "https://xhsqygawsgsnpfwemczi.supabase.co/storage/v1/object/public/downloads/ecowaste-uyo.apk";
