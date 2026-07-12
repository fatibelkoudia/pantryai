export interface User {
  id: string;
  email: string;
  name: string | null;
  // one of the preset avatar ids from theme/avatars.ts, or null for the default
  avatarId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Fields the user can change from the profile page. Email changes apply right
// away (we have no mail server, so there is no confirmation email step).
export interface UpdateProfileDto {
  name?: string;
  email?: string;
  avatarId?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
