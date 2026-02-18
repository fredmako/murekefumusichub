export const ADMIN_EMAIL = "fredrickmakori102@gmail.com";

export const isAdmin = (email?: string | null) => {
  return email === ADMIN_EMAIL;
};
